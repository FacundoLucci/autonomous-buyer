/// <reference types="vite/client" />
import { test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import {
  allowedDraft,
  allowedQuestion,
  questionMessage,
  requiredQuestion,
  visibleMessage,
} from "./deskPolicy";
import type { Doc } from "./_generated/dataModel";
import { approvalKey } from "../src/lib/buy-review";
const modules = import.meta.glob("./**/*.ts");
async function fixture() {
  const t = convexTest(schema, modules);
  const [aId, bId] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("users", { name: "A", isActive: true, role: "viewer" }),
      ctx.db.insert("users", { name: "B", isActive: true, role: "viewer" }),
    ]),
  );
  const a = t.withIdentity({ subject: aId }),
    b = t.withIdentity({ subject: bId });
  const setup = {
    companyName: "Test Company",
    shippingAddress: "100 Test Street, Chicago IL 60601",
    timezone: "America/Chicago",
    itemName: "Tape",
    quantity: "10",
    dailyUsage: "",
    unit: "rolls" as const,
  };
  await a.mutation(api.onboarding.completeFromSource, setup);
  await b.mutation(api.onboarding.completeFromSource, { ...setup, companyName: "Other Company" });
  const workspace = (await a.query(api.onboarding.getWorkspace, {}))!;
  async function draft(
    task: Doc<"taskChats">["task"],
    fields: Doc<"taskChats">["draft"],
    contextId?: string,
  ) {
    return t.run((ctx) =>
      ctx.db.insert("taskChats", {
        userId: aId,
        organizationId: workspace.organizationId,
        task,
        contextId,
        threadId: "test-thread",
        draft: fields,
        busy: false,
        updatedAt: Date.now(),
      }),
    );
  }
  return { t, a, b, aId, workspace, item: workspace.items[0], draft };
}
test("a buy starts before a supplier, price or quantity exists; retries do not duplicate it", async () => {
  const { a, item, draft } = await fixture();
  const chatId = await draft("new_buy", { itemId: item.id });
  const first = await a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" });
  expect(await a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" })).toBe(first);
  const secondChat = await draft("new_buy", { itemId: item.id });
  expect(
    await a.mutation(api.desk.commit, { chatId: secondChat, timezone: "America/Chicago" }),
  ).toBe(first);
  const result = await a.query(api.desk.snapshot, {});
  expect(result.buys).toHaveLength(1);
  expect(result.buys[0]).toMatchObject({ id: first, quantity: null, order: null, closed: false });
});
test("conversations, buys and inventory cannot cross company boundaries", async () => {
  const { a, b, item, draft } = await fixture();
  const chatId = await draft("new_buy", { itemId: item.id });
  await expect(
    b.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" }),
  ).rejects.toThrow(/Conversation not found/);
  await expect(
    b.query(api.desk.conversation, { task: "edit_item", contextId: item.id }),
  ).rejects.toThrow(/Item not found/);
  const buyId = await a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" });
  expect((await b.query(api.desk.snapshot, {})).buys).toEqual([]);
  await expect(b.mutation(api.desk.cancelBuy, { id: buyId })).rejects.toThrow(/Buy not found/);
});
test("stock cannot be changed by a buying task, and monetary terms cannot be set by an inventory task", () => {
  expect(() => allowedDraft("new_buy", { stock: 500 })).toThrow();
  expect(() => allowedDraft("add_item", { unitPriceCents: 100 })).toThrow();
  expect(() => allowedDraft("settings", { supplierEmail: "supplier@example.com" })).toThrow();
  expect(() => allowedDraft("receive", { quantity: 4 })).not.toThrow();
  expect(() => allowedQuestion("receive", "shippingAddress")).toThrow();
  expect(() => allowedQuestion("receive", "quantity")).not.toThrow();
});
test("ordinary AI answers never become UI messages", () => {
  expect(
    visibleMessage({
      agentName: "BUY HARD",
      message: { role: "assistant", content: "Here is life advice or a math answer" },
    }),
  ).toBeNull();
  expect(visibleMessage({ message: { role: "assistant", content: "Ready to save" } })).toBeNull();
  expect(
    visibleMessage({
      agentName: "BUY HARD UI",
      message: { role: "assistant", content: "How many do you need?" },
    }),
  ).toEqual({ role: "assistant", text: "How many do you need?" });
  expect(visibleMessage({ message: { role: "user", content: "Need more cups" } })?.role).toBe(
    "user",
  );
});
test("missing freight and tax remain gaps, even when the price is known", () => {
  expect(requiredQuestion("buy", { quantity: 10, supplier: "Supplier", unitPriceCents: 499 })).toBe(
    "freightCents",
  );
  expect(
    requiredQuestion("buy", {
      quantity: 10,
      supplier: "Supplier",
      unitPriceCents: 499,
      freightCents: 0,
    }),
  ).toBe("taxCents");
});
test("draft mutation enforces the task allowlist on the server", async () => {
  const { t, draft } = await fixture();
  const chatId = await draft("settings", {});
  await t.run((ctx) => ctx.db.patch("taskChats", chatId, { busy: true }));
  await expect(
    t.mutation(internal.desk.updateDraft, { chatId, draft: { stock: 999 } }),
  ).rejects.toThrow(/cannot change/);
});
test("onboarding can create a workspace without invented inventory", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "New user", isActive: true, role: "viewer" }),
  );
  const a = t.withIdentity({ subject: userId });
  const chatId = await t.run((ctx) =>
    ctx.db.insert("taskChats", {
      userId,
      task: "onboarding",
      threadId: "setup",
      draft: { companyName: "New company", shippingAddress: "100 Test Street, Chicago IL 60601" },
      busy: false,
      updatedAt: Date.now(),
    }),
  );
  await a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" });
  const workspace = await a.query(api.onboarding.getWorkspace, {});
  expect(workspace?.items).toEqual([]);
  expect(workspace?.companyName).toBe("New company");
});

