import { ConvexError, v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { ownedCompany } from "./onboarding";
import { sourceEvent, salesProvider, sourceMode } from "./salesFields";
import schema from "./schema";
import { availableStock, replenishmentPlan } from "../src/lib/inventory-planning";
import { consumptionDelta } from "../src/lib/sales-planning";
import { planningChanged, stockFacts } from "./companyStock";
import type { Id } from "./_generated/dataModel";

const connectionView = schema
  .doc("salesConnections")
  .omit("credentials", "webhookKey", "refreshLease", "refreshLeaseUntil");
export const list = query({
  args: {},
  returns: v.object({
    connections: v.array(connectionView),
    mappings: v.array(schema.doc("salesMappings")),
    decisions: v.array(schema.doc("salesDecisions")),
  }),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    const rows = await ctx.db
      .query("salesConnections")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .take(20);
    const mappings = (
      await Promise.all(
        rows.map((c) =>
          ctx.db
            .query("salesMappings")
            .withIndex("by_connectionId", (q) => q.eq("connectionId", c._id))
            .take(100),
        ),
      )
    ).flat();
    const decisions = await ctx.db
      .query("salesDecisions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(20);
    return {
      connections: rows.map(
        ({
          credentials: _credentials,
          webhookKey: _key,
          refreshLease: _lease,
          refreshLeaseUntil: _until,
          ...c
        }) => c,
      ),
      mappings,
      decisions,
    };
  },
});

export const saveMapping = mutation({
  args: {
    connectionId: v.id("salesConnections"),
    itemId: v.id("inventoryItems"),
    externalId: v.string(),
    externalName: v.string(),
    locationId: v.string(),
    mode: sourceMode,
    unitsPerSale: v.number(),
    unitsPerStockUnit: v.number(),
  },
  returns: v.id("salesMappings"),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const [connection, item] = await Promise.all([
      ctx.db.get("salesConnections", args.connectionId),
      ctx.db.get("inventoryItems", args.itemId),
    ]);
    if (
      !connection ||
      connection.organizationId !== organization._id ||
      connection.status !== "connected" ||
      !item ||
      item.organizationId !== organization._id ||
      item.archived
    )
      throw new ConvexError("Choose an active connection and one of your items.");
    for (const value of [args.externalId, args.externalName, args.locationId])
      if (!value.trim() || value.length > 200)
        throw new ConvexError("Confirm the product and location.");
    for (const value of [args.unitsPerSale, args.unitsPerStockUnit])
      if (!Number.isFinite(value) || value <= 0 || value > 1_000_000)
        throw new ConvexError("Enter a positive supply conversion.");
    if (
      connection.provider === "shopify" &&
      ((args.mode === "sales" && args.locationId !== "all") ||
        (args.mode === "inventory" && args.locationId === "all"))
    )
      throw new ConvexError(
        "Use all paid orders for Shopify sales, or a specific location for inventory.",
      );
    const prior = await ctx.db
      .query("salesMappings")
      .withIndex("by_itemId", (q) => q.eq("itemId", item._id))
      .first();
    if (prior)
      throw new ConvexError(
        "This supply already has a source. Remove its mapping before changing the source.",
      );
    const rows = await ctx.db
      .query("salesMappings")
      .withIndex("by_connectionId", (q) => q.eq("connectionId", connection._id))
      .take(101);
    if (rows.length >= 100) throw new ConvexError("This connection supports 100 supply mappings.");
    const stock = availableStock(stockFacts(item));
    if (stock === null)
      throw new ConvexError("Record a stock count before connecting this supply.");
    const now = Date.now();
    const id = await ctx.db.insert("salesMappings", {
      ...args,
      organizationId: organization._id,
      createdAt: now,
    });
    await ctx.db.patch("inventoryItems", item._id, {
      salesConnectionId: connection._id,
      salesBaselineAt: now,
      salesBaselineQuantity: stock,
      salesConsumed: 0,
      salesObservedThrough: now,
      forecastQuantity: stock,
      forecastAt: now,
    });
    return id;
  },
});
export const removeMapping = mutation({
  args: { mappingId: v.id("salesMappings") },
  returns: v.null(),
  handler: async (ctx, { mappingId }) => {
    const { organization } = await ownedCompany(ctx);
    const mapping = await ctx.db.get("salesMappings", mappingId);
    if (!mapping || mapping.organizationId !== organization._id)
      throw new ConvexError("Mapping not found.");
    const item = await ctx.db.get("inventoryItems", mapping.itemId);
    if (item)
      await ctx.db.patch("inventoryItems", item._id, {
        salesConnectionId: undefined,
        salesBaselineAt: undefined,
        salesBaselineQuantity: undefined,
        salesConsumed: undefined,
        salesObservedThrough: undefined,
      });
    await ctx.db.delete("salesMappings", mappingId);
    return null;
  },
});
export const pause = mutation({
  args: { connectionId: v.id("salesConnections"), paused: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const c = await ctx.db.get("salesConnections", args.connectionId);
    if (!c || c.organizationId !== organization._id) throw new ConvexError("Connection not found.");
    await ctx.db.patch("salesConnections", c._id, {
      status: args.paused ? "paused" : "connected",
      message: args.paused ? "Updates paused. Forecasts use the saved daily usage." : undefined,
    });
    if (!args.paused)
      await ctx.scheduler.runAfter(0, internal.salesProvider.sync, { connectionId: c._id });
    return null;
  },
});

