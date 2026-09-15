/// <reference types="vite/client" />
import { expect, test, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { approvalKey } from "../src/lib/buy-review";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T12:00:00Z"));
  const t = convexTest(schema, modules);
  const orderId = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Buyer",
      timezone: "UTC",
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 2 },
      isDemo: false,
    });
    const createdBy = await ctx.db.insert("users", { name: "Owner", organizationId });
    const inventoryItemId = await ctx.db.insert("inventoryItems", {
      organizationId,
      sku: "G1",
      name: "Gloves",
      description: "",
      specification: { productType: "gloves" },
      quantityOnHand: 2,
      safetyStockDays: 3,
      casePack: 1,
      preferredCoverageDays: 30,
      status: "healthy",
      isDemo: false,
    });
    return await ctx.db.insert("companyOrders", {
      organizationId,
      createdBy,
      inventoryItemId,
      number: "PO1",
      itemName: "Gloves",
      sku: "G1",
      unit: "case",
      quantity: 2,
      receivedQuantity: 0,
      unitPriceCents: 1000,
      freightCents: 0,
      taxCents: 0,
      totalCents: 2000,
      currency: "USD",
      supplier: "Shop",
      buyUrl: "https://supplier.example/cart",
      shipTo: "1 Street",
      requiredBy: "2026-12-01",
      notes: "",
      status: "draft",
      isOpen: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  const order = (await t.query(internal.browserCheckout.read, { orderId }))!;
  return { t, order, orderId };
}
test("website submission needs both exact approval and prepared checkout", async () => {
  const { t, order, orderId } = await fixture();
  expect(
    await t.mutation(internal.browserCheckout.reserve, { orderId, phase: "submit" }),
  ).toBeNull();
  await t.run(async (ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      status: "approved",
      approvedTermsKey: approvalKey(order),
    }),
  );
  expect(
    await t.mutation(internal.browserCheckout.reserve, { orderId, phase: "submit" }),
  ).toBeNull();
  await t.run(async (ctx) =>
    ctx.db.patch("companyOrders", orderId, { browserPreparedKey: approvalKey(order) }),
  );
  expect(
    await t.mutation(internal.browserCheckout.reserve, { orderId, phase: "submit" }),
  ).not.toBeNull();
});
test("stale worker results cannot overwrite changed purchase terms", async () => {
  const { t, order, orderId } = await fixture();
  await t.run(async (ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      browserJobId: "job",
      browserPhase: "prepare",
      quantity: 4,
    }),
  );
  await t.mutation(internal.browserCheckout.apply, {
    orderId,
    jobId: "job",
    intent: approvalKey(order),
    result: {
      id: "job",
      state: "prepared",
      snapshot: {
        sku: "G1",
        unit: "case",
        quantity: 2,
        currency: "USD",
        unitPriceCents: 1000,
        freightCents: 0,
        taxCents: 0,
        totalCents: 2000,
        shipTo: "1 Street",
        expectedOn: "2026-12-01",
      },
    },
  });
  const updated = (await t.query(internal.browserCheckout.read, { orderId }))!;
  expect(updated.quantity).toBe(4);
  expect(updated.browserPreparedKey).toBeUndefined();
  expect(updated.executionState).toBe("needs_attention");
});
test("uncertain website outcome remains blocked from a new submission", async () => {
  const { t, order, orderId } = await fixture();
  await t.run(async (ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      status: "approved",
      approvedTermsKey: approvalKey(order),
      browserPreparedKey: approvalKey(order),
      browserJobId: "job",
      browserPhase: "submit",
    }),
  );
  await t.mutation(internal.browserCheckout.apply, {
    orderId,
    jobId: "job",
    intent: approvalKey(order),
    result: { id: "job", state: "outcome_unknown", error: "Supplier response lost" },
  });
  expect((await t.query(internal.browserCheckout.read, { orderId }))?.executionState).toBe(
    "outcome_unknown",
  );
  expect(
    await t.mutation(internal.browserCheckout.reserve, { orderId, phase: "submit" }),
  ).toBeNull();
});

