import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { aiTaskValidator, inventoryStatusValidator, procurementStateValidator } from "./domain";

const finishedStatuses = new Set<Doc<"procurements">["status"]>([
  "confirmed",
  "closed",
  "cancelled",
  "rejected",
  "no_viable_supplier",
]);

function isOpenBuy(procurement: Doc<"procurements">) {
  return procurement.isActive && !finishedStatuses.has(procurement.status);
}

const matchConfidenceSourceValidator = v.union(
  v.literal("controlled_demo_assumption"),
  v.literal("unverified"),
);

const inventoryRowValidator = v.object({
  inventoryItemId: v.id("inventoryItems"),
  sku: v.string(),
  name: v.string(),
  quantityOnHand: v.number(),
  confirmedIncoming: v.number(),
  averageDailyUsage: v.number(),
  daysRemaining: v.union(v.number(), v.null()),
  safetyStockDays: v.number(),
  status: inventoryStatusValidator,
  procurement: v.union(
    v.object({
      procurementId: v.id("procurements"),
      code: v.string(),
      status: procurementStateValidator,
      quantityRequired: v.number(),
      requiredBy: v.string(),
      isOpen: v.optional(v.boolean()),
    }),
    v.null(),
  ),
});

const activityValidator = v.object({
  eventId: v.id("procurementEvents"),
  procurementId: v.id("procurements"),
  code: v.string(),
  summary: v.string(),
  createdAt: v.number(),
});

