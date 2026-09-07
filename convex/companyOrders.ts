import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { AgentMail, vEvent, type OutboundId } from "@agentmail/convex";
import { components, internal } from "./_generated/api";
import { query, type MutationCtx } from "./_generated/server";
import { mutation, internalMutation } from "./audited";
import type { Doc, Id } from "./_generated/dataModel";
import { ownedCompany } from "./onboarding";
import { approvalKey } from "../src/lib/buy-review";
import { boundedText, quantity, orderTotal, validDate } from "./companyRules";
import schema from "./schema";
import { queueAlert } from "./companyAlerts";
import { orderTerms } from "./companyFields";

const agentmail = new AgentMail(components.agentmail);
export async function orderEvent(
  ctx: MutationCtx,
  order: Doc<"companyOrders">,
  kind: string,
  summary: string,
  userId?: Id<"users">,
  requestKey?: string,
) {
  await ctx.db.insert("companyOrderEvents", {
    orderId: order._id,
    kind,
    summary,
    userId,
    requestKey,
    createdAt: Date.now(),
  });
  if (kind !== "draft")
    await queueAlert(
      ctx,
      order.organizationId,
      "order_update",
      `${order._id}:${kind}:${requestKey ?? order.updatedAt}`,
      `${order.number}: ${summary.slice(0, 100)}`,
      `${order.itemName}\n${summary}`,
      order._id,
    );
}
async function ownOrder(ctx: MutationCtx, orderId: Id<"companyOrders">) {
  const { user, organization } = await ownedCompany(ctx);
  const order = await ctx.db.get("companyOrders", orderId);
  if (!order || order.organizationId !== organization._id)
    throw new ConvexError("Order not found.");
  return { user, organization, order };
}

export const list = query({
  args: {},
  returns: v.array(schema.doc("companyOrders")),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    const open = await ctx.db
      .query("companyOrders")
      .withIndex("by_organizationId_and_isOpen", (q) =>
        q.eq("organizationId", organization._id).eq("isOpen", true),
      )
      .order("desc")
      .take(100);
    const closed = await ctx.db
      .query("companyOrders")
      .withIndex("by_organizationId_and_isOpen", (q) =>
        q.eq("organizationId", organization._id).eq("isOpen", false),
      )
      .order("desc")
      .take(30);
    return [...open, ...closed];
  },
});
export const events = query({
  args: { orderId: v.id("companyOrders") },
  returns: v.array(schema.doc("companyOrderEvents")),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const order = await ctx.db.get("companyOrders", args.orderId);
    if (!order || order.organizationId !== organization._id) return [];
    return await ctx.db
      .query("companyOrderEvents")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .order("desc")
      .take(100);
  },
});

export const get = query({
  args: { orderId: v.string() },
  returns: v.union(schema.doc("companyOrders"), v.null()),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const id = ctx.db.normalizeId("companyOrders", args.orderId);
    const order = id ? await ctx.db.get("companyOrders", id) : null;
    return order?.organizationId === organization._id ? order : null;
  },
});