export const owner = internalQuery({
  args: {},
  returns: v.id("organizations"),
  handler: async (ctx) => (await ownedCompany(ctx)).organization._id,
});
export const connection = internalQuery({
  args: { id: v.id("salesConnections") },
  returns: v.union(schema.doc("salesConnections"), v.null()),
  handler: (ctx, { id }) => ctx.db.get("salesConnections", id),
});
export const byAccount = internalQuery({
  args: { provider: salesProvider, accountId: v.string() },
  returns: v.union(schema.doc("salesConnections"), v.null()),
  handler: (ctx, a) =>
    ctx.db
      .query("salesConnections")
      .withIndex("by_provider_and_accountId", (q) =>
        q.eq("provider", a.provider).eq("accountId", a.accountId),
      )
      .unique(),
});
export const byWebhook = internalQuery({
  args: { key: v.string() },
  returns: v.union(schema.doc("salesConnections"), v.null()),
  handler: (ctx, a) =>
    ctx.db
      .query("salesConnections")
      .withIndex("by_webhookKey", (q) => q.eq("webhookKey", a.key))
      .unique(),
});
export const event = internalQuery({
  args: { id: v.id("salesEvents") },
  returns: v.union(schema.doc("salesEvents"), v.null()),
  handler: (ctx, a) => ctx.db.get("salesEvents", a.id),
});
export const mappings = internalQuery({
  args: { connectionId: v.id("salesConnections") },
  returns: v.array(schema.doc("salesMappings")),
  handler: (ctx, a) =>
    ctx.db
      .query("salesMappings")
      .withIndex("by_connectionId", (q) => q.eq("connectionId", a.connectionId))
      .take(100),
});

export const enqueue = internalMutation({
  args: {
    connectionId: v.id("salesConnections"),
    key: v.string(),
    resourceId: v.string(),
    kind: sourceMode,
    locationId: v.optional(v.string()),
    payload: v.optional(sourceEvent),
  },
  returns: v.id("salesEvents"),
  handler: async (ctx, a) => {
    const existing = await ctx.db
      .query("salesEvents")
      .withIndex("by_connectionId_and_key", (q) =>
        q.eq("connectionId", a.connectionId).eq("key", a.key),
      )
      .unique();
    if (existing) return existing._id;
    const c = await ctx.db.get("salesConnections", a.connectionId);
    if (!c) throw new Error("Connection missing.");
    const id = await ctx.db.insert("salesEvents", {
      ...a,
      receivedAt: Date.now(),
      state: c.status === "paused" ? "ignored" : "pending",
      attempts: 0,
    });
    if (c.status !== "paused")
      await ctx.scheduler.runAfter(0, internal.salesProvider.process, { eventId: id });
    return id;
  },
});