test("onboarding redirects to the next setup question without exposing off-topic model prose", async () => {
  const t = convexTest(schema, modules);
  const agentPath: string = "@convex-dev/agent/test";
  const harness: { default: { register: (instance: typeof t) => void } } = await import(agentPath);
  harness.default.register(t);
  const { createThread, saveMessage } = await import("@convex-dev/agent");
  const { components } = await import("./_generated/api");
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "New user", isActive: true, role: "viewer" }),
  );
  const a = t.withIdentity({ subject: userId });
  const chatId = await t.run(async (ctx) => {
    const threadId = await createThread(ctx, components.agent, { userId });
    await saveMessage(ctx, components.agent, {
      threadId,
      message: { role: "user", content: "Give me life advice" },
    });
    await saveMessage(ctx, components.agent, {
      threadId,
      agentName: "BUY HARD",
      message: { role: "assistant", content: "This text must never reach the browser." },
    });
    return ctx.db.insert("taskChats", {
      userId,
      task: "onboarding",
      threadId,
      draft: {},
      busy: true,
      toolUsed: false,
      updatedAt: Date.now(),
    });
  });
  await t.mutation(internal.desk.finish, { chatId });
  const conversation = await a.query(api.desk.conversation, { task: "onboarding" });
  expect(conversation?.messages.map((m) => m.text)).toEqual([
    "Give me life advice",
    "What’s your company called?",
  ]);
});

test("an item with a buy in sourcing cannot be archived", async () => {
  const { a, item, draft } = await fixture();
  const chatId = await draft("new_buy", { itemId: item.id });
  await a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" });
  await expect(
    a.mutation(api.companyInventory.archiveItem, { itemId: item.id, archived: true }),
  ).rejects.toThrow(/open buy/);
});

test("an explicit stock count of zero becomes known, and recounting the same amount refreshes it", async () => {
  const { t, a, item, draft } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch("inventoryItems", item.id, {
      quantityOnHand: 0,
      stockCountKnown: false,
      stockCountedAt: 1,
    }),
  );
  const chatId = await draft("edit_item", { stock: 0 }, item.id);
  await a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" });
  const counted = (await a.query(api.onboarding.getWorkspace, {}))!.items[0];
  expect(counted.quantity).toBe(0);
  expect(counted.stockCountedAt).toBeGreaterThan(1);
  await t.run((ctx) => ctx.db.patch("inventoryItems", item.id, { stockCountedAt: 1 }));
  const recount = await draft("edit_item", { stock: 0 }, item.id);
  await a.mutation(api.desk.commit, { chatId: recount, timezone: "America/Chicago" });
  expect((await a.query(api.onboarding.getWorkspace, {}))!.items[0].stockCountedAt).toBeGreaterThan(
    1,
  );
});

