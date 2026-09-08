import { ConvexError, v } from "convex/values";
import { createThread, listMessages, saveMessage } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { query, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { mutation, internalMutation } from "./audited";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { ownedCompany } from "./onboarding";
import { boundedText } from "./companyRules";
import { limits } from "./rateLimits";
import { chatTask } from "./deskFields";
import { buyerFocus, buyerMessage, buyerCredit } from "./buyerFields";
import { initialDraft, taskContext } from "./desk";
import { questionMessage, requiredQuestion, visibleMessage } from "./deskPolicy";
import { readBuyerSession } from "./buyerSession";

type Focus = NonNullable<Doc<"buyerSessions">["focus"]>;
async function ownSession(ctx: MutationCtx) {
  const { user, organization } = await ownedCompany(ctx);
  let session = await ctx.db
    .query("buyerSessions")
    .withIndex("by_userId_and_organizationId", (q) =>
      q.eq("userId", user._id).eq("organizationId", organization._id),
    )
    .unique();
  if (!session) {
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: "Your buyer",
    });
    const id = await ctx.db.insert("buyerSessions", {
      userId: user._id,
      organizationId: organization._id,
      threadId,
      busy: false,
      updatedAt: Date.now(),
    });
    session = (await ctx.db.get("buyerSessions", id))!;
  }
  return { session, user };
}
async function checkedFocus(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  focus: Focus,
): Promise<Focus> {
  if (focus.item) await taskContext(ctx, "edit_item", focus.item, user);
  if (focus.buy) await taskContext(ctx, "confirm", focus.buy, user);
  return focus;
}
async function activate(
  ctx: MutationCtx,
  session: Doc<"buyerSessions">,
  user: Doc<"users">,
  task: Doc<"taskChats">["task"],
  contextId?: string,
  revision?: boolean,
) {
  if (task === "onboarding") throw new ConvexError("Your company is already set up.");
  const c = await taskContext(ctx, task, contextId, user);
  let chat = session.activeChatId ? await ctx.db.get("taskChats", session.activeChatId) : null;
  if (!chat || chat.savedAt || chat.task !== task || chat.contextId !== contextId) {
    const recent = await ctx.db
      .query("taskChats")
      .withIndex("by_userId_and_task_and_contextId", (q) =>
        q.eq("userId", user._id).eq("task", task).eq("contextId", contextId),
      )
      .order("desc")
      .take(10);
    chat = recent.find((c) => c.buyerSessionId === session._id && !c.savedAt) ?? null;
  }
  if (!chat) {
    const id = await ctx.db.insert("taskChats", {
      userId: user._id,
      organizationId: session.organizationId,
      buyerSessionId: session._id,
      threadId: session.threadId,
      task,
      contextId,
      busy: false,
      updatedAt: Date.now(),
      draft: {
        ...initialDraft(c),
        ...(task === "receive" ? { quantity: undefined } : {}),
        ...(task === "edit_item" ? { stock: undefined, dailyUsage: undefined } : {}),
      },
    });
    chat = (await ctx.db.get("taskChats", id))!;
  }
  if (task === "buy" && revision) {
    await ctx.db.patch("taskChats", chat._id, {
      draft: {
        ...chat.draft,
        unitPriceCents: undefined,
        freightCents: undefined,
        taxCents: undefined,
        expectedOn: undefined,
      },
      reviewedDraftKey: undefined,
      comparison: undefined,
    });
    if (c.order) await ctx.db.patch("companyOrders", c.order._id, { reviewRequired: true });
  }
  const focus: Focus =
    task === "settings"
      ? { page: "settings" }
      : ["buy", "confirm", "receive"].includes(task)
        ? { page: "buys", buy: contextId }
        : { page: "inventory", item: c.item?._id };
  await ctx.db.patch("buyerSessions", session._id, {
    activeChatId: chat._id,
    focus,
    error: undefined,
  });
  return chat;
}

export const conversation = query({
  args: {},
  returns: v.object({
    session: v.union(schema.doc("buyerSessions"), v.null()),
    chat: v.union(schema.doc("taskChats"), v.null()),
    messages: v.array(buyerMessage),
    activity: v.array(schema.doc("deskActivity")),
  }),
  handler: async (ctx) => {
    const { user, organization } = await ownedCompany(ctx);
    const session = await ctx.db
      .query("buyerSessions")
      .withIndex("by_userId_and_organizationId", (q) =>
        q.eq("userId", user._id).eq("organizationId", organization._id),
      )
      .unique();
    const activity = await ctx.db
      .query("deskActivity")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(30);
    if (!session) return { session: null, chat: null, messages: [], activity };
    const chat = session.activeChatId ? await ctx.db.get("taskChats", session.activeChatId) : null;
    const result = await listMessages(ctx, components.agent, {
      threadId: session.threadId,
      paginationOpts: { numItems: 100, cursor: null },
      excludeToolMessages: true,
    });
    return {
      session,
      chat,
      activity,
      messages: result.page.reverse().flatMap((m) => {
        const message = visibleMessage(m);
        return message ? [{ id: m._id, ...message, createdAt: m._creationTime }] : [];
      }),
    };
  },
});

