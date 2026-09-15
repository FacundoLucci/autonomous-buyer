import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { createLinkPaymentBroker, normalizePaymentQuote } from "./payments.mjs";
import { fillPaymentCard, paymentFieldKind } from "./payments-browser.mjs";

const scope = { organizationId: "company-a", paymentOwnerId: "owner-a" };
const job = () => ({
  order: {
    ...scope,
    _id: "order-a",
    buyUrl: "https://merchant.example/item",
    sku: "PENCIL",
    quantity: 2,
    unit: "case",
    shipTo: "School address",
  },
});
const quote = {
  amountCents: 2599,
  currency: "USD",
  merchantUrl: "https://merchant.example/checkout",
  merchantName: "School supplies",
};
const card = () => ({
  number: "4000009990001984",
  cvc: "123",
  brand: "visa",
  exp_month: 12,
  exp_year: 2039,
  valid_until: "2039-01-01T00:00:00Z",
});

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "buy-hard-payment-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [],
    requests = new Map();
  let creates = 0;
  const broker = createLinkPaymentBroker({
    dir,
    encryptionKey: Buffer.alloc(32, 7),
    runCli: async (args, path) => {
      calls.push({ args, path });
      let saved = {};
      try {
        saved = JSON.parse(await readFile(path, "utf8"));
      } catch {}
      if (args[1] === "logout") await writeFile(path, "{}");
      else if (args[1] === "status")
        await writeFile(
          path,
          JSON.stringify({
            auth: {
              access_token: "test-access-secret",
              refresh_token: "test-refresh-secret",
              expires_at: Date.now() + 3600000,
            },
          }),
        );
      else if (!saved.auth)
        await writeFile(
          path,
          JSON.stringify({
            pendingDeviceAuth: {
              device_code: "test-device-secret",
              phrase: "quiet blue pencil",
              verification_url: "https://app.link.com/approve",
              expires_at: Date.now() + 600000,
            },
          }),
        );
    },
    clientFactory: ({ accessToken }) => {
      assert.equal(accessToken, "test-access-secret");
      return {
        spendRequests: {
          create: async (params) => {
            creates++;
            calls.push({ params });
            const response = { ...params, id: "lsrq_test", status: "created" };
            requests.set(response.id, response);
            return response;
          },
          retrieve: async (id, options) => {
            const request = requests.get(id);
            return (
              request && {
                ...request,
                ...(options?.include?.includes("card") ? { card: card() } : {}),
              }
            );
          },
          requestApproval: async (id) => {
            requests.get(id).status = "pending_approval";
            return { id, approval_url: "https://app.link.com/spend/approve" };
          },
          cancel: async (id) => {
            requests.get(id).status = "canceled";
            return requests.get(id);
          },
        },
      };
    },
  });
  return { broker, dir, calls, requests, creates: () => creates };
}

test("provider-owned login keeps device and auth tokens encrypted and separate by owner", async (t) => {
  const { broker, dir, calls } = await fixture(t);
  const connected = await broker.connect(scope);
  assert.equal(connected.url, "https://app.link.com/approve");
  assert.equal(connected.code, "quiet blue pencil");
  assert.equal(connected.connected, false);
  assert.equal((await broker.connection(scope)).connected, true);
  assert.equal((await broker.connection({ ...scope, paymentOwnerId: "owner-b" })).connected, false);
  for (const name of await readdir(join(dir, "payment-wallets"))) {
    const raw = await readFile(join(dir, "payment-wallets", name), "utf8");
    assert(!raw.includes("test-access-secret"));
    assert(!raw.includes("test-device-secret"));
    assert(!raw.includes("test-refresh-secret"));
  }
  for (const call of calls)
    if (call.path) await assert.rejects(readFile(call.path), { code: "ENOENT" });
  assert(!JSON.stringify(connected).includes("secret"));
  await broker.disconnect(scope);
  assert.equal((await broker.connection(scope)).connected, false);
});

test("payment creation binds exact company, owner, order, merchant and amount and reuses the request", async (t) => {
  const { broker, calls, creates } = await fixture(t);
  await broker.connect(scope);
  await broker.connection(scope);
  const current = job();
  const first = await broker.requestPayment(current, quote);
  current.payment = first.payment;
  await broker.requestPayment(current, quote);
  assert.equal(creates(), 1);
  const params = calls.find((call) => call.params).params;
  assert.equal(params.amount, quote.amountCents);
  assert.equal(params.test, true);
  assert.match(params.idempotency_key, /^buy-hard-/);
  assert.equal(params.metadata.buy_hard_order, current.order._id);
  assert.equal((await broker.status(current)).url, "https://app.link.com/spend/approve");
  for (const changed of [
    { ...current, order: { ...current.order, paymentOwnerId: "owner-b" } },
    { ...current, order: { ...current.order, organizationId: "company-b" } },
    { ...current, order: { ...current.order, _id: "order-b" } },
    { ...current, order: { ...current.order, quantity: 9 } },
    { ...current, order: { ...current.order, shipTo: "Changed destination" } },
  ])
    await assert.rejects(broker.status(changed), /checkout changed/i);
  assert.equal((await broker.cancelPayment(current)).status, "canceled");
  await assert.rejects(broker.cancelPayment({ ...current, submitStarted: true }), /order history/);
});