test("changing a draft supplier updates the actual purchase and never approves it", async () => {
  const { a, item, draft } = await fixture();
  const start = await draft("new_buy", { itemId: item.id });
  const buyId = await a.mutation(api.desk.commit, { chatId: start, timezone: "America/Chicago" });
  const terms = {
    quantity: 10,
    unitPriceCents: 100,
    freightCents: 0,
    taxCents: 0,
    currency: "USD",
    requiredBy: "2027-01-01",
    supplier: "First supplier",
    buyUrl: "https://example.com/tape",
  };
  const purchase = await draft("buy", terms, buyId);
  await a.mutation(api.desk.commit, { chatId: purchase, timezone: "America/Chicago" });
  const change = await draft(
    "buy",
    { ...terms, supplier: "Second supplier", buyUrl: "https://example.org/tape" },
    buyId,
  );
  await a.mutation(api.desk.commit, { chatId: change, timezone: "America/Chicago" });
  const buy = (await a.query(api.desk.snapshot, {})).buys[0];
  expect(buy.order).toMatchObject({
    supplier: "Second supplier",
    buyUrl: "https://example.org/tape",
    status: "draft",
    totalCents: 1000,
  });
  expect(buy.order?.approvedAt).toBeUndefined();
});

test("manual counts and buying rules are company scoped and reject invalid values", async () => {
  const { a, b, item } = await fixture();
  await a.mutation(api.companyInventory.updateRules, {
    itemId: item.id,
    buyingPriority: "availability",
    dailyLossCents: 20000,
    lossCurrency: "USD",
    stockoutImpact: "Cannot sell soup",
  });
  await a.mutation(api.companyInventory.recordCount, { itemId: item.id, quantity: 2 });
  expect((await a.query(api.onboarding.getWorkspace, {}))!.items[0]).toMatchObject({
    quantity: 2,
    buyingPriority: "availability",
    dailyLossCents: 20000,
    stockoutImpact: "Cannot sell soup",
  });
  await expect(
    b.mutation(api.companyInventory.recordCount, { itemId: item.id, quantity: 5 }),
  ).rejects.toThrow(/Item not found/);
  await expect(
    b.mutation(api.companyInventory.updateRules, { itemId: item.id, dailyLossCents: 0 }),
  ).rejects.toThrow(/Item not found/);
  await expect(
    a.mutation(api.companyInventory.updateRules, { itemId: item.id, dailyLossCents: -1 }),
  ).rejects.toThrow();
  await expect(
    a.mutation(api.companyInventory.updateRules, { itemId: item.id, dailyLossCents: 0.2 }),
  ).rejects.toThrow();
  await expect(
    a.mutation(api.companyInventory.recordCount, { itemId: item.id, quantity: -1 }),
  ).rejects.toThrow();
});

test("the stock tool records only an explicit remaining count and a retry cannot apply it twice", async () => {
  const { t, a, item, draft } = await fixture();
  const chatId = await draft("stock_update", {}, item.id);
  await t.run((ctx) =>
    ctx.db.patch("taskChats", chatId, {
      busy: true,
      currentMessageId: "turn1",
      lastUserText: "The tape got crushed. We only have two rolls left.",
    }),
  );
  await t.mutation(internal.desk.setReportedStock, {
    chatId,
    messageId: "turn1",
    itemId: item.id,
    count: 2,
  });
  expect((await a.query(api.onboarding.getWorkspace, {}))!.items[0].quantity).toBe(2);
  await t.mutation(internal.desk.setReportedStock, {
    chatId,
    messageId: "turn1",
    itemId: item.id,
    count: 9,
  });
  expect((await a.query(api.onboarding.getWorkspace, {}))!.items[0].quantity).toBe(2);
  await t.run((ctx) =>
    ctx.db.patch("taskChats", chatId, {
      currentMessageId: "turn2",
      lastUserText: "What if we had 8 rolls left?",
      resultSummary: undefined,
    }),
  );
  await expect(
    t.mutation(internal.desk.setReportedStock, {
      chatId,
      messageId: "turn2",
      itemId: item.id,
      count: 8,
    }),
  ).rejects.toThrow(/explicit remaining count/);
  const buyingChat = await draft("buy", { itemId: item.id });
  await t.run((ctx) =>
    ctx.db.patch("taskChats", buyingChat, {
      busy: true,
      currentMessageId: "turn3",
      lastUserText: "We have two rolls left",
    }),
  );
  await expect(
    t.mutation(internal.desk.setReportedStock, {
      chatId: buyingChat,
      messageId: "turn3",
      itemId: item.id,
      count: 2,
    }),
  ).rejects.toThrow(/stock update task/);
});

