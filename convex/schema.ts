import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  structuredAiResultValidator,
  aiTaskValidator,
  procurementEventTypeValidator,
  integrationNameValidator,
  integrationOperationValidator,
  inventoryStatusValidator,
  matchStatusValidator,
  missingQuoteFieldValidator,
  procurementStateValidator,
  reviewStatusValidator,
  sourceKindValidator,
  supplierClaimFieldValidator,
} from "./domain";

const dateValidator = v.string();
const timestampValidator = v.number();
const roleValidator = v.union(v.literal("admin"), v.literal("buyer"), v.literal("viewer"));
const runStatusValidator = v.union(
  v.literal("ready"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("reset"),
);
const operationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
);

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    address: v.object({
      line1: v.string(),
      line2: v.optional(v.string()),
      city: v.string(),
      region: v.string(),
      postalCode: v.string(),
      countryCode: v.string(),
    }),
    timezone: v.string(),
    approvalPolicy: v.object({
      humanApprovalRequired: v.literal(true),
      maximumAutomaticFollowUps: v.number(),
    }),
    isDemo: v.boolean(),
  }).index("by_name", ["name"]),

  users: defineTable({
    organizationId: v.id("organizations"),
    identityToken: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: roleValidator,
    isActive: v.boolean(),
  })
    .index("by_identity", ["identityToken"])
    .index("by_org", ["organizationId"]),

  demoRuns: defineTable({
    label: v.string(),
    status: runStatusValidator,
    scenarioVersion: v.string(),
    startedAt: timestampValidator,
    completedAt: v.optional(timestampValidator),
    isDemo: v.boolean(),
  })
    .index("by_status_created", ["status", "startedAt"])
    .index("by_started_at", ["startedAt"]),

  inventoryItems: defineTable({
    organizationId: v.id("organizations"),
    demoRunId: v.optional(v.id("demoRuns")),
    sku: v.string(),
    name: v.string(),
    description: v.string(),
    specification: v.object({
      productType: v.string(),
      capacityOunces: v.optional(v.number()),
      diameterInches: v.optional(v.number()),
      material: v.optional(v.string()),
      color: v.optional(v.string()),
      tamperEvident: v.optional(v.boolean()),
      foodContactCompliant: v.optional(v.boolean()),
    }),
    quantityOnHand: v.number(),
    safetyStockDays: v.number(),
    casePack: v.number(),
    preferredCoverageDays: v.number(),
    maximumInventoryDays: v.optional(v.number()),
    status: inventoryStatusValidator,
    isDemo: v.boolean(),
  })
    .index("by_org_sku", ["organizationId", "sku"])
    .index("by_org_status", ["organizationId", "status"])
    .index("by_demo_run", ["demoRunId"]),

  inventoryUsage: defineTable({
    inventoryItemId: v.id("inventoryItems"),
    demoRunId: v.optional(v.id("demoRuns")),
    date: dateValidator,
    quantityConsumed: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_item_date", ["inventoryItemId", "date"])
    .index("by_demo_run", ["demoRunId"]),

  expectedInventory: defineTable({
    inventoryItemId: v.id("inventoryItems"),
    procurementId: v.optional(v.id("procurements")),
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    quantity: v.number(),
    arrivalDate: dateValidator,
    status: v.union(
      v.literal("planned"),
      v.literal("confirmed"),
      v.literal("received"),
      v.literal("cancelled"),
    ),
    isDemo: v.boolean(),
  }).index("by_item_arrival", ["inventoryItemId", "arrivalDate"]),

  suppliers: defineTable({
    organizationId: v.id("organizations"),
    demoRunId: v.optional(v.id("demoRuns")),
    name: v.string(),
    domain: v.string(),
    email: v.optional(v.string()),
    relationship: v.union(
      v.literal("incumbent"),
      v.literal("controlled_demo"),
      v.literal("discovered"),
    ),
    historicalReliability: v.optional(v.number()),
    historicalLeadTimeDays: v.optional(v.number()),
    priorUnitPriceMicrodollars: v.optional(v.number()),
    priorFreightCents: v.optional(v.number()),
    paymentTerms: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    isDemo: v.boolean(),
  })
    .index("by_org_domain", ["organizationId", "domain"])
    .index("by_demo_run", ["demoRunId"]),

  demoSupplierIdentities: defineTable({
    demoRunId: v.id("demoRuns"),
    supplierId: v.id("suppliers"),
    label: v.union(v.literal("incumbent"), v.literal("winning"), v.literal("cheapest")),
    displayName: v.string(),
    email: v.string(),
    responsePlan: v.string(),
    isDemo: v.literal(true),
  }).index("by_demo_run", ["demoRunId"]),

  purchaseHistory: defineTable({
    demoRunId: v.id("demoRuns"),
    organizationId: v.id("organizations"),
    inventoryItemId: v.id("inventoryItems"),
    supplierId: v.id("suppliers"),
    purchasedOn: dateValidator,
    quantity: v.number(),
    unitPriceMicrodollars: v.number(),
    freightCents: v.number(),
    leadTimeDays: v.number(),
    arrivedOnTime: v.boolean(),
    isDemo: v.literal(true),
  })
    .index("by_demo_run", ["demoRunId"])
    .index("by_item_and_purchased_on", ["inventoryItemId", "purchasedOn"]),

  historicalMetrics: defineTable({
    demoRunId: v.id("demoRuns"),
    organizationId: v.id("organizations"),
    annualSpendCents: v.number(),
    savingsIdentifiedCents: v.number(),
    projectedStockouts: v.number(),
    autonomousProcurementPercent: v.number(),
    isDemo: v.literal(true),
  }).index("by_demo_run", ["demoRunId"]),

  supplierProducts: defineTable({
    procurementId: v.id("procurements"),
    supplierId: v.id("suppliers"),
    inventoryItemId: v.id("inventoryItems"),
    externalSku: v.optional(v.string()),
    productUrl: v.string(),
    title: v.string(),
    manufacturer: v.optional(v.string()),
    manufacturerSku: v.optional(v.string()),
    material: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    packSize: v.optional(v.number()),
    matchConfidence: v.number(),
    matchStatus: matchStatusValidator,
    publishedUnitPriceMicrodollars: v.optional(v.number()),
    publishedLeadTimeDays: v.optional(v.number()),
    publishedAvailability: v.optional(v.string()),
    observedAt: timestampValidator,
  })
    .index("by_procurement_and_supplier", ["procurementId", "supplierId"])
    .index("by_supplier", ["supplierId"]),

  supplierProductClaims: defineTable({
    supplierProductId: v.id("supplierProducts"),
    field: supplierClaimFieldValidator,
    value: v.string(),
    sourceKind: sourceKindValidator,
    sourceUrl: v.string(),
    isConfirmed: v.boolean(),
    confidence: v.optional(v.number()),
    observedAt: timestampValidator,
  })
    .index("by_product", ["supplierProductId"])
    .index("by_source_url", ["sourceUrl"]),

  procurements: defineTable({
    organizationId: v.id("organizations"),
    inventoryItemId: v.id("inventoryItems"),
    demoRunId: v.id("demoRuns"),
    status: procurementStateValidator,
    reviewStatus: reviewStatusValidator,
    reviewReason: v.optional(v.string()),
    isActive: v.boolean(),
    triggerReason: v.string(),
    quantityRequired: v.number(),
    requiredBy: dateValidator,
    averageDailyUsage: v.number(),
    projectedStockoutDate: dateValidator,
    calculationVersion: v.string(),
    calculationInputs: v.optional(
      v.object({
        asOfDate: dateValidator,
        quantityOnHand: v.number(),
        trailingUsageDays: v.number(),
        safetyStockDays: v.number(),
        supplierLeadTimeDays: v.number(),
        coverageDays: v.number(),
        casePack: v.number(),
        incomingQuantity: v.number(),
      }),
    ),
    code: v.optional(v.string()),
    createdAt: timestampValidator,
    updatedAt: timestampValidator,
  })
    .index("by_org_status", ["organizationId", "status"])
    .index("by_item_active", ["inventoryItemId", "isActive"])
    .index("by_demo_run", ["demoRunId"])
    .index("by_demo_run_and_item_and_is_active", ["demoRunId", "inventoryItemId", "isActive"]),

  agentThreadLinks: defineTable({
    organizationId: v.id("organizations"),
    buyerUserId: v.optional(v.id("users")),
    procurementId: v.optional(v.id("procurements")),
    anchorKey: v.string(),
    componentThreadId: v.string(),
    unreadCount: v.number(),
    status: v.union(
      v.literal("read"),
      v.literal("unread"),
      v.literal("thinking"),
      v.literal("failed"),
    ),
    createdAt: timestampValidator,
    updatedAt: timestampValidator,
    lastMessageAt: v.optional(timestampValidator),
  })
    .index("by_procurement_and_anchor", ["procurementId", "anchorKey"])
    .index("by_component_thread_id", ["componentThreadId"])
    .index("by_organization_and_updated_at", ["organizationId", "updatedAt"]),

  searchRuns: defineTable({
    procurementId: v.id("procurements"),
    demoRunId: v.id("demoRuns"),
    query: v.string(),
    status: operationStatusValidator,
    providerJobId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: timestampValidator,
    completedAt: v.optional(timestampValidator),
  }).index("by_procurement_and_created", ["procurementId", "createdAt"]),

  searchResults: defineTable({
    searchRunId: v.id("searchRuns"),
    procurementId: v.id("procurements"),
    url: v.string(),
    title: v.string(),
    supplierName: v.optional(v.string()),
    summary: v.optional(v.string()),
    markdownExcerpt: v.optional(v.string()),
    observedAt: timestampValidator,
  }).index("by_search_run", ["searchRunId"]),

  rfqs: defineTable({
    procurementId: v.id("procurements"),
    supplierId: v.id("suppliers"),
    demoRunId: v.id("demoRuns"),
    status: v.union(
      v.literal("draft"),
      v.literal("ready"),
      v.literal("queued"),
      v.literal("sent"),
      v.literal("responded"),
      v.literal("closed"),
      v.literal("failed"),
    ),
    requestedQuantity: v.number(),
    requiredBy: dateValidator,
    destination: v.string(),
    recipientEmail: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    isControlledRecipient: v.optional(v.boolean()),
    preparedAt: v.optional(timestampValidator),
    recipientApprovedAt: v.optional(timestampValidator),
    providerOutboundId: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    providerThreadId: v.optional(v.string()),
    deliveryState: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("failed"),
        v.literal("bounced"),
        v.literal("complained"),
        v.literal("rejected"),
      ),
    ),
    automaticFollowUpCount: v.number(),
    createdAt: timestampValidator,
    sentAt: v.optional(timestampValidator),
  })
    .index("by_procurement", ["procurementId"])
    .index("by_thread", ["providerThreadId"]),

  purchasingInboxes: defineTable({
    organizationId: v.id("organizations"),
    provider: v.literal("agentmail"),
    inboxId: v.string(),
    email: v.string(),
    selectedAt: timestampValidator,
  })
    .index("by_organization_and_provider", ["organizationId", "provider"])
    .index("by_inbox_id", ["inboxId"]),

  emailLinks: defineTable({
    procurementId: v.id("procurements"),
    rfqId: v.optional(v.id("rfqs")),
    supplierId: v.id("suppliers"),
    provider: v.literal("agentmail"),
    providerMessageId: v.string(),
    providerThreadId: v.string(),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    purpose: v.union(
      v.literal("rfq"),
      v.literal("quote"),
      v.literal("follow_up"),
      v.literal("purchase_order"),
      v.literal("confirmation"),
    ),
    createdAt: timestampValidator,
  })
    .index("by_provider_message", ["provider", "providerMessageId"])
    .index("by_procurement", ["procurementId"])
    .index("by_procurement_and_purpose_and_direction", ["procurementId", "purpose", "direction"]),

  inboundEmailEvidence: defineTable({
    emailLinkId: v.id("emailLinks"),
    providerEventId: v.string(),
    subject: v.optional(v.string()),
    extractedText: v.string(),
    observedAt: timestampValidator,
  })
    .index("by_email_link", ["emailLinkId"])
    .index("by_provider_event_id", ["providerEventId"]),

  quotes: defineTable({
    procurementId: v.id("procurements"),
    rfqId: v.id("rfqs"),
    supplierId: v.id("suppliers"),
    revision: v.number(),
    quantityAvailable: v.optional(v.number()),
    unitPriceMicrodollars: v.optional(v.number()),
    extendedPriceCents: v.optional(v.number()),
    freightCents: v.optional(v.number()),
    taxesCents: v.optional(v.number()),
    landedCostCents: v.optional(v.number()),
    earliestShipDate: v.optional(dateValidator),
    estimatedArrivalDate: v.optional(dateValidator),
    minimumOrderQuantity: v.optional(v.number()),
    packSize: v.optional(v.number()),
    paymentTerms: v.optional(v.string()),
    expiresOn: v.optional(dateValidator),
    missingInformation: v.array(missingQuoteFieldValidator),
    matchConfidence: v.number(),
    responseConfidence: v.number(),
    qualification: v.union(
      v.literal("pending"),
      v.literal("viable"),
      v.literal("disqualified"),
      v.literal("human_review"),
    ),
    rawProviderMessageId: v.string(),
    extractionVersion: v.optional(v.string()),
    createdAt: timestampValidator,
  })
    .index("by_procurement", ["procurementId"])
    .index("by_rfq_revision", ["rfqId", "revision"]),

  recommendations: defineTable({
    procurementId: v.id("procurements"),
    selectedQuoteId: v.id("quotes"),
    explanation: v.string(),
    rankingVersion: v.string(),
    createdAt: timestampValidator,
  }).index("by_procurement_and_created", ["procurementId", "createdAt"]),

  approvals: defineTable({
    procurementId: v.id("procurements"),
    recommendationId: v.id("recommendations"),
    approvedQuoteId: v.id("quotes"),
    approvedQuoteRevision: v.number(),
    status: v.union(v.literal("approved"), v.literal("modified"), v.literal("rejected")),
    approvedByUserId: v.id("users"),
    approvedQuantity: v.number(),
    approvedUnitPriceMicrodollars: v.number(),
    approvedFreightCents: v.number(),
    approvedTotalCents: v.number(),
    decisionNote: v.optional(v.string()),
    decidedAt: timestampValidator,
  })
    .index("by_recommendation", ["recommendationId"])
    .index("by_procurement", ["procurementId"]),

  purchaseOrders: defineTable({
    procurementId: v.id("procurements"),
    supplierId: v.id("suppliers"),
    approvalId: v.id("approvals"),
    quoteId: v.id("quotes"),
    poNumber: v.string(),
    quantity: v.number(),
    unitPriceMicrodollars: v.number(),
    extendedPriceCents: v.number(),
    freightCents: v.number(),
    totalCents: v.number(),
    requiredBy: dateValidator,
    status: v.union(
      v.literal("draft"),
      v.literal("queued"),
      v.literal("sent"),
      v.literal("confirmed"),
      v.literal("exception"),
      v.literal("cancelled"),
    ),
    providerMessageId: v.optional(v.string()),
    createdAt: timestampValidator,
    sentAt: v.optional(timestampValidator),
  })
    .index("by_procurement", ["procurementId"])
    .index("by_number", ["poNumber"]),

  procurementEvents: defineTable({
    procurementId: v.id("procurements"),
    demoRunId: v.id("demoRuns"),
    type: procurementEventTypeValidator,
    summary: v.string(),
    actorType: v.union(
      v.literal("system"),
      v.literal("agent"),
      v.literal("user"),
      v.literal("provider"),
    ),
    actorUserId: v.optional(v.id("users")),
    fromState: v.optional(procurementStateValidator),
    toState: v.optional(procurementStateValidator),
    sourceKind: v.optional(sourceKindValidator),
    sourceUrl: v.optional(v.string()),
    relatedRecordId: v.optional(v.string()),
    createdAt: timestampValidator,
  })
    .index("by_procurement_and_created", ["procurementId", "createdAt"])
    .index("by_run_created", ["demoRunId", "createdAt"]),

  integrationReceipts: defineTable({
    procurementId: v.optional(v.id("procurements")),
    provider: integrationNameValidator,
    idempotencyKey: v.string(),
    operation: integrationOperationValidator,
    status: operationStatusValidator,
    providerRecordId: v.optional(v.string()),
    requestHash: v.string(),
    errorMessage: v.optional(v.string()),
    createdAt: timestampValidator,
    completedAt: v.optional(timestampValidator),
  })
    .index("by_provider_key", ["provider", "idempotencyKey"])
    .index("by_procurement_and_operation_and_status", ["procurementId", "operation", "status"]),

  aiRuns: defineTable({
    organizationId: v.optional(v.id("organizations")),
    buyerUserId: v.optional(v.id("users")),
    procurementId: v.optional(v.id("procurements")),
    supplierProductId: v.optional(v.id("supplierProducts")),
    rfqId: v.optional(v.id("rfqs")),
    emailLinkId: v.optional(v.id("emailLinks")),
    agentThreadLinkId: v.optional(v.id("agentThreadLinks")),
    anchorKey: v.optional(v.string()),
    intent: v.optional(v.string()),
    task: aiTaskValidator,
    transport: v.union(v.literal("openai"), v.literal("openrouter")),
    model: v.string(),
    status: operationStatusValidator,
    evidenceRefs: v.array(v.string()),
    outputConfidence: v.optional(v.number()),
    result: v.optional(structuredAiResultValidator),
    errorMessage: v.optional(v.string()),
    createdAt: timestampValidator,
    completedAt: v.optional(timestampValidator),
  })
    .index("by_procurement_and_task", ["procurementId", "task"])
    .index("by_agent_thread_link_and_created_at", ["agentThreadLinkId", "createdAt"])
    .index("by_status", ["status"]),
});
