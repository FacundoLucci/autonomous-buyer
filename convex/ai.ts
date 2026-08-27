import { createThread, listUIMessages, saveMessage } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { aiTaskValidator, structuredAiResultValidator } from "./domain";
import { landedCostCents } from "./domain/money";
import { qualifyQuote } from "./domain/quotes";
import schema from "./schema";

const intentByTask = {
  supplier_search_queries: "Prepare supplier search queries from stored procurement evidence.",
  product_equivalency: "Assess product equivalency from stored product evidence.",
  rfq_wording: "Write clear RFQ email wording using only the stored required fields.",
  quote_extraction: "Extract quote fields from a stored supplier message.",
  missing_information: "Detect missing quote fields from stored evidence.",
  follow_up_wording: "Draft a follow-up that requests only missing stored fields.",
  recommendation_explanation: "Explain a completed deterministic quote ranking.",
  confirmation_extraction: "Extract confirmation terms from a stored supplier message.",
  exception_explanation: "Explain a deterministic difference using stored evidence.",
} as const;

const threadMessageValidator = v.object({
  id: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  text: v.string(),
  createdAt: v.number(),
});

function requireStableAnchor(anchorKey: string) {
  const normalized = anchorKey.trim();
  if (!/^[a-z][a-z0-9_-]*(?::[a-z0-9_-]+)*(?:\.[a-z0-9_-]+)*$/.test(normalized)) {
    throw new Error("Anchor keys must name stable product concepts.");
  }
  return normalized;
}

async function findBuyer(ctx: MutationCtx, organizationId: Id<"organizations">) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .take(20);
  return users.find((user) => user.isActive && (user.role === "buyer" || user.role === "admin"));
}

export const startStructuredTask = mutation({
  args: {
    procurementId: v.id("procurements"),
    task: aiTaskValidator,
    anchorKey: v.string(),
  },
  returns: v.object({
    aiRunId: v.id("aiRuns"),
    componentThreadId: v.string(),
  }),
  handler: async (ctx, args) => {
    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null) throw new Error("Procurement not found.");
    const demoRun = await ctx.db.get("demoRuns", procurement.demoRunId);
    if (demoRun === null || !demoRun.isDemo) {
      throw new Error("Structured tasks require an authorized demo procurement until BC-14.");
    }
    const anchorKey = requireStableAnchor(args.anchorKey);
    const buyer = await findBuyer(ctx, procurement.organizationId);
    let link = await ctx.db
      .query("agentThreadLinks")
      .withIndex("by_procurement_and_anchor", (q) =>
        q.eq("procurementId", procurement._id).eq("anchorKey", anchorKey),
      )
      .unique();
    const now = Date.now();
    if (link === null) {
      const componentThreadId = await createThread(ctx, components.agent, {
        userId: buyer?._id,
        title: `${procurement.code ?? "Open buy"} · ${anchorKey}`,
        summary: "Contextual buying guidance backed by stored evidence.",
      });
      const linkId = await ctx.db.insert("agentThreadLinks", {
        organizationId: procurement.organizationId,
        buyerUserId: buyer?._id,
        procurementId: procurement._id,
        anchorKey,
        componentThreadId,
        unreadCount: 0,
        status: "thinking",
        createdAt: now,
        updatedAt: now,
      });
      link = await ctx.db.get("agentThreadLinks", linkId);
    } else {
      await ctx.db.patch("agentThreadLinks", link._id, {
        status: "thinking",
        updatedAt: now,
      });
    }
    if (link === null) throw new Error("Could not create the contextual thread.");

    const recentRuns = await ctx.db
      .query("aiRuns")
      .withIndex("by_procurement_and_task", (q) =>
        q.eq("procurementId", procurement._id).eq("task", args.task),
      )
      .order("desc")
      .take(10);
    const alreadyPending = recentRuns.find(
      (run) =>
        run.agentThreadLinkId === link._id &&
        run.status === "pending" &&
        run.createdAt > now - 120_000,
    );
    if (alreadyPending !== undefined) {
      return { aiRunId: alreadyPending._id, componentThreadId: link.componentThreadId };
    }

    const aiRunId = await ctx.db.insert("aiRuns", {
      organizationId: procurement.organizationId,
      buyerUserId: buyer?._id,
      procurementId: procurement._id,
      agentThreadLinkId: link._id,
      anchorKey,
      intent: intentByTask[args.task],
      task: args.task,
      transport: "openai",
      model: "gpt-5.4-mini",
      status: "pending",
      evidenceRefs: [],
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.aiNode.runStructuredTask, { aiRunId });
    return { aiRunId, componentThreadId: link.componentThreadId };
  },
});

