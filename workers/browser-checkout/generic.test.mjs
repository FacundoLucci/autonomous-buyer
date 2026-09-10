import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";
import { runGenericCheckout } from "./generic.mjs";
import { publicAddress } from "./egress.mjs";
const snapshot = {
  sku: "GLOVE-1",
  unit: "case",
  quantity: 2,
  currency: "USD",
  unitPriceCents: 1000,
  freightCents: 100,
  taxCents: 0,
  totalCents: 2100,
  shipTo: "1 Test Street",
  expectedOn: "2026-12-01",
};
const text =
  "GLOVE-1 — case — Quantity 2 — USD — $10.00 each — Shipping $1.00 — Tax $0.00 — Total $21.00 — Ship to 1 Test Street — Arrives 2026-12-01";
const evidence = {
  sku: "GLOVE-1",
  unit: "case",
  quantity: "Quantity 2",
  currency: "USD",
  unitPriceCents: "$10.00 each",
  freightCents: "Shipping $1.00",
  taxCents: "Tax $0.00",
  totalCents: "Total $21.00",
  shipTo: "1 Test Street",
  expectedOn: "2026-12-01",
};
async function fixture(t) {
  let purchases = 0;
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    if (req.url === "/place-order") {
      purchases++;
      res.end("<h1>Order confirmed TEST-1</h1>");
    } else
      res.end(
        `<h1>Review your order</h1><p>${text}</p><form method="post" action="/place-order"><button>Place order</button></form>`,
      );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  t.after(async () => {
    await browser.close();
    await new Promise((r) => server.close(r));
  });
  const job = {
    phase: "prepare",
    order: { ...snapshot, buyUrl: `http://127.0.0.1:${server.address().port}` },
    snapshot,
  };
  const step = async (_p, j, state) =>
    j.phase === "receipt"
      ? { type: "receipt", confirmation: "TEST-1", evidence: "Order confirmed TEST-1" }
      : { type: "ready", target: [...state.targets.keys()][0], snapshot, evidence };
  return {
    page,
    job,
    step,
    verify: async () => ({ valid: true }),
    allowLocal: true,
    persist: async () => {},
    authorize: async () => true,
    purchases: () => purchases,
  };
}
test("generic HTML preparation and authorized purchase need no adapter", async (t) => {
  const f = await fixture(t);
  assert.equal((await runGenericCheckout(f)).state, "prepared");
  assert.equal(f.purchases(), 0);
  await f.page.context().unrouteAll();
  let saved = false;
  const result = await runGenericCheckout({
    ...f,
    job: { ...f.job, phase: "submit" },
    persist: async (j) => {
      assert.equal(j.submitStarted, true);
      saved = true;
    },
  });
  assert.equal(saved, true);
  assert.equal(result.state, "confirmed");
  assert.equal(f.purchases(), 1);
});
test("changed terms stop before authorization", async (t) => {
  const f = await fixture(t);
  const result = await runGenericCheckout({
    ...f,
    job: {
      ...f.job,
      phase: "submit",
      snapshot: { ...snapshot, totalCents: 2200, freightCents: 200 },
    },
    authorize: async () => assert.fail(),
  });
  assert.equal(result.state, "changed");
  assert.equal(f.purchases(), 0);
});
test("revoked approval prevents submission", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await runGenericCheckout({
        ...f,
        job: { ...f.job, phase: "submit" },
        authorize: async () => false,
      })
    ).state,
    "needs_help",
  );
  assert.equal(f.purchases(), 0);
});
test("model navigation cannot click final purchase", async (t) => {
  const f = await fixture(t);
  const result = await runGenericCheckout({
    ...f,
    step: async (p, j, s) => ({ type: "click", target: [...s.targets.keys()][0] }),
  });
  assert.equal(result.state, "needs_help");
  assert.equal(f.purchases(), 0);
});
test("invented evidence cannot become a prepared purchase", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    runGenericCheckout({
      ...f,
      step: async (p, j, s) => ({
        ...(await f.step(p, j, s)),
        evidence: { ...evidence, taxCents: "invented" },
      }),
    }),
    /Missing visible/,
  );
  assert.equal(f.purchases(), 0);
});
test("lost receipt remains uncertain after one submission", async (t) => {
  const f = await fixture(t);
  const job = { ...f.job, phase: "submit" };
  const result = await runGenericCheckout({
    ...f,
    job,
    step: async (p, j, s) => (j.phase === "receipt" ? { type: "help" } : f.step(p, j, s)),
  });
  assert.equal(result.state, "outcome_unknown");
  assert.equal(job.submitStarted, true);
  assert.equal(f.purchases(), 1);
});
test("egress excludes private, metadata and mapped private addresses", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.0.1",
    "172.16.0.1",
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "100.64.0.1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("1.1.1.1"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
});

test(
  "live model reads checkout evidence and confirms a controlled order",
  { skip: !process.env.BUYER_LIVE_MODEL_TEST, timeout: 180000 },
  async (t) => {
    const f = await fixture(t);
    const { modelDecision } = await import("./generic.mjs");
    const prepared = await runGenericCheckout({ ...f, step: modelDecision, verify: modelDecision });
    assert.equal(prepared.state, "prepared", prepared.error);
    assert.equal(f.purchases(), 0);
    await f.page.context().unrouteAll();
    const result = await runGenericCheckout({
      ...f,
      job: { ...f.job, phase: "submit", snapshot: prepared.snapshot },
      step: modelDecision,
      verify: modelDecision,
    });
    assert.equal(result.state, "confirmed", result.error);
    assert.equal(f.purchases(), 1);
  },
);

test("a journaled submission cannot be replayed", async (t) => {
  const f = await fixture(t);
  const result = await runGenericCheckout({
    ...f,
    job: { ...f.job, phase: "submit", submitStarted: true },
    step: async () => assert.fail("must not navigate"),
  });
  assert.equal(result.state, "outcome_unknown");
  assert.equal(f.purchases(), 0);
});
