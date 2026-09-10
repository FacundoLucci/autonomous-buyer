import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { query, type MutationCtx } from "./_generated/server";
import { mutation } from "./audited";
import { internal } from "./_generated/api";
import { ownedCompany } from "./onboarding";
import { productUrl } from "./inventorySources";
import { amount, boundedText, validEmail, cents } from "./companyRules";
import { buyingPriority } from "./deskFields";
import { units, stockOutlook } from "../src/lib/setup-fields";
import schema from "./schema";
import type { Id, Doc } from "./_generated/dataModel";
import { activeCompanyItems, planningChanged } from "./companyStock";

export const updateRules = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    buyingPriority: v.optional(v.union(buyingPriority, v.null())),
    dailyLossCents: v.optional(v.union(v.number(), v.null())),
    lossCurrency: v.optional(v.string()),
    stockoutImpact: v.optional(v.string()),
    safetyStockDays: v.optional(v.number()),
    preferredCoverageDays: v.optional(v.number()),
    preparationDays: v.optional(v.number()),
    orderMultiple: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { itemId, ...values }) => {
    const { organization } = await ownedCompany(ctx);
    const item = await ctx.db.get("inventoryItems", itemId);
    if (!item || item.organizationId !== organization._id || item.archived)
      throw new ConvexError("Item not found.");
    if (values.dailyLossCents !== undefined && values.dailyLossCents !== null)
      cents(values.dailyLossCents);
    if (
      values.lossCurrency !== undefined &&
      !["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "MXN", "ARS"].includes(values.lossCurrency)
    )
      throw new ConvexError("Choose a supported currency.");
    if ((values.stockoutImpact?.length ?? 0) > 500)
      throw new ConvexError("Keep this under 501 characters.");
    for (const field of [
      "safetyStockDays",
      "preferredCoverageDays",
      "preparationDays",
      "orderMultiple",
    ] as const) {
      const value = values[field];
      if (
        value !== undefined &&
        (!Number.isFinite(value) ||
          !Number.isInteger(value) ||
          value < (field === "orderMultiple" || field === "preferredCoverageDays" ? 1 : 0) ||
          value > (field === "orderMultiple" ? 1000000 : 365))
      )
        throw new ConvexError("Choose valid whole days and a positive pack size.");
    }
    const patch = Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, value === null ? undefined : value]),
    );
    await ctx.db.patch("inventoryItems", itemId, patch);
    await planningChanged(ctx, item);
    await ctx.db.insert("deskActivity", {
      organizationId: organization._id,
      itemId,
      summary: `Buying rules updated for ${item.name}.`,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const recordCount = mutation({
  args: { itemId: v.id("inventoryItems"), quantity: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const item = await ctx.db.get("inventoryItems", args.itemId);
    if (!item || item.organizationId !== organization._id || item.archived)
      throw new ConvexError("Item not found.");
    await writeStockCount(ctx, item, args.quantity);
    return null;
  },
});

// Call only after checking company ownership (or the current chat's owner).
export async function writeStockCount(
  ctx: MutationCtx,
  item: Doc<"inventoryItems">,
  count: number,
) {
  amount(count, "stock count");
  const outlook = stockOutlook(
    count,
    item.estimatedDailyUsage ?? null,
    item.supplierLeadTimeDays ?? null,
    item.safetyStockDays,
  );
  await ctx.db.patch("inventoryItems", item._id, {
    quantityOnHand: count,
    estimatedQuantity: count,
    stockCountKnown: true,
    stockCountedAt: Date.now(),
    forecastQuantity: count,
    forecastAt: Date.now(),
    status:
      count === 0 || outlook.needsAction
        ? "action_required"
        : outlook.reorderAt === null
          ? "watch"
          : "healthy",
  });
  await ctx.db.insert("stockEvents", {
    organizationId: item.organizationId,
    itemId: item._id,
    kind: "count",
    quantity: count,
    createdAt: Date.now(),
  });
  await planningChanged(ctx, item);
  const summary = `${item.name}: ${count} ${item.unit ?? "units"} on hand.`;
  await ctx.db.insert("deskActivity", {
    organizationId: item.organizationId,
    itemId: item._id,
    summary,
    createdAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.companyAlerts.evaluateItem, { itemId: item._id });
  return summary;
}

export const listSources = query({
  args: {},
  returns: v.array(schema.doc("inventorySources")),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    return await ctx.db
      .query("inventorySources")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(50);
  },
});

export const sourcePage = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("inventorySources")),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    return await ctx.db
      .query("inventorySources")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const sourceFile = query({
  args: { sourceId: v.id("inventorySources") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const { user, organization } = await ownedCompany(ctx);
    const source = await ctx.db.get("inventorySources", args.sourceId);
    if (!source || (source.organizationId !== organization._id && source.userId !== user._id))
      return null;
    return source.fileId ? await ctx.storage.getUrl(source.fileId) : null;
  },
});

async function capacity(ctx: MutationCtx, organizationId: Id<"organizations">, count: number) {
  const items = await activeCompanyItems(ctx, organizationId);
  if (items.length + count > 100)
    throw new ConvexError(
      "Your workspace supports 100 active items. Archive unused items to make room.",
    );
  return items;
}

export const importProducts = mutation({
  args: { sourceId: v.id("inventorySources"), indices: v.array(v.number()) },
  returns: v.array(v.id("inventoryItems")),
  handler: async (ctx, args) => {
    const { user, organization } = await ownedCompany(ctx);
    const source = await ctx.db.get("inventorySources", args.sourceId);
    if (
      !source ||
      source.userId !== user._id ||
      source.status !== "ready" ||
      (source.organizationId && source.organizationId !== organization._id)
    )
      throw new ConvexError("Source not found.");
    const indices = [...new Set(args.indices)];
    if (
      !indices.length ||
      indices.length > 20 ||
      indices.some((i) => !Number.isInteger(i) || i < 0 || !source.products?.[i])
    )
      throw new ConvexError("Choose up to 20 products from the file.");
    const existing = await capacity(ctx, organization._id, 0);
    const previous = await Promise.all(
      indices.map((i) =>
        ctx.db
          .query("inventoryItems")
          .withIndex("by_sourceId_and_index", (q) =>
            q.eq("sourceId", source._id).eq("sourceProductIndex", i),
          )
          .unique(),
      ),
    );
    const pending = previous.filter((item) => !item || item.archived);
    if (existing.length + pending.length > 100)
      throw new ConvexError(
        "Your workspace supports 100 active items. Archive unused items to make room.",
      );
    const ids: Id<"inventoryItems">[] = [];
    const skus = new Set(existing.map((i) => i.sku));
    for (const i of indices) {
      const prior = previous[indices.indexOf(i)];
      if (prior) {
        if (prior.organizationId !== organization._id) throw new ConvexError("Item not found.");
        if (prior.archived)
          await ctx.db.patch("inventoryItems", prior._id, { archived: undefined });
        ids.push(prior._id);
        continue;
      }
      const p = source.products![i];
      let sku = (p.sku || p.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")).slice(0, 48) || "ITEM";
      const base = sku;
      let suffix = 2;
      while (
        skus.has(sku) ||
        (await ctx.db
          .query("inventoryItems")
          .withIndex("by_org_sku", (q) => q.eq("organizationId", organization._id).eq("sku", sku))
          .first())
      )
        sku = `${base}-${suffix++}`;
      skus.add(sku);
      const itemId = await ctx.db.insert("inventoryItems", {
        organizationId: organization._id,
        sourceId: source._id,
        sourceProductIndex: i,
        name: boundedText(p.name, "an item name"),
        sku,
        description: p.name,
        specification: { productType: p.name },
        quantityOnHand: 0,
        stockCountKnown: false,
        unit: units.includes(p.unit as (typeof units)[number]) ? p.unit! : "units",
        supplierName: p.supplier ?? undefined,
        supplierLeadTimeDays: p.leadTimeDays ?? undefined,
        leadTimeEvidence: p.leadTimeEvidence ?? undefined,
        buyUrl: source.url,
        casePack: p.packSize ?? 1,
        safetyStockDays: 3,
        preferredCoverageDays: 30,
        status: "watch",
        isDemo: false,
      });
      ids.push(itemId);
    }
    await ctx.db.patch("inventorySources", source._id, { organizationId: organization._id });
    return ids;
  },
});

export const addItem = mutation({
  args: {
    name: v.string(),
    sku: v.string(),
    unit: v.string(),
    buyUrl: v.string(),
    supplier: v.string(),
  },
  returns: v.id("inventoryItems"),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const name = boundedText(args.name, "an item name");
    const sku = boundedText(args.sku, "an item code", 64);
    if (!units.includes(args.unit as (typeof units)[number]))
      throw new ConvexError("Choose a stock unit.");
    await capacity(ctx, organization._id, 1);
    if (
      await ctx.db
        .query("inventoryItems")
        .withIndex("by_org_sku", (q) => q.eq("organizationId", organization._id).eq("sku", sku))
        .first()
    )
      throw new ConvexError(
        "That item code is already in use. Restore the item if it was archived.",
      );
    return await ctx.db.insert("inventoryItems", {
      organizationId: organization._id,
      name,
      sku,
      unit: args.unit,
      description: name,
      specification: { productType: name },
      quantityOnHand: 0,
      stockCountKnown: false,
      supplierName: args.supplier.trim() ? boundedText(args.supplier, "a supplier") : undefined,
      buyUrl: args.buyUrl.trim() ? productUrl(args.buyUrl) : undefined,
      casePack: 1,
      safetyStockDays: 3,
      preferredCoverageDays: 30,
      status: "watch",
      isDemo: false,
    });
  },
});

export const updateBuying = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    buyUrl: v.string(),
    supplierEmail: v.string(),
    coverageDays: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const item = await ctx.db.get("inventoryItems", args.itemId);
    if (!item || item.organizationId !== organization._id) throw new ConvexError("Item not found.");
    amount(args.coverageDays, "coverage", 365);
    if (args.coverageDays < 1 || !Number.isInteger(args.coverageDays))
      throw new ConvexError("Choose 1 to 365 days of coverage.");
    await ctx.db.patch("inventoryItems", item._id, {
      buyUrl: args.buyUrl.trim() ? productUrl(args.buyUrl) : undefined,
      supplierEmail: args.supplierEmail.trim() ? validEmail(args.supplierEmail) : undefined,
      preferredCoverageDays: args.coverageDays,
      ...(item.leadResearchState === "complete" && (args.buyUrl.trim() || undefined) !== item.buyUrl
        ? {
            supplierLeadTimeDays: undefined,
            leadTimeEvidence: undefined,
            leadTimeConfirmedAt: undefined,
            leadResearchState: undefined,
            leadResearchKey: undefined,
          }
        : {}),
    });
    await planningChanged(ctx, item);
    return null;
  },
});

