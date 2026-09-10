/// <reference types="vite/client" />
import { expect, test, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";
import { approvalKey } from "../src/lib/buy-review";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
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
