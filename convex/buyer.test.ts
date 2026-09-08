/// <reference types="vite/client" />
import { test, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { saveMessage } from "@convex-dev/agent";
import schema from "./schema";
import { api, components, internal } from "./_generated/api";
import { orderEvent } from "./companyOrders";
import { approvalKey } from "../src/lib/buy-review";

const modules = import.meta.glob("./**/*.ts");
async function fixture() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  rateLimiterTest.register(t);
  const [aId, bId] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("users", { name: "Buyer A", isActive: true, role: "buyer" }),
      ctx.db.insert("users", { name: "Buyer B", isActive: true, role: "buyer" }),
    ]),
  );
  const a = t.withIdentity({ subject: aId }),
    b = t.withIdentity({ subject: bId });
  const setup = {
    companyName: "Company A",
    shippingAddress: "100 Test Street, Chicago IL 60601",
    timezone: "America/Chicago",
    itemName: "Tape",
    quantity: "10",
    dailyUsage: "",
    unit: "rolls" as const,
  };
  await a.mutation(api.onboarding.completeFromSource, setup);
  await b.mutation(api.onboarding.completeFromSource, { ...setup, companyName: "Company B" });
  const workspace = (await a.query(api.onboarding.getWorkspace, {}))!;
  await a.mutation(api.buyer.begin, { task: "stock_update" });
  const { session } = await a.query(api.buyer.conversation, {});
  async function message(text: string) {
    return t.run(async (ctx) => {
      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId: session!.threadId,
        message: { role: "user", content: text },
      });
      await ctx.db.patch("buyerSessions", session!._id, {
        busy: true,
        currentMessageId: messageId,
      });
      return messageId;
    });
  }
  return { t, a, b, aId, bId, workspace, item: workspace.items[0], session: session!, message };
}

test("the shared conversation survives task changes and resumes unsaved drafts", async () => {
  const { t, a, item, session, message } = await fixture();
  const messageId = await message("Call this item Packing tape");
  const chatId = await t.mutation(internal.buyer.routeTask, {
    sessionId: session._id,
    messageId,
    task: "edit_item",
    contextId: item.id,
  });
  await t.mutation(internal.desk.updateDraft, {
    chatId,
    messageId,
    draft: { name: "Packing tape" },
  });
  await t.mutation(internal.desk.finish, { chatId, messageId });
  await a.mutation(api.buyer.begin, { task: "settings" });
  await a.mutation(api.buyer.begin, { task: "edit_item", contextId: item.id });
  const resumed = await a.query(api.buyer.conversation, {});
  expect(resumed.session?.threadId).toBe(session.threadId);
  expect(resumed.chat?._id).toBe(chatId);
  expect(resumed.chat?.draft.name).toBe("Packing tape");
  expect(resumed.messages.some((m) => m.text === "Call this item Packing tape")).toBe(true);
  await a.mutation(api.desk.commit, { chatId, timezone: "America/Chicago" });
  const saved = await a.query(api.buyer.conversation, {});
  expect(saved.session?.latestText).toBe("Packing tape updated.");
  expect(saved.session?.focus).toEqual({ page: "inventory", item: item.id });
  expect((await a.query(api.onboarding.getWorkspace, {}))?.items[0].name).toBe("Packing tape");
});

test("conversations, tool targets and business updates stay inside their company", async () => {
  const { t, a, b, item, session, message } = await fixture();
  expect((await b.query(api.buyer.conversation, {})).session).toBeNull();
  await expect(
    b.mutation(api.buyer.begin, { task: "edit_item", contextId: item.id }),
  ).rejects.toThrow(/Item not found/);
  const other = (await b.query(api.onboarding.getWorkspace, {}))!;
  const messageId = await message("Show stock");
  await expect(
    t.mutation(internal.buyer.show, {
      sessionId: session._id,
      messageId,
      focus: { page: "inventory", item: other.items[0].id },
    }),
  ).rejects.toThrow(/Item not found/);
  await expect(
    t.mutation(internal.buyer.routeTask, {
      sessionId: session._id,
      messageId,
      task: "edit_item",
      contextId: other.items[0].id,
    }),
  ).rejects.toThrow(/Item not found/);
  await expect(t.query(api.buyer.conversation, {})).rejects.toThrow(/Sign in/);
  await a.mutation(api.companyInventory.recordCount, { itemId: item.id, quantity: 7 });
  expect((await b.query(api.buyer.conversation, {})).activity).toEqual([]);
});

test("the real stock tool updates inventory and leaves its receipt in the shared conversation", async () => {
  const { t, a, item, session, message } = await fixture();
  const messageId = await message("We have 2 rolls of Tape left");
  const chatId = await t.mutation(internal.buyer.routeTask, {
    sessionId: session._id,
    messageId,
    task: "stock_update",
    contextId: item.id,
  });
  await t.mutation(internal.desk.setReportedStock, {
    chatId,
    messageId,
    itemId: item.id,
    count: 2,
  });
  await t.mutation(internal.desk.finish, { chatId, messageId });
  const state = await a.query(api.buyer.conversation, {});
  expect(state.session).toMatchObject({ busy: false, latestText: "Tape: 2 rolls on hand." });
  expect(state.messages.at(-1)?.text).toBe("Tape: 2 rolls on hand.");
  expect((await a.query(api.onboarding.getWorkspace, {}))?.items[0].quantity).toBe(2);
  await t.mutation(internal.desk.finish, { chatId, messageId });
  expect(
    (await a.query(api.buyer.conversation, {})).messages.filter(
      (m) => m.text === "Tape: 2 rolls on hand.",
    ),
  ).toHaveLength(1);
});