export const begin = mutation({
  args: { task: chatTask, contextId: v.optional(v.string()), revision: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { session, user } = await ownSession(ctx);
    if (session.busy) throw new ConvexError("One moment, I’m still working on that.");
    const chat = await activate(ctx, session, user, args.task, args.contextId, args.revision);
    const prompts: Partial<Record<Doc<"taskChats">["task"], string>> = {
      buy: args.revision
        ? "What needs to change? I’ll check the price and delivery again."
        : "Tell me what you need. I’ll look into the options.",
      edit_item: "What would you like to change?",
      settings: "What would you like to change about your company?",
      stock_update: "What changed? Tell me how many you have left.",
    };
    const text =
      prompts[args.task] ?? questionMessage(requiredQuestion(args.task, chat.draft), chat.draft);
    await saveMessage(ctx, components.agent, {
      threadId: session.threadId,
      agentName: "BUY HARD UI",
      message: { role: "assistant", content: text },
    });
    await ctx.db.patch("buyerSessions", session._id, {
      latestText: text,
      currentMessageId: chat.currentMessageId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const send = mutation({
  args: { text: v.string(), focus: buyerFocus },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { session, user } = await ownSession(ctx);
    if (session.busy) throw new ConvexError("One moment, I’m still working on that.");
    const text = boundedText(args.text, "a message", 6000);
    await checkedFocus(ctx, user, args.focus);
    await limits.limit(ctx, "sourceImport", { key: user._id, throws: true });
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: session.threadId,
      message: { role: "user", content: text },
    });
    await ctx.db.patch("buyerSessions", session._id, {
      busy: true,
      currentMessageId: messageId,
      error: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.buyerAgent.respond, {
      sessionId: session._id,
      messageId,
      focus: args.focus,
    });
    await ctx.scheduler.runAfter(300_000, internal.buyer.timeout, {
      sessionId: session._id,
      messageId,
    });
    return null;
  },
});

export const read = internalQuery({
  args: { sessionId: v.id("buyerSessions") },
  returns: v.object({
    session: schema.doc("buyerSessions"),
    active: v.union(schema.doc("taskChats"), v.null()),
    items: v.array(schema.doc("inventoryItems")),
    buys: v.array(schema.doc("companyBuys")),
    orders: v.array(schema.doc("companyOrders")),
  }),
  handler: async (ctx, args) => {
    const { session } = await readBuyerSession(ctx, args.sessionId);
    const [items, buys, orders, active] = await Promise.all([
      ctx.db
        .query("inventoryItems")
        .withIndex("by_org_archived", (q) => q.eq("organizationId", session.organizationId))
        .take(250),
      ctx.db
        .query("companyBuys")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", session.organizationId))
        .order("desc")
        .take(100),
      ctx.db
        .query("companyOrders")
        .withIndex("by_organizationId_and_isOpen", (q) =>
          q.eq("organizationId", session.organizationId).eq("isOpen", true),
        )
        .take(100),
      session.activeChatId ? ctx.db.get("taskChats", session.activeChatId) : null,
    ]);
    return {
      session,
      items: items.filter((i) => !i.archived),
      buys,
      orders,
      active: active?.savedAt ? null : active,
    };
  },
});

export const routeTask = internalMutation({
  args: {
    sessionId: v.id("buyerSessions"),
    messageId: v.string(),
    task: chatTask,
    contextId: v.optional(v.string()),
    revision: v.optional(v.boolean()),
  },
  returns: v.id("taskChats"),
  handler: async (ctx, args) => {
    const { session, user } = await readBuyerSession(ctx, args.sessionId);
    if (!session.busy || session.currentMessageId !== args.messageId)
      throw new ConvexError("This request has changed.");
    const chat = await activate(ctx, session, user, args.task, args.contextId, args.revision);
    const [message] = await ctx.runQuery(components.agent.messages.getMessagesByIds, {
      messageIds: [args.messageId],
    });
    if (
      message?.threadId !== session.threadId ||
      message.message?.role !== "user" ||
      typeof message.message.content !== "string"
    )
      throw new ConvexError("Message unavailable.");
    await ctx.db.patch("taskChats", chat._id, {
      busy: true,
      toolUsed: false,
      question: undefined,
      researchUrls: [],
      credits: [],
      currentMessageId: args.messageId,
      lastUserText: message.message.content,
      resultSummary: undefined,
      error: undefined,
      updatedAt: Date.now(),
    });
    return chat._id;
  },
});

export const show = internalMutation({
  args: { sessionId: v.id("buyerSessions"), messageId: v.string(), focus: buyerFocus },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { session, user } = await readBuyerSession(ctx, args.sessionId);
    if (!session.busy || session.currentMessageId !== args.messageId)
      throw new ConvexError("This request has changed.");
    await checkedFocus(ctx, user, args.focus);
    let text = "Here’s what needs your attention. Choose an item or buy below.";
    if (args.focus.item) {
      const c = await taskContext(ctx, "edit_item", args.focus.item, user);
      text = `${c.item!.name}: ${c.item!.stockCountKnown === false ? "count not yet known" : `${c.item!.quantityOnHand} ${c.item!.unit ?? "units"} on hand`}.`;
    } else if (args.focus.buy) {
      const c = await taskContext(ctx, "confirm", args.focus.buy, user);
      const labels: Record<string, string> = {
        draft: "ready for approval",
        approved: "approved and ready to order",
        sending: "purchase order is being sent",
        sent: "waiting for supplier confirmation",
        placed: "on the way",
        part_received: "partly received",
        received: "received",
        cancelled: "cancelled",
        send_failed: "email delivery needs checking",
      };
      text = `${c.item?.name ?? c.order?.itemName}: ${c.order ? (c.order.reviewRequired ? "price and delivery need checking" : labels[c.order.status]) : "buy started"}${c.order?.expectedOn ? `, expected ${c.order.expectedOn}` : ""}.`;
    } else if (args.focus.page === "settings")
      text = "You can update your company, purchasing inbox, and notifications here.";
    else if (args.focus.page === "inventory")
      text = "Here’s your inventory. Choose an item, update a count, or add something new.";
    else if (args.focus.page === "buys")
      text = "Here are your buys. You can review, approve, order, or record a delivery below.";
    else if (args.focus.page === "audit") text = "Here’s the history of changes to your workspace.";
    await saveMessage(ctx, components.agent, {
      threadId: session.threadId,
      agentName: "BUY HARD UI",
      message: { role: "assistant", content: text },
    });
    await ctx.db.patch("buyerSessions", session._id, {
      busy: false,
      activeChatId: undefined,
      focus: args.focus,
      latestText: text,
      error: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const finish = internalMutation({
  args: { sessionId: v.id("buyerSessions"), messageId: v.string(), error: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { session } = await readBuyerSession(ctx, args.sessionId);
    if (!session.busy || session.currentMessageId !== args.messageId) return null;
    const text = args.error
      ? "I couldn’t finish that. Try again."
      : "I can help with stock, buys, deliveries, and company settings. What would you like to do?";
    await saveMessage(ctx, components.agent, {
      threadId: session.threadId,
      agentName: "BUY HARD UI",
      message: { role: "assistant", content: text },
    });
    await ctx.db.patch("buyerSessions", session._id, {
      busy: false,
      latestText: text,
      error: args.error ? text : undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const timeout = internalMutation({
  args: { sessionId: v.id("buyerSessions"), messageId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("buyerSessions", args.sessionId);
    if (!session?.busy || session.currentMessageId !== args.messageId) return null;
    const error = "That took too long. Your draft is saved; try again.";
    if (session.activeChatId) {
      const chat = await ctx.db.get("taskChats", session.activeChatId);
      if (chat?.currentMessageId === args.messageId)
        await ctx.db.patch("taskChats", chat._id, { busy: false, error });
    }
    await ctx.db.patch("buyerSessions", session._id, { busy: false, error, updatedAt: Date.now() });
    return null;
  },
});

export const noteCredit = internalMutation({
  args: { chatId: v.id("taskChats"), messageId: v.string(), credit: buyerCredit },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("taskChats", args.chatId);
    if (!chat?.busy || chat.currentMessageId !== args.messageId)
      throw new ConvexError("This request has changed.");
    await ctx.db.patch("taskChats", chat._id, {
      credits: [...new Set([...(chat.credits ?? []), args.credit])],
    });
    return null;
  },
});
