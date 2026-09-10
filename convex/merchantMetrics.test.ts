/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { AgentMail } from "@agentmail/convex";
import { api, internal } from "./_generated/api";
import { approvalKey } from "../src/lib/buy-review";
import { receiveSupplierReply } from "./companyOrders";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function fixture(channel: "website" | "purchase_order" = "website") {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const orderId = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Private company",
      timezone: "UTC",
      isDemo: false,
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 2 },
    });
    const createdBy = await ctx.db.insert("users", {
      organizationId,
      isActive: true,
      role: "buyer",
    });
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
    await ctx.db.insert("purchasingInboxes", {
      organizationId,
      provider: "agentmail",
      inboxId: "private@agentmail.to",
      email: "private@agentmail.to",
      selectedAt: Date.now(),
    });
    return ctx.db.insert("companyOrders", {
      organizationId,
      createdBy,
      inventoryItemId,
      number: "PRIVATE-PO1",
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
      supplier: "Private supplier name",
      buyUrl: channel === "website" ? "https://www.amazon.com/product" : undefined,
      supplierEmail: "orders@webstaurantstore.com",
      shipTo: "Private address",
      requiredBy: "2026-12-01",
      quotedArrival: "2026-12-01",
      notes: "",
      status: channel === "website" ? "approved" : "sent",
      isOpen: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      approvedAt: Date.now(),
      orderingMethod: channel,
      browserJobId: "job",
      browserPhase: "submit",
      browserCommitAuthorizedAt: Date.now(),
      providerOutboundId: "sent-by-app",
      providerThreadId: "thread",
      purchaseOrderSentAt: Date.now(),
    });
  });
  const order = (await t.query(internal.browserCheckout.read, { orderId }))!;
  const browserArgs = {
    orderId,
    jobId: "job",
    intent: approvalKey(order),
    result: {
      id: "job",
      state: "confirmed",
      confirmation: "PRIVATE-RECEIPT",
      snapshot: {
        sku: "G1",
        unit: "case",
        quantity: 2,
        currency: "USD",
        unitPriceCents: 1000,
        freightCents: 0,
        taxCents: 0,
        totalCents: 2000,
        shipTo: "Private address",
        expectedOn: "2026-12-01",
      },
    },
  };
  const reply = {
    thread_id: "thread",
    inbox_id: "private@agentmail.to",
    from: "orders@webstaurantstore.com",
    message_id: "reply",
    text: "Confirmed: yes\nPurchase order: PRIVATE-PO1\nConfirmation: PRIVATE-RECEIPT\nSKU: G1\nQuantity: 2 case\nTotal: USD 20.00\nArrival: 2026-12-01",
  };
  return { t, order, orderId, browserArgs, reply };
}

test("confirmed website receipt automatically lists merchant once and exposes only counters", async () => {
  const { t, browserArgs } = await fixture();
  expect(await t.query(api.merchantMetrics.summary, {})).toEqual({
    totalOrders: 0,
    merchantCount: 0,
    merchants: [],
  });
  await t.mutation(internal.browserCheckout.apply, browserArgs);
  await t.mutation(internal.browserCheckout.apply, browserArgs);
  expect(await t.query(api.merchantMetrics.summary, {})).toEqual({
    totalOrders: 1,
    merchantCount: 1,
    merchants: [{ name: "Amazon", domain: "amazon.com", orders: 1 }],
  });
});

test("email-only supplier confirmation automatically lists merchant, duplicate replies do not count", async () => {
  const { t, reply } = await fixture("purchase_order");
  await t.run((ctx) => receiveSupplierReply(ctx, reply, "event"));
  await t.run((ctx) => receiveSupplierReply(ctx, reply, "retry"));
  await t.run((ctx) => receiveSupplierReply(ctx, { ...reply, message_id: "second" }, "another"));
  expect(await t.query(api.merchantMetrics.summary, {})).toEqual({
    totalOrders: 1,
    merchantCount: 1,
    merchants: [{ name: "WebstaurantStore", domain: "webstaurantstore.com", orders: 1 }],
  });
});

