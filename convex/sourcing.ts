import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import schema from "./schema";

const firecrawl = new FirecrawlClient(components.firecrawl);
const SEARCH_QUERY = "16 oz tamper evident PET deli lid wholesale food packaging supplier";

function normalizeResult(result: Record<string, unknown>) {
  const metadata =
    result.metadata !== null && typeof result.metadata === "object"
      ? (result.metadata as Record<string, unknown>)
      : {};
  const urlValue = result.url ?? metadata.url ?? metadata.sourceURL;
  if (typeof urlValue !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch {
    return null;
  }
  const titleValue = result.title ?? metadata.title;
  const summaryValue = result.description ?? result.summary ?? metadata.description;
  const markdownValue = result.markdown;
  const domain = parsed.hostname.replace(/^www\./, "").toLowerCase();
  return {
    url: parsed.toString(),
    domain,
    supplierName: domain
      .split(".")[0]
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    title: typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : domain,
    summary: typeof summaryValue === "string" ? summaryValue.slice(0, 1_000) : undefined,
    markdownExcerpt: typeof markdownValue === "string" ? markdownValue.slice(0, 8_000) : undefined,
  };
}

export const start = action({
  args: { procurementId: v.id("procurements") },
  returns: v.object({ searchRunId: v.id("searchRuns"), candidateCount: v.number() }),
  handler: async (
    ctx,
    args,
  ): Promise<{ searchRunId: Id<"searchRuns">; candidateCount: number }> => {
    const searchRunId: Id<"searchRuns"> = await ctx.runMutation(internal.sourcing.begin, {
      procurementId: args.procurementId,
      query: SEARCH_QUERY,
    });
    try {
      const response = await firecrawl.search(ctx, SEARCH_QUERY, {
        limit: 6,
        sources: ["web"],
        scrapeOptions: { formats: ["markdown", "summary"], onlyMainContent: true },
      });
      const candidates = (response.web ?? [])
        .flatMap((result) => {
          const normalized = normalizeResult(result as Record<string, unknown>);
          return normalized === null ? [] : [normalized];
        })
        .filter(
          (candidate, index, all) =>
            all.findIndex((other) => other.domain === candidate.domain) === index,
        )
        .slice(0, 6);
      if (candidates.length < 2)
        throw new Error("Firecrawl returned fewer than two distinct suppliers.");
      await ctx.runMutation(internal.sourcing.complete, { searchRunId, candidates });
      return { searchRunId, candidateCount: candidates.length };
    } catch (error) {
      await ctx.runMutation(internal.sourcing.fail, {
        searchRunId,
        errorMessage: error instanceof Error ? error.message : "Supplier search failed.",
      });
      throw error;
    }
  },
});

export const begin = internalMutation({
  args: { procurementId: v.id("procurements"), query: v.string() },
  returns: v.id("searchRuns"),
  handler: async (ctx, args) => {
    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null || procurement.status !== "sourcing")
      throw new Error("Procurement is not ready for sourcing.");
    const recent = await ctx.db
      .query("searchRuns")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .order("desc")
      .take(1);
    if (recent[0]?.status === "pending") return recent[0]._id;
    const now = Date.now();
    const searchRunId = await ctx.db.insert("searchRuns", {
      procurementId: procurement._id,
      demoRunId: procurement.demoRunId,
      query: args.query,
      status: "pending",
      createdAt: now,
    });
    await ctx.db.insert("procurementEvents", {
      procurementId: procurement._id,
      demoRunId: procurement.demoRunId,
      type: "search_started",
      summary: "Firecrawl supplier discovery started.",
      actorType: "agent",
      createdAt: now,
    });
    return searchRunId;
  },
});

const candidateValidator = v.object({
  url: v.string(),
  domain: v.string(),
  supplierName: v.string(),
  title: v.string(),
  summary: v.optional(v.string()),
  markdownExcerpt: v.optional(v.string()),
});

