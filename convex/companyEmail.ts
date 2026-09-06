"use node";
import { createHash, randomInt } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { action, internalAction, env } from "./_generated/server";
import { internal } from "./_generated/api";

function hash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
export const requestVerification = action({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const code = String(randomInt(100000, 1000000));
    await ctx.runMutation(internal.companyAlerts.beginVerification, {
      email: args.email,
      code,
      hash: hash(code),
    });
    return null;
  },
});
export const verify = action({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ok = await ctx.runMutation(internal.companyAlerts.verifyHash, {
      hash: hash(args.code.trim()),
    });
    if (!ok)
      throw new ConvexError("That code is incorrect or expired. Try again or request a new one.");
    return null;
  },
});
export const sendAlert = internalAction({
  args: { email: v.string(), subject: v.string(), text: v.string() },
  returns: v.object({
    status: v.union(
      v.literal("queued"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("unknown"),
    ),
    error: v.optional(v.string()),
    providerId: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    if (!env.ALERT_EMAIL_URL || !env.ALERT_EMAIL_SECRET)
      return { status: "failed" as const, error: "Email alerts are not configured." };
    const response = await fetch(env.ALERT_EMAIL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.ALERT_EMAIL_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: args.email, subject: args.subject, text: args.text }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok)
      return {
        status: response.status >= 500 ? ("unknown" as const) : ("failed" as const),
        error: `Email service returned ${response.status}.`,
      };
    const body: unknown = await response.json();
    if (!body || typeof body !== "object")
      return { status: "unknown" as const, error: "Email service did not confirm delivery." };
    const result = body as Record<string, unknown>;
    return {
      status:
        result.status === "delivered"
          ? ("delivered" as const)
          : result.status === "queued"
            ? ("queued" as const)
            : ("unknown" as const),
      providerId: typeof result.messageId === "string" ? result.messageId : undefined,
    };
  },
});
