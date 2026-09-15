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

test("preparation resumes the same cart for approval without a second add", async (t) => {
  const f = await fixture(t);
  await f.page.goto(f.job.order.buyUrl);
  await f.page.setContent(`<button id="add">Add to cart</button><script>
    window.adds = 0;
    document.querySelector('#add').onclick = () => {
      window.adds++;
      document.body.innerHTML = '<h1>Review your order</h1><p>${text}</p><form method="post" action="/place-order"><button>Place order</button></form>';
    };
  </script>`);
  const navigate = async (p, j, state) => {
    const add = [...state.targets].find(([, target]) => target.label === "Add to cart");
    return add ? { type: "click", target: add[0] } : f.step(p, j, state);
  };
  const progress = [];
  const prepared = await runGenericCheckout({
    ...f,
    resume: true,
    step: navigate,
    onProgress: (p) => progress.push(p),
  });
  assert.equal(prepared.state, "prepared");
  assert.equal(await f.page.evaluate(() => window.adds), 1);
  assert.equal(f.job.navigation.cartAdded, true);
  assert.equal(progress[0].action, "click");
  const purchased = await runGenericCheckout({
    ...f,
    resume: true,
    job: { ...f.job, phase: "submit" },
    step: navigate,
  });
  assert.equal(purchased.state, "confirmed");
  assert.equal(f.purchases(), 1);
});

test("an unchanged add to cart cannot be clicked twice", async (t) => {
  const f = await fixture(t);
  await f.page.goto(f.job.order.buyUrl);
  await f.page.setContent(
    '<button onclick="window.adds = (window.adds || 0) + 1">Add to cart</button>',
  );
  const result = await runGenericCheckout({
    ...f,
    resume: true,
    step: async (_p, _j, s) => ({ type: "click", target: [...s.targets.keys()][0] }),
  });
  assert.equal(result.state, "needs_help");
  assert.match(result.error, /already added/);
  assert.equal(await f.page.evaluate(() => window.adds), 1);
});

test("transient decisions recover without resetting the cart", async (t) => {
  const f = await fixture(t);
  let decisions = 0;
  const result = await runGenericCheckout({
    ...f,
    wait: async () => {},
    step: async (p, j, s) => {
      if (++decisions < 3) throw new SyntaxError("Temporary invalid model JSON");
      return f.step(p, j, s);
    },
  });
  assert.equal(result.state, "prepared");
  assert.equal(decisions, 3);
  assert.equal(f.purchases(), 0);
});

test("receipt observation recovers from slow page and model failures without another purchase", async (t) => {
  const f = await fixture(t);
  let receipts = 0;
  const result = await runGenericCheckout({
    ...f,
    job: { ...f.job, phase: "submit" },
    wait: async () => {},
    step: async (p, j, s) => {
      if (j.phase !== "receipt") return f.step(p, j, s);
      receipts++;
      if (receipts === 1) return { type: "wait", ms: 1000 };
      if (receipts === 2) throw new SyntaxError("Temporary model JSON");
      return f.step(p, j, s);
    },
  });
  assert.equal(result.state, "confirmed");
  assert.equal(receipts, 3);
  assert.equal(f.purchases(), 1);
});

test("durable submission failure prevents the final click", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    runGenericCheckout({
      ...f,
      job: { ...f.job, phase: "submit" },
      persist: async () => {
        throw Error("Disk unavailable");
      },
    }),
    /Disk unavailable/,
  );
  assert.equal(f.purchases(), 0);
});

test("routine Enter works but cannot submit a purchase form", async (t) => {
  const f = await fixture(t);
  const { observe, performAction } = await import("./generic.mjs");
  await f.page.goto(f.job.order.buyUrl);
  await f.page.setContent(
    '<form onsubmit="event.preventDefault(); window.searched = true"><input aria-label="Search"><button>Search</button></form>',
  );
  let state = await observe(f.page);
  await performAction(
    f.page,
    { type: "key", key: "Enter", target: [...state.targets.keys()][0] },
    state,
  );
  assert.equal(await f.page.evaluate(() => window.searched), true);
  await f.page.setContent(
    '<form onsubmit="event.preventDefault(); window.purchased = true"><input aria-label="Order note"><button>Place order</button></form>',
  );
  state = await observe(f.page);
  await assert.rejects(
    performAction(
      f.page,
      { type: "key", key: "Enter", target: [...state.targets.keys()][0] },
      state,
    ),
    /could place an order/,
  );
  assert.equal(await f.page.evaluate(() => window.purchased), undefined);
});

