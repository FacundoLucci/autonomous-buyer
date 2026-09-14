import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { env, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { mutation } from "./audited";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "./identity";
import { boundedText } from "./companyRules";

export const invitationRequired =
  "BUY HARD is invite only. Complete onboarding with Facundo before opening your workspace.";

// Existing workspaces keep their access. New workspace creation needs a grant
// written by the owner, never an email match or a client-supplied flag.
export function requireWorkspaceInvitation(user: Doc<"users">) {
  if (user.workspaceAccessGrantedAt === undefined) throw new ConvexError(invitationRequired);
}

export async function submitOnboardingRequest(
  ctx: MutationCtx,
  user: Doc<"users">,
  draft: Doc<"taskChats">["draft"],
  timezone: string,
) {
  const prior = await ctx.db
    .query("onboardingRequests")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  if (prior) return prior._id;
  const companyName = boundedText(draft.companyName ?? "", "your company name");
  const shippingAddress = boundedText(draft.shippingAddress ?? "", "your delivery address", 500);
  if (shippingAddress.length < 12)
    throw new ConvexError("I still need your full delivery address.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new ConvexError("Choose a valid timezone.");
  }
  return await ctx.db.insert("onboardingRequests", {
    userId: user._id,
    companyName,
    shippingAddress,
    timezone,
    requestedAt: Date.now(),
  });
}

export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ companyName: v.string(), shippingAddress: v.string(), requestedAt: v.number() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get("users", userId) : null;
    if (!user || user.isAnonymous || !user.isActive || user.organizationId) return null;
    const request = await ctx.db
      .query("onboardingRequests")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    return request
      ? {
          companyName: request.companyName,
          shippingAddress: request.shippingAddress,
          requestedAt: request.requestedAt,
        }
      : null;
  },
});

async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const id = await getAuthUserId(ctx);
  const owner = id ? await ctx.db.get("users", id) : null;
  if (!owner || owner.isAnonymous || !owner.isActive || id !== env.MARKETING_OWNER_USER_ID)
    throw new ConvexError("Only Facundo can manage invitations.");
  return owner;
}

export const ownerList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const page = await ctx.db
      .query("onboardingRequests")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (request) => {
          const user = await ctx.db.get("users", request.userId);
          return { ...request, email: user?.email ?? user?.onboardingEmail ?? null };
        }),
      ),
    };
  },
});

// This is the only customer-facing path that turns a request into workspace
// access. Booking a meeting cannot call it or grant access automatically.
export const grant = mutation({
  args: { requestId: v.id("onboardingRequests") },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const request = await ctx.db.get("onboardingRequests", args.requestId);
    if (!request) throw new ConvexError("Onboarding request not found.");
    const user = await ctx.db.get("users", request.userId);
    if (!user || user.isAnonymous || !user.isActive)
      throw new ConvexError("This account is unavailable.");
    if (request.organizationId && user.organizationId === request.organizationId)
      return request.organizationId;
    if (user.organizationId) throw new ConvexError("This account already has a workspace.");
    const organizationId = await ctx.db.insert("organizations", {
      name: request.companyName,
      shippingAddress: request.shippingAddress,
      timezone: request.timezone,
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 1 },
      isDemo: false,
    });
    const approvedAt = Date.now();
    await ctx.db.patch("users", user._id, {
      organizationId,
      role: "admin",
      workspaceAccessGrantedAt: approvedAt,
    });
    await ctx.db.patch("onboardingRequests", request._id, {
      organizationId,
      approvedAt,
      approvedBy: owner._id,
    });
    return organizationId;
  },
});
