import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { createCheckoutService } from "./server.mjs";
import { canTransferPrepared, sessionKey, publicJob } from "./sessions.mjs";

const snapshot = {
  sku: "NOTEBOOK",
  unit: "unit",
  quantity: 2,
  currency: "USD",
  unitPriceCents: 500,
  freightCents: 100,
  taxCents: 50,
  totalCents: 1150,
  shipTo: "1 School Street",
  expectedOn: "2026-12-01",
};
const order = {
  organizationId: "school",
  paymentOwnerId: "owner-1",
  _id: "order-1",
  buyUrl: "https://supplier.example/notebook",
  sku: snapshot.sku,
  unit: snapshot.unit,
  quantity: snapshot.quantity,
  shipTo: snapshot.shipTo,
};
const secret = "test-secret-is-at-least-32-characters-long";
const waitFor = async (check) => {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await new Promise((done) => setTimeout(done, 20));
  }
  assert.fail("Checkout did not reach the expected state");
};
async function fixture(t, runCheckout, extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), "buyer-checkout-test-"));
  const browser = await chromium.launch({ headless: true });
  const runtime = await createCheckoutService({
    browser,
    dir,
    encryptionKey: Buffer.alloc(32, 1),
    secret,
    convexSiteUrl: "https://test.convex.site",
    publicUrl: "https://worker.example",
    release: "test-release",
    runCheckout,
    validateJob: async () => true,
    authorizeJob: async () => true,
    ...extra,
  });
  await new Promise((done) => runtime.service.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${runtime.service.address().port}`;
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await runtime.close();
  };
  t.after(async () => {
    await stop();
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  });
  const request = async (path, body) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  const jobState = (id, state) =>
    waitFor(async () => {
      const result = await request(`/jobs/${id}`);
      return result.data.state === state && result.data;
    });
  return { request, jobState, base, dir, browser, stop };
}

test("prepared sessions require the same owner and complete approved terms", () => {
  const prepared = { phase: "prepare", state: "prepared", order, snapshot };
  const submit = { phase: "submit", order, snapshot };
  assert.equal(canTransferPrepared(prepared, submit), true);
  for (const changed of [
    { quantity: 3 },
    { paymentOwnerId: "owner-2" },
    { _id: "order-2" },
    { organizationId: "other" },
  ])
    assert.equal(
      canTransferPrepared(prepared, { ...submit, order: { ...order, ...changed } }),
      false,
    );
  assert.equal(
    canTransferPrepared(prepared, {
      ...submit,
      snapshot: { ...snapshot, totalCents: 1250, freightCents: 200 },
    }),
    false,
  );
  assert.equal(canTransferPrepared({ ...prepared, submitStarted: true }, submit), false);
  assert.notEqual(sessionKey(order), sessionKey({ ...order, paymentOwnerId: "owner-2" }));
});

test("HTTP prepare to approved submit preserves the live cart and prevents stale retry", async (t) => {
  let preparePage;
  let purchases = 0;
  const f = await fixture(t, async ({ page, job, resume, authorize, persist, onProgress }) => {
    if (job.phase === "prepare") {
      assert.equal(resume, false);
      await page.setContent(
        '<input id="cart" value="two notebooks"><input id="private" value="card-test-value">',
      );
      preparePage = page;
      await onProgress({ phase: "prepare", steps: 4, label: "Sensitive supplier text" });
      return { state: "prepared", snapshot };
    }
    assert.equal(page, preparePage);
    assert.equal(resume, true);
    assert.equal(await page.locator("#cart").inputValue(), "two notebooks");
    assert.equal(await page.locator("#private").inputValue(), "card-test-value");
    assert.equal(await authorize(), true);
    job.submitStarted = true;
    await persist(job);
    purchases++;
    return { state: "confirmed", snapshot, confirmation: "CONFIRMED-1" };
  });
  const prep = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  assert.equal(prep.status, 200);
  const prepared = await f.jobState(prep.data.id, "prepared");
  assert.deepEqual(prepared.progress, {
    steps: 4,
    summary: "Checking the supplier cart and total.",
  });
  assert.equal((await f.request("/health")).data.active, 1);
  const submitted = await f.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order,
    snapshot,
    preparedJobId: prep.data.id,
  });
  await f.jobState(submitted.data.id, "confirmed");
  assert.equal(purchases, 1);
  assert.equal((await f.request(`/jobs/${prep.data.id}/retry`, { intent: "draft" })).status, 409);
  assert.equal(
    (await f.request(`/jobs/${submitted.data.id}/retry`, { intent: "approved" })).status,
    409,
  );
  await f.request("/jobs", { phase: "submit", intent: "approved", order, snapshot });
  assert.equal(purchases, 1);
});

test("human Done keeps typed setup on the same page and invalidates help links", async (t) => {
  let calls = 0;
  const f = await fixture(t, async ({ page, resume }) => {
    calls++;
    if (calls === 1) {
      await page.setContent(
        '<input aria-label="School code" id="code" style="position:absolute;left:10px;top:10px;width:200px;height:40px">',
      );
      return { state: "needs_help", error: "Enter the school code." };
    }
    assert.equal(resume, true);
    assert.equal(await page.locator("#code").inputValue(), "school-test-code");
    return { state: "prepared", snapshot };
  });
  const created = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(created.data.id, "needs_help");
  const help = await f.request(`/jobs/${created.data.id}/takeover`, {});
  const path = new URL(help.data.url).pathname;
  assert.equal((await f.request(path, { type: "click", x: 40, y: 25 })).status, 200);
  assert.equal((await f.request(path, { type: "type", text: "school-test-code" })).status, 200);
  assert.equal((await f.request(path, { type: "done" })).data.done, true);
  assert.equal((await f.request(path, { type: "type", text: "stale" })).status, 403);
  assert.equal(
    (await f.request(`/jobs/${created.data.id}/retry`, { intent: "changed" })).status,
    409,
  );
  assert.equal(
    (await f.request(`/jobs/${created.data.id}/retry`, { intent: "draft" })).status,
    200,
  );
  await f.jobState(created.data.id, "prepared");
  assert.equal(calls, 2);
});

test("simultaneous retries allow only one browser writer", async (t) => {
  let calls = 0,
    unblock;
  const gate = new Promise((done) => {
    unblock = done;
  });
  const f = await fixture(t, async () => {
    calls++;
    if (calls === 1) return { state: "needs_help", error: "Help" };
    await gate;
    return { state: "prepared", snapshot };
  });
  const created = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(created.data.id, "needs_help");
  const results = await Promise.all([
    f.request(`/jobs/${created.data.id}/retry`, { intent: "draft" }),
    f.request(`/jobs/${created.data.id}/retry`, { intent: "draft" }),
  ]);
  unblock();
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  await f.jobState(created.data.id, "prepared");
  assert.equal(calls, 2);
});

test("another payment owner starts a fresh browser", async (t) => {
  let first;
  const f = await fixture(t, async ({ page, job, resume }) => {
    if (job.phase === "prepare") {
      first = page;
      await page.setContent('<input value="owner-one-private">');
      return { state: "prepared", snapshot };
    }
    assert.notEqual(page, first);
    assert.equal(resume, false);
    assert.equal(await page.locator("input").count(), 0);
    return { state: "needs_help", error: "Fresh owner needs sign-in." };
  });
  const prepared = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(prepared.data.id, "prepared");
  const submitted = await f.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order: { ...order, paymentOwnerId: "owner-2" },
    snapshot,
    preparedJobId: prepared.data.id,
  });
  const result = await f.jobState(submitted.data.id, "needs_help");
  assert.equal(result.error, "Fresh owner needs sign-in.");
});

test("lost process after submission stays uncertain and never launches again", async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => {
    calls++;
    return { state: "needs_help", error: "Help" };
  });
  const created = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(created.data.id, "needs_help");
  const fakeId = "a".repeat(64);
  const journal = JSON.parse(await readFile(join(f.dir, `${created.data.id}.json`), "utf8"));
  await writeFile(
    join(f.dir, `${fakeId}.json`),
    JSON.stringify({ ...journal, id: fakeId, state: "running", submitStarted: true }),
  );
  const readback = await f.request(`/jobs/${fakeId}`);
  assert.equal(readback.data.state, "outcome_unknown");
  assert.equal((await f.request(`/jobs/${fakeId}/retry`, { intent: "draft" })).status, 409);
  assert.equal(calls, 1);
});

test("public job response excludes payment credentials, URLs and browser history", () => {
  const response = publicJob({
    id: "job",
    state: "needs_payment",
    payment: { number: "secret", cvc: "secret", url: "https://app.link.com/approval" },
    navigation: [{ label: "sensitive" }],
  });
  assert.deepEqual(response, { id: "job", state: "needs_payment", helpKind: "payment" });
});

test("Link approval during preparation keeps the same card through final approved submission", async (t) => {
  let approved = false,
    requests = 0,
    injections = 0,
    authorizations = 0;
  const metadata = {
    requestId: "payment-1",
    status: "pending_approval",
    amountCents: snapshot.totalCents,
    currency: "USD",
    merchantOrigin: "https://supplier.example",
    url: "https://app.link.com/approve/1",
  };
  const broker = {
    connection: async () => ({ connected: true }),
    requestPayment: async () => {
      requests++;
      return {
        state: "needs_payment",
        payment: { ...metadata, status: approved ? "approved" : "pending_approval" },
      };
    },
    status: async () => ({ ...metadata, status: approved ? "approved" : "pending_approval" }),
    cancelPayment: async () => assert.fail("Do not cancel the exact already approved card"),
    injectPayment: async ({ page }) => {
      injections++;
      await page.locator("#payment").fill("one-time-test-card");
      return { continue: true, payment: { ...metadata, status: "filled", last4: "1984" } };
    },
  };
  const f = await fixture(
    t,
    async ({ page, job, resume, payment, authorize, persist }) => {
      if (job.phase === "prepare") {
        if (!resume) await page.setContent('<input id="payment">');
        const result = await payment({
          page,
          job,
          action: { quote: { amountCents: snapshot.totalCents, currency: "USD" } },
        });
        if (!result.continue) return result;
        return { state: "prepared", snapshot };
      }
      assert.equal(resume, true);
      assert.equal(await page.locator("#payment").inputValue(), "one-time-test-card");
      assert.equal(job.payment.last4, "1984");
      assert.equal(await authorize(), true);
      job.submitStarted = true;
      await persist(job);
      return { state: "confirmed", snapshot, confirmation: "WITH-LINK-1" };
    },
    {
      broker,
      authorizeJob: async () => {
        authorizations++;
        return true;
      },
    },
  );
  const prep = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(prep.data.id, "needs_payment");
  assert.equal(authorizations, 0);
  const approval = await f.request(`/jobs/${prep.data.id}/payment`, {});
  assert.equal(approval.data.url, metadata.url);
  approved = true;
  await f.request(`/jobs/${prep.data.id}/retry`, { intent: "draft" });
  await f.jobState(prep.data.id, "prepared");
  const submit = await f.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order,
    snapshot,
    preparedJobId: prep.data.id,
  });
  await f.jobState(submit.data.id, "confirmed");
  // Initial request, explicit retry refresh, and the injection-stage refresh
  // all refer to the same provider request and must not issue another card.
  assert.equal(requests, 3);
  assert.equal(injections, 1);
  assert.equal(authorizations, 1);
});

test("revoked app approval prevents a human or payment resume", async (t) => {
  let calls = 0;
  const f = await fixture(
    t,
    async () => {
      calls++;
      return { state: "needs_help", error: "Help" };
    },
    { validateJob: async () => false },
  );
  const created = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(created.data.id, "needs_help");
  assert.equal(
    (await f.request(`/jobs/${created.data.id}/retry`, { intent: "draft" })).status,
    409,
  );
  assert.equal(calls, 1);
});

test("payment approval for a different amount cannot consume the final app grant", async (t) => {
  let authorizations = 0;
  const metadata = {
    requestId: "payment-1",
    status: "approved",
    amountCents: 1100,
    currency: "USD",
    merchantOrigin: "https://supplier.example",
  };
  const f = await fixture(
    t,
    async ({ job, authorize }) => {
      if (job.phase === "prepare") {
        job.payment = metadata;
        return { state: "prepared", snapshot };
      }
      assert.equal(await authorize(), false);
      return { state: "needs_payment", error: "Approve the final total in Link." };
    },
    {
      broker: { status: async () => metadata },
      authorizeJob: async () => {
        authorizations++;
        return true;
      },
    },
  );
  const prep = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(prep.data.id, "prepared");
  const submit = await f.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order,
    snapshot,
    preparedJobId: prep.data.id,
  });
  await f.jobState(submit.data.id, "needs_payment");
  assert.equal(authorizations, 0);
});

test("expired funded live cart requires a new approval and card injection before final authorization", async (t) => {
  let providerState = "approved",
    requestId = "original-card",
    renewals = 0,
    injections = 0,
    grants = 0,
    purchases = 0,
    submitRuns = 0;
  let lastAuthorize;
  const metadata = () => ({
    requestId,
    status: providerState,
    amountCents: snapshot.totalCents,
    currency: "USD",
    merchantOrigin: "https://supplier.example",
    url: `https://app.link.com/approve/${requestId}`,
  });
  const broker = {
    connection: async () => ({ connected: true }),
    status: async () => metadata(),
    requestPayment: async () => {
      if (providerState === "renewed") {
        requestId = "replacement-card";
        providerState = "pending_approval";
      }
      return {
        state: "needs_payment",
        payment: metadata(),
        error: "Approve the replacement payment.",
      };
    },
    renewPayment: async () => {
      renewals++;
      assert.equal(providerState, "expired");
      providerState = "renewed";
    },
    injectPayment: async ({ page }) => {
      assert.equal(providerState, "approved");
      assert.equal(requestId, "replacement-card");
      injections++;
      await page.locator("#card").fill("replacement-test-card");
      return { continue: true, payment: { ...metadata(), status: "filled" } };
    },
  };
  const f = await fixture(
    t,
    async ({ page, job, resume, authorize, payment, persist }) => {
      if (job.phase === "prepare") {
        await page.setContent('<input id="card" value="expired-test-card">');
        job.payment = { ...metadata(), status: "filled" };
        return { state: "prepared", snapshot };
      }
      submitRuns++;
      lastAuthorize = authorize;
      assert.equal(resume, true);
      assert.equal(await page.locator("#card").inputValue(), "expired-test-card");
      assert.equal(
        await authorize(),
        false,
        "old or uninjected card must never consume the app grant",
      );
      if (submitRuns === 1) return { state: "needs_payment", error: "Renew the expired card." };
      assert.equal(job.paymentRequired, true);
      assert.equal(job.payment.requestId, "replacement-card");
      const result = await payment({ page, job, action: { snapshot } });
      assert.equal(result.continue, true);
      assert.equal(job.paymentRequired, false);
      assert.equal(await page.locator("#card").inputValue(), "replacement-test-card");
      assert.equal(await authorize(), true);
      job.submitStarted = true;
      await persist(job);
      purchases++;
      return { state: "confirmed", snapshot, confirmation: "REPLACEMENT-1" };
    },
    {
      broker,
      authorizeJob: async () => {
        grants++;
        return true;
      },
    },
  );
  const prepare = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(prepare.data.id, "prepared");
  providerState = "expired";
  const submit = await f.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order,
    snapshot,
    preparedJobId: prepare.data.id,
  });
  await f.jobState(submit.data.id, "needs_payment");
  const renewal = await f.request(`/jobs/${submit.data.id}/retry`, { intent: "approved" });
  assert.equal(renewal.status, 200);
  await f.jobState(submit.data.id, "needs_payment");
  assert.equal(renewals, 1);
  assert.equal(submitRuns, 1, "do not run final review while replacement approval is pending");
  const journal = JSON.parse(await readFile(join(f.dir, `${submit.data.id}.json`), "utf8"));
  assert.equal(journal.paymentRequired, true);
  assert.equal(journal.payment.requestId, "replacement-card");
  assert.equal(await lastAuthorize(), false);
  providerState = "approved";
  assert.equal(
    await lastAuthorize(),
    false,
    "provider approval alone does not replace the old merchant card",
  );
  assert.equal(grants, 0);
  await f.request(`/jobs/${submit.data.id}/retry`, { intent: "approved" });
  await f.jobState(submit.data.id, "confirmed");
  assert.equal(injections, 1);
  assert.equal(grants, 1);
  assert.equal(purchases, 1);
});