test("unsupported currency, cap and merchant changes fail before contacting Link", () => {
  for (const invalid of [
    { ...quote, amountCents: 50001 },
    { ...quote, amountCents: -1 },
    { ...quote, currency: "EUR" },
    { ...quote, amountCents: 1.5 },
    { ...quote, merchantUrl: "https://attacker.example" },
    { ...quote, merchantUrl: "http://merchant.example" },
  ])
    assert.throws(() => normalizePaymentQuote(job(), invalid));
  assert.throws(() =>
    normalizePaymentQuote({ order: { ...job().order, paymentOwnerId: undefined } }, quote),
  );
});

test("expired and denied requests require explicit renewal and never recycle the idempotency key", async (t) => {
  const { broker, calls, requests, creates } = await fixture(t);
  await broker.connect(scope);
  await broker.connection(scope);
  const current = job();
  current.payment = (await broker.requestPayment(current, quote)).payment;
  requests.get(current.payment.requestId).status = "expired";
  assert.equal((await broker.requestPayment(current, quote)).state, "needs_help");
  assert.equal(creates(), 1);
  await broker.renewPayment(current);
  current.payment = (await broker.requestPayment(current, quote)).payment;
  const keys = calls.filter((call) => call.params).map((call) => call.params.idempotency_key);
  assert.equal(new Set(keys).size, 2);
  for (const state of ["approved", "pending_approval", "succeeded", "failed", "unknown"]) {
    requests.get(current.payment.requestId).status = state;
    await assert.rejects(broker.renewPayment(current), /active or needs reconciliation/);
  }
  requests.get(current.payment.requestId).status = "denied";
  await broker.renewPayment(current);
});

test("pending, changed or already submitted payments never retrieve or fill credentials", async (t) => {
  const { broker, requests } = await fixture(t);
  await broker.connect(scope);
  await broker.connection(scope);
  const current = job();
  current.payment = (await broker.requestPayment(current, quote)).payment;
  const page = { url: () => "https://merchant.example/checkout" };
  await assert.rejects(
    broker.injectPayment({ page, job: current, requestId: current.payment.requestId }),
    /exact payment terms/,
  );
  requests.get(current.payment.requestId).status = "approved";
  requests.get(current.payment.requestId).amount = 2600;
  await assert.rejects(
    broker.injectPayment({ page, job: current, requestId: current.payment.requestId }),
    /exact payment terms/,
  );
  await assert.rejects(
    broker.injectPayment({
      page,
      job: { ...current, submitStarted: true },
      requestId: current.payment.requestId,
    }),
    /cannot be reused/,
  );
});

test("card classification does not treat ordinary checkout identity fields as card fields", () => {
  assert.equal(paymentFieldKind({ autocomplete: "billing cc-number" }), "number");
  assert.equal(paymentFieldKind({ name: "shipping_name" }), null);
  assert.equal(paymentFieldKind({ name: "email" }), null);
  assert.equal(paymentFieldKind({ name: "credit_card_exp_month" }), "month");
});

test("isolated browser fill hides credentials, never submits, and rejects untrusted frames", async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("https://merchant.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<form onsubmit="window.submitted=true;return false"><input autocomplete="cc-number"><input autocomplete="cc-exp"><input autocomplete="cc-csc"><button>Pay</button></form>`,
    }),
  );
  await page.goto("https://merchant.example/checkout");
  const result = await fillPaymentCard(page, card(), {
    merchantOrigin: "https://merchant.example",
  });
  assert.deepEqual(result, { brand: "visa", last4: "1984" });
  assert(!JSON.stringify(result).includes(card().number));
  assert.equal(await page.locator("[data-buy-hard-payment]").count(), 3);
  assert.equal(await page.evaluate(() => window.submitted), undefined);
  assert.equal(await page.locator("input").first().inputValue(), card().number);
  assert.deepEqual(
    await fillPaymentCard(page, card(), { merchantOrigin: "https://merchant.example" }),
    result,
  );
  assert.equal(
    await page
      .locator("input")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    "rgba(0, 0, 0, 0)",
  );
  await page.goto("https://merchant.example/checkout");
  await assert.rejects(
    fillPaymentCard(page, card(), { merchantOrigin: "https://other.example" }),
    /needs help/,
  );
  await assert.rejects(
    fillPaymentCard(
      page,
      { ...card(), valid_until: "2020-01-01" },
      { merchantOrigin: "https://merchant.example" },
    ),
    /expired/,
  );
});