export const apply = internalMutation({
  args: { eventId: v.id("salesEvents"), data: sourceEvent },
  returns: v.null(),
  handler: async (ctx, { eventId, data }) => {
    const event = await ctx.db.get("salesEvents", eventId);
    if (!event || event.state === "processed" || event.state === "ignored") return null;
    const c = await ctx.db.get("salesConnections", event.connectionId);
    if (!c || c.status === "paused") return null;
    if (data.resourceId !== event.resourceId || data.kind !== event.kind)
      throw new Error("Source event does not match the queued resource.");
    if (
      data.lines.length > 1000 ||
      !Number.isFinite(data.occurredAt) ||
      !Number.isFinite(data.updatedAt) ||
      data.occurredAt > Date.now() + 60_000 ||
      data.updatedAt > Date.now() + 60_000
    )
      throw new Error("Invalid source event.");
    const mappings = await ctx.db
      .query("salesMappings")
      .withIndex("by_connectionId", (q) => q.eq("connectionId", c._id))
      .take(100);
    let changed = 0;
    for (const mapping of mappings) {
      if (mapping.mode !== data.kind || mapping.locationId !== data.locationId) continue;
      const lines = data.lines.filter((l) => l.key === mapping.externalId);
      if (!lines.length) continue;
      const item = await ctx.db.get("inventoryItems", mapping.itemId);
      if (
        !item ||
        item.archived ||
        item.salesConnectionId !== c._id ||
        item.organizationId !== c.organizationId ||
        item.salesBaselineAt === undefined ||
        item.salesBaselineQuantity === undefined ||
        data.occurredAt < item.salesBaselineAt
      )
        continue;
      const now = Date.now();
      const before = availableStock(stockFacts(item), now);
      if (before === null) continue;
      const quantity = lines.reduce((n, l) => n + l.quantity, 0);
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e9)
        throw new Error("Invalid quantity.");
      let consumed = 0;
      let forecastQuantity: number;
      let forecastAt: number;
      if (data.kind === "inventory") {
        if (data.updatedAt <= (item.salesObservedThrough ?? 0)) continue;
        forecastQuantity = quantity / mapping.unitsPerStockUnit;
        forecastAt = data.updatedAt;
        await ctx.db.patch("inventoryItems", item._id, {
          salesBaselineAt: forecastAt,
          salesBaselineQuantity: forecastQuantity,
          salesConsumed: 0,
          salesObservedThrough: forecastAt,
        });
      } else {
        const previous = await ctx.db
          .query("salesConsumption")
          .withIndex("by_mappingId_and_resourceId_and_baselineAt", (q) =>
            q
              .eq("mappingId", mapping._id)
              .eq("resourceId", data.resourceId)
              .eq("baselineAt", item.salesBaselineAt!),
          )
          .unique();
        if (previous && previous.updatedAt >= data.updatedAt) continue;
        const delta = consumptionDelta(
          quantity,
          previous?.quantity ?? 0,
          mapping.unitsPerSale,
          mapping.unitsPerStockUnit,
        );
        const row = {
          connectionId: c._id,
          resourceId: data.resourceId,
          mappingId: mapping._id,
          baselineAt: item.salesBaselineAt,
          quantity: delta.total,
          updatedAt: data.updatedAt,
        };
        if (previous) await ctx.db.patch("salesConsumption", previous._id, row);
        else await ctx.db.insert("salesConsumption", row);
        if (!delta.delta) continue;
        consumed = delta.delta;
        const total = (item.salesConsumed ?? 0) + consumed;
        forecastAt = Math.max(item.salesObservedThrough ?? item.salesBaselineAt, data.occurredAt);
        forecastQuantity = Math.max(0, item.salesBaselineQuantity - total);
        await ctx.db.patch("inventoryItems", item._id, {
          salesConsumed: total,
          salesObservedThrough: forecastAt,
        });
      }
      const updated = {
        ...item,
        forecastQuantity,
        forecastAt,
        estimatedQuantity: forecastQuantity,
      };
      await ctx.db.patch("inventoryItems", item._id, {
        forecastQuantity,
        forecastAt,
        estimatedQuantity: forecastQuantity,
      });
      await planningChanged(ctx, updated);
      const orders = await ctx.db
        .query("companyOrders")
        .withIndex("by_inventoryItemId_and_isOpen", (q) =>
          q.eq("inventoryItemId", item._id).eq("isOpen", true),
        )
        .take(101);
      const plan = replenishmentPlan(
        {
          ...stockFacts(updated),
          preferredCoverageDays: item.preferredCoverageDays,
          preparationDays: item.preparationDays,
          orderMultiple: item.orderMultiple,
        },
        orders
          .filter((o) => o.status === "placed" || o.status === "part_received")
          .map((o) => ({
            quantity: Math.max(0, o.quantity - o.receivedQuantity),
            expectedOn: o.expectedOn ?? null,
          })),
        now,
      );
      const after = availableStock(stockFacts(updated), now)!;
      const summary =
        data.kind === "sales"
          ? mapping.externalName + " sales updated the outlook for " + item.name + "."
          : c.name + " reported a new stock count for " + item.name + ".";
      await ctx.db.insert("salesDecisions", {
        organizationId: c.organizationId,
        connectionId: c._id,
        eventId,
        itemId: item._id,
        source: c.provider + ": " + data.resourceId,
        sourceAt: data.occurredAt,
        createdAt: now,
        beforeQuantity: before,
        afterQuantity: after,
        consumed,
        unit: item.unit ?? "units",
        summary,
        planState: plan.state,
        orderQuantity: plan.quantity,
        requiredBy: plan.requiredBy,
        nextCheckAt: "nextAt" in plan ? plan.nextAt : undefined,
      });
      await ctx.db.insert("deskActivity", {
        organizationId: c.organizationId,
        itemId: item._id,
        summary,
        createdAt: now,
      });
      changed++;
    }
    await ctx.db.patch("salesEvents", eventId, {
      state: changed ? "processed" : "ignored",
      payload: undefined,
      message: changed
        ? "Forecast updated; buyer recheck scheduled."
        : "No new mapped consumption or stock count.",
    });
    await ctx.db.patch("salesConnections", c._id, { lastEventAt: Date.now() });
    return null;
  },
});

