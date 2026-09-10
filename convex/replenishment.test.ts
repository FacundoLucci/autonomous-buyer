/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import agentTest from "@convex-dev/agent/test";
import { calendarDeliveryDays } from "./companyLeadTime";
import { api, internal } from "./_generated/api";
import { applyStockReceipt, baselineUsageChange, stockFacts } from "./companyStock";
import { availableStock, replenishmentPlan } from "../src/lib/inventory-planning";
const modules = import.meta.glob("./**/*.ts");
const DAY = 86400000;
const NOW = Date.parse("2026-09-10T12:00:00Z");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Buyer", role: "buyer", isActive: true });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Buyer company",
      isDemo: false,
      shippingAddress: "100 Main Street, Chicago IL",
      timezone: "America/Chicago",
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 1 },
    });
    await ctx.db.patch("users", userId, { organizationId });
    const itemId = await ctx.db.insert("inventoryItems", {
      organizationId,
      sku: "TAPE",
      name: "Tape",
      description: "Tape",
      specification: { productType: "Tape" },
      quantityOnHand: 10,
      stockCountKnown: true,
      stockCountedAt: NOW,
      estimatedDailyUsage: 2,
      supplierLeadTimeDays: 5,
      safetyStockDays: 3,
      preferredCoverageDays: 30,
      casePack: 1,
      buyingPriority: "availability",
      status: "watch",
      isDemo: false,
    });
    return { userId, organizationId, itemId };
  });
  return { t, ...ids, user: t.withIdentity({ subject: ids.userId }) };
}

test("replenishment requires opt-in; repeated checks create only one buy and fact changes revise it", async () => {
  const { t, user, itemId } = await fixture();
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect(await t.run((ctx) => ctx.db.query("companyBuys").collect())).toHaveLength(0);
  await user.mutation(api.companyInventory.setAutomation, { itemId, enabled: true });
  await Promise.all([
    t.mutation(internal.replenishment.evaluate, { itemId }),
    t.mutation(internal.replenishment.evaluate, { itemId }),
  ]);
  const buys = await t.run((ctx) => ctx.db.query("companyBuys").collect());
  expect(buys).toHaveLength(1);
  expect(buys[0]).toMatchObject({ automatic: true, quantity: 60, planVersion: 1 });
  await user.mutation(api.companyInventory.recordCount, { itemId, quantity: 2 });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  const revised = await t.run((ctx) => ctx.db.get("companyBuys", buys[0]._id));
  expect(revised?.planVersion).toBe(2);
  await user.mutation(api.companyInventory.setAutomation, { itemId, enabled: false });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect((await t.run((ctx) => ctx.db.get("companyBuys", buys[0]._id)))?.planVersion).toBe(2);
});

test("receipt after stockout creates usable inventory and changing usage is prospective", async () => {
  const { t, itemId } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch("inventoryItems", itemId, {
      quantityOnHand: 2,
      stockCountedAt: NOW - 10 * DAY,
      estimatedDailyUsage: 1,
    });
    const item = (await ctx.db.get("inventoryItems", itemId))!;
    await applyStockReceipt(ctx, item, 5);
    const received = (await ctx.db.get("inventoryItems", itemId))!;
    expect(availableStock(stockFacts(received), NOW)).toBe(5);
    expect(received.quantityOnHand).toBe(2);
    expect(received.stockCountedAt).toBe(NOW - 10 * DAY);
  });
  vi.setSystemTime(NOW + 2 * DAY);
  await t.run(async (ctx) => {
    const item = (await ctx.db.get("inventoryItems", itemId))!;
    await baselineUsageChange(ctx, item, 2);
    await ctx.db.patch("inventoryItems", itemId, { estimatedDailyUsage: 2 });
    const changed = (await ctx.db.get("inventoryItems", itemId))!;
    expect(availableStock(stockFacts(changed), NOW + 2 * DAY)).toBe(3);
    expect(availableStock(stockFacts(changed), NOW + 3 * DAY)).toBe(1);
  });
});

test("unknown count never becomes zero; confirmed deliveries extend cover; late orders require reconciliation", () => {
  const facts = {
    quantity: 10,
    stockCountedAt: NOW,
    dailyUsage: 2,
    leadTimeDays: 5,
    safetyStockDays: 3,
    buyingPriority: "availability" as const,
    dailyLossCents: null,
    lossCurrency: "USD",
    preferredCoverageDays: 30,
  };
  expect(replenishmentPlan({ ...facts, quantity: null }, [], NOW).state).toBe("needs_details");
  expect(replenishmentPlan(facts, [{ quantity: 100, expectedOn: "2026-09-11" }], NOW).state).toBe(
    "watching",
  );
  expect(replenishmentPlan(facts, [{ quantity: 100, expectedOn: "2026-09-09" }], NOW).state).toBe(
    "needs_details",
  );
  expect(replenishmentPlan(facts, [{ quantity: 2, expectedOn: "2026-09-11" }], NOW).state).toBe(
    "buying",
  );
});

