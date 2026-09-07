import { getAuthUserId } from "./identity";
import { ConvexError, v } from "convex/values";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { mutation } from "./audited";
import { setupFieldError, stockOutlook, type CompanySetup } from "../src/lib/setup-fields";
import { internal } from "./_generated/api";
import { activeCompanyItems } from "./companyStock";

const unit = v.union(
  v.literal("units"),
  v.literal("cases"),
  v.literal("kg"),
  v.literal("liters"),
  v.literal("rolls"),
);
export const setupArgs = {
  companyName: v.string(),
  shippingAddress: v.string(),
  itemName: v.string(),
  sku: v.string(),
  unit,
  quantity: v.string(),
  dailyUsage: v.string(),
  leadTimeDays: v.string(),
  safetyStockDays: v.string(),
  timezone: v.string(),
};

export async function account(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get("users", userId) : null;
  if (!user || user.isAnonymous || user.isActive !== true) {
    throw new ConvexError("Sign in with your own account to set up your company.");
  }
  return user;
}

export async function ownedCompany(ctx: QueryCtx | MutationCtx) {
  const user = await account(ctx);
  const organization = user.organizationId
    ? await ctx.db.get("organizations", user.organizationId)
    : null;
  if (!organization || organization.isDemo || (user.role !== "admin" && user.role !== "buyer")) {
    throw new ConvexError("Set up your company first.");
  }
  return { user, organization };
}

// The company and first item commit together. Repeated submissions cannot create duplicates.
export const complete = mutation({
  args: setupArgs,
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const user = await account(ctx);
    if (user.organizationId) {
      const existing = await ctx.db.get("organizations", user.organizationId);
      if (!existing || existing.isDemo)
        throw new ConvexError("Use a separate account for your own company.");
      return existing._id;
    }
    for (const key of Object.keys(args) as (keyof typeof args)[]) {
      if (key === "timezone") continue;
      const error = setupFieldError(key as keyof CompanySetup, args[key]);
      if (error) throw new ConvexError(error);
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: args.timezone });
    } catch {
      throw new ConvexError("Choose a valid timezone.");
    }
    const organizationId = await ctx.db.insert("organizations", {
      name: args.companyName.trim(),
      shippingAddress: args.shippingAddress.trim(),
      timezone: args.timezone,
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 1 },
      isDemo: false,
    });
    const quantity = Number(args.quantity);
    const dailyUsage = Number(args.dailyUsage);
    const leadTimeDays = Number(args.leadTimeDays);
    const safetyStockDays = Number(args.safetyStockDays);
    const outlook = stockOutlook(quantity, dailyUsage, leadTimeDays, safetyStockDays);
    await ctx.db.insert("inventoryItems", {
      organizationId,
      name: args.itemName.trim(),
      sku: args.sku.trim(),
      description: args.itemName.trim(),
      specification: { productType: args.itemName.trim() },
      quantityOnHand: quantity,
      stockCountedAt: Date.now(),
      unit: args.unit,
      estimatedDailyUsage: dailyUsage,
      supplierLeadTimeDays: leadTimeDays,
      safetyStockDays,
      casePack: 1,
      preferredCoverageDays: Math.max(30, leadTimeDays + safetyStockDays),
      status: outlook.needsAction ? "action_required" : "healthy",
      isDemo: false,
    });
    await ctx.db.patch("users", user._id, { organizationId, role: "admin" });
    return organizationId;
  },
});

const workspaceValidator = v.object({
  organizationId: v.id("organizations"),
  companyName: v.string(),
  shippingAddress: v.string(),
  inbox: v.union(v.object({ email: v.string() }), v.null()),
  items: v.array(
    v.object({
      id: v.id("inventoryItems"),
      name: v.string(),
      sku: v.string(),
      unit: v.string(),
      quantity: v.union(v.number(), v.null()),
      dailyUsage: v.union(v.number(), v.null()),
      leadTimeDays: v.union(v.number(), v.null()),
      supplier: v.union(v.string(), v.null()),
      evidence: v.union(v.string(), v.null()),
      sourceUrl: v.union(v.string(), v.null()),
      sourceLabel: v.union(v.string(), v.null()),
      sourceId: v.union(v.id("inventorySources"), v.null()),
      buyUrl: v.union(v.string(), v.null()),
      supplierEmail: v.union(v.string(), v.null()),
      coverageDays: v.number(),
      stockCountedAt: v.union(v.number(), v.null()),
      estimatedQuantity: v.union(v.number(), v.null()),
      safetyStockDays: v.number(),
      buyingPriority: v.union(
        v.literal("cost"),
        v.literal("availability"),
        v.literal("flexible"),
        v.null(),
      ),
      dailyLossCents: v.union(v.number(), v.null()),
      lossCurrency: v.string(),
      stockoutImpact: v.union(v.string(), v.null()),
    }),
  ),
});