const dashboardValidator = v.object({
  organizationName: v.string(),
  demoRunId: v.id("demoRuns"),
  runStatus: v.union(
    v.literal("ready"),
    v.literal("active"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("reset"),
  ),
  inventory: v.array(inventoryRowValidator),
  activity: v.array(activityValidator),
  openBuyCount: v.number(),
  latestConfirmedProcurementId: v.optional(v.union(v.id("procurements"), v.null())),
  needsActionCount: v.number(),
  annualSpendCents: v.number(),
  savingsIdentifiedCents: v.number(),
  projectedStockouts: v.number(),
  autonomousProcurementPercent: v.number(),
  agent: v.object({
    state: v.union(
      v.literal("watching"),
      v.literal("working"),
      v.literal("needs_you"),
      v.literal("guiding"),
    ),
    message: v.string(),
    unreadThreadCount: v.number(),
  }),
});

function procurementCode(code: string | undefined, creationTime: number) {
  return code ?? `PC-${String(Math.floor(creationTime / 1000) % 10_000).padStart(4, "0")}`;
}

export const getDashboard = query({
  args: {},
  returns: v.union(dashboardValidator, v.null()),
  handler: async (ctx) => {
    const runs = await ctx.db.query("demoRuns").withIndex("by_started_at").order("desc").take(1);
    const run = runs[0];
    if (run === undefined || run.status === "reset") return null;

    const items = await ctx.db
      .query("inventoryItems")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", run._id))
      .take(20);
    const procurements = await ctx.db
      .query("procurements")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", run._id))
      .order("desc")
      .take(100);
    // Keep completed evidence reachable, while an open buy takes priority for its item.
    const latestByItem = new Map<Doc<"procurements">["inventoryItemId"], Doc<"procurements">>();
    for (const procurement of procurements) {
      const previous = latestByItem.get(procurement.inventoryItemId);
      if (previous === undefined || (isOpenBuy(procurement) && !isOpenBuy(previous))) {
        latestByItem.set(procurement.inventoryItemId, procurement);
      }
    }

    const inventory = [];
    for (const item of items) {
      const usage = await ctx.db
        .query("inventoryUsage")
        .withIndex("by_item_date", (q) => q.eq("inventoryItemId", item._id))
        .order("desc")
        .take(30);
      const averageDailyUsage =
        usage.reduce((total, record) => total + record.quantityConsumed, 0) / 30;
      const linkedBuy = latestByItem.get(item._id);
      const expected = await ctx.db
        .query("expectedInventory")
        .withIndex("by_item_arrival", (q) => q.eq("inventoryItemId", item._id))
        .take(100);
      inventory.push({
        inventoryItemId: item._id,
        sku: item.sku,
        name: item.name,
        quantityOnHand: item.quantityOnHand,
        confirmedIncoming: expected
          .filter((record) => record.status === "confirmed")
          .reduce((total, record) => total + record.quantity, 0),
        averageDailyUsage,
        daysRemaining: averageDailyUsage === 0 ? null : item.quantityOnHand / averageDailyUsage,
        safetyStockDays: item.safetyStockDays,
        status: item.status,
        procurement:
          linkedBuy === undefined
            ? null
            : {
                procurementId: linkedBuy._id,
                code: procurementCode(linkedBuy.code, linkedBuy._creationTime),
                status: linkedBuy.status,
                quantityRequired: linkedBuy.quantityRequired,
                requiredBy: linkedBuy.requiredBy,
                isOpen: isOpenBuy(linkedBuy),
              },
      });
    }
    inventory.sort((a, b) => {
      const priority = { action_required: 0, watch: 1, covered: 2, healthy: 3 } as Record<
        string,
        number
      >;
      return (priority[a.status] ?? 1) - (priority[b.status] ?? 1);
    });

    const events = await ctx.db
      .query("procurementEvents")
      .withIndex("by_run_created", (q) => q.eq("demoRunId", run._id))
      .order("desc")
      .take(6);
    const procurementById = new Map(
      procurements.map((procurement) => [procurement._id, procurement]),
    );
    const activity = events.flatMap((event) => {
      const procurement = procurementById.get(event.procurementId);
      return procurement === undefined
        ? []
        : [
            {
              eventId: event._id,
              procurementId: event.procurementId,
              code: procurementCode(procurement.code, procurement._creationTime),
              summary: event.summary,
              createdAt: event.createdAt,
            },
          ];
    });

    const organization = await ctx.db.get("organizations", items[0]?.organizationId ?? null);
    if (organization === null) return null;
    const metrics = await ctx.db
      .query("historicalMetrics")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", run._id))
      .take(1);
    const metric = metrics[0];
    const threadLinks = await ctx.db
      .query("agentThreadLinks")
      .withIndex("by_organization_and_updated_at", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(100);
    const unreadThreadCount = threadLinks.reduce((total, link) => total + link.unreadCount, 0);
    const open = procurements.filter(isOpenBuy);
    const needsReview = [...latestByItem.values()].filter(
      (procurement) =>
        procurement.isActive &&
        (procurement.status === "approval_required" ||
          procurement.status === "exception" ||
          procurement.status === "no_viable_supplier"),
    );
    const needsBuyer = needsReview.length > 0;
    const actionItemIds = new Set([
      ...inventory
        .filter((item) =>
          ["action_required", "approval_required", "exception"].includes(item.status),
        )
        .map((item) => item.inventoryItemId),
      ...needsReview.map((procurement) => procurement.inventoryItemId),
    ]);
    const latestConfirmed = procurements
      .filter(
        (procurement) => procurement.status === "confirmed" || procurement.status === "closed",
      )
      .sort((first, second) => second.updatedAt - first.updatedAt)[0];
    const waitingForConfirmation = open.some((procurement) =>
      ["po_sent", "confirmation_pending"].includes(procurement.status),
    );
    const waitingForQuotes = open.some((procurement) =>
      ["rfq_sent", "awaiting_quotes"].includes(procurement.status),
    );
    const preparingDelivery = open.some((procurement) =>
      ["rfq_ready", "approved"].includes(procurement.status),
    );
    const doingWork = open.some((procurement) =>
      ["detected", "analyzing", "sourcing", "evaluating"].includes(procurement.status),
    );
    const agentState = needsBuyer
      ? ("needs_you" as const)
      : doingWork
        ? ("working" as const)
        : preparingDelivery
          ? ("guiding" as const)
          : ("watching" as const);
    const agentMessage = needsBuyer
      ? "A purchase needs your review."
      : doingWork
        ? open.some((procurement) => procurement.status === "evaluating")
          ? "Supplier quotes are being compared against the purchase requirements."
          : open.some((procurement) => procurement.status === "sourcing")
            ? "Supplier sourcing is in progress."
            : "Inventory risk is being analyzed."
        : preparingDelivery
          ? "Purchase documents are ready for approved delivery."
          : waitingForConfirmation
            ? "The purchase order is sent. Waiting for supplier confirmation."
            : waitingForQuotes
              ? "Requests are sent. Waiting for supplier quotes."
              : latestConfirmed !== undefined
                ? "The latest purchase is supplier-confirmed. Inventory monitoring continues."
                : "Inventory monitoring is ready. There are no open purchases.";
    return {
      organizationName: organization.name,
      demoRunId: run._id,
      runStatus: run.status,
      inventory,
      activity,
      openBuyCount: open.length,
      latestConfirmedProcurementId: latestConfirmed?._id ?? null,
      needsActionCount: actionItemIds.size,
      annualSpendCents: metric?.annualSpendCents ?? 0,
      savingsIdentifiedCents: metric?.savingsIdentifiedCents ?? 0,
      projectedStockouts: metric?.projectedStockouts ?? 0,
      autonomousProcurementPercent: metric?.autonomousProcurementPercent ?? 0,
      agent: {
        state: agentState,
        message: agentMessage,
        unreadThreadCount,
      },
    };
  },
});

export const getProcurement = query({
  args: { procurementId: v.id("procurements") },
  returns: v.union(
    v.object({
      procurementId: v.id("procurements"),
      code: v.string(),
      status: procurementStateValidator,
      itemName: v.string(),
      sku: v.string(),
      triggerReason: v.string(),
      quantityRequired: v.number(),
      requiredBy: v.string(),
      averageDailyUsage: v.number(),
      projectedStockoutDate: v.string(),
      calculationVersion: v.string(),
      calculationInputs: v.union(
        v.object({
          asOfDate: v.string(),
          quantityOnHand: v.number(),
          trailingUsageDays: v.number(),
          safetyStockDays: v.number(),
          supplierLeadTimeDays: v.number(),
          coverageDays: v.number(),
          casePack: v.number(),
          incomingQuantity: v.number(),
        }),
        v.null(),
      ),
      events: v.array(
        v.object({
          eventId: v.id("procurementEvents"),
          summary: v.string(),
          createdAt: v.number(),
          toState: v.union(procurementStateValidator, v.null()),
        }),
      ),
      threadLinks: v.array(
        v.object({
          anchorKey: v.string(),
          componentThreadId: v.string(),
          unreadCount: v.number(),
          status: v.union(
            v.literal("read"),
            v.literal("unread"),
            v.literal("thinking"),
            v.literal("failed"),
          ),
        }),
      ),
      providerEvidence: v.optional(
        v.object({
          sourcing: v.union(
            v.object({
              provider: v.literal("firecrawl"),
              status: v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed")),
              sourceCount: v.number(),
              createdAt: v.number(),
              completedAt: v.union(v.number(), v.null()),
            }),
            v.null(),
          ),
          ai: v.array(
            v.object({
              task: aiTaskValidator,
              transport: v.union(v.literal("openai"), v.literal("openrouter")),
              model: v.string(),
              status: v.literal("succeeded"),
              evidenceCount: v.number(),
              createdAt: v.number(),
              completedAt: v.union(v.number(), v.null()),
            }),
          ),
        }),
      ),
      recommendation: v.union(
        v.object({
          recommendationId: v.id("recommendations"),
          supplierName: v.string(),
          explanation: v.string(),
          quantityAvailable: v.union(v.number(), v.null()),
          unitPriceMicrodollars: v.union(v.number(), v.null()),
          freightCents: v.union(v.number(), v.null()),
          landedCostCents: v.union(v.number(), v.null()),
          estimatedArrivalDate: v.union(v.string(), v.null()),
          matchConfidence: v.number(),
          matchConfidenceSource: v.optional(matchConfidenceSourceValidator),
          alternatives: v.array(
            v.object({
              supplierName: v.string(),
              landedCostCents: v.union(v.number(), v.null()),
              estimatedArrivalDate: v.union(v.string(), v.null()),
              qualification: v.union(
                v.literal("pending"),
                v.literal("viable"),
                v.literal("disqualified"),
                v.literal("human_review"),
              ),
            }),
          ),
        }),
        v.null(),
      ),
      approval: v.union(
        v.object({
          status: v.union(v.literal("approved"), v.literal("modified"), v.literal("rejected")),
          approvedQuantity: v.number(),
          approvedTotalCents: v.number(),
          decidedAt: v.number(),
          decidedBy: v.string(),
          isJudgeDemo: v.boolean(),
        }),
        v.null(),
      ),
      purchaseOrder: v.union(
        v.object({
          purchaseOrderId: v.id("purchaseOrders"),
          poNumber: v.string(),
          supplierName: v.string(),
          buyerEntity: v.string(),
          shipTo: v.string(),
          billTo: v.string(),
          sku: v.string(),
          productDescription: v.string(),
          quantity: v.number(),
          unitPriceMicrodollars: v.number(),
          extendedPriceCents: v.number(),
          freightCents: v.number(),
          totalCents: v.number(),
          requiredBy: v.string(),
          paymentTerms: v.string(),
          recipientApprovedAt: v.union(v.number(), v.null()),
          quoteRevision: v.number(),
          rfqId: v.id("rfqs"),
          subject: v.string(),
          htmlBody: v.string(),
          errorMessage: v.union(v.string(), v.null()),
          status: v.union(
            v.literal("draft"),
            v.literal("queued"),
            v.literal("sent"),
            v.literal("confirmed"),
            v.literal("exception"),
            v.literal("cancelled"),
          ),
          sentAt: v.union(v.number(), v.null()),
        }),
        v.null(),
      ),
      confirmation: v.union(
        v.object({
          supplierConfirmationNumber: v.union(v.string(), v.null()),
          matchesApprovedTerms: v.boolean(),
          confirmedQuantity: v.union(v.number(), v.null()),
          confirmedArrivalDate: v.union(v.string(), v.null()),
          differences: v.array(
            v.object({ field: v.string(), approved: v.string(), confirmed: v.string() }),
          ),
          extractionConfidence: v.number(),
        }),
        v.null(),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null) return null;
    const item = await ctx.db.get("inventoryItems", procurement.inventoryItemId);
    if (item === null) return null;
    const events = await ctx.db
      .query("procurementEvents")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .order("asc")
      .take(100);
    const threadLinks = await ctx.db
      .query("agentThreadLinks")
      .withIndex("by_procurement_and_anchor", (q) => q.eq("procurementId", procurement._id))
      .take(50);
    const recommendations = await ctx.db
      .query("recommendations")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .order("desc")
      .take(1);
    const recommendation = recommendations[0];
    const selectedQuote =
      recommendation === undefined
        ? null
        : await ctx.db.get("quotes", recommendation.selectedQuoteId);
    const selectedSupplier =
      selectedQuote === null ? null : await ctx.db.get("suppliers", selectedQuote.supplierId);
    const selectedRfq =
      selectedQuote === null ? null : await ctx.db.get("rfqs", selectedQuote.rfqId);
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_procurement", (q) => q.eq("procurementId", procurement._id))
      .take(100);
    const alternatives = [];
    for (const quote of quotes) {
      if (quote._id === selectedQuote?._id) continue;
      const supplier = await ctx.db.get("suppliers", quote.supplierId);
      if (supplier === null) continue;
      alternatives.push({
        supplierName: supplier.name,
        landedCostCents: quote.landedCostCents ?? null,
        estimatedArrivalDate: quote.estimatedArrivalDate ?? null,
        qualification: quote.qualification,
      });
    }
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_procurement", (q) => q.eq("procurementId", procurement._id))
      .order("desc")
      .take(1);
    const approval = approvals[0];
    const approvingUser =
      approval === undefined ? null : await ctx.db.get("users", approval.approvedByUserId);
    const purchaseOrders = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_procurement", (q) => q.eq("procurementId", procurement._id))
      .order("desc")
      .take(1);
    const purchaseOrder = purchaseOrders[0];
    const purchaseOrderSupplier =
      purchaseOrder === undefined ? null : await ctx.db.get("suppliers", purchaseOrder.supplierId);
    const confirmation =
      purchaseOrder === undefined
        ? null
        : await ctx.db
            .query("confirmations")
            .withIndex("by_purchase_order", (q) => q.eq("purchaseOrderId", purchaseOrder._id))
            .order("desc")
            .first();
    const searchRuns = await ctx.db
      .query("searchRuns")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .order("desc")
      .take(1);
    const searchRun = searchRuns[0];
    const searchResults =
      searchRun === undefined
        ? []
        : await ctx.db
            .query("searchResults")
            .withIndex("by_search_run", (q) => q.eq("searchRunId", searchRun._id))
            .take(20);
    const aiRuns = await ctx.db
      .query("aiRuns")
      .withIndex("by_procurement_and_task", (q) => q.eq("procurementId", procurement._id))
      .take(100);
    return {
      procurementId: procurement._id,
      code: procurementCode(procurement.code, procurement._creationTime),
      status: procurement.status,
      itemName: item.name,
      sku: item.sku,
      triggerReason: procurement.triggerReason,
      quantityRequired: procurement.quantityRequired,
      requiredBy: procurement.requiredBy,
      averageDailyUsage: procurement.averageDailyUsage,
      projectedStockoutDate: procurement.projectedStockoutDate,
      calculationVersion: procurement.calculationVersion,
      calculationInputs: procurement.calculationInputs ?? null,
      events: events.map((event) => ({
        eventId: event._id,
        summary: event.summary,
        createdAt: event.createdAt,
        toState: event.toState ?? null,
      })),
      threadLinks: threadLinks.map((link) => ({
        anchorKey: link.anchorKey,
        componentThreadId: link.componentThreadId,
        unreadCount: link.unreadCount,
        status: link.status,
      })),
      providerEvidence: {
        sourcing:
          searchRun === undefined
            ? null
            : {
                provider: "firecrawl" as const,
                status: searchRun.status,
                sourceCount: searchResults.length,
                createdAt: searchRun.createdAt,
                completedAt: searchRun.completedAt ?? null,
              },
        // Only completed runs record the actual transport/model returned by the provider call.
        ai: aiRuns
          .filter((run) => run.status === "succeeded" && run.result !== undefined)
          .sort((first, second) => second.createdAt - first.createdAt)
          .map((run) => ({
            task: run.task,
            transport: run.transport,
            model: run.model,
            status: "succeeded" as const,
            evidenceCount: run.evidenceRefs.length,
            createdAt: run.createdAt,
            completedAt: run.completedAt ?? null,
          })),
      },
      recommendation:
        recommendation === undefined || selectedQuote === null || selectedSupplier === null
          ? null
          : {
              recommendationId: recommendation._id,
              supplierName: selectedSupplier.name,
              explanation: recommendation.explanation,
              quantityAvailable: selectedQuote.quantityAvailable ?? null,
              unitPriceMicrodollars: selectedQuote.unitPriceMicrodollars ?? null,
              freightCents: selectedQuote.freightCents ?? null,
              landedCostCents: selectedQuote.landedCostCents ?? null,
              estimatedArrivalDate: selectedQuote.estimatedArrivalDate ?? null,
              matchConfidence: selectedQuote.matchConfidence,
              matchConfidenceSource:
                selectedRfq?.isControlledRecipient === true
                  ? ("controlled_demo_assumption" as const)
                  : ("unverified" as const),
              alternatives,
            },
      approval:
        approval === undefined
          ? null
          : {
              status: approval.status,
              approvedQuantity: approval.approvedQuantity,
              approvedTotalCents: approval.approvedTotalCents,
              decidedAt: approval.decidedAt,
              decidedBy: approvingUser?.name ?? approvingUser?.email ?? "Authenticated buyer",
              isJudgeDemo: approvingUser?.isAnonymous === true,
            },
      purchaseOrder:
        purchaseOrder === undefined || purchaseOrderSupplier === null
          ? null
          : {
              purchaseOrderId: purchaseOrder._id,
              poNumber: purchaseOrder.poNumber,
              supplierName: purchaseOrderSupplier.name,
              buyerEntity: purchaseOrder.buyerEntity,
              shipTo: purchaseOrder.shipTo,
              billTo: purchaseOrder.billTo,
              sku: purchaseOrder.sku,
              productDescription: purchaseOrder.productDescription,
              quantity: purchaseOrder.quantity,
              unitPriceMicrodollars: purchaseOrder.unitPriceMicrodollars,
              extendedPriceCents: purchaseOrder.extendedPriceCents,
              freightCents: purchaseOrder.freightCents,
              totalCents: purchaseOrder.totalCents,
              requiredBy: purchaseOrder.requiredBy,
              paymentTerms: purchaseOrder.paymentTerms,
              recipientApprovedAt: purchaseOrder.recipientApprovedAt ?? null,
              quoteRevision: purchaseOrder.quoteRevision,
              rfqId: purchaseOrder.rfqId,
              subject: purchaseOrder.subject,
              htmlBody: purchaseOrder.htmlBody,
              errorMessage: purchaseOrder.errorMessage ?? null,
              status: purchaseOrder.status,
              sentAt: purchaseOrder.sentAt ?? null,
            },
      confirmation:
        confirmation === null
          ? null
          : {
              supplierConfirmationNumber: confirmation.supplierConfirmationNumber ?? null,
              matchesApprovedTerms: confirmation.matchesApprovedTerms,
              confirmedQuantity: confirmation.quantity ?? null,
              confirmedArrivalDate: confirmation.estimatedArrivalDate ?? null,
              differences: confirmation.differences,
              extractionConfidence: confirmation.extractionConfidence,
            },
    };
  },
});