test("lost renewal response preserves the payment gate and recovers the same replacement", async (t) => {
  let state = "expired",
    requestId = "expired-card",
    renewals = 0,
    grants = 0;
  const metadata = () => ({
    requestId,
    status: state,
    amountCents: snapshot.totalCents,
    currency: "USD",
    merchantOrigin: "https://supplier.example",
  });
  const broker = {
    status: async () => metadata(),
    requestPayment: async () => {
      if (state === "renewed") {
        state = "pending_approval";
        requestId = "replacement-card";
      }
      return { state: "needs_payment", payment: metadata() };
    },
    renewPayment: async () => {
      renewals++;
      state = "renewed";
      throw Error("Response lost after renewal");
    },
  };
  const f = await fixture(
    t,
    async ({ job }) => {
      job.payment = metadata();
      return { state: "needs_payment", error: "Expired card" };
    },
    {
      broker,
      authorizeJob: async () => {
        grants++;
        return true;
      },
    },
  );
  const created = await f.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order,
    snapshot,
  });
  await f.jobState(created.data.id, "needs_payment");
  assert.equal(
    (await f.request(`/jobs/${created.data.id}/retry`, { intent: "approved" })).status,
    400,
  );
  const saved = JSON.parse(await readFile(join(f.dir, `${created.data.id}.json`), "utf8"));
  assert.equal(saved.paymentRequired, true);
  assert.ok(saved.payment, "provider timeout must not erase the previous funding record");
  assert.equal(
    (await f.request(`/jobs/${created.data.id}/retry`, { intent: "approved" })).status,
    200,
  );
  const recovered = JSON.parse(await readFile(join(f.dir, `${created.data.id}.json`), "utf8"));
  assert.equal(recovered.paymentRequired, true);
  assert.equal(recovered.payment.requestId, "replacement-card");
  assert.equal(renewals, 1);
  assert.equal(grants, 0);
});

