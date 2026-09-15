/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { approvalKey } from "../src/lib/buy-review";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
const selected = {
  supplier: "School shop",
  url: "https://school.example/pencils",
  supplierSku: "PENCIL-CASE",
  evidence: JSON.stringify({
    skuEvidence: "SKU PENCIL-CASE",
    productEvidence: "Pencils",
    unitEvidence: "Sold in cases",
  }),
};
async function fixture() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const records = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "School",
      timezone: "UTC",
      shippingAddress: "123 School Street, Chicago IL 60601",
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 2 },
      isDemo: false,
    });
    const userId = await ctx.db.insert("users", {
      organizationId,
      name: "Buyer",
      role: "buyer",
      isActive: true,
    });
    const itemId = await ctx.db.insert("inventoryItems", {
      organizationId,
      sku: "P1",
      supplierSku: "PENCIL-CASE",
      name: "Pencils",
      description: "",
      specification: { productType: "pencils" },
      unit: "cases",
      quantityOnHand: 0,
      safetyStockDays: 3,
      casePack: 1,
      preferredCoverageDays: 30,
      status: "healthy",
      isDemo: false,
      buyUrl: selected.url,
    });
    const buyId = await ctx.db.insert("companyBuys", {
      organizationId,
      itemId,
      quantity: 2,
      notes: "For school",
      closed: false,
      planVersion: 1,
      purchasingState: "researching",
      createdAt: Date.now(),
    });
    return { organizationId, userId, itemId, buyId };
  });
  return { t, owner: t.withIdentity({ subject: records.userId }), ...records };
}

test("selected item and quantity start website preparation before any price or arrival is known", async () => {
  const { t, owner, buyId } = await fixture();
  const orderId = await t.mutation(internal.companyPurchasing.prepareWebsite, {
    buyId,
    planVersion: 1,
    ...selected,
  });
  expect(orderId).not.toBeNull();
  const order = await t.query(internal.browserCheckout.read, { orderId: orderId! });
  expect(order).toMatchObject({
    browserTermsPending: true,
    reviewRequired: true,
    status: "draft",
    orderingMethod: "website",
    quantity: 2,
    requiredBy: "",
  });
  expect(order?.quotedArrival).toBeUndefined();
  expect(order?.expectedOn).toBeUndefined();
  expect(order?.approvedAt).toBeUndefined();
  expect(order?.browserPreparedKey).toBeUndefined();
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(10));
  expect(scheduled).toHaveLength(1);
  expect(scheduled[0].name).toContain("browserCheckout");
  await expect(
    owner.mutation(api.companyOrders.approve, {
      orderId: orderId!,
      reviewedKey: approvalKey(order!),
    }),
  ).rejects.toThrow(/checked|checkout|approval/i);
  // Research cannot submit or manufacture a second draft after completion.
  expect(
    await t.mutation(internal.companyPurchasing.prepareWebsite, {
      buyId,
      planVersion: 1,
      ...selected,
    }),
  ).toBeNull();
  expect(await t.run((ctx) => ctx.db.query("companyOrders").take(10))).toHaveLength(1);
});

test("chat can hand a researched item to checkout without its former complete-quote prerequisite", async () => {
  const { t, userId, organizationId, itemId, buyId } = await fixture();
  const chatId = await t.run((ctx) =>
    ctx.db.insert("taskChats", {
      userId,
      organizationId,
      task: "buy",
      contextId: buyId,
      threadId: "thread",
      currentMessageId: "message",
      busy: true,
      researchUrls: [selected.url],
      draft: { itemId, quantity: 3 },
      updatedAt: Date.now(),
    }),
  );
  const args = { chatId, messageId: "message", ...selected };
  const orderId = await t.mutation(internal.companyPurchasing.prepareWebsiteFromChat, args);
  expect(await t.mutation(internal.companyPurchasing.prepareWebsiteFromChat, args)).toBe(orderId);
  const order = await t.query(internal.browserCheckout.read, { orderId });
  expect(order).toMatchObject({
    quantity: 3,
    browserTermsPending: true,
    reviewRequired: true,
    createdBy: userId,
  });
  const chat = await t.run((ctx) => ctx.db.get("taskChats", chatId));
  expect(chat?.savedAt).toBeDefined();
  expect(chat?.resultId).toBe(buyId);
  expect(chat?.resultSummary).toContain("Opening the supplier checkout");
  expect(chat?.draft.unitPriceCents).toBeUndefined();
  expect(
    await t.mutation(internal.companyPurchasing.prepareWebsite, {
      buyId,
      planVersion: 1,
      ...selected,
    }),
  ).toBeNull();
  expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(10))).toHaveLength(
    1,
  );
});

