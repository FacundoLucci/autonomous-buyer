import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import { qualifyQuote, rankViableQuotes } from "./domain/quotes";

const DAY_MS = 86_400_000;

function daysAfter(date: string | undefined, baseline: string) {
  if (date === undefined || date <= baseline) return 0;
  return Math.ceil(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${baseline}T00:00:00.000Z`)) / DAY_MS,
  );
}

function paymentTermsScore(terms: string | undefined) {
  if (terms === undefined) return 0;
  const netDays = /net\s*(\d+)/i.exec(terms)?.[1];
  return netDays === undefined ? 1 : Number(netDays);
}

function latestByRfq(quotes: Doc<"quotes">[]) {
  const latest = new Map<string, Doc<"quotes">>();
  for (const quote of quotes) {
    const prior = latest.get(quote.rfqId);
    if (prior === undefined || quote.revision > prior.revision) latest.set(quote.rfqId, quote);
  }
  return [...latest.values()];
}

export const recompute = internalMutation({
  args: { procurementId: v.id("procurements") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null) throw new Error("Procurement not found.");
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_procurement", (q) => q.eq("procurementId", procurement._id))
      .take(20);
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_procurement", (q) => q.eq("procurementId", procurement._id))
      .take(100);
    const latestQuotes = latestByRfq(quotes);
    if (rfqs.length !== 3 || latestQuotes.length !== rfqs.length) return null;
    if (
      latestQuotes.some((quote) =>
        quote.missingInformation.some(
          (field) =>
            field === "quantity_available" || field === "freight" || field === "arrival_date",
        ),
      )
    ) {
      return null;
    }

    const sourceRevisionKey = latestQuotes
      .map((quote) => `${quote.rfqId}:${quote.revision}`)
      .sort()
      .join("|");
    const prior = await ctx.db
      .query("recommendations")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .order("desc")
      .take(1);
    if (prior[0]?.sourceRevisionKey === sourceRevisionKey) return null;

    const item = await ctx.db.get("inventoryItems", procurement.inventoryItemId);
    if (item === null) throw new Error("Inventory item not found.");
    const maximumOrderQuantity =
      item.maximumInventoryDays === undefined
        ? undefined
        : Math.max(
            0,
            Math.floor(item.maximumInventoryDays * procurement.averageDailyUsage) -
              item.quantityOnHand,
          );
    const rows = [];
    for (const quote of latestQuotes) {
      const supplier = await ctx.db.get("suppliers", quote.supplierId);
      if (supplier === null) continue;
      const qualification = qualifyQuote({
        arrivalDate: quote.estimatedArrivalDate,
        requiredBy: procurement.requiredBy,
        quantityAvailable: quote.quantityAvailable,
        requestedQuantity: procurement.quantityRequired,
        minimumOrderQuantity: quote.minimumOrderQuantity,
        maximumOrderQuantity,
        criticalPropertiesConfirmed: quote.matchConfidence >= 0.85,
        productMatchConfidence: quote.matchConfidence,
        requiredCertifications: [],
        confirmedCertifications: [],
        missingInformation: quote.missingInformation,
      });
      rows.push({
        quote,
        supplier,
        qualification,
        projectedStockoutDays: daysAfter(
          quote.estimatedArrivalDate,
          procurement.projectedStockoutDate,
        ),
        excessInventory: Math.max(
          0,
          (quote.quantityAvailable ?? procurement.quantityRequired) - procurement.quantityRequired,
        ),
        supplierReliability: supplier.historicalReliability ?? 0,
        paymentTermsScore: paymentTermsScore(quote.paymentTerms),
      });
    }
    const ranked = rankViableQuotes(
      rows.flatMap((row) =>
        row.quote.landedCostCents === undefined || row.quote.estimatedArrivalDate === undefined
          ? []
          : [
              {
                quoteId: row.quote._id,
                qualification: row.qualification.qualification,
                landedCostCents: row.quote.landedCostCents,
                arrivalDate: row.quote.estimatedArrivalDate,
                projectedStockoutDays: row.projectedStockoutDays,
                productMatchConfidence: row.quote.matchConfidence,
                excessInventory: row.excessInventory,
                supplierReliability: row.supplierReliability,
                paymentTermsScore: row.paymentTermsScore,
              },
            ],
      ),
    );
    const selected = ranked[0];
    if (selected === undefined) {
      if (procurement.status === "evaluating") {
        await ctx.runMutation(internal.procurements.transition, {
          procurementId: procurement._id,
          toState: "no_viable_supplier",
          summary: "No supplier quote passed the deterministic purchase rules.",
          actorType: "agent",
        });
      }
      return null;
    }

    const selectedRow = rows.find((row) => row.quote._id === selected.quoteId);
    if (selectedRow === undefined) throw new Error("Ranked quote was not found.");
    const now = Date.now();
    const recommendationId = await ctx.db.insert("recommendations", {
      procurementId: procurement._id,
      selectedQuoteId: selectedRow.quote._id,
      explanation: `${selectedRow.supplier.name} is the highest-ranked viable quote under the stored purchase rules. OpenAI explanation pending.`,
      rankingVersion: "quote-ranking-v1",
      sourceRevisionKey,
      explanationStatus: "pending",
      createdAt: now,
    });
    const rankByQuote = new Map(ranked.map((quote, index) => [quote.quoteId, index + 1]));
    for (const row of rows) {
      await ctx.db.insert("recommendationEntries", {
        recommendationId,
        procurementId: procurement._id,
        quoteId: row.quote._id,
        supplierId: row.supplier._id,
        rank: rankByQuote.get(row.quote._id),
        selected: row.quote._id === selectedRow.quote._id,
        qualification: row.qualification.qualification,
        reasons: row.qualification.reasons,
        projectedStockoutDays: row.projectedStockoutDays,
        productMatchConfidence: row.quote.matchConfidence,
        landedCostCents: row.quote.landedCostCents,
        excessInventory: row.excessInventory,
        supplierReliability: row.supplierReliability,
        paymentTermsScore: row.paymentTermsScore,
        estimatedArrivalDate: row.quote.estimatedArrivalDate,
        sourceKind: "supplier_confirmed",
        createdAt: now,
      });
    }
    await ctx.db.insert("procurementEvents", {
      procurementId: procurement._id,
      demoRunId: procurement.demoRunId,
      type: "recommendation_created",
      summary: `${selectedRow.supplier.name} ranked first after deterministic quote comparison.`,
      actorType: "agent",
      relatedRecordId: recommendationId,
      createdAt: now,
    });
    if (procurement.status === "evaluating") {
      await ctx.runMutation(internal.procurements.transition, {
        procurementId: procurement._id,
        toState: "approval_required",
        summary: "Quote comparison is complete and exact terms require buyer approval.",
        actorType: "agent",
      });
    }
    const aiRunId = await ctx.db.insert("aiRuns", {
      organizationId: procurement.organizationId,
      procurementId: procurement._id,
      anchorKey: "procurement:recommendation",
      intent:
        "Explain the stored deterministic ranking. State why the selected quote won and why lower-priced alternatives lost. Do not recalculate or change the ranking.",
      task: "recommendation_explanation",
      transport: "openai",
      model: "gpt-5.4-mini",
      status: "pending",
      evidenceRefs: [],
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.aiNode.runStructuredTask, { aiRunId });
    return null;
  },
});

export const getLatestComparison = query({
  args: { procurementId: v.id("procurements") },
  returns: v.union(
    v.object({
      recommendationId: v.id("recommendations"),
      explanation: v.string(),
      rankingVersion: v.string(),
      explanationStatus: v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed")),
      entries: v.array(
        v.object({
          quoteId: v.id("quotes"),
          supplierName: v.string(),
          rank: v.union(v.number(), v.null()),
          selected: v.boolean(),
          qualification: v.union(
            v.literal("pending"),
            v.literal("viable"),
            v.literal("disqualified"),
            v.literal("human_review"),
          ),
          reasons: v.array(v.string()),
          projectedStockoutDays: v.number(),
          productMatchConfidence: v.number(),
          landedCostCents: v.union(v.number(), v.null()),
          excessInventory: v.number(),
          supplierReliability: v.number(),
          paymentTermsScore: v.number(),
          estimatedArrivalDate: v.union(v.string(), v.null()),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const recommendations = await ctx.db
      .query("recommendations")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", args.procurementId))
      .order("desc")
      .take(1);
    const recommendation = recommendations[0];
    if (recommendation === undefined) return null;
    const entries = await ctx.db
      .query("recommendationEntries")
      .withIndex("by_recommendation", (q) => q.eq("recommendationId", recommendation._id))
      .take(20);
    const rows = [];
    for (const entry of entries) {
      const supplier = await ctx.db.get("suppliers", entry.supplierId);
      if (supplier === null) continue;
      rows.push({
        quoteId: entry.quoteId,
        supplierName: supplier.name,
        rank: entry.rank ?? null,
        selected: entry.selected,
        qualification: entry.qualification,
        reasons: entry.reasons,
        projectedStockoutDays: entry.projectedStockoutDays,
        productMatchConfidence: entry.productMatchConfidence,
        landedCostCents: entry.landedCostCents ?? null,
        excessInventory: entry.excessInventory,
        supplierReliability: entry.supplierReliability,
        paymentTermsScore: entry.paymentTermsScore,
        estimatedArrivalDate: entry.estimatedArrivalDate ?? null,
      });
    }
    rows.sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999));
    return {
      recommendationId: recommendation._id,
      explanation: recommendation.explanation,
      rankingVersion: recommendation.rankingVersion,
      explanationStatus: recommendation.explanationStatus ?? "succeeded",
      entries: rows,
    };
  },
});