for (const originalPaymentRequired of [false, true]) {
  test(`handoff journal retains funding across restart when paymentRequired=${originalPaymentRequired}`, async (t) => {
    const metadata = {
      requestId: "bound-card",
      status: "filled",
      amountCents: snapshot.totalCents,
      currency: "USD",
      merchantOrigin: "https://supplier.example",
    };
    const broker = {
      status: async () => ({ ...metadata, status: "approved" }),
      requestPayment: async () => ({
        state: "needs_payment",
        payment: { ...metadata, status: "approved" },
      }),
    };
    let boundary, successorAtBoundary, sourceAtBoundary, sourceId;
    let f;
    f = await fixture(
      t,
      async ({ job, page }) => {
        if (job.phase === "prepare") {
          await page.setContent('<input id="card" value="bound-test-card">');
          job.payment = metadata;
          job.paymentRequired = originalPaymentRequired;
          return { state: "prepared", snapshot };
        }
        // This is the first instruction after source retirement: capture exactly
        // the persisted records a restarted worker would see at this boundary.
        boundary = Object.fromEntries(
          await Promise.all(
            (await readdir(f.dir))
              .filter((name) => !name.endsWith(".tmp"))
              .map(async (name) => [name, await readFile(join(f.dir, name))]),
          ),
        );
        successorAtBoundary = JSON.parse(boundary[`${job.id}.json`].toString());
        sourceAtBoundary = JSON.parse(boundary[`${sourceId}.json`].toString());
        return { state: "needs_help", error: "Pause at the restart boundary." };
      },
      { broker },
    );
    const prepare = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
    sourceId = prepare.data.id;
    await f.jobState(sourceId, "prepared");
    const submit = await f.request("/jobs", {
      phase: "submit",
      intent: "approved",
      order,
      snapshot,
      preparedJobId: sourceId,
    });
    await f.jobState(submit.data.id, "needs_help");
    assert.equal(sourceAtBoundary.supersededBy, submit.data.id);
    assert.equal(successorAtBoundary.payment.requestId, "bound-card");
    assert.equal(successorAtBoundary.paymentRequired, originalPaymentRequired);
    await f.stop();
    let rebuilt,
      grants = 0;
    const restarted = await fixture(
      t,
      async ({ job, resume, authorize }) => {
        rebuilt = {
          resume,
          payment: job.payment,
          required: job.paymentRequired,
          authorized: await authorize(),
        };
        return { state: "needs_help", error: "Rebuilt card setup required." };
      },
      {
        broker,
        authorizeJob: async () => {
          grants++;
          return true;
        },
      },
    );
    for (const [name, bytes] of Object.entries(boundary))
      await writeFile(join(restarted.dir, name), bytes);
    await restarted.jobState(submit.data.id, "needs_help");
    assert.equal(
      (await restarted.request(`/jobs/${submit.data.id}/retry`, { intent: "approved" })).status,
      200,
    );
    await waitFor(() => rebuilt);
    assert.equal(rebuilt.resume, false);
    assert.equal(rebuilt.payment.requestId, "bound-card");
    assert.equal(
      rebuilt.required,
      true,
      "rebuilt browser must reinject even a previously filled card",
    );
    assert.equal(rebuilt.authorized, false);
    assert.equal(grants, 0);
  });
}

