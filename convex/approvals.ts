import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { purchaseOrderTotals } from "./domain/money";

export const decideRecommendation = mutation({
  args: {
    procurementId: v.id("procurements"),
    recommendationId: v.id("recommendations"),
    decision: v.union(v.literal("approved"), v.literal("modified"), v.literal("rejected")),
    modifiedTerms: v.optional(
      v.object({
        quantity: v.number(),
        unitPriceMicrodollars: v.number(),
        freightCents: v.number(),
      }),
    ),
    decisionNote: v.optional(v.string()),
  },
  returns: v.id("approvals"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to decide this purchase.");
    const user = await ctx.db.get("users", userId);
    if (
      user === null ||
      user.isActive !== true ||
      (user.role !== "buyer" && user.role !== "admin") ||
      user.organizationId === undefined
    ) {
      throw new Error("You do not have permission to decide purchases.");
    }

    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null) throw new Error("Procurement not found.");
    if (procurement.organizationId !== user.organizationId) {
      throw new Error("You do not have permission to decide this procurement.");
    }
    if (user.isAnonymous === true) {
      const demoRun = await ctx.db.get("demoRuns", procurement.demoRunId);
      if (demoRun?.isDemo !== true) {
        throw new Error("Judge identities can decide only demo procurements.");
      }
    }
    if (procurement.status !== "approval_required" || procurement.reviewStatus !== "required") {
      throw new Error("This procurement is not awaiting approval.");
    }

    const recommendation = await ctx.db.get("recommendations", args.recommendationId);
    if (recommendation === null || recommendation.procurementId !== procurement._id) {
      throw new Error("Recommendation does not belong to this procurement.");
    }
    const quote = await ctx.db.get("quotes", recommendation.selectedQuoteId);
    if (
      quote === null ||
      quote.procurementId !== procurement._id ||
      quote.qualification !== "viable" ||
      quote.quantityAvailable === undefined ||
      quote.unitPriceMicrodollars === undefined ||
      quote.freightCents === undefined ||
      quote.landedCostCents === undefined
    ) {
      throw new Error("The recommended quote is not eligible for a decision.");
    }
    const existingApproval = await ctx.db
      .query("approvals")
      .withIndex("by_recommendation", (q) => q.eq("recommendationId", recommendation._id))
      .take(1);
    if (existingApproval.length > 0) {
      throw new Error("This recommendation already has a recorded decision.");
    }

    if (args.decision === "modified" && args.modifiedTerms === undefined) {
      throw new Error("Modified decisions require exact replacement terms.");
    }
    if (args.decision !== "modified" && args.modifiedTerms !== undefined) {
      throw new Error("Replacement terms are allowed only for a modified decision.");
    }
    const quantity = args.modifiedTerms?.quantity ?? procurement.quantityRequired;
    const unitPriceMicrodollars =
      args.modifiedTerms?.unitPriceMicrodollars ?? quote.unitPriceMicrodollars;
    const freightCents = args.modifiedTerms?.freightCents ?? quote.freightCents;
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > quote.quantityAvailable) {
      throw new Error("Approved quantity must be a whole number within supplier availability.");
    }
    const totals = purchaseOrderTotals({ quantity, unitPriceMicrodollars, freightCents });
    const now = Date.now();
    const approvalId = await ctx.db.insert("approvals", {
      procurementId: procurement._id,
      recommendationId: recommendation._id,
      approvedQuoteId: quote._id,
      approvedQuoteRevision: quote.revision,
      status: args.decision,
      approvedByUserId: user._id,
      approvedQuantity: quantity,
      approvedUnitPriceMicrodollars: unitPriceMicrodollars,
      approvedFreightCents: freightCents,
      approvedTotalCents: totals.totalCents,
      decisionNote: args.decisionNote?.trim() || undefined,
      decidedAt: now,
    });
    const toState = args.decision === "rejected" ? "rejected" : "approved";
    await ctx.db.patch("procurements", procurement._id, {
      status: toState,
      reviewStatus: "resolved",
      updatedAt: now,
    });
    await ctx.db.insert("procurementEvents", {
      procurementId: procurement._id,
      demoRunId: procurement.demoRunId,
      type: "approval_recorded",
      summary: `Judge decision recorded: ${args.decision} for quote revision ${quote.revision}.`,
      actorType: "user",
      actorUserId: user._id,
      fromState: procurement.status,
      toState,
      relatedRecordId: approvalId,
      createdAt: now,
    });
    return approvalId;
  },
});