test("a stock correction invalidates approval before an executor can submit, and excess cover cancels the draft", async () => {
  const { t, user, itemId, organizationId, userId } = await fixture();
  await user.mutation(api.companyInventory.setAutomation, { itemId, enabled: true });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  const orderId = await t.run(async (ctx) => {
    const buy = (await ctx.db.query("companyBuys").first())!;
    const orderId = await ctx.db.insert("companyOrders", {
      organizationId,
      inventoryItemId: itemId,
      createdBy: userId,
      number: "PO1",
      itemName: "Tape",
      sku: "TAPE",
      unit: "rolls",
      quantity: 60,
      receivedQuantity: 0,
      unitPriceCents: 100,
      freightCents: 0,
      taxCents: 0,
      totalCents: 6000,
      currency: "USD",
      supplier: "Tape supplier",
      shipTo: "100 Main Street",
      requiredBy: "2026-09-11",
      notes: "",
      status: "approved",
      isOpen: true,
      approvedBy: userId,
      approvedAt: NOW,
      approvedTermsKey: "terms",
      executionState: "queued",
      createdAt: NOW,
      updatedAt: NOW,
    });
    await ctx.db.patch("companyBuys", buy._id, { orderId });
    return orderId;
  });
  await user.mutation(api.companyInventory.recordCount, { itemId, quantity: 1000 });
  expect(await t.run((ctx) => ctx.db.get("companyOrders", orderId))).toMatchObject({
    status: "draft",
    reviewRequired: true,
  });
  expect(
    (await t.run((ctx) => ctx.db.get("companyOrders", orderId)))?.approvedTermsKey,
  ).toBeUndefined();
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect(await t.run((ctx) => ctx.db.get("companyOrders", orderId))).toMatchObject({
    status: "cancelled",
    isOpen: false,
  });
  expect((await t.run((ctx) => ctx.db.query("companyBuys").first()))?.closed).toBe(true);
});

test("a future reorder point schedules unattended evaluation and unknown stock creates no buy", async () => {
  const { t, user, itemId } = await fixture();
  await user.mutation(api.companyInventory.recordCount, { itemId, quantity: 100 });
  await user.mutation(api.companyInventory.setAutomation, { itemId, enabled: true });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  const item = (await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))!;
  expect(item.replenishmentScheduledId).toBeDefined();
  const scheduled = await t.run((ctx) => ctx.db.system.get(item.replenishmentScheduledId!));
  expect(scheduled?.scheduledTime).toBe(NOW + 41 * DAY);
  await t.run((ctx) => ctx.db.patch("inventoryItems", itemId, { stockCountKnown: false }));
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect(await t.run((ctx) => ctx.db.query("companyBuys").collect())).toHaveLength(0);
  expect((await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.automationState).toBe(
    "needs_details",
  );
});

test("rounding uses stock-unit order multiples, never imported units per case", async () => {
  const { t, user, itemId } = await fixture();
  await t.run((ctx) => ctx.db.patch("inventoryItems", itemId, { casePack: 1000, unit: "cases" }));
  await user.mutation(api.companyInventory.setAutomation, { itemId, enabled: true });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect((await t.run((ctx) => ctx.db.query("companyBuys").first()))?.quantity).toBe(60);
  await user.mutation(api.companyInventory.updateRules, { itemId, orderMultiple: 24 });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect((await t.run((ctx) => ctx.db.query("companyBuys").first()))?.quantity).toBe(72);
});

test("confirmed incoming that arrives after a stockout triggers only the uncovered bridge", () => {
  const facts = {
    quantity: 2,
    stockCountedAt: NOW,
    dailyUsage: 2,
    leadTimeDays: 5,
    safetyStockDays: 3,
    buyingPriority: "availability" as const,
    dailyLossCents: null,
    lossCurrency: "USD",
    preferredCoverageDays: 30,
  };
  const delivery = [{ quantity: 100, expectedOn: "2026-09-13" }];
  expect(replenishmentPlan(facts, delivery, NOW)).toMatchObject({ state: "buying", quantity: 5 });
  expect(replenishmentPlan({ ...facts, buyingPriority: "flexible" }, delivery, NOW).state).toBe(
    "watching",
  );
});