test("final checkout authorization is once-only and rejects an invalidated approval", async () => {
  const { t, order, orderId } = await fixture();
  const intent = approvalKey({ ...order, quotedArrival: "2026-12-01" });
  await t.run(async (ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      status: "approved",
      quotedArrival: "2026-12-01",
      approvedTermsKey: intent,
      browserPreparedKey: intent,
      browserJobId: "job",
      browserPhase: "submit",
      executionState: "submitting",
    }),
  );
  const args = { orderId, jobId: "job", intent };
  expect(await t.mutation(internal.browserCheckout.authorizeCommit, args)).toBe(true);
  expect(await t.mutation(internal.browserCheckout.authorizeCommit, args)).toBe(false);
  const second = await fixture();
  await second.t.run(async (ctx) =>
    ctx.db.patch("companyOrders", second.orderId, {
      status: "draft",
      quotedArrival: "2026-12-01",
      browserPreparedKey: intent,
      browserJobId: "job",
      browserPhase: "submit",
      executionState: "submitting",
    }),
  );
  expect(
    await second.t.mutation(internal.browserCheckout.authorizeCommit, {
      ...args,
      orderId: second.orderId,
    }),
  ).toBe(false);
});

test("a late browser result cannot disturb partial receiving", async () => {
  const { t, order, orderId } = await fixture();
  await t.run(async (ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      status: "part_received",
      executionState: "confirmed",
      receivedQuantity: 1,
      browserJobId: "job",
      browserPhase: "submit",
    }),
  );
  await t.mutation(internal.browserCheckout.apply, {
    orderId,
    jobId: "job",
    intent: approvalKey(order),
    result: { id: "job", state: "outcome_unknown", error: "Late poll" },
  });
  expect(await t.query(internal.browserCheckout.read, { orderId })).toMatchObject({
    status: "part_received",
    executionState: "confirmed",
    receivedQuantity: 1,
  });
});

test("an old poll failure cannot overwrite a replacement browser job", async () => {
  const { t, orderId } = await fixture();
  await t.run(async (ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      browserJobId: "new-job",
      browserPhase: "prepare",
    }),
  );
  await t.mutation(internal.browserCheckout.fail, {
    orderId,
    jobId: "old-job",
    message: "Old worker stopped",
    uncertain: true,
  });
  expect(
    (await t.query(internal.browserCheckout.read, { orderId }))?.executionState,
  ).toBeUndefined();
});

test("failure after the purchase click remains uncertain and cannot be resent", async () => {
  const { t, order, orderId } = await fixture();
  await t.run(async (ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      status: "approved",
      browserJobId: "job",
      browserPhase: "submit",
      browserCommitAuthorizedAt: Date.now(),
      approvedTermsKey: approvalKey(order),
    }),
  );
  await t.mutation(internal.browserCheckout.apply, {
    orderId,
    jobId: "job",
    intent: approvalKey(order),
    result: { id: "job", state: "needs_help", error: "Receipt unavailable" },
  });
  expect((await t.query(internal.browserCheckout.read, { orderId }))?.executionState).toBe(
    "outcome_unknown",
  );
  expect(
    await t.mutation(internal.browserCheckout.reserve, { orderId, phase: "submit" }),
  ).toBeNull();
});

test("payment setup can continue only for the current unsubmitted job", async () => {
  const { t, order, orderId } = await fixture();
  const intent = approvalKey(order);
  await t.run((ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      browserJobId: "job",
      browserJobIntent: intent,
      browserPhase: "prepare",
    }),
  );
  const args = { orderId, jobId: "job", intent, phase: "prepare" as const };
  expect(await t.query(internal.browserCheckout.validateJob, args)).toBe(true);
  expect(await t.query(internal.browserCheckout.validateJob, { ...args, intent: "stale" })).toBe(
    false,
  );
  await t.run((ctx) => ctx.db.patch("companyOrders", orderId, { quantity: 3 }));
  expect(await t.query(internal.browserCheckout.validateJob, args)).toBe(false);
  await t.run((ctx) =>
    ctx.db.patch("companyOrders", orderId, { quantity: 2, browserCommitAuthorizedAt: Date.now() }),
  );
  expect(await t.query(internal.browserCheckout.validateJob, args)).toBe(false);
});

test("payment pause surfaces the next step without authorizing a purchase", async () => {
  const { t, order, orderId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      browserJobId: "job",
      browserJobIntent: approvalKey(order),
      browserPhase: "prepare",
    }),
  );
  await t.mutation(internal.browserCheckout.apply, {
    orderId,
    jobId: "job",
    intent: approvalKey(order),
    result: {
      id: "job",
      state: "needs_payment",
      helpKind: "payment",
      error: "Approve this store and amount in Link.",
    },
  });
  const updated = await t.query(internal.browserCheckout.read, { orderId });
  expect(updated).toMatchObject({
    status: "draft",
    executionState: "needs_attention",
    browserHelpKind: "payment",
  });
  expect(updated?.browserCommitAuthorizedAt).toBeUndefined();
  await t.mutation(internal.browserCheckout.resume, { orderId });
  expect(await t.query(internal.browserCheckout.read, { orderId })).toMatchObject({
    browserPollCount: 0,
  });
  expect(
    (await t.query(internal.browserCheckout.read, { orderId }))?.browserHelpKind,
  ).toBeUndefined();
});