export const getEvidence = internalQuery({
  args: { aiRunId: v.id("aiRuns") },
  returns: v.object({
    task: aiTaskValidator,
    intent: v.string(),
    componentThreadId: v.string(),
    evidenceRefs: v.array(v.string()),
    evidenceJson: v.string(),
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("aiRuns", args.aiRunId);
    if (run === null || run.procurementId === undefined) {
      throw new Error("AI run is missing its procurement context.");
    }
    const procurement = await ctx.db.get("procurements", run.procurementId);
    const link =
      run.agentThreadLinkId === undefined
        ? null
        : await ctx.db.get("agentThreadLinks", run.agentThreadLinkId);
    if (procurement === null) throw new Error("AI run context not found.");
    const item = await ctx.db.get("inventoryItems", procurement.inventoryItemId);
    if (item === null) throw new Error("Inventory evidence not found.");
    const supplierProduct =
      run.supplierProductId === undefined
        ? null
        : await ctx.db.get("supplierProducts", run.supplierProductId);
    const supplier =
      supplierProduct === null ? null : await ctx.db.get("suppliers", supplierProduct.supplierId);
    const rfq = run.rfqId === undefined ? null : await ctx.db.get("rfqs", run.rfqId);
    const rfqSupplier = rfq === null ? null : await ctx.db.get("suppliers", rfq.supplierId);
    const emailLink =
      run.emailLinkId === undefined ? null : await ctx.db.get("emailLinks", run.emailLinkId);
    const inboundEvidence =
      emailLink === null
        ? null
        : await ctx.db
            .query("inboundEmailEvidence")
            .withIndex("by_email_link", (q) => q.eq("emailLinkId", emailLink._id))
            .unique();
    const latestQuotes =
      rfq === null
        ? []
        : await ctx.db
            .query("quotes")
            .withIndex("by_rfq_revision", (q) => q.eq("rfqId", rfq._id))
            .order("desc")
            .take(1);
    const latestQuote = latestQuotes[0] ?? null;
    const claims =
      supplierProduct === null
        ? []
        : await ctx.db
            .query("supplierProductClaims")
            .withIndex("by_product", (q) => q.eq("supplierProductId", supplierProduct._id))
            .take(50);
    const events = await ctx.db
      .query("procurementEvents")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .order("desc")
      .take(20);
    const recommendations = await ctx.db
      .query("recommendations")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .order("desc")
      .take(1);
    const recommendation = recommendations[0] ?? null;
    const recommendationEntries =
      recommendation === null
        ? []
        : await ctx.db
            .query("recommendationEntries")
            .withIndex("by_recommendation", (q) => q.eq("recommendationId", recommendation._id))
            .take(20);
    const recommendationSupplierNames = new Map<Id<"suppliers">, string>();
    for (const entry of recommendationEntries) {
      const entrySupplier = await ctx.db.get("suppliers", entry.supplierId);
      if (entrySupplier !== null) {
        recommendationSupplierNames.set(entry.supplierId, entrySupplier.name);
      }
    }
    const evidenceRefs = [
      `procurements:${procurement._id}`,
      `inventoryItems:${item._id}`,
      ...(supplierProduct === null ? [] : [`supplierProducts:${supplierProduct._id}`]),
      ...(rfq === null ? [] : [`rfqs:${rfq._id}`, `suppliers:${rfq.supplierId}`]),
      ...(emailLink === null ? [] : [`emailLinks:${emailLink._id}`]),
      ...(inboundEvidence === null ? [] : [`inboundEmailEvidence:${inboundEvidence._id}`]),
      ...(latestQuote === null ? [] : [`quotes:${latestQuote._id}`]),
      ...(recommendation === null ? [] : [`recommendations:${recommendation._id}`]),
      ...recommendationEntries.map((entry) => `recommendationEntries:${entry._id}`),
      ...recommendationEntries.map((entry) => `suppliers:${entry.supplierId}`),
      ...claims.map((claim) => `supplierProductClaims:${claim._id}`),
      ...events.map((event) => `procurementEvents:${event._id}`),
    ];
    return {
      task: run.task,
      intent: run.intent ?? intentByTask[run.task],
      componentThreadId: link?.componentThreadId ?? "",
      evidenceRefs,
      evidenceJson: JSON.stringify({
        procurement: {
          id: evidenceRefs[0],
          status: procurement.status,
          triggerReason: procurement.triggerReason,
          quantityRequired: procurement.quantityRequired,
          requiredBy: procurement.requiredBy,
          averageDailyUsage: procurement.averageDailyUsage,
          projectedStockoutDate: procurement.projectedStockoutDate,
          calculationVersion: procurement.calculationVersion,
        },
        inventoryItem: {
          id: evidenceRefs[1],
          sku: item.sku,
          name: item.name,
          description: item.description,
          specification: item.specification,
          quantityOnHand: item.quantityOnHand,
          casePack: item.casePack,
        },
        supplierProduct:
          supplierProduct === null
            ? null
            : {
                id: `supplierProducts:${supplierProduct._id}`,
                supplierName: supplier?.name ?? null,
                productUrl: supplierProduct.productUrl,
                title: supplierProduct.title,
                material: supplierProduct.material ?? null,
                dimensions: supplierProduct.dimensions ?? null,
                packSize: supplierProduct.packSize ?? null,
              },
        rfq:
          rfq === null
            ? null
            : {
                id: `rfqs:${rfq._id}`,
                supplierId: `suppliers:${rfq.supplierId}`,
                supplierName: rfqSupplier?.name ?? null,
                recipientEmail: rfq.recipientEmail ?? null,
                requestedQuantity: rfq.requestedQuantity,
                requiredBy: rfq.requiredBy,
                destination: rfq.destination,
                productName: item.name,
                sku: item.sku,
                specification: item.specification,
              },
        inboundMessage:
          emailLink === null || inboundEvidence === null
            ? null
            : {
                emailLinkId: `emailLinks:${emailLink._id}`,
                evidenceId: `inboundEmailEvidence:${inboundEvidence._id}`,
                providerMessageId: emailLink.providerMessageId,
                providerThreadId: emailLink.providerThreadId,
                subject: inboundEvidence.subject ?? null,
                extractedText: inboundEvidence.extractedText,
                observedAt: inboundEvidence.observedAt,
              },
        latestQuote:
          latestQuote === null
            ? null
            : {
                id: `quotes:${latestQuote._id}`,
                revision: latestQuote.revision,
                missingInformation: latestQuote.missingInformation,
                quantityAvailable: latestQuote.quantityAvailable ?? null,
                freightCents: latestQuote.freightCents ?? null,
                estimatedArrivalDate: latestQuote.estimatedArrivalDate ?? null,
              },
        recommendation:
          recommendation === null
            ? null
            : {
                id: `recommendations:${recommendation._id}`,
                selectedQuoteId: `quotes:${recommendation.selectedQuoteId}`,
                rankingVersion: recommendation.rankingVersion,
                entries: recommendationEntries.map((entry) => ({
                  id: `recommendationEntries:${entry._id}`,
                  quoteId: `quotes:${entry.quoteId}`,
                  supplierId: `suppliers:${entry.supplierId}`,
                  supplierName: recommendationSupplierNames.get(entry.supplierId) ?? null,
                  selected: entry.selected,
                  rank: entry.rank ?? null,
                  qualification: entry.qualification,
                  reasons: entry.reasons,
                  projectedStockoutDays: entry.projectedStockoutDays,
                  productMatchConfidence: entry.productMatchConfidence,
                  landedCostCents: entry.landedCostCents ?? null,
                  excessInventory: entry.excessInventory,
                  supplierReliability: entry.supplierReliability,
                  paymentTermsScore: entry.paymentTermsScore,
                  estimatedArrivalDate: entry.estimatedArrivalDate ?? null,
                })),
              },
        claims: claims.map((claim) => ({
          id: `supplierProductClaims:${claim._id}`,
          field: claim.field,
          value: claim.value,
          sourceUrl: claim.sourceUrl,
          observedAt: claim.observedAt,
        })),
        events: events.map((event) => ({
          id: `procurementEvents:${event._id}`,
          type: event.type,
          summary: event.summary,
          createdAt: event.createdAt,
        })),
      }),
    };
  },
});

export const completeRun = internalMutation({
  args: {
    aiRunId: v.id("aiRuns"),
    transport: v.union(v.literal("openai"), v.literal("openrouter")),
    model: v.string(),
    evidenceRefs: v.array(v.string()),
    result: structuredAiResultValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("aiRuns", args.aiRunId);
    if (run === null) throw new Error("AI run not found.");
    const link =
      run.agentThreadLinkId === undefined
        ? null
        : await ctx.db.get("agentThreadLinks", run.agentThreadLinkId);
    const now = Date.now();
    if (link !== null) {
      await saveMessage(ctx, components.agent, {
        threadId: link.componentThreadId,
        userId: link.buyerUserId,
        agentName: "Autonomous Buyer",
        message: { role: "assistant", content: args.result.summary },
        metadata: { provider: args.transport, model: args.model },
      });
    }
    await ctx.db.patch("aiRuns", run._id, {
      transport: args.transport,
      model: args.model,
      status: "succeeded",
      evidenceRefs: args.evidenceRefs,
      outputConfidence: args.result.confidence,
      result: args.result,
      completedAt: now,
      errorMessage: undefined,
    });
    if (run.supplierProductId !== undefined && args.result.output.task === "product_equivalency") {
      await ctx.db.patch("supplierProducts", run.supplierProductId, {
        matchStatus: args.result.output.assessment,
        matchConfidence: args.result.confidence,
      });
    }
    if (run.rfqId !== undefined && args.result.output.task === "rfq_wording") {
      await ctx.db.patch("rfqs", run.rfqId, {
        subject: args.result.output.subject,
        body: args.result.output.body,
        preparedAt: now,
      });
      const rfq = await ctx.db.get("rfqs", run.rfqId);
      if (rfq !== null) {
        const procurement = await ctx.db.get("procurements", rfq.procurementId);
        const allRfqs = await ctx.db
          .query("rfqs")
          .withIndex("by_procurement", (q) => q.eq("procurementId", rfq.procurementId))
          .take(20);
        if (
          procurement?.status === "sourcing" &&
          allRfqs.length === 3 &&
          allRfqs.every(
            (candidate) => candidate.subject !== undefined && candidate.body !== undefined,
          )
        ) {
          await ctx.db.patch("procurements", procurement._id, {
            status: "rfq_ready",
            updatedAt: now,
          });
          await ctx.db.insert("procurementEvents", {
            procurementId: procurement._id,
            demoRunId: procurement.demoRunId,
            type: "rfq_prepared",
            summary: "Three controlled RFQs are ready for recipient review.",
            actorType: "agent",
            fromState: "sourcing",
            toState: "rfq_ready",
            createdAt: now,
          });
        }
      }
    }
    if (run.emailLinkId !== undefined && args.result.output.task === "quote_extraction") {
      const emailLink = await ctx.db.get("emailLinks", run.emailLinkId);
      const rfq = emailLink?.rfqId === undefined ? null : await ctx.db.get("rfqs", emailLink.rfqId);
      const procurement = rfq === null ? null : await ctx.db.get("procurements", rfq.procurementId);
      if (emailLink === null || rfq === null || procurement === null) {
        throw new Error("Quote extraction is missing its RFQ context.");
      }
      const output = args.result.output;
      const totals =
        output.unitPriceMicrodollars === null
          ? null
          : landedCostCents({
              quantity: rfq.requestedQuantity,
              unitPriceMicrodollars: output.unitPriceMicrodollars,
              freightCents: output.freightCents ?? undefined,
              taxesCents: output.taxesCents ?? undefined,
            });
      const qualification = qualifyQuote({
        arrivalDate: output.estimatedArrivalDate ?? undefined,
        requiredBy: rfq.requiredBy,
        quantityAvailable: output.quantityAvailable ?? undefined,
        requestedQuantity: rfq.requestedQuantity,
        minimumOrderQuantity: output.minimumOrderQuantity ?? undefined,
        criticalPropertiesConfirmed: rfq.isControlledRecipient === true,
        productMatchConfidence: rfq.isControlledRecipient === true ? 0.9 : 0,
        requiredCertifications: [],
        confirmedCertifications: [],
        missingInformation: output.missingFields,
      });
      const prior = await ctx.db
        .query("quotes")
        .withIndex("by_rfq_revision", (q) => q.eq("rfqId", rfq._id))
        .order("desc")
        .take(1);
      const quoteId = await ctx.db.insert("quotes", {
        procurementId: procurement._id,
        rfqId: rfq._id,
        supplierId: rfq.supplierId,
        revision: (prior[0]?.revision ?? 0) + 1,
        quantityAvailable: output.quantityAvailable ?? undefined,
        unitPriceMicrodollars: output.unitPriceMicrodollars ?? undefined,
        extendedPriceCents: totals?.extendedPriceCents,
        freightCents: output.freightCents ?? undefined,
        taxesCents: output.taxesCents ?? undefined,
        landedCostCents: totals?.landedCostCents,
        earliestShipDate: output.earliestShipDate ?? undefined,
        estimatedArrivalDate: output.estimatedArrivalDate ?? undefined,
        minimumOrderQuantity: output.minimumOrderQuantity ?? undefined,
        packSize: output.packSize ?? undefined,
        paymentTerms: output.paymentTerms ?? undefined,
        expiresOn: output.expiresOn ?? undefined,
        missingInformation: output.missingFields,
        matchConfidence: rfq.isControlledRecipient === true ? 0.9 : 0,
        responseConfidence: args.result.confidence,
        qualification: qualification.qualification,
        rawProviderMessageId: emailLink.providerMessageId,
        extractionVersion: "quote-extraction-v1",
        createdAt: now,
      });
      await ctx.db.patch("rfqs", rfq._id, { status: "responded" });
      await ctx.db.insert("procurementEvents", {
        procurementId: procurement._id,
        demoRunId: procurement.demoRunId,
        type: "quote_recorded",
        summary: `Quote revision ${(prior[0]?.revision ?? 0) + 1} was extracted and deterministically qualified.`,
        actorType: "agent",
        relatedRecordId: quoteId,
        createdAt: now,
      });
      if (procurement.status === "awaiting_quotes") {
        await ctx.runMutation(internal.procurements.transition, {
          procurementId: procurement._id,
          toState: "evaluating",
          summary: "A supplier quote arrived and comparison has started.",
          actorType: "agent",
        });
      }
      const followUpFields = output.missingFields.filter(
        (field) =>
          field === "quantity_available" || field === "freight" || field === "arrival_date",
      );
      if (followUpFields.length > 0 && rfq.automaticFollowUpCount < 2) {
        const followUpRunId = await ctx.db.insert("aiRuns", {
          organizationId: procurement.organizationId,
          procurementId: procurement._id,
          rfqId: rfq._id,
          emailLinkId: emailLink._id,
          intent: `Draft a concise reply in the existing supplier thread. Request only these missing fields: ${followUpFields.join(", ")}. Do not change quantities, dates, or commercial terms.`,
          task: "follow_up_wording",
          transport: "openai",
          model: "gpt-5.4-mini",
          status: "pending",
          evidenceRefs: [],
          createdAt: now,
        });
        await ctx.scheduler.runAfter(0, internal.aiNode.runStructuredTask, {
          aiRunId: followUpRunId,
        });
      } else if (followUpFields.length > 0) {
        await ctx.db.patch("procurements", procurement._id, {
          reviewStatus: "required",
          reviewReason: "The supplier quote is still incomplete after two automatic follow-ups.",
          updatedAt: now,
        });
        await ctx.db.insert("procurementEvents", {
          procurementId: procurement._id,
          demoRunId: procurement.demoRunId,
          type: "review_required",
          summary: "Automatic follow-ups reached the two-attempt limit; buyer review is required.",
          actorType: "agent",
          relatedRecordId: quoteId,
          createdAt: now,
        });
      }
      await ctx.runMutation(internal.recommendations.recompute, {
        procurementId: procurement._id,
      });
    }
    if (run.rfqId !== undefined && args.result.output.task === "follow_up_wording") {
      const rfqId = run.rfqId;
      const rfq = await ctx.db.get("rfqs", rfqId);
      const latestQuotes = await ctx.db
        .query("quotes")
        .withIndex("by_rfq_revision", (q) => q.eq("rfqId", rfqId))
        .order("desc")
        .take(1);
      const quote = latestQuotes[0];
      if (rfq === null || quote === undefined) {
        throw new Error("Follow-up wording is missing its quote context.");
      }
      const allowed = new Set(quote.missingInformation);
      const requestedFields = args.result.output.requestedFields.filter(
        (field) =>
          allowed.has(field) &&
          (field === "quantity_available" || field === "freight" || field === "arrival_date"),
      );
      if (requestedFields.length === 0) {
        throw new Error("Follow-up wording did not request a currently missing required field.");
      }
      await ctx.runMutation(internal.mail.queueFollowUp, {
        rfqId,
        sourceQuoteId: quote._id,
        requestedFields,
        subject: args.result.output.subject,
        body: args.result.output.body,
      });
    }
    if (
      run.procurementId !== undefined &&
      args.result.output.task === "recommendation_explanation"
    ) {
      const recommendations = await ctx.db
        .query("recommendations")
        .withIndex("by_procurement_and_created", (q) =>
          q.eq("procurementId", run.procurementId as Id<"procurements">),
        )
        .order("desc")
        .take(1);
      const recommendation = recommendations[0];
      if (recommendation !== undefined) {
        await ctx.db.patch("recommendations", recommendation._id, {
          explanation: args.result.output.explanation,
          explanationStatus: "succeeded",
        });
      }
    }
    if (link !== null) {
      await ctx.db.patch("agentThreadLinks", link._id, {
        unreadCount: link.unreadCount + 1,
        status: "unread",
        lastMessageAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const failRun = internalMutation({
  args: {
    aiRunId: v.id("aiRuns"),
    transport: v.union(v.literal("openai"), v.literal("openrouter")),
    model: v.string(),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("aiRuns", args.aiRunId);
    if (run === null) return null;
    const now = Date.now();
    await ctx.db.patch("aiRuns", run._id, {
      transport: args.transport,
      model: args.model,
      status: "failed",
      errorMessage: args.errorMessage.slice(0, 500),
      completedAt: now,
    });
    if (run.procurementId !== undefined && run.task === "recommendation_explanation") {
      const procurementId = run.procurementId;
      const recommendations = await ctx.db
        .query("recommendations")
        .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurementId))
        .order("desc")
        .take(1);
      if (recommendations[0] !== undefined) {
        await ctx.db.patch("recommendations", recommendations[0]._id, {
          explanationStatus: "failed",
        });
      }
    }
    if (run.agentThreadLinkId !== undefined) {
      await ctx.db.patch("agentThreadLinks", run.agentThreadLinkId, {
        status: "failed",
        updatedAt: now,
      });
    }
    return null;
  },
});

export const getRun = query({
  args: { aiRunId: v.id("aiRuns") },
  returns: v.union(schema.doc("aiRuns"), v.null()),
  handler: async (ctx, args) => await ctx.db.get("aiRuns", args.aiRunId),
});

export const listThreadMessages = query({
  args: { threadId: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(threadMessageValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("agentThreadLinks")
      .withIndex("by_component_thread_id", (q) => q.eq("componentThreadId", args.threadId))
      .unique();
    if (link === null) throw new Error("Contextual thread not found.");
    const result = await listUIMessages(ctx, components.agent, args);
    return {
      page: result.page.flatMap((message) =>
        message.role === "user" || message.role === "assistant" || message.role === "system"
          ? [
              {
                id: message.id,
                role: message.role,
                text: message.text,
                createdAt: message._creationTime,
              },
            ]
          : [],
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const markThreadRead = mutation({
  args: { threadId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("agentThreadLinks")
      .withIndex("by_component_thread_id", (q) => q.eq("componentThreadId", args.threadId))
      .unique();
    if (link === null) throw new Error("Contextual thread not found.");
    await ctx.db.patch("agentThreadLinks", link._id, {
      unreadCount: 0,
      status: "read",
      updatedAt: Date.now(),
    });
    return null;
  },
});
