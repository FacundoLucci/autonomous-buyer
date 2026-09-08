import { ConvexError, v } from "convex/values";
import { createThread, listMessages, saveMessage } from "@convex-dev/agent";
import { api, components, internal } from "./_generated/api";
import { query, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { mutation, internalMutation } from "./audited";
import { account, ownedCompany } from "./onboarding";
import {
  allowedDraft,
  allowedQuestion,
  questions,
  questionMessage,
  requiredQuestion,
  visibleMessage,
} from "./deskPolicy";
import { questionCode } from "./deskFields";
import { chatTask, deskDraft, buyingOption } from "./deskFields";
import { writeStockCount } from "./companyInventory";
import { rankBuyingOptions, type StockFacts } from "../src/lib/inventory-planning";
import { reportedStock, stockItemMatch } from "../src/lib/stock-message";
import {
  boundedText,
  amount,
  cents,
  quantity,
  validDate,
  validEmail,
  orderTotal,
} from "./companyRules";
import { productUrl } from "./inventorySources";
import { limits } from "./rateLimits";
import type { Doc, Id } from "./_generated/dataModel";
import { quoteKey } from "../src/lib/buy-review";

type Draft = Doc<"taskChats">["draft"];
async function editableOrder(ctx: MutationCtx, chat: Doc<"taskChats">) {
  const user = await ctx.db.get("users", chat.userId);
  if (
    !user?.isActive ||
    user.isAnonymous ||
    user.organizationId !== chat.organizationId ||
    !["admin", "buyer"].includes(user.role ?? "")
  )
    throw new ConvexError("Account unavailable.");
  if (!chat.contextId) throw new ConvexError("Choose a buy.");
  const buyId = ctx.db.normalizeId("companyBuys", chat.contextId);
  const buy = buyId ? await ctx.db.get("companyBuys", buyId) : null;
  if (buy && (buy.organizationId !== chat.organizationId || buy.closed))
    throw new ConvexError("Buy is no longer editable.");
  const id = buy?.orderId ?? ctx.db.normalizeId("companyOrders", chat.contextId);
  const order = id ? await ctx.db.get("companyOrders", id) : null;
  if (order && (order.organizationId !== chat.organizationId || order.status !== "draft"))
    throw new ConvexError("Only an unapproved buy can be changed.");
  return order;
}
function withoutQuote(draft: Draft): Draft {
  return {
    ...draft,
    unitPriceCents: undefined,
    freightCents: undefined,
    taxCents: undefined,
    expectedOn: undefined,
  };
}
function comparisonState(item: Doc<"inventoryItems">, orders: Doc<"companyOrders">[]) {
  return JSON.stringify({
    quantity: item.quantityOnHand,
    counted: item.stockCountedAt,
    known: item.stockCountKnown,
    usage: item.estimatedDailyUsage,
    priority: item.buyingPriority,
    loss: item.dailyLossCents,
    currency: item.lossCurrency,
    deliveries: orders
      .filter((o) => o.status === "placed" || o.status === "part_received")
      .map((o) => [o._id, o.quantity, o.receivedQuantity, o.expectedOn]),
  });
}
async function ownChat(ctx: QueryCtx | MutationCtx, id: Id<"taskChats">) {
  const user = await account(ctx);
  const chat = await ctx.db.get("taskChats", id);
  if (
    !chat ||
    chat.userId !== user._id ||
    (chat.organizationId && chat.organizationId !== user.organizationId)
  )
    throw new ConvexError("Conversation not found.");
  return { chat, user };
}
async function context(ctx: QueryCtx | MutationCtx, task: string, contextId?: string) {
  const user = await account(ctx);
  if (task === "onboarding") {
    if (user.organizationId) throw new ConvexError("Your company is already set up.");
    return {};
  }
  const { organization } = await ownedCompany(ctx);
  if (
    task === "settings" ||
    task === "add_item" ||
    ((task === "new_buy" || task === "stock_update") && !contextId)
  )
    return { organization };
  if (!contextId) throw new ConvexError("Choose an item or buy.");
  if (task === "edit_item" || task === "new_buy" || task === "stock_update") {
    const id = ctx.db.normalizeId("inventoryItems", contextId);
    const item = id ? await ctx.db.get("inventoryItems", id) : null;
    if (!item || item.organizationId !== organization._id || item.archived)
      throw new ConvexError("Item not found.");
    return { organization, item };
  }
  const buyId = ctx.db.normalizeId("companyBuys", contextId);
  const buy = buyId ? await ctx.db.get("companyBuys", buyId) : null;
  const orderId = buy?.orderId ?? ctx.db.normalizeId("companyOrders", contextId);
  const order = orderId ? await ctx.db.get("companyOrders", orderId) : null;
  if (
    (!buy && !order) ||
    (buy && buy.organizationId !== organization._id) ||
    (order && order.organizationId !== organization._id)
  )
    throw new ConvexError("Buy not found.");
  const itemId = buy?.itemId ?? order!.inventoryItemId;
  const item = await ctx.db.get("inventoryItems", itemId);
  if (task === "buy" && (buy?.closed || (order && order.status !== "draft")))
    throw new ConvexError("Only an open, unapproved buy can be changed.");
  return { organization, item, buy, order };
}
function initialDraft(c: Awaited<ReturnType<typeof context>>): Draft {
  return {
    ...(c.organization
      ? { companyName: c.organization.name, shippingAddress: c.organization.shippingAddress }
      : {}),
    ...(c.item
      ? {
          itemId: c.item._id,
          name: c.item.name,
          sku: c.item.sku,
          unit: c.item.unit,
          stock: c.item.stockCountKnown === false ? undefined : c.item.quantityOnHand,
          dailyUsage: c.item.estimatedDailyUsage,
          supplier: c.item.supplierName,
          buyUrl: c.item.buyUrl,
          supplierEmail: c.item.supplierEmail,
          buyingPriority: c.item.buyingPriority,
          dailyLossCents: c.item.dailyLossCents,
          lossCurrency: c.item.lossCurrency ?? "USD",
          stockoutImpact: c.item.stockoutImpact,
        }
      : {}),
    ...(c.buy
      ? { quantity: c.buy.quantity, requiredBy: c.buy.requiredBy, notes: c.buy.notes }
      : {}),
    ...(c.order
      ? {
          quantity: c.order.quantity,
          supplier: c.order.supplier,
          buyUrl: c.order.buyUrl,
          supplierEmail: c.order.supplierEmail,
          unitPriceCents: c.order.unitPriceCents,
          freightCents: c.order.freightCents,
          taxCents: c.order.taxCents,
          currency: c.order.currency,
          expectedOn: c.order.quotedArrival,
          requiredBy: c.order.requiredBy,
          notes: c.order.notes,
        }
      : {}),
  };
}
export const conversation = query({
  args: { task: chatTask, contextId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await account(ctx);
    await context(ctx, args.task, args.contextId);
    const chat = await ctx.db
      .query("taskChats")
      .withIndex("by_userId_and_task_and_contextId", (q) =>
        q.eq("userId", user._id).eq("task", args.task).eq("contextId", args.contextId),
      )
      .order("desc")
      .first();
    if (!chat || chat.savedAt) return null;
    const messages = await listMessages(ctx, components.agent, {
      threadId: chat.threadId,
      paginationOpts: { numItems: 60, cursor: null },
      excludeToolMessages: true,
    });
    return {
      ...chat,
      messages: messages.page.reverse().flatMap((m) => {
        const message = visibleMessage(m);
        return message ? [{ id: m._id, ...message }] : [];
      }),
    };
  },
});
export const send = mutation({
  args: {
    task: chatTask,
    contextId: v.optional(v.string()),
    text: v.string(),
    revision: v.optional(v.boolean()),
  },
  returns: v.id("taskChats"),
  handler: async (ctx, args) => {
    const user = await account(ctx);
    const c = await context(ctx, args.task, args.contextId);
    const text = boundedText(args.text, "a message", 6000);
    await limits.limit(ctx, "sourceImport", { key: user._id, throws: true });
    let chat = await ctx.db
      .query("taskChats")
      .withIndex("by_userId_and_task_and_contextId", (q) =>
        q.eq("userId", user._id).eq("task", args.task).eq("contextId", args.contextId),
      )
      .order("desc")
      .first();
    if (chat?.busy) throw new ConvexError("One moment, I’m still working on that.");
    if (!chat || chat.savedAt) {
      const threadId = await createThread(ctx, components.agent, {
        userId: user._id,
        title: args.task,
      });
      const id = await ctx.db.insert("taskChats", {
        userId: user._id,
        organizationId: user.organizationId,
        task: args.task,
        contextId: args.contextId,
        threadId,
        draft: {
          ...initialDraft(c),
          ...(args.task === "receive" ? { quantity: undefined } : {}),
          ...(args.task === "edit_item" ? { stock: undefined, dailyUsage: undefined } : {}),
        },
        busy: false,
        updatedAt: Date.now(),
      });
      chat = (await ctx.db.get("taskChats", id))!;
    }
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: chat.threadId,
      message: { role: "user", content: text },
    });
    await ctx.db.patch("taskChats", chat._id, {
      ...(args.task === "buy" && args.revision
        ? { draft: withoutQuote(chat.draft), reviewedDraftKey: undefined, comparison: undefined }
        : {}),
      researchUrls: [],
      busy: true,
      toolUsed: false,
      question: undefined,
      currentMessageId: messageId,
      lastUserText: text,
      resultSummary: undefined,
      error: undefined,
      updatedAt: Date.now(),
    });
    if (args.task === "buy" && args.revision && c.order)
      await ctx.db.patch("companyOrders", c.order._id, { reviewRequired: true });
    await ctx.scheduler.runAfter(0, internal.deskAgent.respond, { chatId: chat._id, messageId });
    return chat._id;
  },
});
export const readChat = internalQuery({
  args: { chatId: v.id("taskChats") },
  handler: async (ctx, { chatId }) => {
    const chat = await ctx.db.get("taskChats", chatId);
    if (!chat) throw new Error("Conversation missing.");
    const user = await ctx.db.get("users", chat.userId);
    if (
      !user?.isActive ||
      user.isAnonymous ||
      (chat.organizationId && user.organizationId !== chat.organizationId)
    )
      throw new Error("Account unavailable.");
    const items = chat.organizationId
      ? await ctx.db
          .query("inventoryItems")
          .withIndex("by_org_archived", (q) => q.eq("organizationId", chat.organizationId!))
          .take(250)
      : [];
    return {
      ...chat,
      items: items
        .filter((i) => !i.archived)
        .map((i) => ({
          id: i._id,
          sku: i.sku,
          name: i.name,
          unit: i.unit,
          supplier: i.supplierName,
          buyUrl: i.buyUrl,
          stock: i.stockCountKnown === false ? null : i.quantityOnHand,
          dailyUsage: i.estimatedDailyUsage ?? null,
          buyingPriority: i.buyingPriority ?? null,
          dailyLossCents: i.dailyLossCents ?? null,
          lossCurrency: i.lossCurrency ?? "USD",
          stockoutImpact: i.stockoutImpact ?? null,
        })),
    };
  },
});
export const updateDraft = internalMutation({
  args: { chatId: v.id("taskChats"), draft: deskDraft },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("taskChats", args.chatId);
    if (!chat || !chat.busy || chat.savedAt) throw new Error("Conversation is no longer editable.");
    allowedDraft(chat.task, args.draft);
    const patch = Object.fromEntries(
      Object.entries(args.draft).filter(([, value]) => value !== undefined),
    );
    let draft = { ...chat.draft, ...patch };
    if (chat.task === "buy") {
      const order = await editableOrder(ctx, chat);
      const changed = (
        ["quantity", "requiredBy", "supplier", "buyUrl", "supplierEmail", "currency"] as const
      ).some((k) => args.draft[k] !== undefined && args.draft[k] !== chat.draft[k]);
      if (changed && (order || chat.draft.unitPriceCents !== undefined)) {
        draft = withoutQuote(draft);
        if (order)
          await ctx.db.patch("companyOrders", order._id, {
            reviewRequired: true,
            requestedQuantity: draft.quantity,
          });
      }
    }
    for (const value of Object.values(draft))
      if (typeof value === "string" && value.length > 2000) throw new Error("Detail too long.");
    for (const key of [
      "stock",
      "dailyUsage",
      "leadTimeDays",
      "quantity",
      "unitPriceCents",
      "freightCents",
      "taxCents",
    ] as const)
      if (draft[key] !== undefined) amount(draft[key], key);
    if (
      draft.currency &&
      !["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "MXN", "ARS"].includes(draft.currency)
    )
      throw new Error("Choose a supported currency.");
    if (draft.buyUrl) productUrl(draft.buyUrl);
    if (draft.supplierEmail) validEmail(draft.supplierEmail);
    if (draft.dailyLossCents !== undefined) cents(draft.dailyLossCents);
    if (
      draft.lossCurrency &&
      !["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "MXN", "ARS"].includes(draft.lossCurrency)
    )
      throw new Error("Choose a supported currency.");
    if (draft.itemId) {
      const item = await ctx.db.get("inventoryItems", draft.itemId);
      if (!item || item.organizationId !== chat.organizationId || item.archived)
        throw new Error("Choose an item from this company.");
      if (
        chat.draft.itemId &&
        chat.task !== "new_buy" &&
        chat.task !== "stock_update" &&
        draft.itemId !== chat.draft.itemId
      )
        throw new Error("Keep the current item.");
    }
    await ctx.db.patch("taskChats", args.chatId, {
      draft,
      reviewedDraftKey:
        quoteKey(draft) === quoteKey(chat.draft) ? chat.reviewedDraftKey : undefined,
      comparison: undefined,
      toolUsed: true,
      updatedAt: Date.now(),
    });
    return draft;
  },
});
export const finish = internalMutation({
  args: { chatId: v.id("taskChats"), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("taskChats", args.chatId);
    if (!chat) return;
    if (!args.error || (chat.task === "stock_update" && chat.resultSummary)) {
      const code =
        chat.question ??
        (chat.toolUsed || chat.task === "onboarding"
          ? requiredQuestion(chat.task, chat.draft)
          : "unsupported");
      await saveMessage(ctx, components.agent, {
        threadId: chat.threadId,
        agentName: "BUY HARD UI",
        message: {
          role: "assistant",
          content: chat.resultSummary ?? questionMessage(code, chat.draft),
        },
      });
    }
    await ctx.db.patch("taskChats", args.chatId, {
      busy: false,
      error: chat.task === "stock_update" && chat.resultSummary ? undefined : args.error,
      updatedAt: Date.now(),
    });
  },
});
export const setOnboardingDetails = mutation({
  args: {
    chatId: v.id("taskChats"),
    companyName: v.string(),
    shippingAddress: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { chat } = await ownChat(ctx, args.chatId);
    if (chat.task !== "onboarding" || chat.savedAt)
      throw new ConvexError("This setup is no longer editable.");
    if (chat.busy) throw new ConvexError("Wait for the current reply.");
    const companyName = boundedText(args.companyName, "your company name");
    const shippingAddress = boundedText(args.shippingAddress, "your delivery address", 500);
    if (shippingAddress.length < 12) throw new ConvexError("Enter your full delivery address.");
    await ctx.db.patch("taskChats", chat._id, {
      draft: { ...chat.draft, companyName, shippingAddress },
      question: "ready",
      error: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const commit = mutation({
  args: { chatId: v.id("taskChats"), timezone: v.string() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const { chat, user } = await ownChat(ctx, args.chatId);
    if (chat.savedAt) return chat.resultId ?? "";
    if (chat.task === "stock_update")
      throw new ConvexError("Report the remaining count in the chat, or edit the count directly.");
    if (chat.busy) throw new ConvexError("Wait for the current reply.");
    const c = await context(ctx, chat.task, chat.contextId);
    const d = chat.draft;
    let resultId = "";
    let organizationId = user.organizationId;
    let itemId = d.itemId;
    let summary = "Details updated.";
    if (chat.task === "onboarding") {
      const name = boundedText(d.companyName ?? "", "your company name");
      const address = boundedText(d.shippingAddress ?? "", "your delivery address", 500);
      if (address.length < 12) throw new ConvexError("I still need your full delivery address.");
      try {
        new Intl.DateTimeFormat("en", { timeZone: args.timezone });
      } catch {
        throw new ConvexError("Choose a valid timezone.");
      }
      organizationId = await ctx.db.insert("organizations", {
        name,
        shippingAddress: address,
        timezone: args.timezone,
        approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 1 },
        isDemo: false,
      });
      await ctx.db.patch("users", user._id, { organizationId, role: "admin" });
      resultId = organizationId;
      summary = "Workspace created.";
    }
    if (chat.task === "add_item" || (chat.task === "onboarding" && d.name)) {
      const name = boundedText(d.name ?? "", "an item name");
      itemId = await ctx.runMutation(api.companyInventory.addItem, {
        name,
        sku:
          d.sku ||
          name
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "-")
            .slice(0, 45),
        unit: d.unit || "units",
        buyUrl: d.buyUrl || "",
        supplier: d.supplier || "",
      });
      if (d.stock !== undefined)
        await ctx.runMutation(api.onboarding.updateStock, { itemId, quantity: d.stock });
      if (d.dailyUsage !== undefined)
        await ctx.runMutation(api.onboarding.fillGap, {
          itemId,
          field: "dailyUsage",
          value: String(d.dailyUsage),
        });
      if (d.leadTimeDays !== undefined)
        await ctx.runMutation(api.onboarding.fillGap, {
          itemId,
          field: "leadTimeDays",
          value: String(d.leadTimeDays),
        });
      if (d.supplierEmail)
        await ctx.runMutation(api.companyInventory.updateBuying, {
          itemId,
          buyUrl: d.buyUrl || "",
          supplierEmail: d.supplierEmail,
          coverageDays: 30,
        });
      resultId = itemId;
      summary = `${name} added to inventory.`;
    } else if (chat.task === "edit_item" && c.item) {
      itemId = c.item._id;
      if (d.stock !== undefined)
        await ctx.runMutation(api.onboarding.updateStock, { itemId, quantity: d.stock });
      for (const field of ["supplier", "dailyUsage", "leadTimeDays"] as const)
        if (d[field] !== undefined)
          await ctx.runMutation(api.onboarding.fillGap, { itemId, field, value: String(d[field]) });
      await ctx.runMutation(api.companyInventory.updateBuying, {
        itemId,
        buyUrl: d.buyUrl || "",
        supplierEmail: d.supplierEmail || "",
        coverageDays: c.item.preferredCoverageDays,
      });
      if (d.name)
        await ctx.db.patch("inventoryItems", itemId, { name: boundedText(d.name, "an item name") });
      resultId = itemId;
      summary = `${d.name ?? c.item.name} updated.`;
    } else if (chat.task === "new_buy") {
      if (!itemId) throw new ConvexError("Which inventory item is this for?");
      const item = await ctx.db.get("inventoryItems", itemId);
      if (!item || item.organizationId !== organizationId || item.archived)
        throw new ConvexError("Choose an inventory item.");
      if (d.quantity !== undefined) quantity(d.quantity, item.unit ?? "units");
      if (d.requiredBy) validDate(d.requiredBy);
      const existing = await ctx.db
        .query("companyBuys")
        .withIndex("by_itemId_and_closed", (q) => q.eq("itemId", itemId!).eq("closed", false))
        .take(100);
      for (const buy of existing) {
        const order = buy.orderId ? await ctx.db.get("companyOrders", buy.orderId) : null;
        if (!order || order.isOpen) {
          resultId = buy._id;
          break;
        }
        await ctx.db.patch("companyBuys", buy._id, { closed: true });
      }
      if (!resultId) {
        const order = await ctx.db
          .query("companyOrders")
          .withIndex("by_inventoryItemId_and_isOpen", (q) =>
            q.eq("inventoryItemId", itemId!).eq("isOpen", true),
          )
          .first();
        resultId = await ctx.db.insert("companyBuys", {
          organizationId: organizationId!,
          itemId,
          quantity: d.quantity,
          requiredBy: d.requiredBy,
          notes: d.notes ?? "",
          orderId: order?._id,
          closed: false,
          createdAt: Date.now(),
        });
      }
      summary = `Buy started for ${item.name}.`;
    } else if (chat.task === "buy" && c.item) {
      if (d.expectedOn && Date.parse(`${d.expectedOn}T23:59:59.999Z`) < Date.now())
        throw new ConvexError("The arrival date has passed. Get updated terms before saving.");
      if (c.order?.reviewRequired && (chat.reviewedDraftKey !== quoteKey(d) || !d.expectedOn))
        throw new ConvexError("Recheck price, shipping, and arrival for this change first.");
      if (chat.comparison) {
        const orders = await ctx.db
          .query("companyOrders")
          .withIndex("by_inventoryItemId_and_isOpen", (q) =>
            q.eq("inventoryItemId", c.item!._id).eq("isOpen", true),
          )
          .take(100);
        if (
          chat.comparisonState !== comparisonState(c.item, orders) ||
          chat.comparison.options.some(
            (o) => Date.parse(`${o.expectedOn}T23:59:59.999Z`) < Date.now(),
          )
        )
          throw new ConvexError(
            "Stock, buying rules, or deliveries changed. Compare the options again.",
          );
      }
      for (const field of [
        "quantity",
        "unitPriceCents",
        "freightCents",
        "taxCents",
        "currency",
        "requiredBy",
      ] as const)
        if (d[field] === undefined || d[field] === "")
          throw new ConvexError(`I still need ${field.replace(/([A-Z])/g, " $1").toLowerCase()}.`);
      if (d.supplier)
        await ctx.runMutation(api.onboarding.fillGap, {
          itemId: c.item._id,
          field: "supplier",
          value: d.supplier,
        });
      await ctx.runMutation(api.companyInventory.updateBuying, {
        itemId: c.item._id,
        buyUrl: d.buyUrl ?? c.item.buyUrl ?? "",
        supplierEmail: d.supplierEmail ?? c.item.supplierEmail ?? "",
        coverageDays: c.item.preferredCoverageDays,
      });
      const terms = {
        quantity: d.quantity!,
        unitPriceCents: d.unitPriceCents!,
        freightCents: d.freightCents!,
        taxCents: d.taxCents!,
        currency: d.currency!,
        requiredBy: d.requiredBy!,
        notes: d.notes ?? "",
      };
      const orderId =
        c.order?._id ??
        (await ctx.runMutation(api.companyOrders.create, { itemId: c.item._id, ...terms }));
      if (c.order) {
        await ctx.runMutation(api.companyOrders.updateDraft, { orderId, ...terms });
        const item = (await ctx.db.get("inventoryItems", c.item._id))!;
        await ctx.db.patch("companyOrders", orderId, {
          supplier: item.supplierName!,
          buyUrl: item.buyUrl,
          supplierEmail: item.supplierEmail,
        });
      }
      if (c.buy) await ctx.db.patch("companyBuys", c.buy._id, { orderId });
      await ctx.db.patch("companyOrders", orderId, {
        quotedArrival: d.expectedOn,
        reviewRequired: undefined,
        requestedQuantity: undefined,
      });
      resultId = c.buy?._id ?? orderId;
      summary = `Purchase ready for approval: ${c.item.name}.`;
    } else if (chat.task === "settings") {
      await ctx.runMutation(api.companyInventory.updateCompany, {
        name: d.companyName ?? "",
        shippingAddress: d.shippingAddress ?? "",
      });
      resultId = organizationId!;
      summary = "Company details updated.";
    } else if (chat.task === "confirm" && c.order) {
      await ctx.runMutation(api.companyOrders.place, {
        orderId: c.order._id,
        confirmation: d.confirmation ?? "",
        expectedOn: d.expectedOn ?? "",
      });
      resultId = chat.contextId!;
      summary = `Supplier confirmed ${c.order.itemName}.`;
    } else if (chat.task === "receive" && c.order) {
      if (d.quantity === undefined) throw new ConvexError("How many arrived?");
      await ctx.runMutation(api.companyOrders.receive, {
        orderId: c.order._id,
        quantity: d.quantity,
        requestKey: chat._id,
      });
      resultId = chat.contextId!;
      summary = `${d.quantity} ${c.order.unit} received.`;
    }
    if (!resultId) throw new ConvexError("Add the missing details first.");
    await ctx.db.patch("taskChats", chat._id, { savedAt: Date.now(), resultId });
    if (!organizationId) throw new ConvexError("Company not found.");
    if (itemId && ["onboarding", "add_item", "edit_item"].includes(chat.task)) {
      const rules = {
        buyingPriority: d.buyingPriority,
        dailyLossCents: d.dailyLossCents,
        lossCurrency: d.lossCurrency,
        stockoutImpact: d.stockoutImpact,
      };
      if (Object.values(rules).some((value) => value !== undefined)) {
        if (d.dailyLossCents !== undefined) cents(d.dailyLossCents);
        if (
          d.lossCurrency &&
          !["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "MXN", "ARS"].includes(d.lossCurrency)
        )
          throw new ConvexError("Choose a supported currency.");
        if ((d.stockoutImpact?.length ?? 0) > 500)
          throw new ConvexError("Keep the item’s impact under 501 characters.");
        await ctx.db.patch(
          "inventoryItems",
          itemId,
          Object.fromEntries(Object.entries(rules).filter(([, value]) => value !== undefined)),
        );
      }
    }
    await ctx.db.insert("deskActivity", {
      organizationId,
      summary,
      itemId,
      createdAt: Date.now(),
    });
    return resultId;
  },
});
export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    const [buys, open, closed, activity] = await Promise.all([
      ctx.db
        .query("companyBuys")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
        .order("desc")
        .take(500),
      ctx.db
        .query("companyOrders")
        .withIndex("by_organizationId_and_isOpen", (q) =>
          q.eq("organizationId", organization._id).eq("isOpen", true),
        )
        .order("desc")
        .take(500),
      ctx.db
        .query("companyOrders")
        .withIndex("by_organizationId_and_isOpen", (q) =>
          q.eq("organizationId", organization._id).eq("isOpen", false),
        )
        .order("desc")
        .take(500),
      ctx.db
        .query("deskActivity")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
        .order("desc")
        .take(30),
    ]);
    const orders = [...open, ...closed];
    const linked = new Set(buys.map((b) => b.orderId));
    const rows = await Promise.all(
      buys.map(async (buy) => {
        const item = await ctx.db.get("inventoryItems", buy.itemId);
        const order = buy.orderId ? await ctx.db.get("companyOrders", buy.orderId) : null;
        return {
          id: buy._id as string,
          itemId: buy.itemId,
          name: item?.name ?? "Archived item",
          unit: item?.unit ?? "units",
          quantity: buy.quantity ?? null,
          requiredBy: buy.requiredBy ?? null,
          closed: buy.closed,
          createdAt: buy.createdAt,
          order,
        };
      }),
    );
    const recentEvents = (
      await Promise.all(
        orders.slice(0, 20).map((order) =>
          ctx.db
            .query("companyOrderEvents")
            .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
            .order("desc")
            .take(5),
        ),
      )
    )
      .flat()
      .map((e) => ({
        id: e._id as string,
        summary: e.summary,
        createdAt: e.createdAt,
        target: rows.find((b) => b.order?._id === e.orderId)?.id ?? e.orderId,
      }));
    return {
      buys: [
        ...rows,
        ...orders
          .filter((o) => !linked.has(o._id))
          .map((order) => ({
            id: order._id as string,
            itemId: order.inventoryItemId,
            name: order.itemName,
            unit: order.unit,
            quantity: order.quantity,
            requiredBy: order.requiredBy,
            closed: !order.isOpen,
            createdAt: order.createdAt,
            order,
          })),
      ],
      activity: [
        ...activity.map((a) => ({
          id: a._id as string,
          summary: a.summary,
          createdAt: a.createdAt,
          target: a.buyId ?? a.itemId ?? null,
        })),
        ...recentEvents,
      ]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 30),
      truncated: open.length === 500 || closed.length === 500 || buys.length === 500,
    };
  },
});
export const cancelBuy = mutation({
  args: { id: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const id = ctx.db.normalizeId("companyBuys", args.id);
    const buy = id ? await ctx.db.get("companyBuys", id) : null;
    if (!buy || buy.organizationId !== organization._id) throw new ConvexError("Buy not found.");
    if (buy.orderId) throw new ConvexError("This buy already has a purchase order.");
    await ctx.db.patch("companyBuys", buy._id, { closed: true });
    return null;
  },
});

export const requestDetail = internalMutation({
  args: { chatId: v.id("taskChats"), question: questionCode },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("taskChats", args.chatId);
    if (!chat || !chat.busy || chat.savedAt) throw new Error("Conversation is not editable.");
    allowedQuestion(chat.task, args.question);
    await ctx.db.patch("taskChats", args.chatId, {
      question: args.question,
      ...(args.question === "quote" ? { resultSummary: questions.quote } : {}),
      toolUsed: true,
    });
    return { question: args.question };
  },
});