test("a busy conversation rejects a second send and expires safely without overwriting a later turn", async () => {
  const { t, a, item, session, message } = await fixture();
  const first = await message("We have 2 rolls of Tape left");
  const chatId = await t.mutation(internal.buyer.routeTask, {
    sessionId: session._id,
    messageId: first,
    task: "stock_update",
    contextId: item.id,
  });
  await expect(
    a.mutation(api.buyer.send, { text: "Another request", focus: { page: "dashboard" } }),
  ).rejects.toThrow(/still working/);
  await expect(a.mutation(api.buyer.begin, { task: "settings" })).rejects.toThrow(/still working/);
  await t.mutation(internal.buyer.timeout, { sessionId: session._id, messageId: first });
  const second = await message("We have 4 rolls of Tape left");
  await t.mutation(internal.buyer.routeTask, {
    sessionId: session._id,
    messageId: second,
    task: "stock_update",
    contextId: item.id,
  });
  await t.mutation(internal.buyer.timeout, { sessionId: session._id, messageId: first });
  await t.mutation(internal.desk.finish, { chatId, messageId: first });
  await expect(
    t.mutation(internal.desk.updateDraft, { chatId, messageId: first, draft: { stock: 900 } }),
  ).rejects.toThrow(/request has changed/);
  expect((await a.query(api.buyer.conversation, {})).session).toMatchObject({
    busy: true,
    currentMessageId: second,
  });
  await t.mutation(internal.desk.setReportedStock, {
    chatId,
    messageId: second,
    itemId: item.id,
    count: 4,
  });
  await t.mutation(internal.desk.finish, { chatId, messageId: second });
  expect((await a.query(api.buyer.conversation, {})).session?.latestText).toBe(
    "Tape: 4 rolls on hand.",
  );
});

test("raw model prose is hidden and provider credits require a current completed tool", async () => {
  const { t, a, session, message } = await fixture();
  const messageId = await message("Update stock");
  const chatId = await t.mutation(internal.buyer.routeTask, {
    sessionId: session._id,
    messageId,
    task: "stock_update",
  });
  await t.run((ctx) =>
    saveMessage(ctx, components.agent, {
      threadId: session.threadId,
      agentName: "BUY HARD router",
      message: { role: "assistant", content: "Invented answer" },
    }),
  );
  await t.mutation(internal.buyer.noteCredit, { chatId, messageId, credit: "openai" });
  await expect(
    t.mutation(internal.buyer.noteCredit, { chatId, messageId: "stale", credit: "firecrawl" }),
  ).rejects.toThrow(/request has changed/);
  await t.mutation(internal.desk.finish, { chatId, messageId });
  const state = await a.query(api.buyer.conversation, {});
  expect(state.messages.some((m) => m.text === "Invented answer")).toBe(false);
  expect(state.chat?.credits).toEqual(["openai"]);
});

test("showing a purchase cannot approve it; stale review is rejected and order updates reach the bar", async () => {
  const { t, a, item, session, message } = await fixture();
  await a.mutation(api.onboarding.fillGap, {
    itemId: item.id,
    field: "supplier",
    value: "Test Supplier",
  });
  await a.mutation(api.companyInventory.updateBuying, {
    itemId: item.id,
    buyUrl: "https://example.com/tape",
    supplierEmail: "",
    coverageDays: 30,
  });
  const terms = {
    quantity: 5,
    unitPriceCents: 200,
    freightCents: 100,
    taxCents: 0,
    currency: "USD",
    requiredBy: "2099-01-01",
    notes: "",
  };
  const orderId = await a.mutation(api.companyOrders.create, { itemId: item.id, ...terms });
  const messageId = await message("Approve the tape purchase");
  await t.mutation(internal.buyer.show, {
    sessionId: session._id,
    messageId,
    focus: { page: "buys", buy: orderId },
  });
  const order = (await a.query(api.companyOrders.get, { orderId }))!;
  expect(order.status).toBe("draft");
  const reviewedKey = approvalKey(order);
  await a.mutation(api.companyOrders.updateDraft, { orderId, ...terms, quantity: 6 });
  await expect(a.mutation(api.companyOrders.approve, { orderId, reviewedKey })).rejects.toThrow(
    /changed/,
  );
  const updated = (await a.query(api.companyOrders.get, { orderId }))!;
  await a.mutation(api.companyOrders.approve, { orderId, reviewedKey: approvalKey(updated) });
  const state = await a.query(api.buyer.conversation, {});
  expect(state.activity.some((a) => a.orderId === orderId && /approved/i.test(a.summary))).toBe(
    true,
  );
  expect(state.activity.every((a) => a.credit === undefined)).toBe(true);
  await t.run((ctx) =>
    orderEvent(ctx, updated, "sent", "Purchase order sent; awaiting supplier confirmation."),
  );
  expect((await a.query(api.buyer.conversation, {})).activity[0]).toMatchObject({
    orderId,
    credit: "agentmail",
  });
});

test("send persists the original message and schedules the router with a timeout", async () => {
  vi.useFakeTimers();
  try {
    const { t, a, session } = await fixture();
    await a.mutation(api.buyer.send, { text: "Where is my order?", focus: { page: "buys" } });
    const state = await a.query(api.buyer.conversation, {});
    expect(state.session).toMatchObject({ busy: true, threadId: session.threadId });
    expect(state.messages.at(-1)).toMatchObject({ role: "user", text: "Where is my order?" });
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.some((j) => j.name === "buyerAgent:respond")).toBe(true);
    expect(jobs.some((j) => j.name === "buyer:timeout")).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
