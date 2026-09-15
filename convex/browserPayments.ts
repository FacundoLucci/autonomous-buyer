import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { ownedCompany } from "./onboarding";
import { browserWorker } from "./browserWorker";
import type { Doc } from "./_generated/dataModel";

const connection = v.object({
  connected: v.boolean(),
  mode: v.union(v.literal("test"), v.literal("live")),
  url: v.optional(v.string()),
  code: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  limitCents: v.optional(v.number()),
  currency: v.optional(v.string()),
});

export const owner = internalQuery({
  args: {},
  returns: v.object({ organizationId: v.id("organizations"), paymentOwnerId: v.id("users") }),
  handler: async (ctx) => {
    const { user, organization } = await ownedCompany(ctx);
    return { organizationId: organization._id, paymentOwnerId: user._id };
  },
});

function linkUrl(value: unknown): string {
  if (typeof value !== "string") throw new ConvexError("Link did not return a connection page.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !["link.com", "stripe.com"].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  )
    throw new ConvexError("Link returned an unexpected connection page.");
  return url.href;
}

function safeConnection(value: unknown): typeof connection.type {
  if (!value || typeof value !== "object") throw new ConvexError("Payment connection unavailable.");
  const data = value as Record<string, unknown>;
  if (typeof data.connected !== "boolean" || !["test", "live"].includes(String(data.mode)))
    throw new ConvexError("Payment connection unavailable.");
  return {
    connected: data.connected,
    mode: data.mode as "test" | "live",
    ...(data.url ? { url: linkUrl(data.url) } : {}),
    ...(typeof data.code === "string" ? { code: data.code.slice(0, 100) } : {}),
    ...(typeof data.expiresAt === "number" ? { expiresAt: data.expiresAt } : {}),
    ...(Number.isSafeInteger(data.limitCents) && Number(data.limitCents) > 0
      ? { limitCents: Number(data.limitCents) }
      : {}),
    ...(typeof data.currency === "string" && /^[A-Z]{3}$/.test(data.currency)
      ? { currency: data.currency }
      : {}),
  };
}

export const status = action({
  args: {},
  returns: connection,
  handler: async (ctx): Promise<typeof connection.type> => {
    const scope = await ctx.runQuery(internal.browserPayments.owner, {});
    return safeConnection(await browserWorker("/payments/status", scope));
  },
});

export const connect = action({
  args: {},
  returns: connection,
  handler: async (ctx): Promise<typeof connection.type> => {
    const scope = await ctx.runQuery(internal.browserPayments.owner, {});
    return safeConnection(await browserWorker("/payments/connect", { ...scope, name: "BUY HARD" }));
  },
});

export const disconnect = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const scope = await ctx.runQuery(internal.browserPayments.owner, {});
    await browserWorker("/payments/disconnect", scope);
    return null;
  },
});

export const approvalSession = action({
  args: { orderId: v.id("companyOrders") },
  returns: v.string(),
  handler: async (ctx, { orderId }): Promise<string> => {
    const [scope, order]: [
      { organizationId: string; paymentOwnerId: string },
      Doc<"companyOrders"> | null,
    ] = await Promise.all([
      ctx.runQuery(internal.browserPayments.owner, {}),
      ctx.runQuery(api.companyOrders.get, { orderId }),
    ]);
    if (
      !order?.isOpen ||
      !order.browserJobId ||
      order.browserCommitAuthorizedAt ||
      (order.browserPhase === "submit" ? order.approvedBy : order.createdBy) !==
        scope.paymentOwnerId
    )
      throw new ConvexError("The person funding this purchase must open its payment approval.");
    const result = await browserWorker(`/jobs/${encodeURIComponent(order.browserJobId)}/payment`, {
      ...scope,
      intent: order.browserJobIntent,
    });
    if (!result || typeof result !== "object" || !("url" in result))
      throw new ConvexError("No payment approval is waiting. Continue checkout to refresh it.");
    return linkUrl(result.url);
  },
});