test("stale messages and unresearched or cross-company chat contexts cannot start checkout", async () => {
  const { t, userId, organizationId, itemId, buyId } = await fixture();
  const chatId = await t.run((ctx) =>
    ctx.db.insert("taskChats", {
      userId,
      organizationId,
      task: "buy",
      contextId: buyId,
      threadId: "thread",
      currentMessageId: "current",
      busy: true,
      researchUrls: [],
      draft: { itemId, quantity: 2 },
      updatedAt: Date.now(),
    }),
  );
  await expect(
    t.mutation(internal.companyPurchasing.prepareWebsiteFromChat, {
      chatId,
      messageId: "old",
      ...selected,
    }),
  ).rejects.toThrow(/changed/);
  await expect(
    t.mutation(internal.companyPurchasing.prepareWebsiteFromChat, {
      chatId,
      messageId: "current",
      ...selected,
    }),
  ).rejects.toThrow(/Read the selected product/);
  await t.run(async (ctx) => {
    const otherOrg = await ctx.db.insert("organizations", {
      name: "Other",
      timezone: "UTC",
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 2 },
      isDemo: false,
    });
    await ctx.db.patch("taskChats", chatId, {
      organizationId: otherOrg,
      researchUrls: [selected.url],
    });
  });
  await expect(
    t.mutation(internal.companyPurchasing.prepareWebsiteFromChat, {
      chatId,
      messageId: "current",
      ...selected,
    }),
  ).rejects.toThrow(/open buy in this company/);
  expect(await t.run((ctx) => ctx.db.query("companyOrders").take(10))).toHaveLength(0);
});

test("unknown quantity and substituted stock units cannot become website draft placeholders", async () => {
  const { t, buyId } = await fixture();
  await t.run((ctx) => ctx.db.patch("companyBuys", buyId, { quantity: undefined }));
  await expect(
    t.mutation(internal.companyPurchasing.prepareWebsite, { buyId, planVersion: 1, ...selected }),
  ).rejects.toThrow(/positive quantity/);
  await t.run((ctx) => ctx.db.patch("companyBuys", buyId, { quantity: 2 }));
  await expect(
    t.mutation(internal.companyPurchasing.prepareWebsite, {
      buyId,
      planVersion: 1,
      ...selected,
      evidence: JSON.stringify({
        skuEvidence: "SKU PENCIL-CASE",
        productEvidence: "Pencils",
        unitEvidence: "individual pencils",
      }),
    }),
  ).rejects.toThrow(/stock unit/);
});

test("complete verified purchase-order offers keep their existing route and clear unpriced state", async () => {
  const { t, buyId } = await fixture();
  const orderId = await t.mutation(internal.companyPurchasing.prepareWebsite, {
    buyId,
    planVersion: 1,
    ...selected,
  });
  await t.run((ctx) =>
    ctx.db.patch("companyBuys", buyId, {
      purchasingState: "researching",
      requiredBy: "2030-12-01",
    }),
  );
  const saved = await t.mutation(internal.companyPurchasing.saveOffers, {
    buyId,
    planVersion: 1,
    offers: [
      {
        supplier: selected.supplier,
        supplierSku: selected.supplierSku,
        url: selected.url,
        email: "sales@school.example",
        poVerified: true,
        quantity: 2,
        unit: "cases",
        currency: "USD",
        unitPriceCents: 1500,
        freightCents: 250,
        taxCents: 100,
        expectedOn: "2030-11-01",
        evidence: "Verified purchase order accepted and all charges confirmed.",
      },
    ],
  });
  expect(saved).toBe(orderId);
  const order = await t.query(internal.browserCheckout.read, { orderId: orderId! });
  expect(order).toMatchObject({
    orderingMethod: "purchase_order",
    totalCents: 3350,
    reviewRequired: false,
    quotedArrival: "2030-11-01",
  });
  expect(order?.browserTermsPending).toBeUndefined();
});