export const updateCompany = mutation({
  args: { name: v.string(), shippingAddress: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    if (args.shippingAddress.trim().length < 12)
      throw new ConvexError("Enter your full delivery address.");
    await ctx.db.patch("organizations", organization._id, {
      name: boundedText(args.name, "a company name"),
      shippingAddress: boundedText(args.shippingAddress, "a delivery address", 500),
    });
    if (args.shippingAddress.trim() !== organization.shippingAddress) {
      for (const item of await activeCompanyItems(ctx, organization._id)) {
        if (item.leadResearchState === "complete")
          await ctx.db.patch("inventoryItems", item._id, {
            supplierLeadTimeDays: undefined,
            leadTimeEvidence: undefined,
            leadTimeConfirmedAt: undefined,
            leadResearchState: undefined,
            leadResearchKey: undefined,
          });
        await planningChanged(ctx, item);
      }
    }
    return null;
  },
});

export const archivedItems = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("inventoryItems")),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    return await ctx.db
      .query("inventoryItems")
      .withIndex("by_org_archived", (q) =>
        q.eq("organizationId", organization._id).eq("archived", true),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const archiveItem = mutation({
  args: { itemId: v.id("inventoryItems"), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const item = await ctx.db.get("inventoryItems", args.itemId);
    if (!item || item.organizationId !== organization._id) throw new ConvexError("Item not found.");
    if (!!item.archived === args.archived) return null;
    if (args.archived) {
      const buys = await ctx.db
        .query("companyBuys")
        .withIndex("by_itemId_and_closed", (q) => q.eq("itemId", item._id).eq("closed", false))
        .take(100);
      for (const buy of buys) {
        const order = buy.orderId ? await ctx.db.get("companyOrders", buy.orderId) : null;
        if (!order || order.isOpen)
          throw new ConvexError("Finish or cancel the open buy before archiving this item.");
      }
      const open = await ctx.db
        .query("companyOrders")
        .withIndex("by_inventoryItemId_and_isOpen", (q) =>
          q.eq("inventoryItemId", item._id).eq("isOpen", true),
        )
        .first();
      if (open)
        throw new ConvexError("Receive or cancel the open purchase before archiving this item.");
    } else await capacity(ctx, organization._id, 1);
    await ctx.db.patch("inventoryItems", item._id, { archived: args.archived ? true : undefined });
    if (!args.archived)
      await ctx.scheduler.runAfter(0, internal.companyAlerts.evaluateItem, { itemId: item._id });
    return null;
  },
});

export const setAutomation = mutation({
  args: { itemId: v.id("inventoryItems"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { itemId, enabled }) => {
    const { organization } = await ownedCompany(ctx);
    const item = await ctx.db.get("inventoryItems", itemId);
    if (!item || item.organizationId !== organization._id || item.archived)
      throw new ConvexError("Item not found.");
    if (!!item.replenishmentEnabled === enabled) return null;
    await ctx.db.patch("inventoryItems", itemId, {
      replenishmentEnabled: enabled,
      automationState: enabled ? "watching" : "paused",
      automationNote: enabled
        ? "Checking when you need to buy."
        : "Automatic purchasing is paused.",
    });
    await planningChanged(ctx, item);
    await ctx.db.insert("deskActivity", {
      organizationId: organization._id,
      itemId,
      summary: `${item.name}: automatic replenishment ${enabled ? "enabled" : "paused"}.`,
      createdAt: Date.now(),
    });
    return null;
  },
});