test("Link connections are scoped to the authenticated person and never return tokens", async () => {
  const { t, order } = await fixture();
  await t.run((ctx) => ctx.db.patch("users", order.createdBy, { role: "admin", isActive: true }));
  vi.stubEnv("BROWSER_WORKER_URL", "https://worker.example");
  vi.stubEnv("BROWSER_WORKER_SECRET", "test-secret");
  const calls: Array<Record<string, unknown>> = [];
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    calls.push(JSON.parse(options.body as string));
    return Response.json({
      connected: true,
      mode: "live",
      token: "must-not-escape",
      provider: "stripe_link",
      limitCents: 50000,
      currency: "USD",
    });
  });
  const user = t.withIdentity({ subject: order.createdBy });
  const result = await user.action(api.browserPayments.status, {});
  expect(calls).toEqual([
    { organizationId: order.organizationId, paymentOwnerId: order.createdBy },
  ]);
  expect(result).toEqual({ connected: true, mode: "live", limitCents: 50000, currency: "USD" });
  await expect(t.action(api.browserPayments.connect, {})).rejects.toThrow();
  expect(calls).toHaveLength(1);
});

test("another buyer cannot open the funding owner's Link approval", async () => {
  const { t, order, orderId } = await fixture();
  const colleague = await t.run(async (ctx) => {
    await ctx.db.patch("companyOrders", orderId, { browserJobId: "job", browserPhase: "prepare" });
    return await ctx.db.insert("users", {
      organizationId: order.organizationId,
      role: "buyer",
      isActive: true,
    });
  });
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  await expect(
    t.withIdentity({ subject: colleague }).action(api.browserPayments.approvalSession, { orderId }),
  ).rejects.toThrow("person funding");
  expect(request).not.toHaveBeenCalled();
});

test("approved checkout dispatch carries its prepared cart and records the new job", async () => {
  const { t, order, orderId } = await fixture();
  const intent = approvalKey(order);
  await t.run((ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      status: "approved",
      approvedBy: order.createdBy,
      approvedTermsKey: intent,
      browserPreparedKey: intent,
      browserPreparedJobId: "prepared-cart",
    }),
  );
  vi.stubEnv("BROWSER_WORKER_URL", "https://worker.example");
  vi.stubEnv("BROWSER_WORKER_SECRET", "test-secret");
  let sent: Record<string, unknown> | undefined;
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    sent = JSON.parse(options.body as string);
    return Response.json({ id: "submit-job", state: "running" });
  });
  await t.action(internal.browserCheckout.submit, { orderId });
  expect(sent).toMatchObject({
    phase: "submit",
    preparedJobId: "prepared-cart",
    order: { paymentOwnerId: order.createdBy },
  });
  expect(await t.query(internal.browserCheckout.read, { orderId })).toMatchObject({
    browserJobId: "submit-job",
    executionState: "submitting",
    browserJobIntent: intent,
  });
});

test("brief polling outages recover before asking the buyer for help", async () => {
  const { t, order, orderId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      browserJobId: "job",
      browserJobIntent: approvalKey(order),
      browserPhase: "prepare",
    }),
  );
  const args = { orderId, jobId: "job", intent: approvalKey(order) };
  await t.mutation(internal.browserCheckout.pollError, args);
  expect(
    (await t.query(internal.browserCheckout.read, { orderId }))?.executionState,
  ).toBeUndefined();
  await t.mutation(internal.browserCheckout.pollError, args);
  await t.mutation(internal.browserCheckout.pollError, args);
  expect((await t.query(internal.browserCheckout.read, { orderId }))?.executionState).toBe(
    "needs_attention",
  );
});

