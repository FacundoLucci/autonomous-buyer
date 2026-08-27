import { v } from "convex/values";

import { mutation } from "./_generated/server";

export const approveRecommendation = mutation({
  args: {
    procurementId: v.id("procurements"),
    recommendationId: v.id("recommendations"),
    decisionNote: v.optional(v.string()),
  },
  returns: v.id("approvals"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Sign in to approve this purchase.");

    const user = await ctx.db
      .query("users")
      .withIndex("by_identity", (query) => query.eq("identityToken", identity.tokenIdentifier))
      .unique();
    if (user === null || !user.isActive || (user.role !== "buyer" && user.role !== "admin")) {
      throw new Error("You do not have permission to approve purchases.");
    }

    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null) throw new Error("Procurement not found.");
    if (procurement.organizationId !== user.organizationId) {
      throw new Error("You do not have permission to approve this procurement.");
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
      quote.qualification !== "viable"
    ) {
      throw new Error("The recommended quote is not eligible for approval.");
    }
    if (
      quote.quantityAvailable === undefined ||
      quote.quantityAvailable < procurement.quantityRequired ||
      quote.unitPriceMicrodollars === undefined ||
      quote.freightCents === undefined ||
      quote.landedCostCents === undefined
    ) {
      throw new Error("The recommended quote is missing required commercial terms.");
    }

    const existingApproval = await ctx.db
      .query("approvals")
      .withIndex("by_recommendation", (query) => query.eq("recommendationId", recommendation._id))
      .take(1);
    if (existingApproval.length > 0) {
      throw new Error("This recommendation already has a recorded decision.");
    }

    const now = Date.now();
    const approvalId = await ctx.db.insert("approvals", {
      procurementId: procurement._id,
      recommendationId: recommendation._id,
      approvedQuoteId: quote._id,
      approvedQuoteRevision: quote.revision,
      status: "approved",
      approvedByUserId: user._id,
      approvedQuantity: procurement.quantityRequired,
      approvedUnitPriceMicrodollars: quote.unitPriceMicrodollars,
      approvedFreightCents: quote.freightCents,
      approvedTotalCents: quote.landedCostCents,
      decisionNote: args.decisionNote?.trim() || undefined,
      decidedAt: now,
    });

    await ctx.db.patch("procurements", procurement._id, {
      status: "approved",
      reviewStatus: "resolved",
      updatedAt: now,
    });
    await ctx.db.insert("procurementEvents", {
      procurementId: procurement._id,
      demoRunId: procurement.demoRunId,
      type: "approval_recorded",
      summary: `Purchase approved for quote revision ${quote.revision}.`,
      actorType: "user",
      actorUserId: user._id,
      fromState: procurement.status,
      toState: "approved",
      relatedRecordId: approvalId,
      createdAt: now,
    });

    return approvalId;
  },
});
