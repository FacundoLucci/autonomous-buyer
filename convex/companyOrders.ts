import { recordMerchantOrder } from "./merchantMetrics";
import { supplierAllowed } from "./companySuppliers";
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
import { applyStockReceipt, planningChanged } from "./companyStock";
import { matchSupplierConfirmation, matchSupplierCancellation } from "./supplierConfirmation";

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
  await ctx.db.insert("deskActivity", {
    organizationId: order.organizationId,
    itemId: order.inventoryItemId,
    orderId: order._id,
    summary: `${order.itemName}: ${kind === "supplier_reply" ? "Supplier reply received. Checking the order details." : summary}`,
    ...(["sent", "supplier_reply"].includes(kind) ? { credit: "agentmail" as const } : {}),
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
    if (!(await supplierAllowed(ctx, order.organizationId, order.buyUrl ?? order.sourceUrl)))
      throw new ConvexError("This supplier is paused in your supplier directory.");
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
    if (
      order.orderingMethod === "purchase_order" &&
      (!order.supplierPoVerified || !order.supplierEmail)
    )
      throw new ConvexError("Verify that this supplier accepts purchase orders first.");
    if (order.orderingMethod === "website" && order.browserPreparedKey !== approvalKey(order))
      throw new ConvexError("Check the supplier checkout total before approving.");
    if (order.status !== "draft") throw new ConvexError("This order has already moved forward.");
    await ctx.db.patch("companyOrders", order._id, {
      status: "approved",
      approvedAt: Date.now(),
      approvedTermsKey: approvalKey(order),
      executionState: order.orderingMethod ? "queued" : "needs_attention",
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
    if (order.orderingMethod)
      await ctx.scheduler.runAfter(0, internal.companyOrders.executeApproved, {
        orderId: order._id,
      });
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
      executionState: "confirmed",
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
    const inventory = await ctx.db.get("inventoryItems", order.inventoryItemId);
    if (inventory) await planningChanged(ctx, inventory);
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
    await applyStockReceipt(ctx, item, args.quantity, order._id);
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
  args: {
    orderId: v.id("companyOrders"),
    note: v.string(),
    supplierConfirmed: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { order, user } = await ownOrder(ctx, args.orderId);
    if (order.status === "cancelled") return null;
    if (
      order.status === "received" ||
      order.status === "sending" ||
      order.executionState === "submitting" ||
      order.executionState === "outcome_unknown"
    )
      throw new ConvexError("This order cannot be cancelled now.");
    if (
      ["sent", "placed", "part_received", "send_failed"].includes(order.status) &&
      !args.supplierConfirmed
    )
      throw new ConvexError(
        "Confirm the supplier cancelled the remaining order before removing incoming stock.",
      );
    const note = boundedText(args.note, "the cancellation reason or supplier confirmation", 500);
    await ctx.db.patch("companyOrders", order._id, {
      status: "cancelled",
      isOpen: false,
      updatedAt: Date.now(),
    });
    await orderEvent(ctx, order, "cancelled", `Remaining quantity cancelled: ${note}`, user._id);
    const buys = await ctx.db
      .query("companyBuys")
      .withIndex("by_itemId_and_closed", (q) =>
        q.eq("itemId", order.inventoryItemId).eq("closed", false),
      )
      .take(100);
    for (const buy of buys.filter((buy) => buy.orderId === order._id)) {
      await ctx.db.patch("companyBuys", buy._id, {
        closed: true,
        planVersion: (buy.planVersion ?? 0) + 1,
      });
      if (buy.automatic)
        await ctx.db.patch("inventoryItems", order.inventoryItemId, {
          replenishmentEnabled: false,
          automationState: "paused",
          automationNote: "Automatic buying paused after cancellation. Resume when ready.",
        });
    }
    const inventory = await ctx.db.get("inventoryItems", order.inventoryItemId);
    if (inventory) await planningChanged(ctx, inventory);
    return null;
  },
});

export const send = mutation({
  args: { orderId: v.id("companyOrders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { order, organization } = await ownOrder(ctx, args.orderId);
    if (order.providerOutboundId) return null;
    if (order.status !== "approved" || !order.approvedAt)
      throw new ConvexError("Approve the exact order before sending it.");
    if (!order.supplierPoVerified || order.orderingMethod !== "purchase_order")
      throw new ConvexError("Verify that this supplier accepts purchase orders first.");
    if (order.approvedTermsKey !== approvalKey(order))
      throw new ConvexError("Purchase details changed. Review them again.");
    if (!order.supplierEmail)
      throw new ConvexError("This order uses a buy link. Complete checkout with the supplier.");
    await queuePurchaseOrder(ctx, order, organization.name);
    return null;
  },
});

async function queuePurchaseOrder(
  ctx: MutationCtx,
  order: Doc<"companyOrders">,
  companyName: string,
) {
  if (!order.supplierEmail) throw new ConvexError("Supplier email missing.");
  if (!(await supplierAllowed(ctx, order.organizationId, order.buyUrl ?? order.sourceUrl)))
    throw new ConvexError("This supplier is paused in your supplier directory.");
  const inbox = await ctx.db
    .query("purchasingInboxes")
    .withIndex("by_organization_and_provider", (q) =>
      q.eq("organizationId", order.organizationId).eq("provider", "agentmail"),
    )
    .unique();
  if (!inbox) throw new ConvexError("Connect your purchasing inbox first.");
  const body = [
    `Purchase order ${order.number}`,
    `Buyer: ${companyName}`,
    `Supplier: ${order.supplier}`,
    `${order.itemName} (supplier SKU: ${order.supplierSku ?? order.sku}; internal item: ${order.sku})`,
    `Quantity: ${order.quantity} ${order.unit}`,
    `Price per ${order.unit}: ${order.currency} ${(order.unitPriceCents / 100).toFixed(2)}`,
    `Freight: ${(order.freightCents / 100).toFixed(2)}`,
    `Tax: ${(order.taxCents / 100).toFixed(2)}`,
    `Total approved: ${order.currency} ${(order.totalCents / 100).toFixed(2)}`,
    `Deliver to: ${order.shipTo}`,
    `Required by: ${order.requiredBy}`,
    order.notes,
    "Do not substitute products or change the approved terms without our agreement. Reply using these fields, completing the reference and arrival date:",
    "Confirmed: [yes only after accepting this order]",
    `Purchase order: ${order.number}`,
    "Confirmation: [your order reference]",
    `SKU: ${order.supplierSku ?? order.sku}`,
    `Quantity: ${order.quantity} ${order.unit}`,
    `Total: ${order.currency} ${(order.totalCents / 100).toFixed(2)}`,
    "Arrival: YYYY-MM-DD",
  ]
    .filter(Boolean)
    .join("\n\n");
  const outboundId = await agentmail.sendMessage(ctx, inbox.inboxId, {
    to: order.supplierEmail,
    subject: `Purchase order ${order.number} — ${companyName}`,
    text: body,
    headers: { "X-Buy-Hard-Order": order._id },
  });
  await ctx.db.patch("companyOrders", order._id, {
    status: "sending",
    executionState: "submitting",
    providerOutboundId: outboundId,
    updatedAt: Date.now(),
  });
  await orderEvent(
    ctx,
    order,
    "sending",
    `Purchase order queued for ${order.supplierEmail}.`,
    undefined,
  );
  await ctx.scheduler.runAfter(1000, internal.companyOrders.reconcile, {
    orderId: order._id,
    attempt: 0,
  });
}

export const executeApproved = internalMutation({
  args: { orderId: v.id("companyOrders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get("companyOrders", orderId);
    if (
      !order ||
      order.status !== "approved" ||
      order.executionState !== "queued" ||
      order.providerOutboundId
    )
      return null;
    if (!(await supplierAllowed(ctx, order.organizationId, order.buyUrl ?? order.sourceUrl))) {
      await ctx.db.patch("companyOrders", orderId, {
        executionState: "needs_attention",
        error: "This supplier is paused in your supplier directory.",
      });
      return null;
    }
    if (!order.approvedTermsKey || order.approvedTermsKey !== approvalKey(order)) {
      await ctx.db.patch("companyOrders", orderId, {
        executionState: "needs_attention",
        error: "Purchase details changed. Review them again.",
      });
      return null;
    }
    if (order.orderingMethod === "website") {
      await ctx.scheduler.runAfter(0, internal.browserCheckout.submit, { orderId });
      return null;
    }
    if (
      order.orderingMethod !== "purchase_order" ||
      !order.supplierPoVerified ||
      !order.supplierEmail
    )
      return null;
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", order.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    if (!inbox) {
      await ctx.scheduler.runAfter(0, internal.companyMail.prepareOrderInbox, { orderId });
      return null;
    }
    const organization = await ctx.db.get("organizations", order.organizationId);
    if (organization) await queuePurchaseOrder(ctx, order, organization.name);
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
          executionState: "outcome_unknown",
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
      executionState: success ? "awaiting_confirmation" : "needs_attention",
      providerThreadId: result.threadId ?? undefined,
      purchaseOrderSentAt: success
        ? (order.purchaseOrderSentAt ?? Date.now())
        : order.purchaseOrderSentAt,
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
  if (
    !inbox ||
    message.inbox_id !== inbox.inboxId ||
    from !== order.supplierEmail?.trim().toLowerCase()
  )
    return true;
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
  if (order.cancellationRequestedAt && order.isOpen && body) {
    if (matchSupplierCancellation(body, order)) {
      await ctx.db.patch("companyOrders", order._id, {
        status: "cancelled",
        isOpen: false,
        updatedAt: Date.now(),
        error: undefined,
      });
      const buys = await ctx.db
        .query("companyBuys")
        .withIndex("by_itemId_and_closed", (q) =>
          q.eq("itemId", order.inventoryItemId).eq("closed", false),
        )
        .take(100);
      for (const buy of buys.filter((b) => b.orderId === order._id)) {
        await ctx.db.patch("companyBuys", buy._id, {
          closed: true,
          planVersion: (buy.planVersion ?? 0) + 1,
        });
        if (buy.automatic)
          await ctx.db.patch("inventoryItems", order.inventoryItemId, {
            replenishmentEnabled: false,
            automationState: "paused",
            automationNote: "Automatic buying paused after cancellation. Resume when ready.",
          });
      }
      const inventory = await ctx.db.get("inventoryItems", order.inventoryItemId);
      if (inventory) await planningChanged(ctx, inventory);
      return true;
    }
  }
  if (["sent", "sending", "send_failed"].includes(order.status) && order.approvedAt) {
    const result = matchSupplierConfirmation(body ?? "", order);
    if (result.confirmed) {
      await ctx.db.patch("companyOrders", order._id, {
        status: "placed",
        executionState: "confirmed",
        confirmation: result.reference,
        expectedOn: result.arrival,
        placedAt: Date.now(),
        updatedAt: Date.now(),
        error: undefined,
      });
      await recordMerchantOrder(ctx, order._id, "email");
      const inventory = await ctx.db.get("inventoryItems", order.inventoryItemId);
      if (inventory) await planningChanged(ctx, inventory);
    } else {
      await ctx.db.patch("companyOrders", order._id, {
        executionState: "needs_attention",
        error: "Supplier reply needs review: " + result.reason,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.companyConfirmation.extract, {
        orderId: order._id,
        replyKey: key,
      });
    }
  }
  return true;
}

export const retryExecution = mutation({
  args: { orderId: v.id("companyOrders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const { order } = await ownOrder(ctx, orderId);
    if (
      order.status !== "approved" ||
      order.executionState !== "needs_attention" ||
      order.providerOutboundId ||
      order.orderingMethod !== "purchase_order" ||
      !order.supplierPoVerified ||
      order.approvedTermsKey !== approvalKey(order)
    )
      throw new ConvexError(
        "This order needs checking before another attempt. No new order was sent.",
      );
    await ctx.db.patch("companyOrders", orderId, { executionState: "queued", error: undefined });
    await ctx.scheduler.runAfter(0, internal.companyOrders.executeApproved, { orderId });
    return null;
  },
});

export const requestCancellation = mutation({
  args: { orderId: v.id("companyOrders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const { order, user } = await ownOrder(ctx, orderId);
    if (order.cancellationOutboundId) return null;
    if (
      !["sent", "placed", "part_received"].includes(order.status) ||
      !order.providerOutboundId ||
      !order.supplierEmail
    )
      throw new ConvexError(
        "Contact the supplier to cancel this order, then record their confirmation.",
      );
    const delivery = await agentmail.status(ctx, order.providerOutboundId as OutboundId);
    if (!delivery?.agentmailMessageId)
      throw new ConvexError("Check purchase order delivery before requesting cancellation.");
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", order.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    if (!inbox) throw new ConvexError("Purchasing inbox not found.");
    const outboundId = await agentmail.replyToMessage(
      ctx,
      inbox.inboxId,
      delivery.agentmailMessageId,
      {
        to: order.supplierEmail,
        text: `Please cancel the remaining ${order.quantity - order.receivedQuantity} ${order.unit} on purchase order ${order.number}. This is a cancellation request, not a new purchase. Please confirm using these fields:\nCancelled: [yes only after cancellation is completed]\nPurchase order: ${order.number}\nRemaining quantity: ${order.quantity - order.receivedQuantity} ${order.unit}`,
      },
    );
    await ctx.db.patch("companyOrders", orderId, {
      cancellationRequestedAt: Date.now(),
      cancellationOutboundId: outboundId,
      updatedAt: Date.now(),
    });
    await orderEvent(
      ctx,
      order,
      "cancellation_requested",
      "Cancellation requested. Incoming stock remains until the supplier confirms.",
      user._id,
    );
    return null;
  },
});