export const noteResearch = internalMutation({
  args: { chatId: v.id("taskChats"), messageId: v.string(), url: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("taskChats", args.chatId);
    if (!chat?.busy || chat.currentMessageId !== args.messageId)
      throw new Error("This request has changed.");
    await ctx.db.patch("taskChats", chat._id, {
      researchUrls: [...new Set([...(chat.researchUrls ?? []), productUrl(args.url)])].slice(-10),
    });
  },
});
export const reviewChange = internalMutation({
  args: {
    chatId: v.id("taskChats"),
    mode: v.union(v.literal("catalog"), v.literal("supplier_quote")),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("taskChats", args.chatId);
    if (!chat?.busy || chat.task !== "buy") throw new Error("Choose a buy.");
    await editableOrder(ctx, chat);
    const summary =
      args.mode === "catalog"
        ? "I’m checking the current price, shipping, and arrival for this change."
        : "This change needs a new supplier quote. Price, shipping, and arrival must be confirmed before you approve.";
    await ctx.db.patch("taskChats", chat._id, {
      revisionMode: args.mode,
      resultSummary: summary,
      toolUsed: true,
      ...(args.mode === "supplier_quote" ? { question: "quote" as const } : {}),
    });
    return { mode: args.mode, message: summary };
  },
});
export const verifyTerms = internalMutation({
  args: {
    chatId: v.id("taskChats"),
    messageId: v.string(),
    draft: deskDraft,
    source: v.union(v.literal("public_page"), v.literal("supplier_quote")),
    sourceUrl: v.optional(v.string()),
    quoteExcerpt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("taskChats", args.chatId);
    if (!chat?.busy || chat.task !== "buy" || chat.currentMessageId !== args.messageId)
      throw new Error("Choose the current buy.");
    await editableOrder(ctx, chat);
    allowedDraft("buy", args.draft);
    const d = { ...chat.draft, ...args.draft };
    for (const key of [
      "quantity",
      "unitPriceCents",
      "freightCents",
      "taxCents",
      "currency",
      "supplier",
      "expectedOn",
      "requiredBy",
    ] as const)
      if (args.draft[key] === undefined || args.draft[key] === "")
        throw new Error("Verify quantity, price, shipping, tax, and arrival together.");
    if (chat.draft.quantity !== undefined && d.quantity !== chat.draft.quantity)
      throw new Error("Check the requested quantity.");
    if (!["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "MXN", "ARS"].includes(d.currency!))
      throw new Error("Choose a supported currency.");
    for (const value of Object.values(d))
      if (typeof value === "string" && value.length > 2000) throw new Error("Detail too long.");
    quantity(d.quantity!, d.unit ?? "units");
    orderTotal(d.quantity!, d.unitPriceCents!, d.freightCents!, d.taxCents!);
    validDate(d.expectedOn!);
    validDate(d.requiredBy!);
    if (Date.parse(`${d.expectedOn}T23:59:59.999Z`) < Date.now())
      throw new Error("Get a current arrival date.");
    if (!d.buyUrl && !d.supplierEmail) throw new Error("Add the supplier contact.");
    if (d.buyUrl) productUrl(d.buyUrl);
    if (d.supplierEmail) validEmail(d.supplierEmail);
    if (
      args.source === "public_page" &&
      (!args.sourceUrl || !chat.researchUrls?.includes(productUrl(args.sourceUrl)))
    )
      throw new Error("Read the current source before verifying its terms.");
    if (
      args.source === "supplier_quote" &&
      (!args.quoteExcerpt ||
        args.quoteExcerpt.length < 20 ||
        !chat.lastUserText?.includes(args.quoteExcerpt))
    )
      throw new Error("A supplier quote is needed.");
    await ctx.db.patch("taskChats", chat._id, {
      draft: d,
      reviewedDraftKey: quoteKey(d),
      toolUsed: true,
      question: "ready",
      resultSummary:
        "The new price, shipping, and arrival are checked. Review the updated buy before approving.",
    });
    return d;
  },
});

export const setReportedStock = internalMutation({
  args: {
    chatId: v.id("taskChats"),
    messageId: v.string(),
    itemId: v.id("inventoryItems"),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("taskChats", args.chatId);
    if (
      !chat ||
      chat.task !== "stock_update" ||
      !chat.busy ||
      chat.currentMessageId !== args.messageId
    )
      throw new Error("Use the stock update task.");
    const user = await ctx.db.get("users", chat.userId);
    if (
      !user?.isActive ||
      user.isAnonymous ||
      user.organizationId !== chat.organizationId ||
      !["admin", "buyer"].includes(user.role ?? "")
    )
      throw new Error("Account unavailable.");
    if (chat.stockUpdatedMessageId === args.messageId)
      return chat.resultSummary ?? "Stock updated.";
    const item = await ctx.db.get("inventoryItems", args.itemId);
    if (!item || item.archived || item.organizationId !== chat.organizationId)
      throw new Error("Item not found.");
    if (chat.contextId && chat.contextId !== item._id) throw new Error("Keep the selected item.");
    const all = await ctx.db
      .query("inventoryItems")
      .withIndex("by_org_archived", (q) => q.eq("organizationId", item.organizationId))
      .take(250);
    const match = stockItemMatch(
      chat.lastUserText ?? "",
      all.filter((i) => !i.archived).map((i) => ({ id: i._id, name: i.name, sku: i.sku })),
    );
    if (!chat.contextId && (match?.id ?? chat.draft.itemId) !== item._id)
      throw new Error("Ask which item they mean.");
    const reported = reportedStock(chat.lastUserText ?? "", item.unit ?? "units");
    if (reported === null || reported !== args.count)
      throw new Error("Ask for an explicit remaining count in this item’s stock unit.");
    const summary = await writeStockCount(ctx, item, args.count);
    await ctx.db.patch("taskChats", chat._id, {
      stockUpdatedMessageId: args.messageId,
      resultSummary: summary,
      toolUsed: true,
      draft: { itemId: item._id, name: item.name, stock: args.count, unit: item.unit },
      updatedAt: Date.now(),
    });
    return summary;
  },
});

export const compareOptions = internalMutation({
  args: { chatId: v.id("taskChats"), messageId: v.string(), options: v.array(buyingOption) },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("taskChats", args.chatId);
    if (
      !chat ||
      chat.task !== "buy" ||
      !chat.busy ||
      chat.currentMessageId !== args.messageId ||
      !chat.draft.itemId
    )
      throw new Error("Choose a buy to compare.");
    const user = await ctx.db.get("users", chat.userId);
    const item = await ctx.db.get("inventoryItems", chat.draft.itemId);
    if (
      !item ||
      item.archived ||
      item.organizationId !== chat.organizationId ||
      !user?.isActive ||
      user.isAnonymous ||
      user.organizationId !== item.organizationId ||
      !["admin", "buyer"].includes(user.role ?? "")
    )
      throw new Error("Item not found.");
    for (const o of args.options) {
      if (chat.draft.quantity !== undefined && o.quantity !== chat.draft.quantity)
        throw new Error("Compare options for the requested quantity.");
      productUrl(o.url);
      boundedText(o.supplier, "a supplier");
      quantity(o.quantity, item.unit ?? "units");
      validDate(o.expectedOn);
      if (Date.parse(`${o.expectedOn}T23:59:59.999Z`) < Date.now())
        throw new Error("Use current arrival dates.");
      if (o.unit !== (item.unit ?? "units"))
        throw new Error("Prices must use the inventory stock unit.");
      if (!/^[A-Z]{3}$/.test(o.currency)) throw new Error("Use a currency code.");
      orderTotal(o.quantity, o.unitPriceCents, o.freightCents, o.taxCents);
    }
    const orders = await ctx.db
      .query("companyOrders")
      .withIndex("by_inventoryItemId_and_isOpen", (q) =>
        q.eq("inventoryItemId", item._id).eq("isOpen", true),
      )
      .take(100);
    const deliveries = orders
      .filter((o) => o.status === "placed" || o.status === "part_received")
      .map((o) => ({
        quantity: o.quantity - o.receivedQuantity,
        expectedOn: o.expectedOn ?? null,
      }));
    const facts: StockFacts = {
      quantity: item.stockCountKnown === false ? null : item.quantityOnHand,
      dailyUsage: item.estimatedDailyUsage ?? null,
      stockCountedAt: item.stockCountedAt ?? null,
      leadTimeDays: item.supplierLeadTimeDays ?? null,
      safetyStockDays: item.safetyStockDays,
      buyingPriority: item.buyingPriority ?? null,
      dailyLossCents: item.dailyLossCents ?? null,
      lossCurrency: item.lossCurrency ?? "USD",
    };
    const comparison = rankBuyingOptions(facts, deliveries, args.options);
    const best = comparison.options[0];
    await ctx.db.patch("taskChats", chat._id, {
      comparison,
      comparisonState: comparisonState(item, orders),
      toolUsed: true,
      question: "ready",
      draft: {
        ...chat.draft,
        quantity: best.quantity,
        expectedOn: best.expectedOn,
        supplier: best.supplier,
        buyUrl: best.url,
        supplierEmail: undefined,
        unitPriceCents: best.unitPriceCents,
        freightCents: best.freightCents,
        taxCents: best.taxCents,
        currency: best.currency,
        requiredBy: chat.draft.requiredBy ?? best.expectedOn,
      },
      updatedAt: Date.now(),
    });
    return comparison;
  },
});