test("the audit log keeps before and after values, the actor and chat source, without duplicates or cross-company access", async () => {
  const { t, a, b, aId, item, draft } = await fixture();
  const page = { paginationOpts: { numItems: 50, cursor: null } };
  await a.mutation(api.companyInventory.recordCount, { itemId: item.id, quantity: 7 });
  await a.mutation(api.companyInventory.updateRules, {
    itemId: item.id,
    buyingPriority: "availability",
    dailyLossCents: 20000,
  });
  const chatId = await draft("stock_update", {}, item.id);
  await t.run((ctx) =>
    ctx.db.patch("taskChats", chatId, {
      busy: true,
      currentMessageId: "count",
      lastUserText: "We only have two rolls left.",
    }),
  );
  const args = { chatId, messageId: "count", itemId: item.id, count: 2 };
  await t.mutation(internal.desk.setReportedStock, args);
  await t.mutation(internal.desk.setReportedStock, args);
  const entries = (await a.query(api.audit.list, page)).page.filter(
    (e) => e.entityId === item.id && e.action === "updated",
  );
  expect(entries).toHaveLength(3);
  expect(entries[0]).toMatchObject({
    actorId: aId,
    actor: "A",
    via: "chat",
    changes: expect.arrayContaining([{ field: "quantityOnHand", before: "7", after: "2" }]),
  });
  expect(entries[1].changes).toContainEqual({
    field: "dailyLossCents",
    before: null,
    after: "20000",
  });
  expect(entries[2]).toMatchObject({
    via: "manual",
    changes: expect.arrayContaining([{ field: "quantityOnHand", before: "10", after: "7" }]),
  });
  await expect(
    b.mutation(api.companyInventory.recordCount, { itemId: item.id, quantity: 9 }),
  ).rejects.toThrow();
  expect((await b.query(api.audit.list, page)).page.some((e) => e.entityId === item.id)).toBe(
    false,
  );
  expect(
    (await a.query(api.audit.list, page)).page.filter(
      (e) => e.entityId === item.id && e.action === "updated",
    ),
  ).toHaveLength(3);
});

test("buy recommendations use saved loss and stock, stay unapproved, and require a fresh comparison after a count changes", async () => {
  const { t, a, item, draft } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch("inventoryItems", item.id, {
      quantityOnHand: 2,
      estimatedDailyUsage: 1,
      stockCountedAt: Date.now(),
      buyingPriority: "cost",
      dailyLossCents: 20000,
      lossCurrency: "USD",
    }),
  );
  const begin = await draft("new_buy", { itemId: item.id });
  const buyId = await a.mutation(api.desk.commit, { chatId: begin, timezone: "America/Chicago" });
  const chatId = await draft("buy", { itemId: item.id }, buyId);
  const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const options = [
    {
      supplier: "Slow",
      url: "https://example.com/tape",
      quantity: 10,
      unit: "rolls",
      currency: "USD",
      unitPriceCents: 500,
      freightCents: 0,
      taxCents: 0,
      expectedOn: day(5),
    },
    {
      supplier: "Quick",
      url: "https://example.org/tape",
      quantity: 10,
      unit: "rolls",
      currency: "USD",
      unitPriceCents: 800,
      freightCents: 1000,
      taxCents: 0,
      expectedOn: day(1),
    },
  ];
  await t.run((ctx) =>
    ctx.db.patch("taskChats", chatId, { busy: true, currentMessageId: "compare" }),
  );
  const result = await t.mutation(internal.desk.compareOptions, {
    chatId,
    messageId: "compare",
    options,
  });
  expect(result.options[0].supplier).toBe("Quick");
  expect((await a.query(api.desk.snapshot, {})).buys[0].order).toBeNull();
  await a.mutation(api.companyInventory.recordCount, { itemId: item.id, quantity: 100 });
  await t.run((ctx) => ctx.db.patch("taskChats", chatId, { busy: false }));
  await expect(
    a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" }),
  ).rejects.toThrow(/Compare the options again/);
  await t.run((ctx) => ctx.db.patch("taskChats", chatId, { busy: true }));
  const fresh = await t.mutation(internal.desk.compareOptions, {
    chatId,
    messageId: "compare",
    options,
  });
  expect(fresh.options[0].supplier).toBe("Slow");
  await t.run((ctx) => ctx.db.patch("taskChats", chatId, { busy: false }));
  await a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" });
  const order = (await a.query(api.desk.snapshot, {})).buys[0].order!;
  expect(order).toMatchObject({ supplier: "Slow", status: "draft" });
  expect(order.approvedAt).toBeUndefined();
  await a.mutation(api.companyOrders.approve, { orderId: order._id });
  await a.mutation(api.companyOrders.place, {
    orderId: order._id,
    confirmation: "Test confirmation",
    expectedOn: day(5),
  });
  await a.mutation(api.companyOrders.receive, {
    orderId: order._id,
    quantity: 10,
    requestKey: "audit-receipt",
  });
  const log = (await a.query(api.audit.list, { paginationOpts: { numItems: 100, cursor: null } }))
    .page;
  expect(
    log.some(
      (e) =>
        e.entityId === item.id &&
        e.changes.some(
          (c) =>
            c.field === "forecastQuantity" &&
            c.before === "100" &&
            Math.abs(Number(c.after) - 110) < 0.01,
        ),
    ),
  ).toBe(true);
  expect(
    log.some(
      (e) =>
        e.entityId === order._id &&
        e.changes.some((c) => c.field === "status" && c.after === "received"),
    ),
  ).toBe(true);
});