test("model text and image request redact card and credential fields across frames", async (t) => {
  const f = await fixture(t);
  const { observe, modelDecision } = await import("./generic.mjs");
  await f.page.goto(f.job.order.buyUrl);
  await f.page.setContent(
    '<input type="password" value="top-secret-login"><input autocomplete="cc-number" value="4242424242424242"><input name="cvc" value="987"><p>Card 4242 4242 4242 4242</p><p>top-secret-login</p><iframe srcdoc="<input name=cardnumber value=5555555555554444>"></iframe>',
  );
  const state = await observe(f.page);
  const visible = JSON.stringify(state.frames);
  assert.doesNotMatch(
    visible,
    /4242424242424242|4242 4242 4242 4242|5555555555554444|top-secret-login/,
  );
  assert.ok(state.masks.length >= 4);
  let sent;
  const originalScreenshot = f.page.screenshot.bind(f.page);
  f.page.screenshot = async (options) => {
    assert.equal(options.mask, state.masks);
    return originalScreenshot(options);
  };
  await modelDecision(
    f.page,
    { ...f.job, order: { ...f.job.order, cardNumber: "DO-NOT-SEND" } },
    state,
    "act",
    undefined,
    {
      request: async (_url, options) => {
        sent = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            output: [
              { content: [{ type: "output_text", text: '{"type":"help","reason":"setup"}' }] },
            ],
          }),
        };
      },
    },
  );
  const inputText = sent.input[0].content[0].text;
  assert.doesNotMatch(inputText, /4242424242424242|5555555555554444|top-secret-login|DO-NOT-SEND/);
});

test("model retries transient malformed JSON before any browser action", async (t) => {
  const f = await fixture(t);
  const { observe, modelDecision } = await import("./generic.mjs");
  await f.page.goto(f.job.order.buyUrl);
  let calls = 0;
  const result = await modelDecision(f.page, f.job, await observe(f.page), "act", undefined, {
    wait: async () => {},
    request: async () => {
      calls++;
      if (calls === 1) return { ok: false, status: 429 };
      return {
        ok: true,
        json: async () => ({
          output: [
            { content: [{ type: "output_text", text: calls === 2 ? "{" : '{"type":"wait"}' }] },
          ],
        }),
      };
    },
  });
  assert.equal(result.type, "wait");
  assert.equal(calls, 3);
  assert.equal(f.purchases(), 0);
});

test("payment setup prepares exact terms before requesting a protected card", async (t) => {
  const f = await fixture(t);
  let paymentCalls = 0;
  const result = await runGenericCheckout({
    ...f,
    step: async () => ({ type: "payment", snapshot, evidence }),
    payment: async () => {
      paymentCalls++;
      return { state: "needs_payment" };
    },
  });
  assert.equal(result.state, "prepared");
  assert.equal(result.paymentRequired, true);
  assert.equal(paymentCalls, 0);
  assert.equal(f.purchases(), 0);
});

test("approved payment handoff gets verified amount then resumes final review", async (t) => {
  const f = await fixture(t);
  let hasCard = false;
  const result = await runGenericCheckout({
    ...f,
    job: { ...f.job, phase: "submit" },
    step: async (p, j, s) => (!hasCard ? { type: "payment", snapshot, evidence } : f.step(p, j, s)),
    payment: async ({ action, snapshot: checked }) => {
      assert.deepEqual(checked, snapshot);
      assert.equal(action.quote.amountCents, 2100);
      assert.equal(action.quote.currency, "USD");
      hasCard = true;
      return { continue: true };
    },
  });
  assert.equal(result.state, "confirmed");
  assert.equal(f.purchases(), 1);
});

