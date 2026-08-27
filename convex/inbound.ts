import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object")
    throw new Error("AgentMail message payload is invalid.");
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new Error(`AgentMail ${field} is required.`);
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export const onMessageReceived = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = record(args.message);
    const providerMessageId = requiredString(message.message_id, "message_id");
    const providerThreadId = requiredString(message.thread_id, "thread_id");
    const idempotencyKey = `agentmail:event:${args.eventId}`;
    const priorReceipt = await ctx.db
      .query("integrationReceipts")
      .withIndex("by_provider_key", (q) =>
        q.eq("provider", "agentmail").eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (priorReceipt !== null) return null;
    const priorLink = await ctx.db
      .query("emailLinks")
      .withIndex("by_provider_message", (q) =>
        q.eq("provider", "agentmail").eq("providerMessageId", providerMessageId),
      )
      .unique();
    if (priorLink !== null) return null;
    const rfq = await ctx.db
      .query("rfqs")
      .withIndex("by_thread", (q) => q.eq("providerThreadId", providerThreadId))
      .unique();
    if (rfq === null) {
      await ctx.db.insert("integrationReceipts", {
        provider: "agentmail",
        idempotencyKey,
        operation: "agentmail_receive_message",
        status: "failed",
        providerRecordId: providerMessageId,
        requestHash: providerMessageId,
        errorMessage: "Inbound AgentMail thread is not linked to an RFQ.",
        createdAt: Date.now(),
        completedAt: Date.now(),
      });
      return null;
    }
    const extractedText =
      optionalString(message.extracted_text) ??
      optionalString(message.text) ??
      optionalString(message.preview);
    if (extractedText === undefined)
      throw new Error("Inbound supplier message has no extractable text.");
    const now = Date.now();
    await ctx.db.insert("integrationReceipts", {
      procurementId: rfq.procurementId,
      provider: "agentmail",
      idempotencyKey,
      operation: "agentmail_receive_message",
      status: "succeeded",
      providerRecordId: providerMessageId,
      requestHash: `${providerMessageId}|${providerThreadId}`,
      createdAt: now,
      completedAt: now,
    });
    const emailLinkId = await ctx.db.insert("emailLinks", {
      procurementId: rfq.procurementId,
      rfqId: rfq._id,
      supplierId: rfq.supplierId,
      provider: "agentmail",
      providerMessageId,
      providerThreadId,
      direction: "inbound",
      purpose: "quote",
      createdAt: now,
    });
    await ctx.db.insert("inboundEmailEvidence", {
      emailLinkId,
      providerEventId: args.eventId,
      subject: optionalString(message.subject),
      extractedText,
      observedAt: now,
    });
    const procurement = await ctx.db.get("procurements", rfq.procurementId);
    if (procurement === null) throw new Error("Procurement not found for inbound RFQ.");
    await ctx.db.insert("procurementEvents", {
      procurementId: procurement._id,
      demoRunId: procurement.demoRunId,
      type: "email_received",
      summary: "A controlled supplier reply arrived through AgentMail.",
      actorType: "provider",
      relatedRecordId: emailLinkId,
      createdAt: now,
    });
    const aiRunId = await ctx.db.insert("aiRuns", {
      organizationId: procurement.organizationId,
      procurementId: procurement._id,
      rfqId: rfq._id,
      emailLinkId,
      intent:
        "Extract only commercial terms stated in the supplier email. Convert dollars to integer microdollars or cents as named by the schema. Use null for absent fields and list every missing required field.",
      task: "quote_extraction",
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

export const listQuotes = query({
  args: { procurementId: v.id("procurements") },
  returns: v.array(
    v.object({
      quoteId: v.id("quotes"),
      supplierName: v.string(),
      revision: v.number(),
      quantityAvailable: v.union(v.number(), v.null()),
      unitPriceMicrodollars: v.union(v.number(), v.null()),
      freightCents: v.union(v.number(), v.null()),
      landedCostCents: v.union(v.number(), v.null()),
      estimatedArrivalDate: v.union(v.string(), v.null()),
      qualification: v.union(
        v.literal("pending"),
        v.literal("viable"),
        v.literal("disqualified"),
        v.literal("human_review"),
      ),
      missingInformation: v.array(v.string()),
      responseConfidence: v.number(),
      rawProviderMessageId: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_procurement", (q) => q.eq("procurementId", args.procurementId))
      .order("desc")
      .take(50);
    const rows = [];
    for (const quote of quotes) {
      const supplier = await ctx.db.get("suppliers", quote.supplierId);
      if (supplier === null) continue;
      rows.push({
        quoteId: quote._id,
        supplierName: supplier.name,
        revision: quote.revision,
        quantityAvailable: quote.quantityAvailable ?? null,
        unitPriceMicrodollars: quote.unitPriceMicrodollars ?? null,
        freightCents: quote.freightCents ?? null,
        landedCostCents: quote.landedCostCents ?? null,
        estimatedArrivalDate: quote.estimatedArrivalDate ?? null,
        qualification: quote.qualification,
        missingInformation: quote.missingInformation,
        responseConfidence: quote.responseConfidence,
        rawProviderMessageId: quote.rawProviderMessageId,
        createdAt: quote.createdAt,
      });
    }
    return rows;
  },
});