test("email without app-sent evidence and changed or wrong-sender confirmations never count", async () => {
  const { t, orderId, reply } = await fixture("purchase_order");
  await t.run((ctx) =>
    receiveSupplierReply(ctx, { ...reply, from: "other@webstaurantstore.com" }, "wrong"),
  );
  await t.run((ctx) =>
    receiveSupplierReply(
      ctx,
      { ...reply, message_id: "changed", text: reply.text.replace("USD 20.00", "USD 30.00") },
      "changed",
    ),
  );
  expect((await t.query(api.merchantMetrics.summary, {})).totalOrders).toBe(0);
  await t.run((ctx) => ctx.db.patch("companyOrders", orderId, { purchaseOrderSentAt: undefined }));
  await t.run((ctx) => receiveSupplierReply(ctx, reply, "matching"));
  expect((await t.query(api.merchantMetrics.summary, {})).totalOrders).toBe(0);
});

test("manual placement, demo organization, demo inventory and unknown browser outcomes do not count", async () => {
  for (const mode of ["manual", "demoOrg", "demoItem", "unknown", "noCommit"] as const) {
    const { t, order, orderId, browserArgs } = await fixture();
    if (mode === "manual") {
      await t.withIdentity({ subject: order.createdBy }).mutation(api.companyOrders.place, {
        orderId,
        confirmation: "manually-reported",
        expectedOn: "2026-12-01",
      });
    } else {
      await t.run(async (ctx) => {
        if (mode === "demoOrg")
          await ctx.db.patch("organizations", order.organizationId, { isDemo: true });
        if (mode === "demoItem")
          await ctx.db.patch("inventoryItems", order.inventoryItemId, { isDemo: true });
        if (mode === "noCommit")
          await ctx.db.patch("companyOrders", orderId, { browserCommitAuthorizedAt: undefined });
      });
      await t.mutation(
        internal.browserCheckout.apply,
        mode === "unknown"
          ? { ...browserArgs, result: { id: "job", state: "outcome_unknown" } }
          : browserArgs,
      );
    }
    expect((await t.query(api.merchantMetrics.summary, {})).totalOrders).toBe(0);
  }
});

test("assessing or approving a supplier does not certify a successful order", async () => {
  const { t, order } = await fixture();
  await t.run((ctx) =>
    ctx.db.insert("companySuppliers", {
      organizationId: order.organizationId,
      name: "Amazon",
      url: "https://amazon.com",
      domain: "amazon.com",
      approved: true,
      channels: "browser",
      assessmentState: "complete",
      readiness: "ready",
      notes: "Tested page assessment",
      assessmentVersion: 1,
      updatedAt: Date.now(),
    }),
  );
  expect((await t.query(api.merchantMetrics.summary, {})).merchants).toEqual([]);
});

test("top twenty list stays bounded while global totals include every merchant", async () => {
  const { t, order, browserArgs } = await fixture();
  for (let index = 0; index < 23; index++) {
    const { _id: _orderId, _creationTime: _created, ...fields } = order;
    const orderId = await t.run((ctx) =>
      ctx.db.insert("companyOrders", {
        ...fields,
        buyUrl: `https://merchant${index}.com/product`,
        providerThreadId: `thread${index}`,
      }),
    );
    const updated = (await t.query(internal.browserCheckout.read, { orderId }))!;
    await t.mutation(internal.browserCheckout.apply, {
      ...browserArgs,
      orderId,
      intent: approvalKey(updated),
    });
  }
  const result = await t.query(api.merchantMetrics.summary, {});
  expect(result.totalOrders).toBe(23);
  expect(result.merchantCount).toBe(23);
  expect(result.merchants).toHaveLength(20);
  expect(result.merchants.every((m) => m.name === m.domain && m.orders === 1)).toBe(true);
});