async function pausedBrowserFixture() {
  const setup = await fixture();
  const { t, order, orderId } = setup;
  await t.run(async (ctx) => {
    await ctx.db.patch("users", order.createdBy, { role: "admin", isActive: true });
    await ctx.db.patch("companyOrders", orderId, {
      browserJobId: "job",
      browserJobIntent: approvalKey(order),
      browserPhase: "prepare",
      executionState: "needs_attention",
      error: "The browser connection was interrupted.",
      browserPollFailures: 3,
    });
  });
  vi.stubEnv("BROWSER_WORKER_URL", "https://worker.example");
  vi.stubEnv("BROWSER_WORKER_SECRET", "test-secret");
  return { ...setup, user: t.withIdentity({ subject: order.createdBy }) };
}
const recoveredSnapshot = {
  sku: "G1",
  unit: "case",
  quantity: 2,
  currency: "USD",
  unitPriceCents: 1000,
  freightCents: 0,
  taxCents: 0,
  totalCents: 2000,
  shipTo: "1 Street",
  expectedOn: "2026-12-01",
};

test("supplier takeover stays with the current funding owner", async () => {
  const { t, order, orderId, user } = await pausedBrowserFixture();
  const colleague = await t.run((ctx) =>
    ctx.db.insert("users", {
      organizationId: order.organizationId,
      role: "buyer",
      isActive: true,
    }),
  );
  const request = vi.fn(async () =>
    Response.json({ url: "https://worker.example/takeover/token" }),
  );
  vi.stubGlobal("fetch", request);
  await expect(
    t.withIdentity({ subject: colleague }).action(api.browserCheckout.helpSession, { orderId }),
  ).rejects.toThrow("person funding");
  expect(request).not.toHaveBeenCalled();
  expect(await user.action(api.browserCheckout.helpSession, { orderId })).toBe(
    "https://worker.example/takeover/token",
  );
  expect(request).toHaveBeenCalledOnce();
});

test("supplier takeover rejects changed and closed purchases", async () => {
  const { t, orderId, user } = await pausedBrowserFixture();
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  await t.run((ctx) => ctx.db.patch("companyOrders", orderId, { quantity: 3 }));
  await expect(user.action(api.browserCheckout.helpSession, { orderId })).rejects.toThrow(
    "checkout changed",
  );
  await t.run((ctx) => ctx.db.patch("companyOrders", orderId, { quantity: 2, isOpen: false }));
  await expect(user.action(api.browserCheckout.helpSession, { orderId })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});

test("submission takeover follows the approver when the funding owner changes", async () => {
  const { t, order, orderId, user } = await pausedBrowserFixture();
  const approver = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      organizationId: order.organizationId,
      role: "buyer",
      isActive: true,
    });
    await ctx.db.patch("companyOrders", orderId, {
      status: "approved",
      approvedBy: id,
      approvedTermsKey: approvalKey(order),
      browserPreparedKey: approvalKey(order),
      browserPhase: "submit",
    });
    return id;
  });
  const request = vi.fn(async () =>
    Response.json({ url: "https://worker.example/takeover/token" }),
  );
  vi.stubGlobal("fetch", request);
  await expect(user.action(api.browserCheckout.helpSession, { orderId })).rejects.toThrow(
    "person funding",
  );
  expect(request).not.toHaveBeenCalled();
  await t.withIdentity({ subject: approver }).action(api.browserCheckout.helpSession, { orderId });
  expect(request).toHaveBeenCalledOnce();
});

test("continue recovers a finished cart after polling stopped without restarting it", async () => {
  const { t, orderId, user } = await pausedBrowserFixture();
  const request = vi.fn(async () =>
    Response.json({ id: "job", state: "prepared", snapshot: recoveredSnapshot }),
  );
  vi.stubGlobal("fetch", request);
  await user.action(api.browserCheckout.retry, { orderId });
  expect(request).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: "GET" }));
  const updated = await t.query(internal.browserCheckout.read, { orderId });
  expect(updated).toMatchObject({
    status: "draft",
    browserPreparedJobId: "job",
    quotedArrival: "2026-12-01",
  });
  expect(updated?.browserJobId).toBeUndefined();
  expect(updated?.executionState).toBeUndefined();
  expect(updated?.error).toBeUndefined();
});

test("continue reconnects to a running checkout without trying to start another writer", async () => {
  const { t, orderId, user } = await pausedBrowserFixture();
  const request = vi.fn(async () =>
    Response.json({
      id: "job",
      state: "running",
      progress: { steps: 5, summary: "Checking cart." },
    }),
  );
  vi.stubGlobal("fetch", request);
  await user.action(api.browserCheckout.retry, { orderId });
  expect(request).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: "GET" }));
  const updated = await t.query(internal.browserCheckout.read, { orderId });
  expect(updated).toMatchObject({ browserPollFailures: 0, browserProgress: "Checking cart." });
  expect(updated?.error).toBeUndefined();
  expect(updated?.executionState).toBeUndefined();
});