export const history = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("companyOrders")),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    return await ctx.db
      .query("companyOrders")
      .withIndex("by_organizationId_and_isOpen", (q) =>
        q.eq("organizationId", organization._id).eq("isOpen", false),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const create = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    ...orderTerms,
  },
  returns: v.id("companyOrders"),
  handler: async (ctx, args) => {
    const { user, organization } = await ownedCompany(ctx);
    const item = await ctx.db.get("inventoryItems", args.itemId);
    if (!item || item.organizationId !== organization._id || item.archived)
      throw new ConvexError("Item not found.");
    const prior = await ctx.db
      .query("companyOrders")
      .withIndex("by_inventoryItemId_and_isOpen", (q) =>
        q.eq("inventoryItemId", item._id).eq("isOpen", true),
      )
      .first();
    if (prior) return prior._id;
    const source = item.sourceId ? await ctx.db.get("inventorySources", item.sourceId) : null;
    const buyUrl = item.buyUrl ?? source?.url;
    if (!buyUrl && !item.supplierEmail)
      throw new ConvexError("Add a buy link or supplier email to this item first.");
    if (!item.supplierName) throw new ConvexError("Add the supplier name first.");
    if (!organization.shippingAddress)
      throw new ConvexError("Add your delivery address in company settings.");
    quantity(args.quantity, item.unit ?? "units");
    const currency = args.currency.toUpperCase();
    if (!["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "MXN", "ARS"].includes(currency))
      throw new ConvexError("Choose a supported currency.");
    validDate(args.requiredBy);
    if (args.notes.length > 2000) throw new ConvexError("Keep order notes under 2,001 characters.");
    const id = await ctx.db.insert("companyOrders", {
      organizationId: organization._id,
      inventoryItemId: item._id,
      createdBy: user._id,
      number: "Pending",
      itemName: item.name,
      sku: item.sku,
      unit: item.unit ?? "units",
      quantity: args.quantity,
      receivedQuantity: 0,
      unitPriceCents: args.unitPriceCents,
      freightCents: args.freightCents,
      taxCents: args.taxCents,
      totalCents: orderTotal(args.quantity, args.unitPriceCents, args.freightCents, args.taxCents),
      currency,
      supplier: item.supplierName,
      supplierEmail: item.supplierEmail,
      buyUrl,
      shipTo: organization.shippingAddress,
      requiredBy: args.requiredBy,
      notes: args.notes.trim(),
      status: "draft",
      isOpen: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch("companyOrders", id, { number: `BH-${id.slice(-10).toUpperCase()}` });
    const order = (await ctx.db.get("companyOrders", id))!;
    await orderEvent(ctx, order, "draft", "Purchase prepared for review.", user._id);
    return id;
  },
});

export const approve = mutation({
  args: { orderId: v.id("companyOrders"), reviewedKey: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { order, user } = await ownOrder(ctx, args.orderId);
    if (order.quotedArrival && Date.parse(`${order.quotedArrival}T23:59:59.999Z`) < Date.now())
      throw new ConvexError(
        "The quoted arrival has passed. Check the terms again before approval.",
      );
    if (order.reviewRequired)
      throw new ConvexError(
        "Price, shipping, and arrival need to be checked again before approval.",
      );
    if (args.reviewedKey !== undefined && args.reviewedKey !== approvalKey(order))
      throw new ConvexError("This buy changed. Review the updated details before approving.");
    if (order.status === "approved") return null;
    if (order.status !== "draft") throw new ConvexError("This order has already moved forward.");
    await ctx.db.patch("companyOrders", order._id, {
      status: "approved",
      approvedAt: Date.now(),
      approvedBy: user._id,
      updatedAt: Date.now(),
    });
    await orderEvent(
      ctx,
      order,
      "approved",
      `Approved ${order.quantity} ${order.unit} for ${order.currency} ${(order.totalCents / 100).toFixed(2)}.`,
      user._id,
    );
    return null;
  },
});

export const updateDraft = mutation({
  args: { orderId: v.id("companyOrders"), ...orderTerms },
  returns: v.id("companyOrders"),
  handler: async (ctx, { orderId, ...terms }) => {
    const { order, user } = await ownOrder(ctx, orderId);
    if (order.status !== "draft") throw new ConvexError("Only an unapproved draft can be edited.");
    quantity(terms.quantity, order.unit);
    validDate(terms.requiredBy);
    if (!["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "MXN", "ARS"].includes(terms.currency))
      throw new ConvexError("Choose a supported currency.");
    if (terms.notes.length > 2000)
      throw new ConvexError("Keep order notes under 2,001 characters.");
    await ctx.db.patch("companyOrders", order._id, {
      ...terms,
      notes: terms.notes.trim(),
      totalCents: orderTotal(
        terms.quantity,
        terms.unitPriceCents,
        terms.freightCents,
        terms.taxCents,
      ),
      updatedAt: Date.now(),
    });
    await orderEvent(ctx, order, "draft", "Draft terms updated for review.", user._id);
    return order._id;
  },
});

export const place = mutation({
  args: { orderId: v.id("companyOrders"), confirmation: v.string(), expectedOn: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { order, user } = await ownOrder(ctx, args.orderId);
    if (order.status === "placed") return null;
    if (!["approved", "sent"].includes(order.status))
      throw new ConvexError("Approve the order and confirm it with your supplier first.");
    const confirmation = boundedText(args.confirmation, "the supplier confirmation", 200);
    validDate(args.expectedOn);
    await ctx.db.patch("companyOrders", order._id, {
      status: "placed",
      placedAt: Date.now(),
      confirmation,
      expectedOn: args.expectedOn,
      updatedAt: Date.now(),
    });
    await orderEvent(
      ctx,
      order,
      "placed",
      `Supplier order ${confirmation}; expected ${args.expectedOn}.`,
      user._id,
    );
    return null;
  },
});

export const receive = mutation({
  args: { orderId: v.id("companyOrders"), quantity: v.number(), requestKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { order, user } = await ownOrder(ctx, args.orderId);
    boundedText(args.requestKey, "a receipt reference", 100);
    const prior = await ctx.db
      .query("companyOrderEvents")
      .withIndex("by_orderId_and_requestKey", (q) =>
        q.eq("orderId", order._id).eq("requestKey", args.requestKey),
      )
      .unique();
    if (prior) return null;
    if (order.status !== "placed" && order.status !== "part_received")
      throw new ConvexError("Record the supplier confirmation before receiving this order.");
    quantity(args.quantity, order.unit);
    const receivedQuantity = Math.round((order.receivedQuantity + args.quantity) * 1e6) / 1e6;
    if (receivedQuantity > order.quantity)
      throw new ConvexError("Received quantity exceeds what remains on the order.");
    const item = await ctx.db.get("inventoryItems", order.inventoryItemId);
    if (!item || item.organizationId !== order.organizationId)
      throw new ConvexError("Inventory item not found.");
    if (item.stockCountKnown === false)
      throw new ConvexError(
        "Count the stock already on your shelf before receiving this delivery.",
      );
    const nextQuantity = item.quantityOnHand + args.quantity;
    if (nextQuantity > 1_000_000_000) throw new ConvexError("Stock count is too large.");
    await ctx.db.patch("inventoryItems", item._id, {
      quantityOnHand: nextQuantity,
      stockCountKnown: true,
    });
    await ctx.db.patch("companyOrders", order._id, {
      receivedQuantity,
      status: receivedQuantity === order.quantity ? "received" : "part_received",
      isOpen: receivedQuantity !== order.quantity,
      updatedAt: Date.now(),
    });
    await orderEvent(
      ctx,
      order,
      "received",
      `Received ${args.quantity} ${order.unit}; ${receivedQuantity} of ${order.quantity} received.`,
      user._id,
      args.requestKey,
    );
    await ctx.scheduler.runAfter(0, internal.companyAlerts.evaluateItem, { itemId: item._id });
    return null;
  },
});

export const cancel = mutation({
  args: { orderId: v.id("companyOrders"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { order, user } = await ownOrder(ctx, args.orderId);
    if (order.status === "cancelled") return null;
    if (order.status === "received" || order.status === "sending")
      throw new ConvexError("This order cannot be cancelled now.");
    const note = boundedText(args.note, "the cancellation reason or supplier confirmation", 500);
    await ctx.db.patch("companyOrders", order._id, {
      status: "cancelled",
      isOpen: false,
      updatedAt: Date.now(),
    });
    await orderEvent(ctx, order, "cancelled", `Remaining quantity cancelled: ${note}`, user._id);
    return null;
  },
});

export const send = mutation({
  args: { orderId: v.id("companyOrders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { order, user, organization } = await ownOrder(ctx, args.orderId);
    if (order.providerOutboundId) return null;
    if (order.status !== "approved" || !order.approvedAt)
      throw new ConvexError("Approve the exact order before sending it.");
    if (!order.supplierEmail)
      throw new ConvexError("This order uses a buy link. Complete checkout with the supplier.");
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", organization._id).eq("provider", "agentmail"),
      )
      .unique();
    if (!inbox) throw new ConvexError("Connect your purchasing inbox first.");
    const body = [
      `Purchase order ${order.number}`,
      `Buyer: ${organization.name}`,
      `Supplier: ${order.supplier}`,
      `${order.itemName} (${order.sku})`,
      `Quantity: ${order.quantity} ${order.unit}`,
      `Price per ${order.unit}: ${order.currency} ${(order.unitPriceCents / 100).toFixed(2)}`,
      `Freight: ${(order.freightCents / 100).toFixed(2)}`,
      `Tax: ${(order.taxCents / 100).toFixed(2)}`,
      `Total approved: ${order.currency} ${(order.totalCents / 100).toFixed(2)}`,
      `Deliver to: ${order.shipTo}`,
      `Required by: ${order.requiredBy}`,
      order.notes,
      "Please reply to confirm the order number, final total, and delivery date. Do not substitute products or change the approved terms without our agreement.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const outboundId = await agentmail.sendMessage(ctx, inbox.inboxId, {
      to: order.supplierEmail,
      subject: `Purchase order ${order.number} — ${organization.name}`,
      text: body,
      headers: { "X-Buy-Hard-Order": order._id },
    });
    await ctx.db.patch("companyOrders", order._id, {
      status: "sending",
      providerOutboundId: outboundId,
      updatedAt: Date.now(),
    });
    await orderEvent(
      ctx,
      order,
      "sending",
      `Purchase order queued for ${order.supplierEmail}.`,
      user._id,
    );
    await ctx.scheduler.runAfter(1000, internal.companyOrders.reconcile, {
      orderId: order._id,
      attempt: 0,
    });
    return null;
  },
});

export const reconcile = internalMutation({
  args: { orderId: v.id("companyOrders"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get("companyOrders", args.orderId);
    if (!order?.providerOutboundId || order.status !== "sending") return null;
    const result = await agentmail.status(ctx, order.providerOutboundId as OutboundId);
    if (!result || result.status === "pending") {
      if (args.attempt < 120)
        await ctx.scheduler.runAfter(5000, internal.companyOrders.reconcile, {
          ...args,
          attempt: args.attempt + 1,
        });
      else {
        await ctx.db.patch("companyOrders", order._id, {
          status: "send_failed",
          error: "Delivery is still unconfirmed. Check your purchasing inbox before retrying.",
          updatedAt: Date.now(),
        });
        await orderEvent(ctx, order, "send_failed", "Purchase order delivery needs checking.");
      }
      return null;
    }
    const success = result.status === "sent" || result.status === "delivered";
    await ctx.db.patch("companyOrders", order._id, {
      status: success ? "sent" : "send_failed",
      providerThreadId: result.threadId ?? undefined,
      error: success
        ? undefined
        : "Email delivery failed. Check the supplier address and purchasing inbox.",
      updatedAt: Date.now(),
    });
    await orderEvent(
      ctx,
      order,
      success ? "sent" : "send_failed",
      success
        ? "Purchase order sent; awaiting supplier confirmation."
        : "Purchase order email failed.",
    );
    return null;
  },
});

export const checkDelivery = mutation({
  args: { orderId: v.id("companyOrders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { order } = await ownOrder(ctx, args.orderId);
    if (order.status !== "send_failed" || !order.providerOutboundId)
      throw new ConvexError("No delivery to check.");
    await ctx.db.patch("companyOrders", order._id, { status: "sending", error: undefined });
    await ctx.scheduler.runAfter(0, internal.companyOrders.reconcile, {
      orderId: order._id,
      attempt: 0,
    });
    return null;
  },
});

// A message can bounce after the initial provider acceptance. Preserve received
// orders, but make the later mail failure visible in their activity and alerts.
export const onMailEvent = internalMutation({
  args: { event: vEvent },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    if (!["message.bounced", "message.rejected", "message.complained"].includes(event.event_type))
      return null;
    const payload: Record<string, unknown> =
      event.message ?? event.bounce ?? event.reject ?? event.complaint ?? {};
    if (typeof payload.thread_id !== "string") return null;
    const order = await ctx.db
      .query("companyOrders")
      .withIndex("by_providerThreadId", (q) =>
        q.eq("providerThreadId", payload.thread_id as string),
      )
      .unique();
    if (!order) return null; // The initial delivery poll also checks failure status.
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", order.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    if (!inbox || payload.inbox_id !== inbox.inboxId) return null;
    const key = `mail:${event.event_id}`;
    if (
      await ctx.db
        .query("companyOrderEvents")
        .withIndex("by_orderId_and_requestKey", (q) =>
          q.eq("orderId", order._id).eq("requestKey", key),
        )
        .unique()
    )
      return null;
    const error =
      "The email provider reported a delivery problem. Check the supplier address and purchasing inbox.";
    if (["sent", "sending"].includes(order.status))
      await ctx.db.patch("companyOrders", order._id, {
        status: "send_failed",
        error,
        updatedAt: Date.now(),
      });
    await orderEvent(ctx, order, "send_failed", error, undefined, key);
    return null;
  },
});

export async function receiveSupplierReply(
  ctx: MutationCtx,
  message: Record<string, unknown>,
  eventId: string,
) {
  if (typeof message.thread_id !== "string") return false;
  const order = await ctx.db
    .query("companyOrders")
    .withIndex("by_providerThreadId", (q) => q.eq("providerThreadId", message.thread_id as string))
    .unique();
  if (!order) return false;
  const inbox = await ctx.db
    .query("purchasingInboxes")
    .withIndex("by_organization_and_provider", (q) =>
      q.eq("organizationId", order.organizationId).eq("provider", "agentmail"),
    )
    .unique();
  const from =
    typeof message.from === "string"
      ? (message.from.match(/<([^<>]+)>/)?.[1] ?? message.from).trim().toLowerCase()
      : "";
  if (!inbox || message.inbox_id !== inbox.inboxId || from !== order.supplierEmail) return true;
  const key = `reply:${typeof message.message_id === "string" ? message.message_id : eventId}`;
  const prior = await ctx.db
    .query("companyOrderEvents")
    .withIndex("by_orderId_and_requestKey", (q) => q.eq("orderId", order._id).eq("requestKey", key))
    .unique();
  if (prior) return true;
  const body = [message.extracted_text, message.text, message.preview].find(
    (t) => typeof t === "string" && t.trim(),
  ) as string | undefined;
  await orderEvent(
    ctx,
    order,
    "supplier_reply",
    `Supplier reply: ${(body ?? "Open your purchasing inbox to read the reply.").slice(0, 12000)}`,
    undefined,
    key,
  );
  return true;
}