test("restart before submit inherits the prepared payment journal without a live source", async (t) => {
  const metadata = {
    requestId: "prepared-card",
    status: "filled",
    amountCents: snapshot.totalCents,
    currency: "USD",
    merchantOrigin: "https://supplier.example",
  };
  const original = await fixture(t, async ({ job }) => {
    job.payment = metadata;
    job.paymentRequired = false;
    return { state: "prepared", snapshot };
  });
  const prepared = await original.request("/jobs", { phase: "prepare", intent: "draft", order });
  await original.jobState(prepared.data.id, "prepared");
  await original.stop();
  let resumed,
    grants = 0;
  const restarted = await fixture(
    t,
    async ({ job, resume, authorize }) => {
      resumed = {
        payment: job.payment,
        required: job.paymentRequired,
        resume,
        authorized: await authorize(),
      };
      return { state: "needs_help", error: "Supply the protected card again." };
    },
    {
      authorizeJob: async () => {
        grants++;
        return true;
      },
    },
  );
  for (const name of await readdir(original.dir))
    await writeFile(join(restarted.dir, name), await readFile(join(original.dir, name)));
  const submitted = await restarted.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order,
    snapshot,
    preparedJobId: prepared.data.id,
  });
  await restarted.jobState(submitted.data.id, "needs_help");
  assert.equal(resumed.payment.requestId, "prepared-card");
  assert.equal(resumed.required, true);
  assert.equal(resumed.resume, false);
  assert.equal(resumed.authorized, false);
  assert.equal(grants, 0);
});