test("payment before delivery details continues preparation, then one app-approved purchase", async (t) => {
  const f = await fixture(t);
  await f.page.goto(f.job.order.buyUrl);
  await f.page.setContent(
    '<h1>GLOVE-1</h1><p>2 case — USD — Current total $21.00</p><input autocomplete="cc-number"><p>Enter payment to calculate delivery</p>',
  );
  const quote = {
    amountCents: 2100,
    currency: "USD",
    merchantUrl: f.job.order.buyUrl,
    evidence: {
      amountCents: "Current total $21.00",
      currency: "USD",
      sku: "GLOVE-1",
      unit: "case",
      quantity: "2 case",
    },
  };
  let hasCard = false,
    authorized = 0;
  const step = async (p, j, state) => (hasCard ? f.step(p, j, state) : { type: "payment", quote });
  const payment = async ({ action, snapshot: checked }) => {
    assert.equal(checked, undefined);
    assert.equal(action.quote.amountCents, 2100);
    assert.equal(f.purchases(), 0);
    hasCard = true;
    await f.page.setContent(
      `<h1>Review your order</h1><p>${text}</p><form method="post" action="/place-order"><button>Place order</button></form>`,
    );
    return { continue: true };
  };
  const authorize = async () => {
    authorized++;
    return true;
  };
  const prepared = await runGenericCheckout({ ...f, resume: true, step, payment, authorize });
  assert.equal(prepared.state, "prepared");
  assert.equal(f.purchases(), 0);
  assert.equal(authorized, 0, "card setup must not consume final order approval");
  const result = await runGenericCheckout({
    ...f,
    resume: true,
    job: { ...f.job, phase: "submit", snapshot: prepared.snapshot },
    step,
    payment,
    authorize,
  });
  assert.equal(result.state, "confirmed");
  assert.equal(f.purchases(), 1);
  assert.equal(authorized, 1);
});

test("invented amount or unrelated merchant cannot request a protected card", async (t) => {
  const f = await fixture(t);
  const quote = {
    amountCents: 2100,
    currency: "USD",
    merchantUrl: f.job.order.buyUrl,
    evidence: {
      amountCents: "Total $21.00",
      currency: "USD",
      sku: "GLOVE-1",
      unit: "case",
      quantity: "Quantity 2",
    },
  };
  for (const change of [
    { amountCents: 9999 },
    { merchantUrl: "https://another-merchant.example" },
  ]) {
    await assert.rejects(
      runGenericCheckout({
        ...f,
        step: async () => ({ type: "payment", quote: { ...quote, ...change } }),
        payment: async () => assert.fail("unverified payment must not be requested"),
      }),
      /payment quote|selected supplier/,
    );
  }
  assert.equal(f.purchases(), 0);
});

test("asynchronous order request and delayed receipt finish after the one click", async (t) => {
  const f = await fixture(t);
  await f.page.goto(f.job.order.buyUrl);
  await f.page.setContent(`<p>${text}</p><button id="buy">Place order</button><script>
    document.querySelector('#buy').onclick = () => {
      document.body.innerHTML = '<p>Processing your order</p>';
      setTimeout(async () => {
        const receipt = await fetch('/place-order', {method:'POST'}).then(r => r.text());
        document.body.innerHTML = receipt;
      }, 200);
    };
  </script>`);
  const result = await runGenericCheckout({
    ...f,
    resume: true,
    job: { ...f.job, phase: "submit" },
    step: async (p, j, state) =>
      j.phase === "receipt" && state.frames.some((frame) => frame.text.includes("Processing"))
        ? { type: "wait" }
        : f.step(p, j, state),
  });
  assert.equal(result.state, "confirmed");
  assert.equal(f.purchases(), 1);
});

test(
  "live model completes payment-first preparation and one approved purchase",
  { skip: !process.env.BUYER_LIVE_MODEL_TEST, timeout: 300000 },
  async (t) => {
    const f = await fixture(t);
    const { modelDecision } = await import("./generic.mjs");
    await f.page.goto(f.job.order.buyUrl);
    await f.page.setContent(
      '<h1>Payment setup for GLOVE-1</h1><p>Stock unit: case. Quantity: 2. Currency: USD. Current total: $21.00.</p><p>A card is required before the supplier can show the delivery date and final order review. Request protected payment setup using this visible quote.</p><label>Card number<input autocomplete="cc-number"></label>',
    );
    let suppliedCard = 0,
      grants = 0;
    const payment = async ({ action }) => {
      assert.equal(action.quote.amountCents, 2100);
      assert.equal(f.purchases(), 0);
      suppliedCard++;
      await f.page.setContent(
        `<h1>Review your order</h1><p>${text}</p><form method="post" action="/place-order"><button>Place order</button></form>`,
      );
      return { continue: true };
    };
    const authorize = async () => {
      grants++;
      return true;
    };
    const prepared = await runGenericCheckout({
      ...f,
      resume: true,
      step: modelDecision,
      verify: modelDecision,
      payment,
      authorize,
    });
    assert.equal(prepared.state, "prepared", prepared.error);
    assert.equal(suppliedCard, 1);
    assert.equal(grants, 0);
    assert.equal(f.purchases(), 0);
    const purchased = await runGenericCheckout({
      ...f,
      resume: true,
      job: { ...f.job, phase: "submit", snapshot: prepared.snapshot },
      step: modelDecision,
      verify: modelDecision,
      payment,
      authorize,
    });
    assert.equal(purchased.state, "confirmed", purchased.error);
    assert.equal(grants, 1);
    assert.equal(f.purchases(), 1);
  },
);

