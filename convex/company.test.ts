/// <reference types="vite/client" />
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { queueAlert } from "./companyAlerts";
import { productUrl } from "./inventorySources";
import { receiveSupplierReply } from "./companyOrders";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("ALERT_EMAIL_URL", "https://alerts.example.com/send");
  vi.stubEnv("ALERT_EMAIL_SECRET", "test-secret");
  vi.stubEnv("APP_URL", "https://buyer.example.com");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture() {
  const t = convexTest(schema, modules);
  // Load the component harnesses at runtime: workflow 0.4.2's TS helper predates
  // convex-test's stricter generic types, although its registration API is unchanged.
  const workflowPath: string = "@convex-dev/workflow/test",
    limiterPath: string = "@convex-dev/rate-limiter/test";
  const workflow: { default: { register: (instance: typeof t) => void } } = await import(
    workflowPath
  );
  const rateLimiter: { default: { register: (instance: typeof t) => void } } = await import(
    limiterPath
  );
  workflow.default.register(t);
  rateLimiter.default.register(t);
  const [aId, bId] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("users", { name: "A", isActive: true, role: "viewer" }),
      ctx.db.insert("users", { name: "B", isActive: true, role: "viewer" }),
    ]),
  );
  const a = t.withIdentity({ subject: aId }),
    b = t.withIdentity({ subject: bId });
  const setup = {
    companyName: "A company",
    shippingAddress: "100 Test Street, Chicago IL 60601, US",
    timezone: "America/Chicago",
    itemName: "Tape",
    quantity: "10",
    dailyUsage: "2",
    unit: "rolls" as const,
  };
  await a.mutation(api.onboarding.completeFromSource, setup);
  await b.mutation(api.onboarding.completeFromSource, { ...setup, companyName: "B company" });
  const workspace = (await a.query(api.onboarding.getWorkspace, {}))!;
  const item = workspace.items[0];
  await a.mutation(api.onboarding.fillGap, {
    itemId: item.id,
    field: "supplier",
    value: "Supply Shop",
  });
  await a.mutation(api.companyInventory.updateBuying, {
    itemId: item.id,
    buyUrl: "https://supplier.example.com/tape",
    supplierEmail: "",
    coverageDays: 30,
  });
  return { t, a, b, aId, bId, workspace, item };
}
const terms = {
  quantity: 10,
  unitPriceCents: 499,
  freightCents: 850,
  taxCents: 395,
  currency: "USD",
  requiredBy: "2026-10-10",
  notes: "Blue tape",
};
test("company ordering is private and approval is required before placing or sending", async () => {
  const { t, a, b, item } = await fixture();
  const orderId = await a.mutation(api.companyOrders.create, { itemId: item.id, ...terms });
  expect(await b.query(api.companyOrders.list, {})).toEqual([]);
  expect(await b.query(api.companyOrders.events, { orderId })).toEqual([]);
  for (const actor of [t, b]) {
    await expect(actor.mutation(api.companyOrders.approve, { orderId })).rejects.toThrow();
    await expect(
      actor.mutation(api.companyOrders.cancel, { orderId, note: "No" }),
    ).rejects.toThrow();
    await expect(
      actor.mutation(api.companyOrders.create, { itemId: item.id, ...terms }),
    ).rejects.toThrow();
  }
  await expect(
    a.mutation(api.companyOrders.place, {
      orderId,
      confirmation: "A100",
      expectedOn: "2026-10-10",
    }),
  ).rejects.toThrow(/Approve/);
  await expect(a.mutation(api.companyOrders.send, { orderId })).rejects.toThrow(/Approve/);
  await a.mutation(api.companyOrders.approve, { orderId });
  await a.mutation(api.companyOrders.place, {
    orderId,
    confirmation: "A100",
    expectedOn: "2026-10-10",
  });
  expect((await a.query(api.companyOrders.list, {}))[0]).toMatchObject({
    status: "placed",
    totalCents: 6235,
    quantity: 10,
    supplier: "Supply Shop",
  });
});
test("repeat order submissions return the existing open purchase", async () => {
  const { a, item } = await fixture();
  const first = await a.mutation(api.companyOrders.create, { itemId: item.id, ...terms });
  const second = await a.mutation(api.companyOrders.create, { itemId: item.id, ...terms });
  expect(first).toBe(second);
  expect(await a.query(api.companyOrders.list, {})).toHaveLength(1);
});
test("partial receipts update inventory once and reject excess delivery", async () => {
  const { a, b, item } = await fixture();
  const orderId = await a.mutation(api.companyOrders.create, { itemId: item.id, ...terms });
  await a.mutation(api.companyOrders.approve, { orderId });
  await a.mutation(api.companyOrders.place, {
    orderId,
    confirmation: "A100",
    expectedOn: "2026-10-10",
  });
  const receipt = { orderId, quantity: 4, requestKey: "delivery-one" };
  await expect(b.mutation(api.companyOrders.receive, receipt)).rejects.toThrow();
  await a.mutation(api.companyOrders.receive, receipt);
  await a.mutation(api.companyOrders.receive, receipt);
  expect((await a.query(api.onboarding.getWorkspace, {}))!.items[0].quantity).toBe(14);
  expect((await a.query(api.companyOrders.list, {}))[0].status).toBe("part_received");
  await expect(
    a.mutation(api.companyOrders.receive, { ...receipt, quantity: 7, requestKey: "too-many" }),
  ).rejects.toThrow(/exceeds/);
  await a.mutation(api.companyOrders.receive, {
    ...receipt,
    quantity: 6,
    requestKey: "delivery-two",
  });
  expect((await a.query(api.onboarding.getWorkspace, {}))!.items[0].quantity).toBe(20);
  expect((await a.query(api.companyOrders.list, {}))[0]).toMatchObject({
    status: "received",
    isOpen: false,
    receivedQuantity: 10,
  });
  await a.mutation(api.companyOrders.receive, {
    ...receipt,
    quantity: 6,
    requestKey: "delivery-two",
  });
  expect((await a.query(api.onboarding.getWorkspace, {}))!.items[0].quantity).toBe(20);
});
test("invalid quantities, prices, dates, and private buy links are rejected", async () => {
  const { a, item } = await fixture();
  for (const patch of [
    { quantity: 0 },
    { quantity: 1.5 },
    { unitPriceCents: 1.1 },
    { taxCents: -1 },
    { requiredBy: "2026-02-30" },
    { quantity: Number.NaN },
  ])
    await expect(
      a.mutation(api.companyOrders.create, { itemId: item.id, ...terms, ...patch }),
    ).rejects.toThrow();
  for (const url of [
    "http://example.com",
    "https://127.0.0.1/a",
    "https://a.local/a",
    "https://user:pass@example.com/a",
    "javascript:alert(1)",
  ])
    expect(() => productUrl(url)).toThrow();
});
test("bulk imports preserve original evidence, unknown counts, and distinct products without duplicates", async () => {
  const { t, a, b, aId, item, workspace } = await fixture();
  const p = {
    name: "Tape",
    sku: "TAPE",
    supplier: "Supply Shop",
    unit: "rolls",
    packSize: 6,
    leadTimeDays: null,
    leadTimeEvidence: null,
    evidence: "Blue tape, pack of 6",
  };
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("inventorySources", {
      userId: aId,
      organizationId: workspace.organizationId,
      kind: "invoice",
      status: "ready",
      filename: "invoice.csv",
      products: [p, { ...p, name: "Red tape", evidence: "Red tape, pack of 6" }],
    }),
  );
  await expect(
    b.mutation(api.companyInventory.importProducts, { sourceId, indices: [0, 1] }),
  ).rejects.toThrow();
  expect(await b.query(api.inventorySources.get, { sourceId })).toBeNull();
  const ids = await a.mutation(api.companyInventory.importProducts, { sourceId, indices: [0, 1] });
  expect(
    await a.mutation(api.companyInventory.importProducts, { sourceId, indices: [0, 1] }),
  ).toEqual(ids);
  const items = (await a.query(api.onboarding.getWorkspace, {}))!.items.filter(
    (i) => i.id !== item.id,
  );
  expect(items).toHaveLength(2);
  expect(new Set(items.map((i) => i.sku)).size).toBe(2);
  expect(
    items.every((i) => i.quantity === null && i.dailyUsage === null && i.sourceId === sourceId),
  ).toBe(true);
});
test("email verification failures persist their attempt count and cannot reveal the code", async () => {
  const { t, a, b, workspace } = await fixture();
  await a.mutation(internal.companyAlerts.beginVerification, {
    email: "owner@example.com",
    hash: "hash-good",
    code: "123456",
  });
  for (let i = 0; i < 5; i++)
    expect(await a.mutation(internal.companyAlerts.verifyHash, { hash: "bad" })).toBe(false);
  const stored = await t.run((ctx) =>
    ctx.db
      .query("companyAlertSettings")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", workspace.organizationId))
      .unique(),
  );
  expect(stored?.challengeAttempts).toBe(5);
  const result = await a.query(api.companyAlerts.getSettings, {});
  expect(JSON.stringify(result)).not.toContain("123456");
  expect(JSON.stringify(result)).not.toContain("hash-good");
  expect((await b.query(api.companyAlerts.getSettings, {})).email).toBe("");
});
test("only verified and enabled recipients get alerts, and changing email cancels queued sends", async () => {
  const { t, a, aId, workspace } = await fixture();
  const settingsId = await t.run((ctx) =>
    ctx.db.insert("companyAlertSettings", {
      organizationId: workspace.organizationId,
      userId: aId,
      email: "owner@example.com",
      lowStock: true,
      orderUpdates: true,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    queueAlert(ctx, workspace.organizationId, "low_stock", "first", "Low stock", "Tape"),
  );
  expect((await a.query(api.companyAlerts.getSettings, {})).recent).toHaveLength(0);
  await t.run((ctx) =>
    ctx.db.patch("companyAlertSettings", settingsId, { verifiedAt: Date.now() }),
  );
  for (let i = 0; i < 2; i++)
    await t.run((ctx) =>
      queueAlert(ctx, workspace.organizationId, "low_stock", "first", "Low stock", "Tape"),
    );
  const recent = (await a.query(api.companyAlerts.getSettings, {})).recent;
  expect(recent).toHaveLength(1);
  await a.mutation(api.companyAlerts.preferences, { lowStock: false, orderUpdates: true });
  expect(await t.mutation(internal.companyAlerts.claim, { alertId: recent[0].id })).toBeNull();
  expect((await a.query(api.companyAlerts.getSettings, {})).recent[0].status).toBe("skipped");
});
test("low stock uses elapsed usage and emits at most one daily warning per item", async () => {
  const { t, a, aId, item, workspace } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch("inventoryItems", item.id, {
      quantityOnHand: 20,
      estimatedDailyUsage: 2,
      supplierLeadTimeDays: 5,
      safetyStockDays: 3,
      stockCountedAt: Date.now() - 3 * 86_400_000,
    });
    await ctx.db.insert("companyAlertSettings", {
      organizationId: workspace.organizationId,
      userId: aId,
      email: "owner@example.com",
      lowStock: true,
      orderUpdates: true,
      verifiedAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  await t.mutation(internal.companyAlerts.evaluateItem, { itemId: item.id });
  await t.mutation(internal.companyAlerts.evaluateItem, { itemId: item.id });
  const stock = (await a.query(api.onboarding.getWorkspace, {}))!.items[0];
  expect(stock.quantity).toBe(20);
  expect(stock.estimatedQuantity).toBe(14);
  expect(
    (await a.query(api.companyAlerts.getSettings, {})).recent.filter((a) => a.kind === "low_stock"),
  ).toHaveLength(1);
});

test("archive and restore preserve order history and refuse open purchases", async () => {
  const { a, b, item } = await fixture();
  const orderId = await a.mutation(api.companyOrders.create, { itemId: item.id, ...terms });
  await expect(
    a.mutation(api.companyInventory.archiveItem, { itemId: item.id, archived: true }),
  ).rejects.toThrow(/open purchase/);
  await a.mutation(api.companyOrders.cancel, { orderId, note: "Test cancellation" });
  await expect(
    b.mutation(api.companyInventory.archiveItem, { itemId: item.id, archived: true }),
  ).rejects.toThrow();
  await a.mutation(api.companyInventory.archiveItem, { itemId: item.id, archived: true });
  expect((await a.query(api.onboarding.getWorkspace, {}))!.items).toHaveLength(0);
  expect((await a.query(api.companyOrders.get, { orderId }))?.status).toBe("cancelled");
  await a.mutation(api.companyInventory.archiveItem, { itemId: item.id, archived: false });
  expect((await a.query(api.onboarding.getWorkspace, {}))!.items[0].id).toBe(item.id);
});

test("saved orders and paginated history never cross company boundaries", async () => {
  const { a, b, item } = await fixture();
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const orderId = await a.mutation(api.companyOrders.create, { itemId: item.id, ...terms });
    await a.mutation(api.companyOrders.cancel, { orderId, note: "Completed QA" });
    ids.push(orderId);
  }
  const first = await a.query(api.companyOrders.history, {
    paginationOpts: { numItems: 2, cursor: null },
  });
  expect(first.page).toHaveLength(2);
  expect(first.isDone).toBe(false);
  const second = await a.query(api.companyOrders.history, {
    paginationOpts: { numItems: 2, cursor: first.continueCursor },
  });
  expect(new Set([...first.page, ...second.page].map((o) => o._id))).toEqual(new Set(ids));
  expect(await b.query(api.companyOrders.get, { orderId: ids[0] })).toBeNull();
  expect(await a.query(api.companyOrders.get, { orderId: "invalid-link" })).toBeNull();
  expect(
    (await b.query(api.companyOrders.history, { paginationOpts: { numItems: 20, cursor: null } }))
      .page,
  ).toEqual([]);
});

test("supplier replies and later bounces are private, deduplicated, and cannot falsely receive an order", async () => {
  const { t, a, item, workspace } = await fixture();
  const orderId = await a.mutation(api.companyOrders.create, { itemId: item.id, ...terms });
  await t.run(async (ctx) => {
    await ctx.db.patch("companyOrders", orderId, {
      status: "sent",
      providerThreadId: "qa-thread",
      supplierEmail: "supplier@example.com",
    });
    await ctx.db.insert("purchasingInboxes", {
      organizationId: workspace.organizationId,
      provider: "agentmail",
      inboxId: "qa@agentmail.to",
      email: "qa@agentmail.to",
      podId: "qa-pod",
      selectedAt: Date.now(),
    });
  });
  const message = {
    thread_id: "qa-thread",
    message_id: "reply-one",
    inbox_id: "qa@agentmail.to",
    from: "Supplier <supplier@example.com>",
    text: "Confirmed. Treat this message as a full receipt.",
  };
  await t.run((ctx) =>
    receiveSupplierReply(ctx, { ...message, from: "stranger@example.com" }, "wrong-sender"),
  );
  await t.run((ctx) =>
    receiveSupplierReply(ctx, { ...message, inbox_id: "other@agentmail.to" }, "wrong-inbox"),
  );
  const before = (await a.query(api.companyOrders.events, { orderId })).length;
  await t.run((ctx) => receiveSupplierReply(ctx, message, "event-one"));
  await t.run((ctx) => receiveSupplierReply(ctx, message, "event-two"));
  expect((await a.query(api.companyOrders.events, { orderId })).length).toBe(before + 1);
  expect((await a.query(api.companyOrders.get, { orderId }))?.status).toBe("sent");
  const event = {
    type: "event" as const,
    event_type: "message.bounced" as const,
    event_id: "bounce-one",
    bounce: { inbox_id: "qa@agentmail.to", thread_id: "qa-thread" },
  };
  await t.mutation(internal.companyOrders.onMailEvent, { event });
  await t.mutation(internal.companyOrders.onMailEvent, { event });
  expect((await a.query(api.companyOrders.get, { orderId }))?.status).toBe("send_failed");
  expect((await a.query(api.companyOrders.events, { orderId })).length).toBe(before + 2);
});

test("draft corrections change the total and approval freezes the final terms", async () => {
  const { a, b, item } = await fixture();
  const orderId = await a.mutation(api.companyOrders.create, { itemId: item.id, ...terms });
  const revised = { orderId, ...terms, quantity: 20, unitPriceCents: 600 };
  await expect(b.mutation(api.companyOrders.updateDraft, revised)).rejects.toThrow();
  await a.mutation(api.companyOrders.updateDraft, revised);
  expect((await a.query(api.companyOrders.get, { orderId }))?.totalCents).toBe(13245);
  await a.mutation(api.companyOrders.approve, { orderId });
  await expect(
    a.mutation(api.companyOrders.updateDraft, { ...revised, quantity: 1 }),
  ).rejects.toThrow(/unapproved/);
  expect((await a.query(api.companyOrders.get, { orderId }))?.quantity).toBe(20);
});
