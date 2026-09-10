/// <reference types="vite/client" />
import { expect, test, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";
afterEach(() => vi.useRealTimers());
const modules = import.meta.glob("./**/*.ts");
test("old quote versions cannot hide the current request or bypass supplier deduplication", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const buyId = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Buyer",
      timezone: "UTC",
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 2 },
      isDemo: false,
    });
    const itemId = await ctx.db.insert("inventoryItems", {
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
    const buyId = await ctx.db.insert("companyBuys", {
      organizationId,
      itemId,
      planVersion: 20,
      notes: "",
      closed: false,
      quantity: 2,
      requiredBy: "2026-12-01",
      createdAt: Date.now(),
    });
    for (let version = 0; version < 12; version++)
      await ctx.db.insert("companyQuoteRequests", {
        organizationId,
        itemId,
        buyId,
        planVersion: version,
        supplier: "Shop",
        email: "sales@supplier.example",
        url: "https://supplier.example/product",
        followups: 0,
        state: "waiting",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    await ctx.db.insert("companyQuoteRequests", {
      organizationId,
      itemId,
      buyId,
      planVersion: 20,
      supplier: "Shop",
      email: "sales@supplier.example",
      url: "https://supplier.example/product",
      followups: 0,
      state: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return buyId;
  });
  const current = await t.query(internal.companyPurchasing.context, { buyId, planVersion: 20 });
  expect(current?.requests).toHaveLength(1);
  const result = await t.mutation(internal.companyPurchasing.requestQuote, {
    buyId,
    planVersion: 20,
    supplier: "Shop",
    email: "sales@supplier.example",
    url: "https://supplier.example/product",
  });
  expect(result).toBe("waiting");
  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("companyQuoteRequests")
      .withIndex("by_buyId_and_planVersion", (q) => q.eq("buyId", buyId).eq("planVersion", 20))
      .take(10),
  );
  expect(rows).toHaveLength(1);
  // A replan retains an obsolete draft. It must still advance past exhausted quotes.
  await t.run(async (ctx) => {
    const buy = (await ctx.db.get("companyBuys", buyId))!;
    const createdBy = await ctx.db.insert("users", {
      organizationId: buy.organizationId,
      name: "Buyer",
    });
    const orderId = await ctx.db.insert("companyOrders", {
      organizationId: buy.organizationId,
      inventoryItemId: buy.itemId,
      createdBy,
      number: "PO1",
      itemName: "Gloves",
      sku: "G1",
      unit: "cases",
      quantity: 2,
      receivedQuantity: 0,
      unitPriceCents: 1000,
      freightCents: 0,
      taxCents: 0,
      totalCents: 2000,
      currency: "USD",
      supplier: "Shop",
      shipTo: "1 Street",
      requiredBy: "2026-12-01",
      notes: "",
      reviewRequired: true,
      status: "draft",
      isOpen: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch("companyBuys", buyId, { orderId, purchasingState: "waiting_supplier" });
    await ctx.db.patch("companyQuoteRequests", rows[0]._id, {
      followups: 2,
      providerOutboundId: "test-outbound",
    });
  });
  await t.mutation(internal.companyPurchasing.followup, { requestId: rows[0]._id });
  const advanced = await t.query(internal.companyPurchasing.context, { buyId, planVersion: 20 });
  expect(advanced?.buy.purchasingState).toBe("needs_details");
  expect(advanced?.buy.purchasingNote).toContain("Checking another supplier");
  await t.run(async (ctx) => {
    await ctx.db.patch("companyBuys", buyId, { purchasingState: "researching" });
    await ctx.db.patch("companyQuoteRequests", rows[0]._id, { state: "replied", followups: 2 });
  });
  expect(
    await t.mutation(internal.companyPurchasing.requestQuote, {
      buyId,
      planVersion: 20,
      supplier: "Shop",
      email: "sales@supplier.example",
      url: "https://supplier.example/product",
    }),
  ).toBe("needs_details");
  const stillResearching = await t.query(internal.companyPurchasing.context, {
    buyId,
    planVersion: 20,
  });
  expect(stillResearching?.buy.purchasingState).toBe("researching");
});