test("public merchant names may begin with a number while private destinations stay blocked", async () => {
  const { installGuard } = await import("./generic.mjs");
  let routeHandler;
  await installGuard(
    {
      on() {},
      context: () => ({
        route: async (_pattern, handler) => {
          routeHandler = handler;
        },
      }),
    },
    { committing: false, allowLocal: false },
  );
  for (const [url, expected] of [
    ["https://3m.com/supplies", "continue"],
    ["https://4imprint.com/cart", "continue"],
    ["https://127.0.0.1/", "abort"],
    ["https://localhost/", "abort"],
    ["https://metadata.internal/", "abort"],
  ]) {
    let result;
    await routeHandler({
      request: () => ({ url: () => url, postData: () => null }),
      continue: () => {
        result = "continue";
      },
      abort: () => {
        result = "abort";
      },
    });
    assert.equal(result, expected, url);
  }
});

test("an earlier payment cap cannot cover a changed final total", async (t) => {
  const f = await fixture(t);
  let grants = 0;
  const result = await runGenericCheckout({
    ...f,
    job: {
      ...f.job,
      phase: "submit",
      payment: { amountCents: 2000, currency: "USD", status: "filled" },
    },
    authorize: async () => {
      grants++;
      return true;
    },
  });
  assert.equal(result.state, "needs_help");
  assert.match(result.error, /payment approval/);
  assert.equal(grants, 0);
  assert.equal(f.purchases(), 0);
});

test("private expiration and security digits preserve matching commercial terms", async (t) => {
  const f = await fixture(t);
  const { observe, checkedReady } = await import("./generic.mjs");
  const order = {
    ...snapshot,
    sku: "SKU-123",
    quantity: 12,
    unitPriceCents: 100,
    freightCents: 0,
    totalCents: 1200,
    expectedOn: "2026-12-12",
  };
  const proof = {
    ...evidence,
    sku: "SKU-123",
    quantity: "Quantity 12",
    unitPriceCents: "$1.00 each",
    freightCents: "Shipping $0.00",
    totalCents: "Total $12.00",
    expectedOn: "2026-12-12",
  };
  await f.page.goto(f.job.order.buyUrl);
  await f.page.setContent(
    '<h1>Review</h1><p>SKU-123 — case — Quantity 12 — USD — $1.00 each — Shipping $0.00 — Tax $0.00 — Total $12.00 — Ship to 1 Test Street — Arrives 2026-12-12</p><label>Expiration month<select autocomplete="cc-exp-month"><option selected>12</option></select></label><label>Expiration year<select autocomplete="cc-exp-year"><option selected>2026</option></select></label><input autocomplete="cc-csc" value="123"><input autocomplete="cc-name" value="Test"><p>CVC: 123</p><p>Expiration: 12/2026</p><button>Place order</button>',
  );
  const state = await observe(f.page);
  const source = JSON.stringify(state.frames);
  assert.match(source, /SKU-123/);
  assert.match(source, /Quantity 12/);
  assert.match(source, /Total \$12\.00/);
  assert.match(source, /2026-12-12/);
  assert.doesNotMatch(source, /CVC: 123|Expiration: 12\/2026/);
  const target = [...state.targets].find(([, item]) => item.label === "Place order")[0];
  assert.deepEqual(checkedReady({ snapshot: order, evidence: proof, target }, state, order), order);
});

test("observations retain routine quantity and address values but never private field values", async (t) => {
  const f = await fixture(t);
  const { observe } = await import("./generic.mjs");
  await f.page.goto(f.job.order.buyUrl);
  await f.page.setContent(
    '<input name="quantity" value="12"><input autocomplete="street-address" value="1 Test Street"><input type="password" value="swordfish"><input name="unknown" value="do-not-share"><input name="cc-number" value="4242424242424242"><input name="cvc" value="123">',
  );
  const state = await observe(f.page);
  const elements = state.frames.flatMap((frame) => frame.elements);
  assert.equal(elements.find((item) => item.name === "quantity").value, "12");
  assert.equal(
    elements.find((item) => item.autocomplete === "street-address").value,
    "1 Test Street",
  );
  assert.ok(elements.filter((item) => item.sensitive).every((item) => !("value" in item)));
  assert.doesNotMatch(JSON.stringify(state.frames), /swordfish|4242424242424242|do-not-share/);
});
