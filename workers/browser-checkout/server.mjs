import http from "node:http";
import { mkdir, readFile, writeFile, rename, open } from "node:fs/promises";
import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { fingerprint, computerStep, sameSnapshot, validateSnapshot } from "./runner.mjs";
import { runGenericCheckout, observe, performAction } from "./generic.mjs";
import { startEgressProxy } from "./egress.mjs";
import {
  retainedStates,
  sessionKey,
  canTransferPrepared,
  canRetry,
  safeProgress,
  publicJob,
} from "./sessions.mjs";

// Tests use the same HTTP lifecycle with an isolated browser and controlled
// checkout. No external model or live payment is needed for these tests.
export async function createCheckoutService({
  browser,
  dir,
  encryptionKey,
  secret,
  convexSiteUrl,
  publicUrl,
  release = "local",
  broker,
  runCheckout = runGenericCheckout,
  validateJob,
  authorizeJob,
  idleMs = 15 * 60_000,
}) {
  if (!secret || secret.length < 32 || encryptionKey?.length !== 32)
    throw Error("Set a shared secret and a 32-byte session encryption key.");
  const callback = new URL(convexSiteUrl);
  if (callback.protocol !== "https:") throw Error("HTTPS Convex callback required");
  if (publicUrl && new URL(publicUrl).protocol !== "https:")
    throw Error("HTTPS public URL required");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const active = new Map(),
    sessions = new Map(),
    takeovers = new Map(),
    running = new Set(),
    admissions = new Map(),
    mutations = new Set();
  const view = (job) => publicJob(running.has(job.id) ? { ...job, state: "running" } : job);

  async function atomic(path, value) {
    const tmp = `${path}.${randomBytes(8).toString("hex")}.tmp`;
    const file = await open(tmp, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(value));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(tmp, path);
    const directory = await open(dir, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
  const save = (job) => atomic(`${dir}/${job.id}.json`, job);
  const orderKey = (job) => fingerprint([job.order.organizationId, job.order._id]);
  const setLatest = (job) => atomic(`${dir}/order-${orderKey(job)}.current`, { id: job.id });
  async function latest(job) {
    try {
      return JSON.parse(await readFile(`${dir}/order-${orderKey(job)}.current`, "utf8")).id;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw Error("Order journal is unreadable.");
    }
  }
  async function load(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    try {
      return JSON.parse(await readFile(`${dir}/${id}.json`, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw Error("Execution journal is unreadable; refusing to replay a purchase.");
    }
  }
  async function readSession(id) {
    try {
      const data = Buffer.from(await readFile(`${dir}/${id}.session`, "utf8"), "base64");
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, data.subarray(0, 12));
      decipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString(),
      );
    } catch (error) {
      if (error.code === "ENOENT") return undefined;
      throw Error("Supplier session cannot be opened. Sign in again.");
    }
  }
  async function saveSession(id, context) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(await context.storageState({ indexedDB: true }))),
      cipher.final(),
    ]);
    await writeFile(
      `${dir}/${id}.session`,
      Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"),
      { mode: 0o600 },
    );
  }
  function revoke(id) {
    for (const [token, grant] of takeovers) if (grant.id === id) takeovers.delete(token);
  }
  async function close(id) {
    const entry = active.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    revoke(id);
    active.delete(id);
    sessions.delete(entry.sessionId);
    try {
      await saveSession(entry.sessionId, entry.context);
    } finally {
      await entry.context.close();
    }
  }
  function retain(entry) {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      if (active.get(entry.job.id) !== entry) return;
      if (running.has(entry.job.id) || entry.humanBusy) return retain(entry);
      void close(entry.job.id).catch(() => {});
    }, idleMs);
    entry.timer.unref();
  }
  async function callbackRequest(path, job) {
    const response = await fetch(new URL(path, callback), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: job.order._id,
        jobId: job.id,
        intent: job.intent,
        phase: job.phase,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok ? response.json() : null;
  }
  async function valid(job) {
    if ((await latest(job)) !== job.id || job.supersededBy || job.submitStarted) return false;
    if (validateJob) return validateJob(job);
    // Admission returns the job ID before the app can record it. Allow this
    // brief registration window at the first payment or submission step.
    for (let attempt = 0; attempt < 3; attempt++) {
      if ((await callbackRequest("/api/browser/validate", job))?.valid === true) return true;
      if (attempt < 2) await new Promise((done) => setTimeout(done, 300));
    }
    return false;
  }
  async function payment({ page, job, action }) {
    if (!(await valid(job)))
      return {
        state: "needs_help",
        error: "Purchase details changed. Review the buy in BUY HARD.",
      };
    if (!broker || !job.order.paymentOwnerId)
      return { state: "needs_payment", error: "Connect your payment wallet in BUY HARD." };
    let quote;
    if (action.snapshot) {
      const snapshot = validateSnapshot(action.snapshot);
      if (job.phase === "submit" && !sameSnapshot(snapshot, job.snapshot))
        return { state: "needs_help", error: "Payment terms changed. Review the purchase again." };
      quote = { amountCents: snapshot.totalCents, currency: snapshot.currency };
    } else if (
      action.quote &&
      (job.phase === "prepare" ||
        (action.quote.amountCents === job.snapshot.totalCents &&
          String(action.quote.currency).toUpperCase() === job.snapshot.currency))
    ) {
      quote = action.quote;
    } else return { state: "needs_help", error: "Check the supplier total before adding payment." };
    const connection = await broker.connection(scope(job.order));
    if (!connection.connected)
      return {
        state: "needs_payment",
        error: "Connect your Link wallet in BUY HARD, then continue checkout.",
      };
    // Once a protected card is requested, final authorization must continue to
    // require that card until a replacement has actually been injected.
    job.paymentRequired = true;
    await save(job);
    const result = await broker.requestPayment(job, {
      ...quote,
      merchantUrl: job.order.buyUrl,
      merchantName: job.order.supplier || new URL(job.order.buyUrl).hostname,
      description: `BUY HARD is preparing ${job.order.quantity} ${job.order.unit} of ${job.order.itemName || job.order.sku} from your selected supplier. You approve this payment request in Link, and BUY HARD checks the final order total before purchase.`,
    });
    job.payment = result.payment;
    await save(job);
    if (["approved", "filled"].includes(job.payment?.status)) {
      if (!(await valid(job)))
        return { state: "needs_help", error: "Purchase approval changed. Review it in BUY HARD." };
      const injected = await broker.injectPayment({ page, job, requestId: job.payment.requestId });
      if (injected.payment) job.payment = injected.payment;
      if (injected.continue === true && injected.payment?.status === "filled")
        job.paymentRequired = false;
      await save(job);
      return injected;
    }
    return result;
  }
  async function execute(job, { resume = false, preparedJobId } = {}) {
    let entry = active.get(job.id);
    if (!entry && preparedJobId) {
      const prepared = active.get(preparedJobId);
      if (prepared && !running.has(preparedJobId) && !prepared.humanBusy) {
        if (!canTransferPrepared(prepared.job, job)) {
          // Another approver uses their own supplier browser and wallet. Never
          // carry credentials from the person who prepared the purchase.
          if (
            prepared.job.order.organizationId !== job.order.organizationId ||
            prepared.job.order._id !== job.order._id ||
            prepared.job.order.paymentOwnerId === job.order.paymentOwnerId
          )
            throw Error("The live cart differs from the approved purchase.");
          prepared.job.supersededBy = job.id;
          await save(prepared.job);
          if (prepared.job.payment) await broker?.cancelPayment(prepared.job);
          await close(preparedJobId);
        } else {
          // Broker binding includes owner, company, order, product, quantity,
          // address, merchant and amount. An exact approved successor keeps the
          // same pending/approved payment and live form, never a new charge.
          if (prepared.job.payment) {
            // Keep the funding obligation durable even if the provider check
            // fails or the process stops before this live page is transferred.
            job.payment = prepared.job.payment;
            job.paymentRequired = true;
            await save(job);
            const paymentState = await broker.status(job);
            if (["succeeded", "failed"].includes(paymentState.status))
              throw Error("The live cart payment needs checking in Link before purchasing.");
            job.paymentRequired = Boolean(prepared.job.paymentRequired);
          }
          if (prepared.job.paymentRequired) job.paymentRequired = true;
          if (prepared.job.navigation) job.navigation = prepared.job.navigation;
          // Retiring the source must never precede persistence of the complete
          // successor, including the card binding and any reinjection gate.
          await save(job);
          await save({ ...prepared.job, supersededBy: job.id });
          prepared.job.supersededBy = job.id;
          clearTimeout(prepared.timer);
          revoke(preparedJobId);
          active.delete(preparedJobId);
          prepared.job = job;
          active.set(job.id, prepared);
          entry = prepared;
          resume = true;
        }
      }
    }
    if (!entry) {
      const key = sessionKey(job.order);
      if (sessions.has(key) || sessions.size >= 3)
        throw Error(
          "Another checkout is using this supplier session. Try again after it finishes.",
        );
      sessions.set(key, job.id);
      let context;
      try {
        if (job.payment) {
          // Storage state can retain a merchant payment token, but it cannot
          // prove which card the rebuilt checkout currently uses.
          job.paymentRequired = true;
          job.navigation ||= { steps: 0, history: [] };
          job.navigation.history = [
            ...(job.navigation.history || []),
            {
              type: "payment",
              result: "setup_required",
              label:
                "The supplier browser restarted. Open change payment and request protected payment setup again before final review.",
            },
          ].slice(-16);
          await save(job);
        }
        context = await browser.newContext({
          viewport: { width: 1280, height: 900 },
          storageState: await readSession(key),
          serviceWorkers: "block",
        });
        await context.routeWebSocket("**/*", (socket) => socket.close());
        entry = { context, page: await context.newPage(), sessionId: key, job };
        active.set(job.id, entry);
      } catch (error) {
        sessions.delete(key);
        await context?.close().catch(() => {});
        throw error;
      }
      resume = false;
    }
    entry.job = job;
    clearTimeout(entry.timer);
    revoke(job.id);
    Object.assign(
      job,
      await runCheckout({
        page: entry.page,
        job,
        resume,
        persist: save,
        payment,
        onProgress: async (progress) => {
          job.progress = safeProgress(
            { ...progress, phase: progress.phase || job.phase },
            job.progress,
          );
          await save(job);
        },
        authorize: async () => {
          if (!(await valid(job))) return false;
          if (job.paymentRequired) return false;
          if (job.payment) {
            const paymentState = broker && (await broker.status(job));
            if (
              !paymentState ||
              paymentState.status !== "approved" ||
              paymentState.amountCents !== job.snapshot.totalCents ||
              paymentState.currency !== job.snapshot.currency ||
              paymentState.merchantOrigin !== new URL(job.order.buyUrl).origin
            )
              return false;
          }
          return authorizeJob
            ? authorizeJob(job)
            : (await callbackRequest("/api/browser/authorize", job))?.authorized === true;
        },
      }),
    );
    if (job.state === "needs_payment")
      job.progress = safeProgress({ phase: "payment" }, job.progress);
    await save(job);
    await saveSession(entry.sessionId, entry.context);
    if (retainedStates.has(job.state)) retain(entry);
    else await close(job.id);
  }
  async function executeSafely(job, options) {
    try {
      await execute(job, options);
    } catch (error) {
      job.state = job.submitStarted ? "outcome_unknown" : "needs_help";
      job.error = job.submitStarted
        ? "Checkout may have succeeded. Check the supplier order before another attempt."
        : "The supplier checkout needs help. Check the supplier session or payment connection.";
      if (
        !job.submitStarted &&
        /^(Another checkout|The live cart|Supplier session)/.test(error.message)
      )
        job.error = error.message;
      await save(job);
      if (active.has(job.id)) retain(active.get(job.id));
    } finally {
      running.delete(job.id);
    }
  }
  function start(job, options) {
    const entry = active.get(job.id);
    if (running.has(job.id) || entry?.humanBusy) throw Error("Checkout is already active.");
    running.add(job.id);
    revoke(job.id);
    if (entry) clearTimeout(entry.timer);
    void executeSafely(job, options);
  }
  function authenticated(req) {
    const value = Buffer.from((req.headers.authorization || "").replace(/^Bearer /, "")),
      expected = Buffer.from(secret);
    return value.length === expected.length && timingSafeEqual(value, expected);
  }
  async function body(req) {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 20000) throw Error("Request too large");
    }
    return JSON.parse(text || "{}");
  }
  function reply(res, status, value) {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(value));
  }
  function scope(input) {
    if (
      typeof input.organizationId !== "string" ||
      !input.organizationId ||
      typeof input.paymentOwnerId !== "string" ||
      !input.paymentOwnerId
    )
      throw Error("Payment owner is required");
    return { organizationId: input.organizationId, paymentOwnerId: input.paymentOwnerId };
  }
  const service = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://worker");
      if (url.pathname === "/health")
        return reply(res, browser.isConnected() ? 200 : 503, {
          ok: browser.isConnected(),
          mode: "adaptive",
          active: active.size,
          release,
          callbackOrigin: callback.origin,
          capabilities: [
            "live_cart_resume",
            "approval_callback",
            "durable_journal",
            "single_replica",
          ],
          payments: broker ? "link" : "unavailable",
          paymentMode: process.env.LINK_PAYMENT_MODE === "live" ? "live" : "test",
        });
      if (url.pathname.startsWith("/takeover/")) {
        const token = url.pathname.split("/")[2],
          grant = takeovers.get(token),
          entry = grant && active.get(grant.id);
        if (!grant || grant.expires < Date.now() || !entry || running.has(grant.id))
          return reply(res, 403, { error: "Session expired. Open supplier help from BUY HARD." });
        if (!(await valid(entry.job))) {
          revoke(grant.id);
          return reply(res, 403, {
            error: "This purchase changed. Open its current checkout in BUY HARD.",
          });
        }
        if (running.has(grant.id) || active.get(grant.id) !== entry)
          return reply(res, 403, {
            error: "Checkout resumed. Open supplier help again when it pauses.",
          });
        if (req.method === "GET" && url.pathname.endsWith("/screen")) {
          if (entry.humanBusy) return reply(res, 409, { error: "An action is still finishing." });
          const mask = entry.page
            .frames()
            .map((frame) => frame.locator('[data-buy-hard-payment="true"]'));
          res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
          return res.end(await entry.page.screenshot({ mask }));
        }
        if (req.method === "POST") {
          if (entry.humanBusy) return reply(res, 409, { error: "An action is still finishing." });
          entry.humanBusy = true;
          try {
            const input = await body(req);
            if (input.type === "done") {
              revoke(grant.id);
              await saveSession(entry.sessionId, entry.context);
              retain(entry);
              return reply(res, 200, { done: true });
            }
            if (input.type === "key" && input.key !== "Tab")
              throw Error("Use the visible supplier controls");
            if (input.type === "click") {
              if (!Number.isFinite(input.x) || !Number.isFinite(input.y))
                throw Error("Invalid click");
              const state = await observe(entry.page);
              let selected;
              for (const [id, target] of state.targets) {
                const box = await target.locator.boundingBox();
                if (
                  box &&
                  input.x >= box.x &&
                  input.x <= box.x + box.width &&
                  input.y >= box.y &&
                  input.y <= box.y + box.height
                )
                  selected = id;
              }
              if (!selected) throw Error("Select a visible form control");
              await performAction(entry.page, { type: "click", target: selected }, state, {
                human: true,
              });
            } else {
              if (
                input.type === "type" &&
                (typeof input.text !== "string" || input.text.length > 2000)
              )
                throw Error("Invalid input");
              await computerStep(entry.page, input);
            }
            retain(entry);
            return reply(res, 200, { ok: true });
          } finally {
            entry.humanBusy = false;
          }
        }
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        });
        return res.end(
          `<!doctype html><meta name="viewport" content="width=device-width"><title>Supplier help</title><p>Complete supplier sign-in or payment setup. Finish here, then continue in BUY HARD. Your cart stays open.</p><button onclick="send({type:'done'})">Finish setup</button><input id="entry" type="password" autocomplete="off" placeholder="Type into supplier field"><button onclick="send({type:'type',text:entry.value});entry.value=''">Type</button><button onclick="send({type:'key',key:'Tab'})">Tab</button><button onclick="send({type:'scroll',y:600})">Scroll down</button><button onclick="send({type:'scroll',y:-600})">Scroll up</button><p id="message" role="status"></p><img id="screen" style="width:100%;max-width:1280px" src="${url.pathname}/screen"><script>const base=location.pathname;let busy=false;async function send(a){if(busy)return;busy=true;try{const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});const result=await r.json();document.getElementById('message').textContent=result.error||(result.done?'Setup saved. Continue in BUY HARD.':'');if(!result.done)document.getElementById('screen').src=base+'/screen?t='+Date.now()}finally{busy=false}}document.getElementById('screen').onclick=e=>{const r=document.getElementById('screen').getBoundingClientRect();send({type:'click',x:(e.clientX-r.left)*1280/r.width,y:(e.clientY-r.top)*900/r.height})};</script>`,
        );
      }
      if (!authenticated(req)) return reply(res, 401, { error: "Unauthorized" });
      if (req.method === "POST" && /^\/payments\/(connect|status|disconnect)$/.test(url.pathname)) {
        if (!broker) return reply(res, 503, { error: "Payment wallet is unavailable." });
        const owner = scope(await body(req)),
          operation = url.pathname.split("/")[2];
        const result =
          operation === "connect"
            ? await broker.connect(owner)
            : operation === "disconnect"
              ? await broker.disconnect(owner)
              : await broker.connection(owner);
        return reply(res, 200, result);
      }
      if (req.method === "POST" && url.pathname === "/jobs") {
        const input = await body(req);
        if (
          !input ||
          !["prepare", "submit"].includes(input.phase) ||
          typeof input.intent !== "string" ||
          !input.intent
        )
          return reply(res, 400, { error: "Invalid job" });
        const order = input.order;
        if (
          !order ||
          !["organizationId", "_id", "buyUrl", "sku", "unit", "shipTo"].every(
            (key) => typeof order[key] === "string" && order[key].trim(),
          ) ||
          !Number.isFinite(order.quantity) ||
          order.quantity <= 0
        )
          return reply(res, 400, { error: "A complete order is required." });
        const destination = new URL(order.buyUrl);
        if (destination.protocol !== "https:" || destination.username || destination.password)
          return reply(res, 400, { error: "A public HTTPS supplier URL is required." });
        if (input.phase === "submit") validateSnapshot(input.snapshot);
        if (input.preparedJobId && !/^[a-f0-9]{64}$/.test(input.preparedJobId))
          return reply(res, 400, { error: "Invalid prepared cart." });
        const id = fingerprint([order.organizationId, order._id, input.phase, input.intent]);
        let admission = admissions.get(id);
        if (!admission) {
          admission = (async () => {
            let job = await load(id);
            if (job) {
              if ((await latest(job)) !== job.id) throw Error("This checkout has been replaced.");
              if (job.state === "running" && !active.has(id) && !running.has(id)) {
                job.state = job.submitStarted ? "outcome_unknown" : "needs_help";
                job.error = "The browser restarted. Review the checkout before continuing.";
                await save(job);
              }
              return job;
            }
            job = {
              id,
              phase: input.phase,
              intent: input.intent,
              order: Object.fromEntries(
                [
                  "organizationId",
                  "_id",
                  "buyUrl",
                  "sku",
                  "unit",
                  "shipTo",
                  "quantity",
                  "itemName",
                  "supplier",
                  "paymentOwnerId",
                ]
                  .filter((key) => order[key] !== undefined)
                  .map((key) => [key, order[key]]),
              ),
              ...(input.snapshot ? { snapshot: validateSnapshot(input.snapshot) } : {}),
              ...(input.preparedJobId ? { preparedJobId: input.preparedJobId } : {}),
              state: "running",
              createdAt: Date.now(),
            };
            const key = orderKey(job);
            if (mutations.has(key)) throw Error("This purchase is already being updated.");
            mutations.add(key);
            try {
              const previousId = await latest(job),
                previous = previousId && (await load(previousId));
              if (previous?.submitStarted || (previousId && running.has(previousId)))
                throw Error("Check the existing purchase before starting another checkout.");
              if (previousId && active.get(previousId)?.humanBusy)
                throw Error("Finish supplier setup before starting another checkout.");
              if (input.preparedJobId && previousId && input.preparedJobId !== previousId)
                throw Error("This prepared checkout has been replaced.");
              if (input.preparedJobId && (!previous || previous.id !== input.preparedJobId))
                throw Error(
                  "The prepared checkout journal is unavailable. Prepare the purchase again.",
                );
              if (
                input.preparedJobId &&
                !canTransferPrepared(previous, job) &&
                (previous.order.organizationId !== job.order.organizationId ||
                  previous.order._id !== job.order._id ||
                  previous.order.paymentOwnerId === job.order.paymentOwnerId)
              )
                throw Error("The prepared cart differs from the approved purchase.");
              if (input.preparedJobId && previous && canTransferPrepared(previous, job)) {
                // A restart may have removed the live source page. Inherit
                // funding from its journal before publishing the successor.
                if (previous.payment) {
                  job.payment = previous.payment;
                  job.paymentRequired = true;
                }
                if (previous.paymentRequired) job.paymentRequired = true;
                if (previous.navigation) job.navigation = previous.navigation;
              }
              await save(job);
              await setLatest(job);
              if (previousId) revoke(previousId);
              if (previousId && previousId !== input.preparedJobId && active.has(previousId)) {
                active.get(previousId).job.supersededBy = job.id;
                await save(active.get(previousId).job);
                if (previous.payment) await broker?.cancelPayment(previous);
                await close(previousId);
              }
              start(job, { preparedJobId: input.preparedJobId });
              return job;
            } finally {
              mutations.delete(key);
            }
          })();
          admissions.set(id, admission);
        }
        try {
          return reply(res, 200, view(await admission));
        } finally {
          admissions.delete(id);
        }
      }
      const match = url.pathname.match(
        /^\/jobs\/([a-f0-9]{64})(\/(?:takeover|retry|reconcile|payment))?$/,
      );
      if (match) {
        const job = active.get(match[1])?.job || (await load(match[1]));
        if (!job) return reply(res, 404, { error: "Job not found" });
        if (job.state === "running" && !active.has(job.id) && !running.has(job.id)) {
          job.state = job.submitStarted ? "outcome_unknown" : "needs_help";
          job.error = "The browser restarted. Review the checkout before continuing.";
          await save(job);
        }
        if (match[2] && (await latest(job)) !== job.id)
          return reply(res, 409, {
            error: "This checkout has been replaced. Open the current buy.",
          });
        if (match[2] === "/retry" && req.method === "POST") {
          const input = await body(req);
          if (!canRetry(job, input.intent) || running.has(job.id) || active.get(job.id)?.humanBusy)
            return reply(res, 409, { error: "This checkout cannot be resumed." });
          running.add(job.id);
          revoke(job.id);
          try {
            if (!(await valid(job)))
              return reply(res, 409, { error: "Approval changed. Review the buy in BUY HARD." });
            if (job.payment && broker) {
              const paymentState = job.paymentRequired ? job.payment : await broker.status(job);
              if (
                job.paymentRequired ||
                ["denied", "expired", "canceled"].includes(paymentState.status)
              ) {
                // Persist the blocking marker before renewing the provider
                // record. The merchant may still hold the expired card/token,
                // and a crash or provider timeout must never erase that fact.
                job.paymentRequired = true;
                await save(job);
                const quote = {
                  amountCents:
                    job.phase === "submit" ? job.snapshot.totalCents : job.payment.amountCents,
                  currency: job.phase === "submit" ? job.snapshot.currency : job.payment.currency,
                  merchantUrl: job.order.buyUrl,
                  merchantName: job.order.supplier || new URL(job.order.buyUrl).hostname,
                };
                // Re-read/create by the broker's durable quote key first. This
                // also recovers a renewal that finished before a lost response.
                let replacement = await broker.requestPayment(job, quote);
                if (["denied", "expired", "canceled"].includes(replacement.payment?.status)) {
                  job.payment = replacement.payment;
                  await save(job);
                  await broker.renewPayment(job);
                  replacement = await broker.requestPayment(job, quote);
                }
                if (replacement.payment) job.payment = replacement.payment;
                if (job.payment?.status !== "approved") {
                  job.state = replacement.state || "needs_payment";
                  job.error =
                    replacement.error || "Approve the replacement payment in Link, then continue.";
                  await save(job);
                  if (active.has(job.id)) retain(active.get(job.id));
                  return reply(res, 200, publicJob(job));
                }
                job.navigation ||= { steps: 0, history: [] };
                job.navigation.history = [
                  ...(job.navigation.history || []),
                  {
                    type: "payment",
                    result: "setup_required",
                    label:
                      "The replacement payment is approved. Open the supplier change payment controls and request payment setup to replace the old card before final review.",
                  },
                ].slice(-16);
              }
            }
            job.state = "running";
            job.error = undefined;
            await save(job);
          } finally {
            running.delete(job.id);
          }
          start(job, { resume: active.has(job.id), preparedJobId: job.preparedJobId });
          return reply(res, 200, view(job));
        }
        if (match[2] === "/reconcile" && req.method === "POST")
          return reply(res, 409, {
            error:
              "Check supplier order history and record its confirmation. An uncertain purchase is never repeated.",
          });
        if (match[2] === "/payment" && req.method === "POST") {
          if (running.has(job.id) || job.submitStarted || !(await valid(job)))
            return reply(res, 409, { error: "Review the current purchase before payment." });
          const paymentStatus = broker && job.payment && (await broker.status(job)),
            paymentUrl =
              paymentStatus?.actionUrl ||
              paymentStatus?.url ||
              job.payment?.actionUrl ||
              job.payment?.url;
          if (!paymentUrl || new URL(paymentUrl).protocol !== "https:")
            return reply(res, 409, {
              error: "Connect Link or continue checkout to request payment.",
            });
          return reply(res, 200, { url: paymentUrl });
        }
        if (match[2] === "/takeover" && req.method === "POST") {
          const entry = active.get(job.id);
          if (
            !publicUrl ||
            !entry ||
            running.has(job.id) ||
            entry.humanBusy ||
            !["needs_help", "needs_payment"].includes(job.state)
          )
            return reply(res, 409, {
              error: "No active help session. Continue checkout in BUY HARD.",
            });
          if (!(await valid(job)))
            return reply(res, 409, {
              error: "This purchase changed. Open its current checkout in BUY HARD.",
            });
          revoke(job.id);
          const token = randomBytes(32).toString("hex");
          takeovers.set(token, { id: job.id, expires: Date.now() + 10 * 60_000 });
          retain(entry);
          return reply(res, 200, { url: `${publicUrl}/takeover/${token}` });
        }
        return reply(res, 200, view(job));
      }
      return reply(res, 404, { error: "Not found" });
    } catch {
      return reply(res, 400, {
        error: "The request could not be completed. Refresh the buy and try again.",
      });
    }
  });
  return {
    service,
    async close() {
      for (const id of active.keys()) await close(id).catch(() => {});
      await new Promise((done) => service.close(done));
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const secret = process.env.BROWSER_WORKER_SECRET;
  const encryptionKey = Buffer.from(process.env.SESSION_ENCRYPTION_KEY || "", "hex");
  if (!secret || secret.length < 32 || encryptionKey.length !== 32 || !process.env.OPENAI_API_KEY)
    throw Error("Set the browser secret, session encryption key, and model API key.");
  const proxy = await startEgressProxy();
  const browser = await chromium.launch({
    headless: true,
    proxy: { server: proxy.url },
    args: [
      "--proxy-bypass-list=<-loopback>",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    ],
  });
  const dir = process.env.DATA_DIR || "./data";
  const { createLinkPaymentBroker } = await import("./payments.mjs");
  const broker = await createLinkPaymentBroker({ dir, encryptionKey });
  const runtime = await createCheckoutService({
    browser,
    dir,
    encryptionKey,
    secret,
    broker,
    convexSiteUrl: process.env.CONVEX_SITE_URL,
    publicUrl: process.env.PUBLIC_URL,
    release: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RELEASE_SHA || "local",
  });
  runtime.service.listen(Number(process.env.PORT || 8080), "0.0.0.0");
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await runtime.close();
      await browser.close();
      proxy.close();
      process.exit(0);
    });
}
