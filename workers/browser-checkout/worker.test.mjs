import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";
import { runCheckout } from "./runner.mjs";
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
async function fixture(t) {
  let purchases = 0;
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    if (req.url === "/commit") {
      purchases++;
      res.end(
        `<pre id="receipt">${JSON.stringify({ ...snapshot, confirmation: `TEST-${purchases}` })}</pre>`,
      );
    } else if (req.url === "/cart")
      res.end(
        `<pre id="cart">${JSON.stringify(snapshot)}</pre><form action="/commit" method="post"><button id="submit">Place order</button></form>`,
      );
    else
      res.end(
        '<button style="position:absolute;left:0;top:0;width:150px;height:80px" onclick="location.href=\'/cart\'">Prepare cart</button>',
      );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block" }),
    page = await context.newPage();
  t.after(async () => {
    await browser.close();
    await new Promise((r) => server.close(r));
  });
  return {
    page,
    purchases: () => purchases,
    adapter: {
      origins: [origin],
      writePaths: [],
      commitPaths: ["/commit"],
      cartSelector: "#cart",
      receiptSelector: "#receipt",
      submitSelector: "#submit",
    },
    job: {
      id: "test",
      phase: "prepare",
      order: { ...snapshot, organizationId: "test-company", buyUrl: origin },
      snapshot,
    },
  };
}
test("real browser prepares through computer click, then submits once with matching receipt", async (t) => {
  const f = await fixture(t);
  let persistCount = 0;
  const options = {
    ...f,
    persist: async () => persistCount++,
    authorize: async () => true,
    step: async () => ({ type: "click", x: 70, y: 30 }),
  };
  const prepared = await runCheckout(options);
  assert.equal(prepared.state, "prepared");
  assert.equal(f.purchases(), 0);
  assert.equal(persistCount, 0);
  await f.page.context().unrouteAll();
  const result = await runCheckout({ ...options, job: { ...f.job, phase: "submit" } });
  assert.equal(result.state, "confirmed");
  assert.equal(result.confirmation, "TEST-1");
  assert.equal(f.purchases(), 1);
  assert.equal(persistCount, 1);
});
test("changed price requires new approval and cannot submit", async (t) => {
  const f = await fixture(t);
  const result = await runCheckout({
    ...f,
    job: {
      ...f.job,
      phase: "submit",
      snapshot: { ...snapshot, unitPriceCents: 900, totalCents: 1900 },
    },
    persist: async () => assert.fail("must not submit"),
    step: async () => ({ type: "click", x: 70, y: 30 }),
  });
  assert.equal(result.state, "changed");
  assert.equal(f.purchases(), 0);
});
test("preparation cannot access commit endpoint, even with a page-suggested action", async (t) => {
  const f = await fixture(t);
  await runCheckout({
    ...f,
    persist: async () => {},
    step: async () => ({ type: "click", x: 70, y: 30 }),
  });
  await f.page.locator("#submit").click();
  assert.equal(f.purchases(), 0);
});

test("stock change revoked at final authorization prevents the actual commit", async (t) => {
  const f = await fixture(t);
  const result = await runCheckout({
    ...f,
    job: { ...f.job, phase: "submit" },
    persist: async () => assert.fail("must not journal a submit"),
    authorize: async () => false,
    step: async () => ({ type: "click", x: 70, y: 30 }),
  });
  assert.equal(result.state, "needs_help");
  assert.equal(f.purchases(), 0);
});
