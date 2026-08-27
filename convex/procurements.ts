import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { procurementStateValidator } from "./domain";
import { assertAllowedTransition, type ProcurementState } from "./domain/procurement";

const actorTypeValidator = v.union(
  v.literal("system"),
  v.literal("agent"),
  v.literal("user"),
  v.literal("provider"),
);

async function requireSuccessfulReceipt(
  ctx: MutationCtx,
  procurementId: Id<"procurements">,
  operation: "agentmail_send_rfq" | "agentmail_send_purchase_order" | "agentmail_receive_message",
) {
  const receipts = await ctx.db
    .query("integrationReceipts")
    .withIndex("by_procurement_and_operation_and_status", (query) =>
      query.eq("procurementId", procurementId).eq("operation", operation).eq("status", "succeeded"),
    )
    .order("desc")
    .take(1);
  const receipt = receipts[0];
  if (receipt?.providerRecordId === undefined) {
    throw new Error(`Cannot record ${operation} without a successful provider receipt.`);
  }
  return receipt;
}

async function requireTransitionEvidence(
  ctx: MutationCtx,
  procurementId: Id<"procurements">,
  toState: ProcurementState,
  actorType: "system" | "agent" | "user" | "provider",
  actorUserId?: Id<"users">,
) {
  if (toState === "approved") {
    if (actorType !== "user" || actorUserId === undefined) {
      throw new Error("Approval must be recorded by an authenticated buyer.");
    }
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_procurement", (query) => query.eq("procurementId", procurementId))
      .order("desc")
      .take(1);
    const approval = approvals[0];
    if (
      (approval?.status !== "approved" && approval?.status !== "modified") ||
      approval.approvedByUserId !== actorUserId
    ) {
      throw new Error("Cannot approve without a matching durable approval record.");
    }
    const [user, recommendation, quote] = await Promise.all([
      ctx.db.get("users", approval.approvedByUserId),
      ctx.db.get("recommendations", approval.recommendationId),
      ctx.db.get("quotes", approval.approvedQuoteId),
    ]);
    const procurement = await ctx.db.get("procurements", procurementId);
    if (
      procurement === null ||
      user === null ||
      !user.isActive ||
      (user.role !== "buyer" && user.role !== "admin") ||
      user.organizationId !== procurement.organizationId ||
      recommendation === null ||
      recommendation.procurementId !== procurementId ||
      recommendation.selectedQuoteId !== approval.approvedQuoteId ||
      quote === null ||
      quote.procurementId !== procurementId ||
      quote.revision !== approval.approvedQuoteRevision
    ) {
      throw new Error("Approval evidence does not match this procurement and quote revision.");
    }
  }

  if (toState === "rfq_sent") {
    const receipt = await requireSuccessfulReceipt(ctx, procurementId, "agentmail_send_rfq");
    const links = await ctx.db
      .query("emailLinks")
      .withIndex("by_procurement_and_purpose_and_direction", (query) =>
        query.eq("procurementId", procurementId).eq("purpose", "rfq").eq("direction", "outbound"),
      )
      .order("desc")
      .take(1);
    if (links[0]?.providerMessageId !== receipt.providerRecordId) {
      throw new Error("RFQ state requires a matching outbound email record.");
    }
  }

  if (toState === "po_sent") {
    const receipt = await requireSuccessfulReceipt(
      ctx,
      procurementId,
      "agentmail_send_purchase_order",
    );
    const purchaseOrders = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_procurement", (query) => query.eq("procurementId", procurementId))
      .order("desc")
      .take(1);
    const purchaseOrder = purchaseOrders[0];
    if (
      purchaseOrder === undefined ||
      (purchaseOrder.status !== "sent" && purchaseOrder.status !== "confirmed") ||
      purchaseOrder.providerMessageId !== receipt.providerRecordId
    ) {
      throw new Error("Purchase-order state requires a matching sent order and provider receipt.");
    }
    const approval = await ctx.db.get("approvals", purchaseOrder.approvalId);
    if (
      (approval?.status !== "approved" && approval?.status !== "modified") ||
      approval.procurementId !== procurementId ||
      approval.approvedQuoteId !== purchaseOrder.quoteId
    ) {
      throw new Error("Purchase order is not tied to the approved quote revision.");
    }
  }

  if (toState === "confirmed") {
    const receipt = await requireSuccessfulReceipt(ctx, procurementId, "agentmail_receive_message");
    const [purchaseOrders, confirmationLinks] = await Promise.all([
      ctx.db
        .query("purchaseOrders")
        .withIndex("by_procurement", (query) => query.eq("procurementId", procurementId))
        .order("desc")
        .take(1),
      ctx.db
        .query("emailLinks")
        .withIndex("by_procurement_and_purpose_and_direction", (query) =>
          query
            .eq("procurementId", procurementId)
            .eq("purpose", "confirmation")
            .eq("direction", "inbound"),
        )
        .order("desc")
        .take(1),
    ]);
    if (
      purchaseOrders[0]?.status !== "confirmed" ||
      confirmationLinks[0]?.providerMessageId !== receipt.providerRecordId
    ) {
      throw new Error(
        "Confirmation state requires a confirmed order and inbound provider receipt.",
      );
    }
  }
}

export const transition = internalMutation({
  args: {
    procurementId: v.id("procurements"),
    toState: procurementStateValidator,
    summary: v.string(),
    actorType: actorTypeValidator,
    actorUserId: v.optional(v.id("users")),
    relatedRecordId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null) throw new Error("Procurement not found.");
    if (args.summary.trim().length === 0) throw new Error("Transition summary is required.");
    if (args.actorType === "user" && args.actorUserId === undefined) {
      throw new Error("User transitions require an actorUserId.");
    }
    if (args.actorType !== "user" && args.actorUserId !== undefined) {
      throw new Error("Only user transitions may include an actorUserId.");
    }

    assertAllowedTransition(procurement.status, args.toState);
    await requireTransitionEvidence(
      ctx,
      procurement._id,
      args.toState,
      args.actorType,
      args.actorUserId,
    );
    const now = Date.now();
    await ctx.db.patch("procurements", args.procurementId, {
      status: args.toState,
      updatedAt: now,
    });
    await ctx.db.insert("procurementEvents", {
      procurementId: procurement._id,
      demoRunId: procurement.demoRunId,
      type: "state_transitioned",
      summary: args.summary.trim(),
      actorType: args.actorType,
      actorUserId: args.actorUserId,
      fromState: procurement.status,
      toState: args.toState,
      relatedRecordId: args.relatedRecordId,
      createdAt: now,
    });
    return null;
  },
});