test("a quantity revision invalidates old terms and approval until a current quote is checked", async () => {
  const { t, a, item, draft } = await fixture();
  const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const start = await draft("new_buy", { itemId: item.id });
  const buyId = await a.mutation(api.desk.commit, { chatId: start, timezone: "America/Chicago" });
  const oldTerms = {
    supplier: "Supplier",
    buyUrl: "https://example.com/tape",
    quantity: 20,
    unitPriceCents: 2000,
    freightCents: 0,
    taxCents: 0,
    currency: "USD",
    requiredBy: day(3),
  };
  const prepare = await draft("buy", oldTerms, buyId);
  await a.mutation(api.desk.commit, { chatId: prepare, timezone: "America/Chicago" });
  const original = (await a.query(api.desk.snapshot, {})).buys[0].order!;
  const chatId = await draft("buy", { ...oldTerms, itemId: item.id, unit: "rolls" }, buyId);
  await t.run((ctx) =>
    ctx.db.patch("taskChats", chatId, {
      busy: true,
      currentMessageId: "change",
      lastUserText: "I actually need 24 rolls.",
    }),
  );
  const changed = await t.mutation(internal.desk.updateDraft, {
    chatId,
    draft: { quantity: 24, unitPriceCents: 2000, freightCents: 0, taxCents: 0, expectedOn: day(3) },
  });
  expect(changed.quantity).toBe(24);
  expect(changed.unitPriceCents).toBeUndefined();
  expect(changed.freightCents).toBeUndefined();
  expect(changed.taxCents).toBeUndefined();
  expect(changed.expectedOn).toBeUndefined();
  await expect(
    a.mutation(api.companyOrders.approve, {
      orderId: original._id,
      reviewedKey: approvalKey(original),
    }),
  ).rejects.toThrow(/checked again/);
  const revised = { ...oldTerms, quantity: 24, freightCents: 2000, expectedOn: day(4) };
  await expect(
    t.mutation(internal.desk.verifyTerms, {
      chatId,
      messageId: "change",
      draft: revised,
      source: "public_page",
      sourceUrl: oldTerms.buyUrl,
    }),
  ).rejects.toThrow(/Read the current source/);
  await expect(
    t.mutation(internal.desk.verifyTerms, {
      chatId,
      messageId: "change",
      draft: revised,
      source: "supplier_quote",
    }),
  ).rejects.toThrow(/supplier quote/);
  await t.mutation(internal.desk.noteResearch, {
    chatId,
    messageId: "change",
    url: oldTerms.buyUrl,
  });
  await t.mutation(internal.desk.verifyTerms, {
    chatId,
    messageId: "change",
    draft: revised,
    source: "public_page",
    sourceUrl: oldTerms.buyUrl,
  });
  await t.run((ctx) => ctx.db.patch("taskChats", chatId, { busy: false }));
  await a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" });
  const order = (await a.query(api.desk.snapshot, {})).buys[0].order!;
  expect(order).toMatchObject({
    quantity: 24,
    totalCents: 50000,
    quotedArrival: day(4),
    status: "draft",
  });
  expect(order.reviewRequired).toBeUndefined();
  await expect(
    a.mutation(api.companyOrders.approve, {
      orderId: order._id,
      reviewedKey: approvalKey(original),
    }),
  ).rejects.toThrow(/buy changed/);
  await a.mutation(api.companyOrders.approve, {
    orderId: order._id,
    reviewedKey: approvalKey(order),
  });
  const another = await draft("buy", { ...revised, itemId: item.id }, buyId);
  await t.run((ctx) => ctx.db.patch("taskChats", another, { busy: true }));
  await expect(
    t.mutation(internal.desk.updateDraft, { chatId: another, draft: { quantity: 28 } }),
  ).rejects.toThrow(/unapproved/);
});

