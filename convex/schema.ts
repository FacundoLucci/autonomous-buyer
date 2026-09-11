import { attribution, stage, event, deliveryStatus } from "./marketingFields";
import { questionCode } from "./deskFields";
import { chatTask, deskDraft } from "./deskFields";
import { buyerFocus, buyerCredit } from "./buyerFields";
import { authTables } from "@convex-dev/auth/server";
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

import { sourceProduct, sourceState } from "./inventorySourceFields";
import { companyOrderStatus, alertStatus, alertKind } from "./companyFields";

import { supplierChannels, supplierEvidence } from "./supplierDirectoryFields";

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
  marketingLeads: defineTable({
    email: v.string(),
    businessName: v.string(),
    challenge: v.string(),
    source: attribution,
    stage,
    replyDueAt: v.number(),
    confirmation: deliveryStatus,
    notification: deliveryStatus,
    confirmedBookingAt: v.optional(v.number()),
    pilotStartedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),
  marketingEvents: defineTable({ visitorId: v.string(), event, source: attribution }).index(
    "by_visitorId_and_event",
    ["visitorId", "event"],
  ),
  marketingBookings: defineTable({
    uid: v.string(),
    leadId: v.id("marketingLeads"),
    status: v.string(),
    startTime: v.string(),
    updatedAt: v.number(),
  })
    .index("by_uid", ["uid"])
    .index("by_leadId", ["leadId"]),

  organizations: defineTable({
    name: v.string(),
    address: v.optional(
      v.object({
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        region: v.string(),
        postalCode: v.string(),
        countryCode: v.string(),
      }),
    ),
    shippingAddress: v.optional(v.string()),
    mailPodId: v.optional(v.string()),
    timezone: v.string(),
    approvalPolicy: v.object({
      humanApprovalRequired: v.literal(true),
      maximumAutomaticFollowUps: v.number(),
    }),
    isDemo: v.boolean(),
  })
    .index("by_name", ["name"])
    .index("by_is_demo_and_name", ["isDemo", "name"]),

  users: defineTable({
    organizationId: v.optional(v.id("organizations")),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(roleValidator),
    isActive: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_org", ["organizationId"]),

  authSessions: authTables.authSessions,
  authAccounts: authTables.authAccounts,
  authRefreshTokens: authTables.authRefreshTokens,
  authVerificationCodes: authTables.authVerificationCodes,
  authVerifiers: authTables.authVerifiers,
  authRateLimits: authTables.authRateLimits,

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

  inventorySources: defineTable({
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    kind: v.union(v.literal("link"), v.literal("invoice")),
    url: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    filename: v.optional(v.string()),
    status: sourceState,
    products: v.optional(v.array(sourceProduct)),
    message: v.optional(v.string()),
    threadId: v.optional(v.string()),
    inventoryItemId: v.optional(v.id("inventoryItems")),
  })
    .index("by_userId", ["userId"])
    .index("by_organizationId", ["organizationId"]),

  inventoryItems: defineTable({
    supplierSku: v.optional(v.string()),
    leadResearchKey: v.optional(v.string()),
    leadResearchState: v.optional(
      v.union(v.literal("researching"), v.literal("complete"), v.literal("needs_details")),
    ),
    leadResearchThreadId: v.optional(v.string()),
    leadResearchStartedAt: v.optional(v.number()),
    buyUrl: v.optional(v.string()),
    supplierEmail: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    stockCountedAt: v.optional(v.number()),
    forecastQuantity: v.optional(v.number()),
    forecastAt: v.optional(v.number()),
    replenishmentEnabled: v.optional(v.boolean()),
    preparationDays: v.optional(v.number()),
    orderMultiple: v.optional(v.number()),
    replenishmentScheduledId: v.optional(v.id("_scheduled_functions")),
    automationState: v.optional(v.string()),
    automationNote: v.optional(v.string()),
    planningRevision: v.optional(v.number()),
    estimatedQuantity: v.optional(v.number()),
    sourceId: v.optional(v.id("inventorySources")),
    sourceProductIndex: v.optional(v.number()),
    supplierName: v.optional(v.string()),
    leadTimeEvidence: v.optional(v.string()),
    leadTimeConfirmedBy: v.optional(v.id("users")),
    leadTimeConfirmedAt: v.optional(v.number()),
    stockCountKnown: v.optional(v.boolean()),
    buyingPriority: v.optional(
      v.union(v.literal("cost"), v.literal("availability"), v.literal("flexible")),
    ),
    dailyLossCents: v.optional(v.number()),
    lossCurrency: v.optional(v.string()),
    stockoutImpact: v.optional(v.string()),

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
    unit: v.optional(v.string()),
    estimatedDailyUsage: v.optional(v.number()),
    supplierLeadTimeDays: v.optional(v.number()),
    safetyStockDays: v.number(),
    casePack: v.number(),
    preferredCoverageDays: v.number(),
    maximumInventoryDays: v.optional(v.number()),
    status: inventoryStatusValidator,
    isDemo: v.boolean(),
  })
    .index("by_org_sku", ["organizationId", "sku"])
    .index("by_org_archived", ["organizationId", "archived"])
    .index("by_sourceId_and_index", ["sourceId", "sourceProductIndex"])
    .index("by_org_status", ["organizationId", "status"])
    .index("by_demo_run", ["demoRunId"]),

  stockEvents: defineTable({
    organizationId: v.id("organizations"),
    itemId: v.id("inventoryItems"),
    kind: v.union(v.literal("count"), v.literal("receipt"), v.literal("usage_change")),
    quantity: v.number(),
    orderId: v.optional(v.id("companyOrders")),
    createdAt: v.number(),
  }).index("by_itemId", ["itemId"]),

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
  })
    .index("by_item_arrival", ["inventoryItemId", "arrivalDate"])
    .index("by_purchase_order", ["purchaseOrderId"]),

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
    podId: v.optional(v.string()),
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

  rfqFollowUps: defineTable({
    procurementId: v.id("procurements"),
    rfqId: v.id("rfqs"),
    sourceQuoteId: v.id("quotes"),
    sourceProviderMessageId: v.string(),
    attempt: v.number(),
    requestedFields: v.array(missingQuoteFieldValidator),
    subject: v.string(),
    body: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("human_review"),
    ),
    providerOutboundId: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    providerThreadId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: timestampValidator,
    sentAt: v.optional(timestampValidator),
  })
    .index("by_rfq_and_attempt", ["rfqId", "attempt"])
    .index("by_procurement_and_created_at", ["procurementId", "createdAt"]),

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
    sourceRevisionKey: v.optional(v.string()),
    explanationStatus: v.optional(
      v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed")),
    ),
    createdAt: timestampValidator,
  }).index("by_procurement_and_created", ["procurementId", "createdAt"]),

  recommendationEntries: defineTable({
    recommendationId: v.id("recommendations"),
    procurementId: v.id("procurements"),
    quoteId: v.id("quotes"),
    supplierId: v.id("suppliers"),
    rank: v.optional(v.number()),
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
    landedCostCents: v.optional(v.number()),
    excessInventory: v.number(),
    supplierReliability: v.number(),
    paymentTermsScore: v.number(),
    estimatedArrivalDate: v.optional(dateValidator),
    sourceKind: v.literal("supplier_confirmed"),
    createdAt: timestampValidator,
  })
    .index("by_recommendation", ["recommendationId"])
    .index("by_procurement_and_created_at", ["procurementId", "createdAt"]),

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
    quoteRevision: v.number(),
    rfqId: v.id("rfqs"),
    poNumber: v.string(),
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
    requiredBy: dateValidator,
    paymentTerms: v.string(),
    recipientEmail: v.string(),
    recipientApprovedAt: v.optional(timestampValidator),
    recipientApprovedByUserId: v.optional(v.id("users")),
    subject: v.string(),
    textBody: v.string(),
    htmlBody: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("queued"),
      v.literal("sent"),
      v.literal("confirmed"),
      v.literal("exception"),
      v.literal("cancelled"),
    ),
    providerMessageId: v.optional(v.string()),
    providerOutboundId: v.optional(v.string()),
    providerThreadId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: timestampValidator,
    sentAt: v.optional(timestampValidator),
  })
    .index("by_procurement", ["procurementId"])
    .index("by_approval", ["approvalId"])
    .index("by_thread", ["providerThreadId"])
    .index("by_number", ["poNumber"]),

  confirmations: defineTable({
    procurementId: v.id("procurements"),
    purchaseOrderId: v.id("purchaseOrders"),
    emailLinkId: v.id("emailLinks"),
    supplierConfirmationNumber: v.optional(v.string()),
    supplierConfirmed: v.boolean(),
    sku: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unitPriceMicrodollars: v.optional(v.number()),
    freightCents: v.optional(v.number()),
    totalCents: v.optional(v.number()),
    estimatedArrivalDate: v.optional(dateValidator),
    paymentTerms: v.optional(v.string()),
    matchesApprovedTerms: v.boolean(),
    differences: v.array(
      v.object({
        field: v.string(),
        approved: v.string(),
        confirmed: v.string(),
      }),
    ),
    extractionConfidence: v.number(),
    createdAt: timestampValidator,
  })
    .index("by_procurement", ["procurementId"])
    .index("by_purchase_order", ["purchaseOrderId"])
    .index("by_email_link", ["emailLinkId"]),

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

  buyerSessions: defineTable({
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    threadId: v.string(),
    activeChatId: v.optional(v.id("taskChats")),
    focus: v.optional(buyerFocus),
    busy: v.boolean(),
    currentMessageId: v.optional(v.string()),
    latestText: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_userId_and_organizationId", ["userId", "organizationId"]),
  taskChats: defineTable({
    buyerSessionId: v.optional(v.id("buyerSessions")),
    credits: v.optional(v.array(buyerCredit)),
    reviewedDraftKey: v.optional(v.string()),
    researchUrls: v.optional(v.array(v.string())),
    revisionMode: v.optional(v.union(v.literal("catalog"), v.literal("supplier_quote"))),
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    task: chatTask,
    contextId: v.optional(v.string()),
    threadId: v.string(),
    draft: deskDraft,
    busy: v.boolean(),
    toolUsed: v.optional(v.boolean()),
    question: v.optional(questionCode),
    error: v.optional(v.string()),
    savedAt: v.optional(v.number()),
    resultId: v.optional(v.string()),
    currentMessageId: v.optional(v.string()),
    lastUserText: v.optional(v.string()),
    stockUpdatedMessageId: v.optional(v.string()),
    resultSummary: v.optional(v.string()),
    comparisonState: v.optional(v.string()),
    comparison: v.optional(
      v.object({
        priority: v.union(v.literal("cost"), v.literal("availability"), v.literal("flexible")),
        selected: v.number(),
        options: v.array(
          v.object({
            index: v.number(),
            supplier: v.string(),
            url: v.string(),
            quantity: v.number(),
            unit: v.string(),
            currency: v.string(),
            unitPriceCents: v.number(),
            freightCents: v.number(),
            taxCents: v.number(),
            expectedOn: v.string(),
            totalCents: v.number(),
            shortageDays: v.union(v.number(), v.null()),
            lossCents: v.union(v.number(), v.null()),
            effectiveCents: v.number(),
          }),
        ),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_userId_and_task_and_contextId", ["userId", "task", "contextId"]),
  companySuppliers: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    url: v.string(),
    domain: v.string(),
    approved: v.boolean(),
    channels: supplierChannels,
    assessmentState: v.union(
      v.literal("pending"),
      v.literal("analyzing"),
      v.literal("complete"),
      v.literal("needs_help"),
    ),
    readiness: v.union(v.literal("unverified"), v.literal("needs_setup"), v.literal("ready")),
    notes: v.string(),
    assessmentNotes: v.optional(v.string()),
    email: v.optional(v.string()),
    checkedAt: v.optional(v.number()),
    evidence: v.optional(v.array(supplierEvidence)),
    assessmentVersion: v.number(),
    threadId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_domain", ["organizationId", "domain"]),
  companyQuoteRequests: defineTable({
    buyId: v.id("companyBuys"),
    organizationId: v.id("organizations"),
    itemId: v.id("inventoryItems"),
    planVersion: v.number(),
    supplier: v.string(),
    email: v.string(),
    url: v.string(),
    providerOutboundId: v.optional(v.string()),
    providerThreadId: v.optional(v.string()),
    followups: v.number(),
    state: v.union(
      v.literal("sending"),
      v.literal("waiting"),
      v.literal("replied"),
      v.literal("failed"),
    ),
    reply: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_buyId", ["buyId"])
    .index("by_buyId_and_planVersion", ["buyId", "planVersion"])
    .index("by_providerThreadId", ["providerThreadId"]),
  companyBuys: defineTable({
    automatic: v.optional(v.boolean()),
    planVersion: v.optional(v.number()),
    planningKey: v.optional(v.string()),
    purchasingState: v.optional(
      v.union(
        v.literal("researching"),
        v.literal("waiting_supplier"),
        v.literal("needs_details"),
        v.literal("ready"),
        v.literal("failed"),
      ),
    ),
    purchasingNote: v.optional(v.string()),
    researchThreadId: v.optional(v.string()),
    researchAttempt: v.optional(v.number()),
    researchPlanVersion: v.optional(v.number()),
    workflowId: v.optional(v.string()),
    organizationId: v.id("organizations"),
    itemId: v.id("inventoryItems"),
    quantity: v.optional(v.number()),
    requiredBy: v.optional(v.string()),
    notes: v.string(),
    orderId: v.optional(v.id("companyOrders")),
    closed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_itemId_and_closed", ["itemId", "closed"]),
  auditEntries: defineTable({
    organizationId: v.id("organizations"),
    entityId: v.string(),
    entityType: v.string(),
    name: v.string(),
    action: v.union(v.literal("created"), v.literal("updated"), v.literal("deleted")),
    actorId: v.optional(v.id("users")),
    actor: v.string(),
    via: v.union(v.literal("manual"), v.literal("chat"), v.literal("system")),
    changes: v.array(
      v.object({
        field: v.string(),
        before: v.union(v.string(), v.null()),
        after: v.union(v.string(), v.null()),
      }),
    ),
    createdAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),
  deskActivity: defineTable({
    organizationId: v.id("organizations"),
    summary: v.string(),
    itemId: v.optional(v.id("inventoryItems")),
    buyId: v.optional(v.id("companyBuys")),
    orderId: v.optional(v.id("companyOrders")),
    credit: v.optional(buyerCredit),
    createdAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),
  merchantOrderCounts: defineTable({
    key: v.string(),
    domain: v.string(),
    name: v.string(),
    orders: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_orders", ["orders"]),
  merchantOrderTotals: defineTable({
    key: v.literal("all"),
    totalOrders: v.number(),
    merchantCount: v.number(),
  }).index("by_key", ["key"]),
  companyOrders: defineTable({
    merchantMetricKey: v.optional(v.string()),
    purchaseOrderSentAt: v.optional(v.number()),
    sourceUrl: v.optional(v.string()),
    termsEvidence: v.optional(v.string()),
    supplierSku: v.optional(v.string()),
    cancellationRequestedAt: v.optional(v.number()),
    cancellationOutboundId: v.optional(v.string()),
    browserPreparedKey: v.optional(v.string()),
    browserCommitAuthorizedAt: v.optional(v.number()),
    browserJobId: v.optional(v.string()),
    browserJobIntent: v.optional(v.string()),
    browserPhase: v.optional(v.union(v.literal("prepare"), v.literal("submit"))),
    browserPollCount: v.optional(v.number()),
    orderingMethod: v.optional(v.union(v.literal("purchase_order"), v.literal("website"))),
    supplierPoVerified: v.optional(v.boolean()),
    approvedTermsKey: v.optional(v.string()),
    executionState: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("submitting"),
        v.literal("awaiting_confirmation"),
        v.literal("outcome_unknown"),
        v.literal("needs_attention"),
        v.literal("confirmed"),
      ),
    ),
    reviewRequired: v.optional(v.boolean()),
    requestedQuantity: v.optional(v.number()),
    quotedArrival: v.optional(v.string()),
    organizationId: v.id("organizations"),
    inventoryItemId: v.id("inventoryItems"),
    createdBy: v.id("users"),
    number: v.string(),
    itemName: v.string(),
    sku: v.string(),
    unit: v.string(),
    quantity: v.number(),
    receivedQuantity: v.number(),
    unitPriceCents: v.number(),
    freightCents: v.number(),
    taxCents: v.number(),
    totalCents: v.number(),
    currency: v.string(),
    supplier: v.string(),
    supplierEmail: v.optional(v.string()),
    buyUrl: v.optional(v.string()),
    shipTo: v.string(),
    requiredBy: v.string(),
    notes: v.string(),
    status: companyOrderStatus,
    isOpen: v.boolean(),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    placedAt: v.optional(v.number()),
    confirmation: v.optional(v.string()),
    expectedOn: v.optional(v.string()),
    providerOutboundId: v.optional(v.string()),
    providerThreadId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizationId_and_isOpen", ["organizationId", "isOpen"])
    .index("by_inventoryItemId_and_isOpen", ["inventoryItemId", "isOpen"])
    .index("by_providerThreadId", ["providerThreadId"]),

  companyOrderEvents: defineTable({
    orderId: v.id("companyOrders"),
    kind: v.string(),
    summary: v.string(),
    userId: v.optional(v.id("users")),
    requestKey: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_orderId", ["orderId"])
    .index("by_orderId_and_requestKey", ["orderId", "requestKey"]),

  companyAlertSettings: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    email: v.string(),
    verifiedAt: v.optional(v.number()),
    lowStock: v.boolean(),
    orderUpdates: v.boolean(),
    challengeHash: v.optional(v.string()),
    challengeExpiresAt: v.optional(v.number()),
    challengeAttempts: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),

  companyAlerts: defineTable({
    organizationId: v.id("organizations"),
    settingsId: v.id("companyAlertSettings"),
    email: v.string(),
    kind: alertKind,
    key: v.string(),
    subject: v.string(),
    text: v.string(),
    status: alertStatus,
    attempt: v.number(),
    error: v.optional(v.string()),
    providerId: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_key", ["organizationId", "key"]),
});