test("shared mailbox merchants stay distinct without publishing their email addresses", async () => {
  const { t, order, reply } = await fixture("purchase_order");
  for (const [index, supplierEmail, supplier] of [
    [1, "vendor-one@gmail.com", "First supplier"],
    [2, "vendor-two@gmail.com", "Second supplier"],
  ] as const) {
    const { _id: _orderId, _creationTime: _created, ...fields } = order;
    await t.run((ctx) =>
      ctx.db.insert("companyOrders", {
        ...fields,
        supplierEmail,
        supplier,
        providerThreadId: `email-${index}`,
      }),
    );
    await t.run((ctx) =>
      receiveSupplierReply(
        ctx,
        { ...reply, thread_id: `email-${index}`, from: supplierEmail },
        `mail-${index}`,
      ),
    );
  }
  const result = await t.query(api.merchantMetrics.summary, {});
  expect(result.totalOrders).toBe(2);
  expect(result.merchantCount).toBe(2);
  expect(result.merchants.map((m) => m.name).sort()).toEqual(["First supplier", "Second supplier"]);
  expect(result.merchants.every((m) => m.domain === "")).toBe(true);
  expect(JSON.stringify(result)).not.toContain("gmail");
});

test("evidence-backed ordinary email extraction counts only once", async () => {
  const { t, orderId, order } = await fixture("purchase_order");
  const body = "Confirmed PRIVATE-RECEIPT: G1, 2 case, USD 20.00, arrival 2026-12-01.";
  await t.run((ctx) =>
    ctx.db.insert("companyOrderEvents", {
      orderId,
      kind: "supplier_reply",
      summary: body,
      requestKey: "reply:ordinary",
      createdAt: Date.now(),
    }),
  );
  const args = {
    orderId,
    replyKey: "reply:ordinary",
    extracted: JSON.stringify({
      confirmed: true,
      reference: "PRIVATE-RECEIPT",
      sku: order.sku,
      quantity: "2 case",
      total: "USD 20.00",
      arrival: "2026-12-01",
      evidence: {
        confirmation: "Confirmed",
        reference: "PRIVATE-RECEIPT",
        sku: "G1",
        quantity: "2 case",
        total: "USD 20.00",
        arrival: "2026-12-01",
      },
    }),
  };
  await t.mutation(internal.companyConfirmation.apply, args);
  await t.mutation(internal.companyConfirmation.apply, args);
  expect((await t.query(api.merchantMetrics.summary, {})).totalOrders).toBe(1);
});

test("delivery reconciliation records sent evidence before matching email confirmation counts", async () => {
  const { t, orderId, reply } = await fixture("purchase_order");
  await t.run((ctx) =>
    ctx.db.patch("companyOrders", orderId, { status: "sending", purchaseOrderSentAt: undefined }),
  );
  vi.spyOn(AgentMail.prototype, "status").mockResolvedValue({
    status: "sent",
    threadId: "thread",
    agentmailMessageId: "provider-message",
    errorMessage: null,
  });
  await t.mutation(internal.companyOrders.reconcile, { orderId, attempt: 0 });
  expect(
    (await t.query(internal.browserCheckout.read, { orderId }))?.purchaseOrderSentAt,
  ).toBeGreaterThan(0);
  expect((await t.query(api.merchantMetrics.summary, {})).totalOrders).toBe(0);
  await t.run((ctx) => receiveSupplierReply(ctx, reply, "sent-and-confirmed"));
  expect((await t.query(api.merchantMetrics.summary, {})).totalOrders).toBe(1);
});

test("reserved test websites and email domains never enter public metrics", async () => {
  for (const domain of ["shop.example.com", "example.net", "example.org", "supplier.test"]) {
    const { t, orderId, reply } = await fixture("purchase_order");
    await t.run((ctx) =>
      ctx.db.patch("companyOrders", orderId, {
        buyUrl: `https://${domain}/product`,
        supplierEmail: `orders@${domain}`,
      }),
    );
    await t.run((ctx) =>
      receiveSupplierReply(ctx, { ...reply, from: `orders@${domain}` }, "test-domain"),
    );
    expect((await t.query(api.merchantMetrics.summary, {})).totalOrders).toBe(0);
  }
});
