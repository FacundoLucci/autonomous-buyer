import type { Auth } from "convex/server";
import type { Id } from "./_generated/dataModel";

// Both issuers are verified by Convex. Legacy subjects append a session ID;
// Auth 2 uses the app-owned user ID directly. Never match accounts by email.
export async function getAuthUserId(ctx: { auth: Auth }): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity ? (identity.subject.split("|")[0] as Id<"users">) : null;
}
