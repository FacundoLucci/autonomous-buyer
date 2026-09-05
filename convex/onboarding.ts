import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { setupFieldError, stockOutlook, type CompanySetup } from "../src/lib/setup-fields";

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
      quantity: v.number(),
      dailyUsage: v.number(),
      leadTimeDays: v.number(),
      safetyStockDays: v.number(),
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
      ctx.db
        .query("inventoryItems")
        .withIndex("by_org_sku", (q) => q.eq("organizationId", organization._id))
        .take(100),
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
      items: items.map((item) => ({
        id: item._id,
        name: item.name,
        sku: item.sku,
        unit: item.unit ?? "units",
        quantity: item.quantityOnHand,
        dailyUsage: item.estimatedDailyUsage ?? 0,
        leadTimeDays: item.supplierLeadTimeDays ?? 0,
        safetyStockDays: item.safetyStockDays,
      })),
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
      item.estimatedDailyUsage ?? 0,
      item.supplierLeadTimeDays ?? 0,
      item.safetyStockDays,
    );
    await ctx.db.patch("inventoryItems", item._id, {
      quantityOnHand: args.quantity,
      status: outlook.needsAction ? "action_required" : "healthy",
    });
    return null;
  },
});