test("provider outage during handoff preserves successor funding before retiring the source", async (t) => {
  const metadata = {
    requestId: "funded-card",
    status: "filled",
    amountCents: snapshot.totalCents,
    currency: "USD",
    merchantOrigin: "https://supplier.example",
  };
  let f,
    atProviderCheck,
    submitRuns = 0;
  f = await fixture(
    t,
    async ({ job }) => {
      if (job.phase === "submit") {
        submitRuns++;
        return { state: "needs_help" };
      }
      job.payment = metadata;
      job.paymentRequired = false;
      return { state: "prepared", snapshot };
    },
    {
      broker: {
        status: async (job) => {
          atProviderCheck = JSON.parse(await readFile(join(f.dir, `${job.id}.json`), "utf8"));
          throw Error("Provider temporarily unavailable");
        },
      },
    },
  );
  const prepare = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(prepare.data.id, "prepared");
  const submit = await f.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order,
    snapshot,
    preparedJobId: prepare.data.id,
  });
  await f.jobState(submit.data.id, "needs_help");
  assert.equal(atProviderCheck.payment.requestId, "funded-card");
  assert.equal(atProviderCheck.paymentRequired, true);
  const source = JSON.parse(await readFile(join(f.dir, `${prepare.data.id}.json`), "utf8"));
  const successor = JSON.parse(await readFile(join(f.dir, `${submit.data.id}.json`), "utf8"));
  assert.equal(source.supersededBy, undefined);
  assert.equal(successor.paymentRequired, true);
  assert.equal(successor.preparedJobId, prepare.data.id);
  assert.equal(submitRuns, 0);
});