test("continue recovers a receipt after the one-time purchase grant", async () => {
  const { t, order, orderId, user } = await pausedBrowserFixture();
  const intent = approvalKey({ ...order, quotedArrival: "2026-12-01" });
  await t.run((ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      status: "approved",
      approvedBy: order.createdBy,
      quotedArrival: "2026-12-01",
      approvedTermsKey: intent,
      browserPreparedKey: intent,
      browserJobIntent: intent,
      browserPhase: "submit",
      browserCommitAuthorizedAt: Date.now(),
      executionState: "outcome_unknown",
    }),
  );
  const request = vi.fn(async () =>
    Response.json({
      id: "job",
      state: "confirmed",
      snapshot: recoveredSnapshot,
      confirmation: "SUPPLIER-42",
    }),
  );
  vi.stubGlobal("fetch", request);
  await user.action(api.browserCheckout.retry, { orderId });
  expect(request).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: "GET" }));
  expect(await t.query(internal.browserCheckout.read, { orderId })).toMatchObject({
    status: "placed",
    executionState: "confirmed",
    confirmation: "SUPPLIER-42",
  });
});

test("an uncertain purchase only requests reconciliation and remains blocked after rejection", async () => {
  const { t, order, orderId, user } = await pausedBrowserFixture();
  const intent = approvalKey(order);
  await t.run((ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      status: "approved",
      approvedBy: order.createdBy,
      approvedTermsKey: intent,
      browserPreparedKey: intent,
      browserPhase: "submit",
      browserCommitAuthorizedAt: Date.now(),
      executionState: "outcome_unknown",
    }),
  );
  const uncertain = {
    id: "job",
    state: "outcome_unknown",
    error: "Check supplier order history before another attempt.",
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json(uncertain))
    .mockResolvedValueOnce(new Response("Check supplier order history", { status: 409 }))
    .mockResolvedValueOnce(Response.json(uncertain));
  vi.stubGlobal("fetch", request);
  await user.action(api.browserCheckout.retry, { orderId });
  expect(request.mock.calls.map((call) => [new URL(call[0]).pathname, call[1].method])).toEqual([
    ["/jobs/job", "GET"],
    ["/jobs/job/reconcile", "POST"],
    ["/jobs/job", "GET"],
  ]);
  expect(await t.query(internal.browserCheckout.read, { orderId })).toMatchObject({
    executionState: "outcome_unknown",
    error: uncertain.error,
  });
  expect(
    await t.mutation(internal.browserCheckout.reserve, { orderId, phase: "submit" }),
  ).toBeNull();
});

test("a rejected resume still reads back the existing checkout result", async () => {
  const { t, orderId, user } = await pausedBrowserFixture();
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: "job", state: "needs_help", error: "Sign in." }))
    .mockResolvedValueOnce(new Response("Already resumed", { status: 409 }))
    .mockResolvedValueOnce(
      Response.json({ id: "job", state: "prepared", snapshot: recoveredSnapshot }),
    );
  vi.stubGlobal("fetch", request);
  await user.action(api.browserCheckout.retry, { orderId });
  expect(request.mock.calls.map((call) => call[1].method)).toEqual(["GET", "POST", "GET"]);
  const updated = await t.query(internal.browserCheckout.read, { orderId });
  expect(updated).toMatchObject({ browserPreparedJobId: "job", quotedArrival: "2026-12-01" });
  expect(updated?.error).toBeUndefined();
  expect(updated?.executionState).toBeUndefined();
});

test("a rejected resume keeps a supplier pause visible when it still needs help", async () => {
  const { t, orderId, user } = await pausedBrowserFixture();
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: "job", state: "needs_help", error: "Sign in." }))
    .mockResolvedValueOnce(new Response("Busy", { status: 409 }))
    .mockResolvedValueOnce(
      Response.json({ id: "job", state: "needs_help", error: "Finish supplier sign-in." }),
    );
  vi.stubGlobal("fetch", request);
  await user.action(api.browserCheckout.retry, { orderId });
  expect(request.mock.calls.map((call) => call[1].method)).toEqual(["GET", "POST", "GET"]);
  expect(await t.query(internal.browserCheckout.read, { orderId })).toMatchObject({
    executionState: "needs_attention",
    browserHelpKind: "supplier",
    error: "Finish supplier sign-in.",
  });
});