export const failed = internalMutation({
  args: { eventId: v.id("salesEvents"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const event = await ctx.db.get("salesEvents", a.eventId);
    if (!event || event.state === "processed" || event.state === "ignored") return null;
    const attempts = event.attempts + 1;
    await ctx.db.patch("salesEvents", event._id, {
      state: attempts < 5 ? "pending" : "failed",
      attempts,
      message: a.message.slice(0, 200),
    });
    if (attempts < 5)
      await ctx.scheduler.runAfter(
        Math.min(3_600_000, 30_000 * 2 ** attempts),
        internal.salesProvider.process,
        { eventId: event._id },
      );
    else
      await connectionState(
        ctx,
        event.connectionId,
        "needs_attention",
        "Some updates could not be read. Reconnect or retry the sync.",
      );
    return null;
  },
});
async function connectionState(
  ctx: MutationCtx,
  id: Id<"salesConnections">,
  status: "connected" | "paused" | "needs_attention",
  message?: string,
) {
  const connection = await ctx.db.get("salesConnections", id);
  if (!connection || (connection.status === "paused" && status !== "paused")) return;
  await ctx.db.patch("salesConnections", id, { status, message });
}
export const setState = internalMutation({
  args: {
    id: v.id("salesConnections"),
    status: v.union(v.literal("connected"), v.literal("paused"), v.literal("needs_attention")),
    message: v.optional(v.string()),
    synced: v.optional(v.boolean()),
    credentials: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const connection = await ctx.db.get("salesConnections", a.id);
    if (!connection || (connection.status === "paused" && a.status !== "paused")) return null;
    await connectionState(ctx, a.id, a.status, a.message);
    if (a.synced) await ctx.db.patch("salesConnections", a.id, { lastSyncAt: Date.now() });
    if (a.credentials) await ctx.db.patch("salesConnections", a.id, { credentials: a.credentials });
    return null;
  },
});

export const claimRefresh = internalMutation({
  args: { id: v.id("salesConnections"), credentials: v.string(), lease: v.string() },
  returns: v.boolean(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get("salesConnections", a.id);
    if (
      !c ||
      c.status === "paused" ||
      c.credentials !== a.credentials ||
      (c.refreshLeaseUntil ?? 0) > Date.now()
    )
      return false;
    await ctx.db.patch("salesConnections", a.id, {
      refreshLease: a.lease,
      refreshLeaseUntil: Date.now() + 60_000,
    });
    return true;
  },
});
export const finishRefresh = internalMutation({
  args: { id: v.id("salesConnections"), lease: v.string(), credentials: v.optional(v.string()) },
  returns: v.boolean(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get("salesConnections", a.id);
    if (!c || c.refreshLease !== a.lease) return false;
    await ctx.db.patch("salesConnections", a.id, {
      refreshLease: undefined,
      refreshLeaseUntil: undefined,
      ...(a.credentials ? { credentials: a.credentials } : {}),
    });
    return true;
  },
});