test("revoked current intent blocks new help grants and invalidates existing takeover actions", async (t) => {
  let valid = true,
    supplierPage;
  const f = await fixture(
    t,
    async ({ page }) => {
      supplierPage = page;
      await page.setContent(
        '<input id="setup" aria-label="School code" style="position:absolute;left:10px;top:10px;width:200px;height:40px">',
      );
      return { state: "needs_help", error: "Complete supplier setup." };
    },
    { validateJob: async () => valid },
  );
  const created = await f.request("/jobs", { phase: "prepare", intent: "draft", order });
  await f.jobState(created.data.id, "needs_help");
  const grant = await f.request(`/jobs/${created.data.id}/takeover`, {});
  const path = new URL(grant.data.url).pathname;
  assert.equal((await f.request(path, { type: "click", x: 40, y: 25 })).status, 200);
  valid = false;
  assert.equal((await f.request(`/jobs/${created.data.id}/takeover`, {})).status, 409);
  assert.equal((await f.request(path, { type: "type", text: "must-not-be-written" })).status, 403);
  assert.equal(await supplierPage.locator("#setup").inputValue(), "");
  valid = true;
  assert.equal((await f.request(path, { type: "type", text: "old-grant" })).status, 403);
});

test("payment-required prepared journal survives restart before any provider request exists", async (t) => {
  const original = await fixture(t, async () => ({
    state: "prepared",
    snapshot,
    paymentRequired: true,
  }));
  const prepare = await original.request("/jobs", { phase: "prepare", intent: "draft", order });
  await original.jobState(prepare.data.id, "prepared");
  await original.stop();
  let rebuilt,
    grants = 0;
  const restarted = await fixture(
    t,
    async ({ job, authorize }) => {
      rebuilt = {
        required: job.paymentRequired,
        payment: job.payment,
        authorized: await authorize(),
      };
      return { state: "needs_payment", error: "Protected payment is still required." };
    },
    {
      authorizeJob: async () => {
        grants++;
        return true;
      },
    },
  );
  for (const name of await readdir(original.dir))
    await writeFile(join(restarted.dir, name), await readFile(join(original.dir, name)));
  const submit = await restarted.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order,
    snapshot,
    preparedJobId: prepare.data.id,
  });
  await restarted.jobState(submit.data.id, "needs_payment");
  assert.equal(rebuilt.required, true);
  assert.equal(rebuilt.payment, undefined);
  assert.equal(rebuilt.authorized, false);
  assert.equal(grants, 0);
});