export const getWorkspace = query({
  args: {},
  returns: v.union(workspaceValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get("users", userId) : null;
    if (!user?.organizationId || user.isAnonymous || user.isActive !== true) return null;
    const organization = await ctx.db.get("organizations", user.organizationId);
    if (!organization || organization.isDemo || (user.role !== "admin" && user.role !== "buyer"))
      return null;
    const [items, inbox] = await Promise.all([
      activeCompanyItems(ctx, organization._id),
      ctx.db
        .query("purchasingInboxes")
        .withIndex("by_organization_and_provider", (q) =>
          q.eq("organizationId", organization._id).eq("provider", "agentmail"),
        )
        .unique(),
    ]);
    return {
      organizationId: organization._id,
      companyName: organization.name,
      shippingAddress: organization.shippingAddress ?? "",
      inbox: inbox ? { email: inbox.email } : null,
      items: await Promise.all(
        items.map(async (item) => {
          const source = item.sourceId ? await ctx.db.get("inventorySources", item.sourceId) : null;
          return {
            id: item._id,
            name: item.name,
            sku: item.sku,
            unit: item.unit ?? "units",
            quantity: item.stockCountKnown === false ? null : item.quantityOnHand,
            dailyUsage: item.estimatedDailyUsage ?? null,
            leadTimeDays: item.supplierLeadTimeDays ?? null,
            supplier: item.supplierName ?? null,
            evidence: item.leadTimeEvidence ?? null,
            sourceUrl: source?.url ?? null,
            sourceLabel: source?.filename ?? source?.url ?? null,
            sourceId: source?._id ?? null,
            buyUrl: item.buyUrl ?? source?.url ?? null,
            supplierEmail: item.supplierEmail ?? null,
            coverageDays: item.preferredCoverageDays,
            stockCountedAt: item.stockCountedAt ?? null,
            estimatedQuantity:
              item.stockCountKnown === false
                ? null
                : (item.estimatedQuantity ?? item.quantityOnHand),
            safetyStockDays: item.safetyStockDays,
            buyingPriority: item.buyingPriority ?? null,
            dailyLossCents: item.dailyLossCents ?? null,
            lossCurrency: item.lossCurrency ?? "USD",
            stockoutImpact: item.stockoutImpact ?? null,
          };
        }),
      ),
    };
  },
});

export const updateStock = mutation({
  args: { itemId: v.id("inventoryItems"), quantity: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const item = await ctx.db.get("inventoryItems", args.itemId);
    if (!item || item.organizationId !== organization._id) throw new ConvexError("Item not found.");
    if (!Number.isFinite(args.quantity) || args.quantity < 0 || args.quantity > 1_000_000_000)
      throw new ConvexError("Enter a valid stock count.");
    const outlook = stockOutlook(
      args.quantity,
      item.estimatedDailyUsage ?? null,
      item.supplierLeadTimeDays ?? null,
      item.safetyStockDays,
    );
    await ctx.db.patch("inventoryItems", item._id, {
      quantityOnHand: args.quantity,
      estimatedQuantity: args.quantity,
      stockCountKnown: true,
      stockCountedAt: Date.now(),
      status: outlook.needsAction
        ? "action_required"
        : outlook.reorderAt === null
          ? "watch"
          : "healthy",
    });
    await ctx.scheduler.runAfter(0, internal.companyAlerts.evaluateItem, { itemId: item._id });
    return null;
  },
});

