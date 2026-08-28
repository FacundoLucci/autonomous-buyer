import { v } from "convex/values";

import { internalQuery, mutation, query } from "./_generated/server";
import { env } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const currentUserValidator = v.object({
  userId: v.id("users"),
  name: v.string(),
  email: v.union(v.string(), v.null()),
  role: v.union(v.literal("admin"), v.literal("buyer"), v.literal("viewer")),
  isJudgeDemo: v.boolean(),
  canApproveDemo: v.boolean(),
});

export const getDemoOrganizationId = internalQuery({
  args: {},
  returns: v.id("organizations"),
  handler: async (ctx) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_name", (q) => q.eq("name", "Acme Foods"))
      .unique();
    if (organization === null) throw new Error("Start the demo before creating a judge identity.");
    return organization._id;
  },
});

export const getCurrentUser = query({
  args: {},
  returns: v.union(currentUserValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get("users", userId);
    if (user === null) return null;
    const role = user.role ?? "viewer";
    return {
      userId: user._id,
      name: user.name ?? user.email ?? "Signed-in viewer",
      email: user.email ?? null,
      role,
      isJudgeDemo: user.isAnonymous === true,
      canApproveDemo:
        user.isActive === true &&
        (role === "buyer" || role === "admin") &&
        user.organizationId !== undefined,
    };
  },
});

export const claimConfiguredBuyer = mutation({
  args: {},
  returns: currentUserValidator,
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const user = await ctx.db.get("users", userId);
    if (user === null) throw new Error("Signed-in user not found.");
    const allowedEmail = env.BUYER_EMAIL?.trim().toLowerCase();
    if (
      user.isAnonymous !== true &&
      (allowedEmail === undefined || user.email?.trim().toLowerCase() !== allowedEmail)
    ) {
      throw new Error("This account is not configured as the demo buyer.");
    }
    let organization = await ctx.db
      .query("organizations")
      .withIndex("by_name", (q) => q.eq("name", "Acme Foods"))
      .unique();
    if (organization === null && user.isAnonymous !== true) {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Acme Foods",
        address: {
          line1: "100 Demo Way",
          city: "Cedar Rapids",
          region: "IA",
          postalCode: "52401",
          countryCode: "US",
        },
        timezone: "America/Chicago",
        approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 1 },
        isDemo: true,
      });
      organization = await ctx.db.get("organizations", organizationId);
    }
    if (organization === null) throw new Error("Start the demo before claiming buyer access.");
    const name = user.isAnonymous === true ? "Judge demo buyer" : (user.name ?? user.email);
    await ctx.db.patch("users", user._id, {
      organizationId: organization._id,
      name,
      role: "buyer" as const,
      isActive: true,
    });
    return {
      userId: user._id,
      name: name ?? "Demo buyer",
      email: user.email ?? null,
      role: "buyer" as const,
      isJudgeDemo: user.isAnonymous === true,
      canApproveDemo: true,
    };
  },
});