test("address confirmation shows the address or asks for manual entry", () => {
  for (const shippingAddress of [undefined, "", "   "]) {
    const message = questionMessage("confirmAddress", { shippingAddress });
    expect(message).toContain("I don’t have a delivery address yet.");
    expect(message).toContain("postal code and country");
    expect(message).not.toContain("Is this the right");
  }
  expect(
    questionMessage("confirmAddress", {
      shippingAddress: "  123 Main St, Chicago, IL 60601, USA  ",
    }),
  ).toBe(
    "123 Main St, Chicago, IL 60601, USA\n\nIs this the right delivery address? If not, enter the correct one.",
  );
});

test("manual setup recovers an empty draft and opens a workspace without an agent reply", async () => {
  const { t, b } = await fixture();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "New user", isActive: true, role: "viewer" }),
  );
  const user = t.withIdentity({ subject: userId });
  const chatId = await t.run((ctx) =>
    ctx.db.insert("taskChats", {
      userId,
      task: "onboarding",
      threadId: "manual-setup",
      draft: {},
      busy: false,
      updatedAt: Date.now(),
    }),
  );
  const details = {
    chatId,
    companyName: "My company",
    shippingAddress: "123 Baker St, Chicago, IL 60601, USA",
  };
  await expect(b.mutation(api.desk.setOnboardingDetails, details)).rejects.toThrow(
    "Conversation not found",
  );
  await expect(
    user.mutation(api.desk.setOnboardingDetails, { ...details, shippingAddress: " " }),
  ).rejects.toThrow();
  await user.mutation(api.desk.setOnboardingDetails, details);
  const id = await user.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" });
  const workspace = await user.query(api.onboarding.getWorkspace, {});
  expect(workspace?.organizationId).toBe(id);
  expect(await user.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" })).toBe(id);
});

test("manual setup cannot change another task or a busy conversation", async () => {
  const { t, a, draft } = await fixture();
  const chatId = await draft("onboarding", {});
  const details = {
    chatId,
    companyName: "Company",
    shippingAddress: "100 Main St, Chicago IL 60601",
  };
  await t.run((ctx) => ctx.db.patch("taskChats", chatId, { busy: true }));
  await expect(a.mutation(api.desk.setOnboardingDetails, details)).rejects.toThrow(
    "Wait for the current reply",
  );
  const otherId = await draft("settings", {});
  await expect(
    a.mutation(api.desk.setOnboardingDetails, { ...details, chatId: otherId }),
  ).rejects.toThrow("no longer editable");
});

test("onboarding help is scoped to the active request and does not edit the form", async () => {
  const { t, draft } = await fixture();
  const chatId = await draft("onboarding", { companyName: "LUHV FOOD" });
  await t.run((ctx) =>
    ctx.db.patch("taskChats", chatId, { busy: true, currentMessageId: "current" }),
  );
  await t.mutation(internal.desk.setOnboardingHelp, {
    chatId,
    messageId: "current",
    kind: "example",
    field: "shippingAddress",
  });
  const chat = await t.run((ctx) => ctx.db.get("taskChats", chatId));
  expect(chat?.draft).toEqual({ companyName: "LUHV FOOD" });
  expect(chat?.resultSummary).toContain("[postal code]");
  expect(chat?.question).toBe("shippingAddress");
  await expect(
    t.mutation(internal.desk.setOnboardingHelp, {
      chatId,
      messageId: "old",
      kind: "example",
      field: "current",
    }),
  ).rejects.toThrow(/no longer editable/);
  const other = await draft("settings", {});
  await t.run((ctx) =>
    ctx.db.patch("taskChats", other, { busy: true, currentMessageId: "current" }),
  );
  await expect(
    t.mutation(internal.desk.setOnboardingHelp, {
      chatId: other,
      messageId: "current",
      kind: "example",
      field: "current",
    }),
  ).rejects.toThrow(/no longer editable/);
});
