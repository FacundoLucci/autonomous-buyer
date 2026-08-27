import { getAuthUserId } from "@convex-dev/auth/server";
import { AgentMail, type OutboundId } from "@agentmail/convex";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { purchaseOrderTotals } from "./domain/money";

const agentmail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.inbound.onMessageReceived,
});
const RECIPIENT_APPROVAL_TEXT = "APPROVE PO RECIPIENT";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function address(organization: Doc<"organizations">) {
  const value = organization.address;
  return [
    value.line1,
    value.line2,
    `${value.city}, ${value.region} ${value.postalCode}`,
    value.countryCode,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

function renderHtml(input: {
  poNumber: string;
  supplierName: string;
  buyerEntity: string;
  shipTo: string;
  sku: string;
  productDescription: string;
  quantity: number;
  unitPriceMicrodollars: number;
  extendedPriceCents: number;
  freightCents: number;
  totalCents: number;
  requiredBy: string;
  paymentTerms: string;
  rfqReference: string;
  procurementReference: string;
}) {
  const rows = [
    ["SKU", input.sku],
    ["Description", input.productDescription],
    ["Quantity", input.quantity.toLocaleString("en-US")],
    ["Unit price", money(Math.round(input.unitPriceMicrodollars / 10_000))],
    ["Extended price", money(input.extendedPriceCents)],
    ["Freight", money(input.freightCents)],
    ["Total", money(input.totalCents)],
    ["Required delivery", input.requiredBy],
    ["Payment terms", input.paymentTerms],
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.poNumber)}</title></head><body style="margin:0;background:#f5f5f4;color:#1c1917;font-family:Arial,sans-serif"><main style="max-width:720px;margin:24px auto;background:white;border:1px solid #d6d3d1;border-radius:12px;padding:32px"><p style="color:#b45309;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Purchase order</p><h1>${escapeHtml(input.poNumber)}</h1><p><strong>Supplier:</strong> ${escapeHtml(input.supplierName)}<br><strong>Buyer:</strong> ${escapeHtml(input.buyerEntity)}</p><h2>Ship to and bill to</h2><p style="white-space:pre-line">${escapeHtml(input.shipTo)}</p><table style="width:100%;border-collapse:collapse"><tbody>${rows.map(([label, value]) => `<tr><th scope="row" style="text-align:left;padding:10px;border-bottom:1px solid #e7e5e4">${escapeHtml(label)}</th><td style="text-align:right;padding:10px;border-bottom:1px solid #e7e5e4">${escapeHtml(value)}</td></tr>`).join("")}</tbody></table><p><strong>RFQ:</strong> ${escapeHtml(input.rfqReference)}<br><strong>Procurement:</strong> ${escapeHtml(input.procurementReference)}</p><p>Please reply to confirm the exact quantity, price, freight, arrival date, payment terms, and your supplier order number.</p></main></body></html>`;
}

export async function createPurchaseOrderDraft(
  ctx: MutationCtx,
  input: {
    procurement: Doc<"procurements">;
    approvalId: Id<"approvals">;
    approval: {
      approvedQuantity: number;
      approvedUnitPriceMicrodollars: number;
      approvedFreightCents: number;
      approvedTotalCents: number;
    };
    quote: Doc<"quotes">;
    createdAt: number;
  },
) {
  const existing = await ctx.db
    .query("purchaseOrders")
    .withIndex("by_approval", (q) => q.eq("approvalId", input.approvalId))
    .unique();
  if (existing !== null) return existing._id;
  const [organization, item, supplier, rfq] = await Promise.all([
    ctx.db.get("organizations", input.procurement.organizationId),
    ctx.db.get("inventoryItems", input.procurement.inventoryItemId),
    ctx.db.get("suppliers", input.quote.supplierId),
    ctx.db.get("rfqs", input.quote.rfqId),
  ]);
  if (organization === null || item === null || supplier === null || rfq === null) {
    throw new Error("Purchase-order source records are incomplete.");
  }
  if (
    rfq.procurementId !== input.procurement._id ||
    rfq.supplierId !== supplier._id ||
    rfq.recipientEmail === undefined
  ) {
    throw new Error("The approved quote does not have an exact RFQ recipient.");
  }
  const totals = purchaseOrderTotals({
    quantity: input.approval.approvedQuantity,
    unitPriceMicrodollars: input.approval.approvedUnitPriceMicrodollars,
    freightCents: input.approval.approvedFreightCents,
  });
  if (totals.totalCents !== input.approval.approvedTotalCents) {
    throw new Error("Approved totals do not match deterministic PO totals.");
  }
  const procurementReference = input.procurement.code ?? input.procurement._id;
  const poNumber = `PO-${procurementReference.replace(/^BC-/, "")}-${input.approvalId.slice(-6).toUpperCase()}`;
  const buyerAddress = address(organization);
  const paymentTerms = input.quote.paymentTerms ?? supplier.paymentTerms ?? "Due on receipt";
  const textBody = [
    `PURCHASE ORDER ${poNumber}`,
    `Supplier: ${supplier.name}`,
    `Buyer: ${organization.name}`,
    `Ship to / Bill to:\n${buyerAddress}`,
    `SKU: ${item.sku}`,
    `Description: ${item.description}`,
    `Quantity: ${input.approval.approvedQuantity}`,
    `Unit price: ${money(Math.round(input.approval.approvedUnitPriceMicrodollars / 10_000))}`,
    `Extended price: ${money(totals.extendedPriceCents)}`,
    `Freight: ${money(input.approval.approvedFreightCents)}`,
    `Total: ${money(totals.totalCents)}`,
    `Required delivery: ${input.procurement.requiredBy}`,
    `Payment terms: ${paymentTerms}`,
    `RFQ reference: ${rfq._id}`,
    `Procurement reference: ${procurementReference}`,
    "Please reply to confirm the exact quantity, price, freight, arrival date, payment terms, and your supplier order number.",
  ].join("\n\n");
  const htmlBody = renderHtml({
    poNumber,
    supplierName: supplier.name,
    buyerEntity: organization.name,
    shipTo: buyerAddress,
    sku: item.sku,
    productDescription: item.description,
    quantity: input.approval.approvedQuantity,
    unitPriceMicrodollars: input.approval.approvedUnitPriceMicrodollars,
    extendedPriceCents: totals.extendedPriceCents,
    freightCents: input.approval.approvedFreightCents,
    totalCents: totals.totalCents,
    requiredBy: input.procurement.requiredBy,
    paymentTerms,
    rfqReference: rfq._id,
    procurementReference,
  });
  return await ctx.db.insert("purchaseOrders", {
    procurementId: input.procurement._id,
    supplierId: supplier._id,
    approvalId: input.approvalId,
    quoteId: input.quote._id,
    quoteRevision: input.quote.revision,
    rfqId: rfq._id,
    poNumber,
    buyerEntity: organization.name,
    shipTo: buyerAddress,
    billTo: buyerAddress,
    sku: item.sku,
    productDescription: item.description,
    quantity: input.approval.approvedQuantity,
    unitPriceMicrodollars: input.approval.approvedUnitPriceMicrodollars,
    extendedPriceCents: totals.extendedPriceCents,
    freightCents: input.approval.approvedFreightCents,
    totalCents: totals.totalCents,
    requiredBy: input.procurement.requiredBy,
    paymentTerms,
    recipientEmail: rfq.recipientEmail,
    subject: `Purchase order ${poNumber} · ${item.sku}`,
    textBody,
    htmlBody,
    status: "draft",
    createdAt: input.createdAt,
  });
}

async function requireConfiguredBuyer(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Sign in as the configured buyer.");
  const user = await ctx.db.get("users", userId);
  if (
    user === null ||
    user.isAnonymous === true ||
    user.isActive !== true ||
    (user.role !== "buyer" && user.role !== "admin") ||
    user.organizationId === undefined
  ) {
    throw new Error("A configured buyer must approve external PO delivery.");
  }
  return user;
}

export const approveRecipient = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    recipientEmail: v.string(),
    confirmation: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireConfiguredBuyer(ctx);
    const order = await ctx.db.get("purchaseOrders", args.purchaseOrderId);
    if (order === null) throw new Error("Purchase order not found.");
    const procurement = await ctx.db.get("procurements", order.procurementId);
    if (procurement === null || procurement.organizationId !== user.organizationId) {
      throw new Error("You cannot approve this purchase-order recipient.");
    }
    const recipientEmail = args.recipientEmail.trim().toLowerCase();
    if (args.confirmation !== RECIPIENT_APPROVAL_TEXT) {
      throw new Error(`Type ${RECIPIENT_APPROVAL_TEXT} to approve the exact recipient.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) || recipientEmail.endsWith(".example")) {
      throw new Error("The recipient must be a real external email address.");
    }
    if (order.status !== "draft" || order.providerOutboundId !== undefined) {
      throw new Error("Only an unsent draft recipient can be approved.");
    }
    await ctx.db.patch("purchaseOrders", order._id, {
      recipientEmail,
      recipientApprovedAt: Date.now(),
      recipientApprovedByUserId: user._id,
    });
    return null;
  },
});

export const sendApproved = mutation({
  args: { purchaseOrderId: v.id("purchaseOrders") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireConfiguredBuyer(ctx);
    const order = await ctx.db.get("purchaseOrders", args.purchaseOrderId);
    if (order === null) throw new Error("Purchase order not found.");
    const procurement = await ctx.db.get("procurements", order.procurementId);
    if (procurement === null || procurement.organizationId !== user.organizationId) {
      throw new Error("You cannot send this purchase order.");
    }
    if (order.providerOutboundId !== undefined) return order.providerOutboundId;
    if (
      order.status !== "draft" ||
      order.recipientApprovedAt === undefined ||
      order.recipientApprovedByUserId === undefined
    ) {
      throw new Error("Approve the exact recipient before sending this purchase order.");
    }
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", procurement.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    if (inbox === null) throw new Error("The Acme purchasing inbox is not selected.");
    const idempotencyKey = `${procurement.demoRunId}:po:${order._id}:v1`;
    const priorReceipt = await ctx.db
      .query("integrationReceipts")
      .withIndex("by_provider_key", (q) =>
        q.eq("provider", "agentmail").eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (priorReceipt?.providerRecordId !== undefined) return priorReceipt.providerRecordId;
    const outboundId = await agentmail.sendMessage(ctx, inbox.inboxId, {
      to: order.recipientEmail,
      subject: order.subject,
      text: order.textBody,
      html: order.htmlBody,
      labels: ["autonomous-buyer", `procurement-${procurement._id}`, `po-${order.poNumber}`],
      headers: { "X-Autonomous-Buyer-Key": idempotencyKey },
    });
    const now = Date.now();
    await ctx.db.insert("integrationReceipts", {
      procurementId: procurement._id,
      provider: "agentmail",
      idempotencyKey,
      operation: "agentmail_send_purchase_order",
      status: "pending",
      providerRecordId: outboundId,
      requestHash: `${order.recipientEmail}|${order.subject}|${order.totalCents}`,
      createdAt: now,
    });
    await ctx.db.patch("purchaseOrders", order._id, {
      status: "queued",
      providerOutboundId: outboundId,
    });
    await ctx.scheduler.runAfter(1_000, internal.purchaseOrders.reconcileDelivery, {
      purchaseOrderId: order._id,
      attempt: 0,
    });
    return outboundId;
  },
});

export const reconcileDelivery = internalMutation({
  args: { purchaseOrderId: v.id("purchaseOrders"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get("purchaseOrders", args.purchaseOrderId);
    if (order === null || order.providerOutboundId === undefined) return null;
    if (order.status === "sent" || order.status === "confirmed") return null;
    const status = await agentmail.status(ctx, order.providerOutboundId as OutboundId);
    if ((status === null || status.status === "pending") && args.attempt < 60) {
      await ctx.scheduler.runAfter(2_000, internal.purchaseOrders.reconcileDelivery, {
        purchaseOrderId: order._id,
        attempt: args.attempt + 1,
      });
      return null;
    }
    const succeeded = status?.status === "sent" || status?.status === "delivered";
    const procurement = await ctx.db.get("procurements", order.procurementId);
    if (procurement === null) return null;
    const receipt = await ctx.db
      .query("integrationReceipts")
      .withIndex("by_provider_key", (q) =>
        q
          .eq("provider", "agentmail")
          .eq("idempotencyKey", `${procurement.demoRunId}:po:${order._id}:v1`),
      )
      .unique();
    const now = Date.now();
    if (receipt !== null) {
      await ctx.db.patch("integrationReceipts", receipt._id, {
        status: succeeded ? "succeeded" : "failed",
        providerRecordId: status?.agentmailMessageId ?? order.providerOutboundId,
        errorMessage: status?.errorMessage ?? undefined,
        completedAt: now,
      });
    }
    await ctx.db.patch("purchaseOrders", order._id, {
      status: succeeded ? "sent" : "draft",
      providerMessageId: status?.agentmailMessageId ?? undefined,
      providerThreadId: status?.threadId ?? undefined,
      errorMessage:
        status?.errorMessage ?? (status === null ? "Delivery status unavailable." : undefined),
      sentAt: succeeded ? now : undefined,
    });
    if (succeeded && status?.agentmailMessageId && status.threadId) {
      const existingLink = await ctx.db
        .query("emailLinks")
        .withIndex("by_provider_message", (q) =>
          q
            .eq("provider", "agentmail")
            .eq("providerMessageId", status.agentmailMessageId as string),
        )
        .unique();
      if (existingLink === null) {
        await ctx.db.insert("emailLinks", {
          procurementId: procurement._id,
          rfqId: order.rfqId,
          supplierId: order.supplierId,
          provider: "agentmail",
          providerMessageId: status.agentmailMessageId,
          providerThreadId: status.threadId,
          direction: "outbound",
          purpose: "purchase_order",
          createdAt: now,
        });
      }
      if (procurement.status === "approved") {
        await ctx.db.patch("inventoryItems", procurement.inventoryItemId, { status: "ordered" });
        await ctx.runMutation(internal.procurements.transition, {
          procurementId: procurement._id,
          toState: "po_sent",
          summary: `${order.poNumber} was sent once through AgentMail.`,
          actorType: "agent",
          relatedRecordId: order._id,
        });
        await ctx.runMutation(internal.procurements.transition, {
          procurementId: procurement._id,
          toState: "confirmation_pending",
          summary: `Waiting for supplier confirmation of ${order.poNumber}.`,
          actorType: "agent",
          relatedRecordId: order._id,
        });
      }
      await ctx.db.insert("procurementEvents", {
        procurementId: procurement._id,
        demoRunId: procurement.demoRunId,
        type: "purchase_order_sent",
        summary: `${order.poNumber} delivery succeeded for the approved recipient.`,
        actorType: "provider",
        relatedRecordId: order._id,
        createdAt: now,
      });
    }
    return null;
  },
});
