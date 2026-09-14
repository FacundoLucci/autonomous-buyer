import { v } from "convex/values";
import { defineTable } from "convex/server";

export const salesProvider = v.union(v.literal("square"), v.literal("shopify"));
export const sourceMode = v.union(v.literal("sales"), v.literal("inventory"));
export const sourceLine = v.object({ key: v.string(), name: v.string(), quantity: v.number() });
export const sourceEvent = v.object({
  key: v.string(),
  resourceId: v.string(),
  locationId: v.string(),
  occurredAt: v.number(),
  updatedAt: v.number(),
  kind: sourceMode,
  lines: v.array(sourceLine),
  adjustment: v.optional(v.boolean()),
});
export const salesTables = {
  salesConnections: defineTable({
    organizationId: v.id("organizations"),
    provider: salesProvider,
    accountId: v.string(),
    name: v.string(),
    sandbox: v.boolean(),
    status: v.union(v.literal("connected"), v.literal("paused"), v.literal("needs_attention")),
    credentials: v.string(),
    webhookKey: v.string(),
    createdAt: v.number(),
    lastEventAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    message: v.optional(v.string()),
    refreshLease: v.optional(v.string()),
    refreshLeaseUntil: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_provider_and_accountId", ["provider", "accountId"])
    .index("by_webhookKey", ["webhookKey"]),
  salesAuthStates: defineTable({
    state: v.string(),
    provider: salesProvider,
    shop: v.optional(v.string()),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_state", ["state"])
    .index("by_expiresAt", ["expiresAt"]),
  salesMappings: defineTable({
    organizationId: v.id("organizations"),
    connectionId: v.id("salesConnections"),
    itemId: v.id("inventoryItems"),
    externalId: v.string(),
    externalName: v.string(),
    locationId: v.string(),
    mode: sourceMode,
    unitsPerSale: v.number(),
    unitsPerStockUnit: v.number(),
    createdAt: v.number(),
  })
    .index("by_connectionId", ["connectionId"])
    .index("by_itemId", ["itemId"]),
  salesEvents: defineTable({
    connectionId: v.id("salesConnections"),
    key: v.string(),
    resourceId: v.string(),
    kind: sourceMode,
    locationId: v.optional(v.string()),
    receivedAt: v.number(),
    payload: v.optional(sourceEvent),
    state: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    message: v.optional(v.string()),
  })
    .index("by_connectionId_and_key", ["connectionId", "key"])
    .index("by_connectionId", ["connectionId"]),
  salesConsumption: defineTable({
    connectionId: v.id("salesConnections"),
    resourceId: v.string(),
    mappingId: v.id("salesMappings"),
    baselineAt: v.number(),
    quantity: v.number(),
    updatedAt: v.number(),
  }).index("by_mappingId_and_resourceId_and_baselineAt", ["mappingId", "resourceId", "baselineAt"]),
  salesDecisions: defineTable({
    organizationId: v.id("organizations"),
    itemId: v.id("inventoryItems"),
    connectionId: v.id("salesConnections"),
    eventId: v.id("salesEvents"),
    source: v.string(),
    sourceAt: v.number(),
    createdAt: v.number(),
    beforeQuantity: v.number(),
    afterQuantity: v.number(),
    consumed: v.number(),
    unit: v.string(),
    summary: v.string(),
    planState: v.string(),
    orderQuantity: v.number(),
    requiredBy: v.union(v.string(), v.null()),
    nextCheckAt: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_itemId", ["itemId"]),
};