export const complete = internalMutation({
  args: { searchRunId: v.id("searchRuns"), candidates: v.array(candidateValidator) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("searchRuns", args.searchRunId);
    if (run === null) throw new Error("Search run not found.");
    const procurement = await ctx.db.get("procurements", run.procurementId);
    if (procurement === null) throw new Error("Procurement not found.");
    const now = Date.now();
    for (const [index, candidate] of args.candidates.entries()) {
      const resultId = await ctx.db.insert("searchResults", {
        searchRunId: run._id,
        procurementId: procurement._id,
        url: candidate.url,
        title: candidate.title,
        supplierName: candidate.supplierName,
        summary: candidate.summary,
        markdownExcerpt: candidate.markdownExcerpt,
        observedAt: now,
      });
      let supplier = await ctx.db
        .query("suppliers")
        .withIndex("by_org_domain", (q) =>
          q.eq("organizationId", procurement.organizationId).eq("domain", candidate.domain),
        )
        .unique();
      if (supplier === null) {
        const supplierId = await ctx.db.insert("suppliers", {
          organizationId: procurement.organizationId,
          demoRunId: procurement.demoRunId,
          name: candidate.supplierName,
          domain: candidate.domain,
          relationship: "discovered",
          sourceUrl: candidate.url,
          isDemo: false,
        });
        supplier = await ctx.db.get("suppliers", supplierId);
      }
      if (supplier === null) continue;
      const productId = await ctx.db.insert("supplierProducts", {
        procurementId: procurement._id,
        supplierId: supplier._id,
        inventoryItemId: procurement.inventoryItemId,
        productUrl: candidate.url,
        title: candidate.title,
        matchConfidence: 0,
        matchStatus: "insufficient_information",
        observedAt: now,
      });
      await ctx.db.insert("supplierProductClaims", {
        supplierProductId: productId,
        field: "product_title",
        value: candidate.title,
        sourceKind: "website",
        sourceUrl: candidate.url,
        isConfirmed: true,
        observedAt: now,
      });
      const aiRunId = await ctx.db.insert("aiRuns", {
        organizationId: procurement.organizationId,
        procurementId: procurement._id,
        supplierProductId: productId,
        intent:
          "Assess dimensional and material product equivalency from the stored website evidence.",
        task: "product_equivalency",
        transport: "openai",
        model: "gpt-5.4-mini",
        status: "pending",
        evidenceRefs: [`searchResults:${resultId}`],
        createdAt: now + index,
      });
      await ctx.scheduler.runAfter(0, internal.aiNode.runStructuredTask, { aiRunId });
      await ctx.db.insert("procurementEvents", {
        procurementId: procurement._id,
        demoRunId: procurement.demoRunId,
        type: "supplier_discovered",
        summary: `${supplier.name} discovered through Firecrawl.`,
        actorType: "agent",
        sourceKind: "website",
        sourceUrl: candidate.url,
        relatedRecordId: supplier._id,
        createdAt: now + index,
      });
    }
    await ctx.db.patch("searchRuns", run._id, { status: "succeeded", completedAt: now });
    await ctx.db.insert("procurementEvents", {
      procurementId: procurement._id,
      demoRunId: procurement.demoRunId,
      type: "search_completed",
      summary: `${args.candidates.length} real supplier websites were captured with provenance.`,
      actorType: "agent",
      createdAt: now + args.candidates.length,
    });
    return null;
  },
});

export const fail = internalMutation({
  args: { searchRunId: v.id("searchRuns"), errorMessage: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("searchRuns", args.searchRunId, {
      status: "failed",
      errorMessage: args.errorMessage.slice(0, 500),
      completedAt: Date.now(),
    });
    return null;
  },
});

export const getLatest = query({
  args: { procurementId: v.id("procurements") },
  returns: v.union(
    v.object({
      run: schema.doc("searchRuns"),
      candidates: v.array(
        v.object({
          resultId: v.id("searchResults"),
          supplierName: v.string(),
          title: v.string(),
          url: v.string(),
          observedAt: v.number(),
          relationship: v.union(
            v.literal("incumbent"),
            v.literal("controlled_demo"),
            v.literal("discovered"),
          ),
          matchStatus: v.union(
            v.literal("exact_match"),
            v.literal("likely_match"),
            v.literal("possible_match"),
            v.literal("not_compatible"),
            v.literal("insufficient_information"),
          ),
          matchConfidence: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("searchRuns")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", args.procurementId))
      .order("desc")
      .take(1);
    const run = runs[0];
    if (run === undefined) return null;
    const results = await ctx.db
      .query("searchResults")
      .withIndex("by_search_run", (q) => q.eq("searchRunId", run._id))
      .take(20);
    const products = await ctx.db
      .query("supplierProducts")
      .withIndex("by_procurement_and_supplier", (q) => q.eq("procurementId", args.procurementId))
      .take(50);
    const productByUrl = new Map(products.map((product) => [product.productUrl, product]));
    const candidates = [];
    for (const result of results) {
      const product = productByUrl.get(result.url);
      if (product === undefined) continue;
      const supplier = await ctx.db.get("suppliers", product.supplierId);
      if (supplier === null) continue;
      candidates.push({
        resultId: result._id,
        supplierName: supplier.name,
        title: result.title,
        url: result.url,
        observedAt: result.observedAt,
        relationship: supplier.relationship,
        matchStatus: product.matchStatus,
        matchConfidence: product.matchConfidence,
      });
    }
    return { run, candidates };
  },
});
