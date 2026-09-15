import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
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
  t.after(async () => {
    await runtime.close();
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
  return { request, jobState, base, dir, browser };
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
  assert.equal(requests, 2);
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