test("invalid or missing prepared journals cannot publish an unguarded successor after restart", async (t) => {
  const original = await fixture(t, async () => ({
    state: "prepared",
    snapshot,
    paymentRequired: true,
  }));
  const prepare = await original.request("/jobs", { phase: "prepare", intent: "draft", order });
  await original.jobState(prepare.data.id, "prepared");
  await original.stop();
  let runs = 0;
  const restarted = await fixture(t, async () => {
    runs++;
    return { state: "prepared", snapshot };
  });
  for (const name of await readdir(original.dir))
    await writeFile(join(restarted.dir, name), await readFile(join(original.dir, name)));
  const changed = { ...snapshot, quantity: 3, totalCents: 1650 };
  const mismatch = await restarted.request("/jobs", {
    phase: "submit",
    intent: "changed",
    order: { ...order, quantity: 3 },
    snapshot: changed,
    preparedJobId: prepare.data.id,
  });
  assert.equal(mismatch.status, 400);
  assert.equal(runs, 0);
  await rm(join(restarted.dir, `${prepare.data.id}.json`));
  const missing = await restarted.request("/jobs", {
    phase: "submit",
    intent: "approved",
    order,
    snapshot,
    preparedJobId: prepare.data.id,
  });
  assert.equal(missing.status, 400);
  assert.equal(runs, 0);
});