export const completeFromSource = mutation({
  args: {
    companyName: v.string(),
    shippingAddress: v.string(),
    timezone: v.string(),
    sourceId: v.optional(v.id("inventorySources")),
    productIndex: v.optional(v.number()),
    itemName: v.string(),
    quantity: v.string(),
    dailyUsage: v.string(),
    unit,
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const user = await account(ctx);
    if (user.organizationId) {
      const org = await ctx.db.get("organizations", user.organizationId);
      if (org && !org.isDemo) return org._id;
      throw new ConvexError("Use your own account for your company.");
    }
    for (const field of ["companyName", "shippingAddress", "itemName"] as const) {
      const message = setupFieldError(field, args[field]);
      if (message) throw new ConvexError(message);
    }
    for (const field of ["quantity", "dailyUsage"] as const) {
      if (args[field].trim()) {
        const message = setupFieldError(field, args[field]);
        if (message) throw new ConvexError(message);
      }
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: args.timezone });
    } catch {
      throw new ConvexError("Choose a valid timezone.");
    }
    const source = args.sourceId ? await ctx.db.get("inventorySources", args.sourceId) : null;
    if (args.sourceId && (!source || source.userId !== user._id || source.status !== "ready"))
      throw new ConvexError("Finish reading your source first.");
    const index = args.productIndex ?? 0;
    const product = source?.products?.[index];
    if (source && (!Number.isInteger(index) || !product))
      throw new ConvexError("Choose an item from your source.");
    const organizationId = await ctx.db.insert("organizations", {
      name: args.companyName.trim(),
      shippingAddress: args.shippingAddress.trim(),
      timezone: args.timezone,
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 1 },
      isDemo: false,
    });
    const quantity = args.quantity.trim() ? Number(args.quantity) : undefined;
    const dailyUsage = args.dailyUsage.trim() ? Number(args.dailyUsage) : undefined;
    const lead = product?.leadTimeDays ?? undefined;
    const outlook = stockOutlook(quantity ?? null, dailyUsage ?? null, lead ?? null, 3);
    const itemId = await ctx.db.insert("inventoryItems", {
      organizationId,
      name: args.itemName.trim(),
      description: args.itemName.trim(),
      sku:
        product?.sku ??
        (args.itemName
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .slice(0, 32) ||
          "ITEM-001"),
      specification: { productType: args.itemName.trim() },
      quantityOnHand: quantity ?? 0,
      stockCountedAt: quantity !== undefined ? Date.now() : undefined,
      stockCountKnown: quantity !== undefined,
      unit: args.unit,
      estimatedDailyUsage: dailyUsage,
      supplierLeadTimeDays: lead,
      safetyStockDays: 3,
      casePack: product?.packSize ?? 1,
      preferredCoverageDays: 30,
      status: outlook.needsAction
        ? "action_required"
        : quantity === undefined || outlook.reorderAt === null
          ? "watch"
          : "healthy",
      isDemo: false,
      sourceId: source?._id,
      sourceProductIndex: product ? index : undefined,
      supplierName: product?.supplier ?? undefined,
      buyUrl: source?.url,
      leadTimeEvidence: product?.leadTimeEvidence ?? undefined,
    });
    if (source)
      await ctx.db.patch("inventorySources", source._id, {
        inventoryItemId: itemId,
        organizationId,
      });
    await ctx.db.patch("users", user._id, { organizationId, role: "admin" });
    return organizationId;
  },
});

export const fillGap = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    field: v.union(
      v.literal("supplier"),
      v.literal("leadTimeDays"),
      v.literal("dailyUsage"),
      v.literal("safetyStockDays"),
    ),
    value: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, organization } = await ownedCompany(ctx);
    const item = await ctx.db.get("inventoryItems", args.itemId);
    if (!item || item.organizationId !== organization._id) throw new ConvexError("Item not found.");
    const error = setupFieldError(args.field === "supplier" ? "itemName" : args.field, args.value);
    if (error) throw new ConvexError(error);
    const patch =
      args.field === "supplier"
        ? { supplierName: args.value.trim() }
        : args.field === "leadTimeDays"
          ? {
              supplierLeadTimeDays: Number(args.value),
              leadTimeConfirmedBy: user._id,
              leadTimeConfirmedAt: Date.now(),
              leadTimeEvidence: "Confirmed by your team",
            }
          : args.field === "dailyUsage"
            ? { estimatedDailyUsage: Number(args.value) }
            : { safetyStockDays: Number(args.value) };
    const next = { ...item, ...patch };
    const outlook = stockOutlook(
      next.stockCountKnown === false ? null : next.quantityOnHand,
      next.estimatedDailyUsage ?? null,
      next.supplierLeadTimeDays ?? null,
      next.safetyStockDays,
    );
    await ctx.db.patch("inventoryItems", item._id, {
      ...patch,
      status: outlook.needsAction
        ? "action_required"
        : next.stockCountKnown === false || outlook.reorderAt === null
          ? "watch"
          : "healthy",
    });
    await ctx.scheduler.runAfter(0, internal.companyAlerts.evaluateItem, { itemId: item._id });
    return null;
  },
});
