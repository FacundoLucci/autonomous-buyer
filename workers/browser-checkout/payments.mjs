import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Link, { getDuplicateSpendRequest } from "@stripe/link-sdk";
import { fillPaymentCard } from "./payments-browser.mjs";

const runFile = promisify(execFile);
const cli = fileURLToPath(new URL("./node_modules/@stripe/link-cli/dist/cli.js", import.meta.url));
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const text = (value, max = 500) =>
  typeof value === "string" && value.trim().length <= max && value.trim();
const SAFE_STATUSES = new Set([
  "created",
  "pending_approval",
  "approved",
  "denied",
  "expired",
  "requires_action",
  "succeeded",
  "failed",
  "canceled",
]);

export function paymentScope(value) {
  if (!text(value?.organizationId, 200) || !text(value?.paymentOwnerId, 200))
    throw Error("Connect a payment wallet as the purchasing owner first.");
  return { organizationId: value.organizationId, paymentOwnerId: value.paymentOwnerId };
}

function linkUrl(value) {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !(url.hostname === "link.com" || url.hostname.endsWith(".link.com"))
  )
    throw Error("Link returned an unsupported approval address.");
  return url.href;
}

export function normalizePaymentQuote(job, quote) {
  const scope = paymentScope(job.order);
  const merchant = new URL(quote?.merchantUrl || job.order.buyUrl);
  const orderMerchant = new URL(job.order.buyUrl);
  if (
    merchant.protocol !== "https:" ||
    merchant.username ||
    merchant.password ||
    merchant.origin !== orderMerchant.origin ||
    !text(job.order._id, 200) ||
    !Number.isSafeInteger(quote?.amountCents) ||
    quote.amountCents <= 0 ||
    quote.amountCents > 50000 ||
    String(quote.currency).toUpperCase() !== "USD"
  )
    throw Error(
      "Link currently supports US wallets and purchases up to $500. Check the displayed checkout total.",
    );
  const normalized = {
    ...scope,
    orderId: job.order._id,
    sku: job.order.sku,
    quantity: job.order.quantity,
    unit: job.order.unit,
    shipTo: job.order.shipTo,
    merchantOrigin: merchant.origin,
    amountCents: quote.amountCents,
    currency: "USD",
  };
  return {
    ...normalized,
    quoteHash: hash(normalized),
    merchantName: String(quote.merchantName || merchant.hostname).slice(0, 150),
  };
}

