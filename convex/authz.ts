import { getAuthUserId } from "@convex-dev/auth/server";

import type { Id } from "./_generated/dataModel";
import { internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

type DatabaseCtx = MutationCtx | QueryCtx;

export async function requireConfiguredBuyer(ctx: DatabaseCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Sign in as the configured buyer.");
  const user = await ctx.db.get("users", userId);
  if (
    user === null ||
    user.isAnonymous === true ||
    user.isActive !== true ||
    (user.role !== "buyer" && user.role !== "admin") ||
    user.organizationId === undefined
  ) {
    throw new Error("A configured buyer must authorize this shared demo change.");
  }
  return user;
}

export async function requireExternalBuyer(ctx: DatabaseCtx, procurementId: Id<"procurements">) {
  const user = await requireConfiguredBuyer(ctx);
  const procurement = await ctx.db.get("procurements", procurementId);
  if (procurement === null) throw new Error("Procurement not found.");
  if (user.organizationId !== procurement.organizationId) {
    throw new Error("A configured buyer must authorize external provider actions.");
  }
  return { user, procurement };
}

export const assertExternalBuyer = internalQuery({
  args: { procurementId: v.id("procurements") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireExternalBuyer(ctx, args.procurementId);
    return null;
  },
});

export async function requireDemoOperator(ctx: DatabaseCtx, procurementId: Id<"procurements">) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Enter judge mode to run the interactive demo.");
  const [user, procurement] = await Promise.all([
    ctx.db.get("users", userId),
    ctx.db.get("procurements", procurementId),
  ]);
  if (procurement === null) throw new Error("Procurement not found.");
  const demoRun = await ctx.db.get("demoRuns", procurement.demoRunId);
  if (
    user === null ||
    user.isActive !== true ||
    (user.role !== "buyer" && user.role !== "admin") ||
    user.organizationId !== procurement.organizationId ||
    (user.isAnonymous === true && demoRun?.isDemo !== true)
  ) {
    throw new Error("This identity cannot operate the demo procurement.");
  }
  return { user, procurement };
}

export const assertDemoOperator = internalQuery({
  args: { procurementId: v.id("procurements") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireDemoOperator(ctx, args.procurementId);
    return null;
  },
});

export async function canSeePrivateProviderData(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return false;
  const user = await ctx.db.get("users", userId);
  return (
    user !== null &&
    user.isAnonymous !== true &&
    user.isActive === true &&
    (user.role === "buyer" || user.role === "admin") &&
    user.organizationId === organizationId
  );
}