test("cancelling an automatic buy pauses repeated buying until resumed", async () => {
  const { t, user, itemId } = await fixture();
  await user.mutation(api.companyInventory.setAutomation, { itemId, enabled: true });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  const buy = (await t.run((ctx) => ctx.db.query("companyBuys").first()))!;
  await user.mutation(api.desk.cancelBuy, { id: buy._id });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect(await t.run((ctx) => ctx.db.query("companyBuys").collect())).toHaveLength(1);
  expect((await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.replenishmentEnabled).toBe(
    false,
  );
  await user.mutation(api.companyInventory.setAutomation, { itemId, enabled: true });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect(await t.run((ctx) => ctx.db.query("companyBuys").collect())).toHaveLength(2);
});

test("stock changes cancel a website approval only before the final commit was claimed", async () => {
  const { t, user, itemId, organizationId, userId } = await fixture();
  const orderId = await t.run((ctx) =>
    ctx.db.insert("companyOrders", {
      organizationId,
      inventoryItemId: itemId,
      createdBy: userId,
      number: "WEB1",
      itemName: "Tape",
      sku: "TAPE",
      unit: "rolls",
      quantity: 60,
      receivedQuantity: 0,
      unitPriceCents: 100,
      freightCents: 0,
      taxCents: 0,
      totalCents: 6000,
      currency: "USD",
      supplier: "Tape supplier",
      shipTo: "100 Main Street",
      requiredBy: "2026-09-11",
      notes: "",
      status: "approved",
      isOpen: true,
      approvedBy: userId,
      approvedAt: NOW,
      approvedTermsKey: "terms",
      executionState: "submitting",
      browserPhase: "submit",
      browserJobId: "job",
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
  await user.mutation(api.companyInventory.recordCount, { itemId, quantity: 3 });
  expect(await t.run((ctx) => ctx.db.get("companyOrders", orderId))).toMatchObject({
    status: "draft",
    browserJobId: "job",
  });
  expect(
    (await t.run((ctx) => ctx.db.get("companyOrders", orderId)))?.approvedTermsKey,
  ).toBeUndefined();
  await t.run((ctx) =>
    ctx.db.patch("companyOrders", orderId, {
      status: "approved",
      approvedTermsKey: "new-terms",
      executionState: "submitting",
      browserCommitAuthorizedAt: NOW,
    }),
  );
  await user.mutation(api.companyInventory.recordCount, { itemId, quantity: 100 });
  expect(await t.run((ctx) => ctx.db.get("companyOrders", orderId))).toMatchObject({
    status: "approved",
    approvedTermsKey: "new-terms",
    executionState: "submitting",
    reviewRequired: true,
  });
});

test("lead preflight researches once and waits for verified delivery time without creating a premature buy", async () => {
  const { t, user, itemId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch("inventoryItems", itemId, {
      supplierLeadTimeDays: undefined,
      buyUrl: "https://supplier.example.com/tape",
      quantityOnHand: 1000,
    }),
  );
  await user.mutation(api.companyInventory.setAutomation, { itemId, enabled: true });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  const researching = (await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))!;
  expect(researching.leadResearchState).toBe("researching");
  expect(researching.leadResearchThreadId).toBeDefined();
  expect(await t.run((ctx) => ctx.db.query("companyBuys").collect())).toHaveLength(0);
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect((await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.leadResearchThreadId).toBe(
    researching.leadResearchThreadId,
  );
  await t.mutation(internal.companyLeadTime.finish, {
    itemId,
    key: researching.leadResearchKey!,
    url: "https://supplier.example.com/delivery",
    excerpt: "Delivery takes 3–5 calendar days.",
  });
  expect((await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.supplierLeadTimeDays).toBe(
    5,
  );
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect(await t.run((ctx) => ctx.db.query("companyBuys").collect())).toHaveLength(0);
  await user.mutation(api.companyInventory.updateCompany, {
    name: "Buyer company",
    shippingAddress: "200 Other Street, Boston MA",
  });
  expect(
    (await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.supplierLeadTimeDays,
  ).toBeUndefined();
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect((await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.leadResearchState).toBe(
    "researching",
  );
});

test("business days, dispatch times, stale supplier evidence, and invented conversions never fill delivery lead", async () => {
  for (const excerpt of [
    "Delivery takes 3 business days.",
    "Ships within 2 calendar days.",
    "Dispatch in 3 calendar days.",
    "Delivery is not guaranteed within 4 calendar days.",
    "Delivery takes 2-3 days.",
  ])
    expect(calendarDeliveryDays(excerpt)).toBeNull();
  const { t, user, itemId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch("inventoryItems", itemId, {
      supplierLeadTimeDays: undefined,
      buyUrl: "https://supplier.example.com/tape",
    }),
  );
  await user.mutation(api.companyInventory.setAutomation, { itemId, enabled: true });
  await t.mutation(internal.replenishment.evaluate, { itemId });
  const item = (await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))!;
  await t.mutation(internal.companyLeadTime.finish, {
    itemId,
    key: item.leadResearchKey!,
    url: "https://supplier.example.com/tape",
    excerpt: "Ships in 2 calendar days.",
  });
  expect(
    (await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.supplierLeadTimeDays,
  ).toBeUndefined();
  expect((await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.leadResearchState).toBe(
    "needs_details",
  );
  await t.mutation(internal.replenishment.evaluate, { itemId });
  expect((await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.leadResearchState).toBe(
    "needs_details",
  );
  await user.mutation(api.companyInventory.updateBuying, {
    itemId,
    buyUrl: "https://other.example.com/tape",
    supplierEmail: "",
    coverageDays: 30,
  });
  await t.mutation(internal.companyLeadTime.finish, {
    itemId,
    key: item.leadResearchKey!,
    url: "https://supplier.example.com/tape",
    excerpt: "Delivery in 2 calendar days.",
  });
  expect(
    (await t.run((ctx) => ctx.db.get("inventoryItems", itemId)))?.supplierLeadTimeDays,
  ).toBeUndefined();
});