/** Provider auth and credentials stay in this broker; callers only receive allowlisted metadata. */
export function createLinkPaymentBroker({
  dir,
  encryptionKey,
  testMode = process.env.LINK_PAYMENT_MODE !== "live",
  clientFactory = (options) => new Link(options),
  runCli = executeCli,
} = {}) {
  if (!dir || !Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32)
    throw Error("Payment wallet encryption must be configured.");
  const root = join(dir, "payment-wallets");
  const locks = new Map();
  const mode = testMode ? "test" : "live";
  const basics = { provider: "stripe_link", mode, limitCents: 50000, currency: "USD" };

  async function locked(key, operation) {
    const prior = locks.get(key) || Promise.resolve();
    let release;
    const next = new Promise((resolve) => {
      release = resolve;
    });
    locks.set(key, next);
    await prior;
    try {
      return await operation();
    } finally {
      release();
      if (locks.get(key) === next) locks.delete(key);
    }
  }
  async function read(name) {
    try {
      const data = await readFile(join(root, name));
      const d = createDecipheriv("aes-256-gcm", encryptionKey, data.subarray(0, 12));
      d.setAAD(Buffer.from(name));
      d.setAuthTag(data.subarray(12, 28));
      return JSON.parse(Buffer.concat([d.update(data.subarray(28)), d.final()]).toString());
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw Error("Payment wallet cannot be read. Reconnect the wallet before buying.");
    }
  }
  async function write(name, value) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", encryptionKey, iv);
    c.setAAD(Buffer.from(name));
    const encrypted = Buffer.concat([c.update(JSON.stringify(value)), c.final()]);
    const target = join(root, name),
      temp = `${target}.${randomBytes(8).toString("hex")}`;
    await writeFile(temp, Buffer.concat([iv, c.getAuthTag(), encrypted]), {
      mode: 0o600,
      flag: "wx",
    });
    await rename(temp, target);
  }
  const authName = (scope) => `${hash(paymentScope(scope))}.auth`;
  const spendName = (quote) => `${quote.quoteHash}.${mode}.spend`;

  async function authCommand(scope, args) {
    const name = authName(scope);
    return locked(name, async () => {
      const temp = await mkdtemp(join(tmpdir(), "buy-hard-link-"));
      const path = join(temp, "auth.json");
      try {
        const saved = await read(name);
        if (saved) await writeFile(path, JSON.stringify(saved), { mode: 0o600, flag: "wx" });
        // CLI stdout can contain token prefixes. Never return or log stdout/stderr.
        await runCli(args, path);
        let state;
        try {
          state = JSON.parse(await readFile(path, "utf8"));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          state = {};
        }
        await write(name, state);
        return state;
      } catch {
        throw Error("Link could not complete the wallet connection. Try connecting again.");
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    });
  }
  function authView(state) {
    const pending = state?.pendingDeviceAuth;
    return {
      ...basics,
      connected: Boolean(state?.auth?.access_token),
      ...(pending && pending.expires_at > Date.now()
        ? {
            url: linkUrl(pending.verification_url),
            code: pending.phrase,
            expiresAt: pending.expires_at,
          }
        : {}),
    };
  }
  async function client(scope) {
    let state = await read(authName(scope));
    if (!state?.auth?.access_token) throw Error("Connect your Link wallet to continue.");
    if (!Number.isFinite(state.auth.expires_at) || state.auth.expires_at < Date.now() + 60000)
      state = await authCommand(scope, ["auth", "login", "--client-name", "BUY HARD"]);
    if (!state?.auth?.access_token) throw Error("Reconnect your Link wallet to continue.");
    return clientFactory({
      accessToken: state.auth.access_token,
      fetch: (url, options) =>
        fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(20000) }),
      verbose: false,
    });
  }
  function safePayment(record, response) {
    const action = response.status_details?.requires_action?.next_action;
    return {
      provider: "stripe_link",
      mode,
      requestId: response.id,
      quoteHash: record.quote.quoteHash,
      amountCents: record.quote.amountCents,
      currency: record.quote.currency,
      merchantOrigin: record.quote.merchantOrigin,
      status: SAFE_STATUSES.has(response.status) ? response.status : "needs_help",
      ...(record.url ? { url: linkUrl(record.url) } : {}),
      ...(action
        ? {
            actionUrl: linkUrl(action.action_url),
            resolution: action.resolution,
            action: action.type,
          }
        : {}),
    };
  }
  async function recordFor(job) {
    const payment = job.payment;
    if (!payment || !/^[a-f0-9]{64}$/.test(payment.quoteHash) || payment.mode !== mode)
      throw Error("Prepare this payment again before continuing.");
    const record = await read(`${payment.quoteHash}.${mode}.spend`);
    if (!record || record.requestId !== payment.requestId)
      throw Error("This payment does not belong to this checkout.");
    const check = normalizePaymentQuote(job, {
      amountCents: record.quote.amountCents,
      currency: record.quote.currency,
      merchantUrl: record.quote.merchantOrigin,
    });
    if (check.quoteHash !== record.quote.quoteHash)
      throw Error("The checkout changed. Review a new payment request.");
    return record;
  }

  return {
    async connect(scope) {
      return authView(await authCommand(scope, ["auth", "login", "--client-name", "BUY HARD"]));
    },
    async connection(scope) {
      const saved = await read(authName(scope));
      if (!saved) return { ...basics, connected: false };
      let state =
        saved.pendingDeviceAuth && saved.pendingDeviceAuth.expires_at > Date.now()
          ? await authCommand(scope, ["auth", "status", "--max-attempts", "1"])
          : saved;
      if (
        state.auth &&
        (!Number.isFinite(state.auth.expires_at) || state.auth.expires_at < Date.now() + 60000)
      )
        state = await authCommand(scope, ["auth", "login", "--client-name", "BUY HARD"]);
      return authView(state);
    },
    async disconnect(scope) {
      await authCommand(scope, ["auth", "logout"]);
      return { ...basics, connected: false };
    },
    async requestPayment(job, suppliedQuote) {
      const quote = normalizePaymentQuote(job, suppliedQuote);
      return locked(spendName(quote), async () => {
        const link = await client(quote);
        let record = await read(spendName(quote));
        let request;
        if (record?.requestId) request = await link.spendRequests.retrieve(record.requestId);
        else {
          const params = {
            idempotency_key: `buy-hard-${quote.quoteHash}-${mode}-${record?.generation || 0}`,
            credential_type: "card",
            amount: quote.amountCents,
            currency: "usd",
            merchant_name: quote.merchantName,
            merchant_url: quote.merchantOrigin,
            context: `BUY HARD is preparing the user-requested purchase of ${job.order.quantity} ${job.order.unit} of ${job.order.sku} from ${quote.merchantName}. The displayed checkout total is ${(quote.amountCents / 100).toFixed(2)} USD. Final order submission still requires purchase approval in BUY HARD.`,
            test: testMode,
            metadata: { buy_hard_order: quote.orderId, buy_hard_quote: quote.quoteHash },
          };
          try {
            request = await link.spendRequests.create(params);
          } catch (error) {
            request = getDuplicateSpendRequest(error);
            if (!request)
              throw Error(
                "Link could not create this payment request. Check your wallet and limits.",
              );
          }
          record = {
            quote,
            generation: record?.generation || 0,
            requestId: request.id,
            createdAt: Date.now(),
          };
          await write(spendName(quote), record);
        }
        if (!request)
          throw Error(
            "Link could not find this payment request. Check the wallet before retrying.",
          );
        if (request.status === "created") {
          const approval = await link.spendRequests.requestApproval(request.id);
          record.url = linkUrl(approval.approval_url);
          await write(spendName(quote), record);
          request = { ...request, status: "pending_approval" };
        }
        const terminal = ["denied", "expired", "canceled", "succeeded", "failed"].includes(
          request.status,
        );
        return {
          state: terminal ? "needs_help" : "needs_payment",
          payment: safePayment(record, request),
          error: terminal
            ? `The Link request is ${request.status}. Check its status before requesting another payment.`
            : request.status === "approved"
              ? "Payment approved. Continue this checkout."
              : "Approve the exact checkout total in Link, then continue here.",
        };
      });
    },
    async status(job) {
      const record = await recordFor(job),
        link = await client(record.quote);
      const request = await link.spendRequests.retrieve(record.requestId);
      if (!request) throw Error("Link could not find this payment request.");
      return safePayment(record, request);
    },
    async cancelPayment(job) {
      if (job.submitStarted)
        throw Error("Check the merchant order history before canceling a submitted payment.");
      const record = await recordFor(job),
        link = await client(record.quote);
      const request = await link.spendRequests.retrieve(record.requestId);
      if (!request) throw Error("Link could not find this payment request.");
      const result = ["created", "pending_approval", "approved"].includes(request.status)
        ? await link.spendRequests.cancel(record.requestId)
        : request;
      return safePayment(record, result);
    },
    // Only call after the owner explicitly retries. A failed/unknown or successful
    // payment must be reconciled, never silently replaced by another credential.
    async renewPayment(job) {
      if (job.submitStarted)
        throw Error("Check the merchant order history before retrying a submitted payment.");
      const record = await recordFor(job);
      return locked(spendName(record.quote), async () => {
        const current = await recordFor(job),
          link = await client(current.quote);
        const request = await link.spendRequests.retrieve(current.requestId);
        if (!["denied", "expired", "canceled"].includes(request?.status))
          throw Error("This payment is still active or needs reconciliation before retrying.");
        await write(spendName(current.quote), {
          quote: current.quote,
          generation: (current.generation || 0) + 1,
        });
        return { readyToRetry: true };
      });
    },
    async injectPayment({ page, job, requestId }) {
      const record = await recordFor(job);
      if (requestId !== record.requestId || job.submitStarted)
        throw Error("This payment cannot be reused for a different purchase.");
      const merchant = new URL(page.url());
      if (merchant.origin !== record.quote.merchantOrigin)
        throw Error("The payment page moved to a different merchant. Review it before continuing.");
      const link = await client(record.quote);
      const request = await link.spendRequests.retrieve(record.requestId, { include: ["card"] });
      if (
        !request ||
        request.status !== "approved" ||
        request.amount !== record.quote.amountCents ||
        String(request.currency).toUpperCase() !== record.quote.currency ||
        new URL(request.merchant_url).origin !== record.quote.merchantOrigin
      )
        throw Error("Link has not approved these exact payment terms.");
      if (!request.card) throw Error("Link has not issued this payment card yet.");
      try {
        const masked = await fillPaymentCard(page, request.card, {
          merchantOrigin: record.quote.merchantOrigin,
        });
        return {
          continue: true,
          payment: { ...safePayment(record, request), status: "filled", ...masked },
        };
      } finally {
        if (request.card) {
          request.card.number = "";
          request.card.cvc = "";
        }
      }
    },
  };
}

async function executeCli(args, authPath) {
  const env = { ...process.env, NO_UPDATE_NOTIFIER: "1" };
  for (const name of Object.keys(env)) if (name.startsWith("LINK_")) delete env[name];
  await runFile(process.execPath, [cli, ...args, "--auth", authPath, "--format", "json"], {
    env,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
}
