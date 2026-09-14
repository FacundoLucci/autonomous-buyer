import { v } from "convex/values";
import { internalAction, env } from "./_generated/server";
import { internal } from "./_generated/api";

// Keep provider acceptance distinct from delivery; retain failures for owner follow-up.
export const send = internalAction({
  args: {
    leadId: v.id("marketingLeads"),
    kind: v.union(v.literal("confirmation"), v.literal("notification")),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.runQuery(internal.marketing.get, { leadId: args.leadId });
    if (!lead || lead[args.kind] !== "pending") return null;
    const email = args.kind === "confirmation" ? lead.email : env.MARKETING_NOTIFY_EMAIL;
    if (!env.ALERT_EMAIL_URL || !env.ALERT_EMAIL_SECRET || !email) {
      await ctx.runMutation(internal.marketing.delivery, { ...args, status: "failed" });
      return null;
    }
    try {
      const response = await fetch(env.ALERT_EMAIL_URL, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ALERT_EMAIL_SECRET}`,
        },
        body: JSON.stringify({
          to: email,
          subject:
            args.kind === "confirmation"
              ? "We received your BUY HARD pilot interest"
              : `BUY HARD inquiry: ${lead.businessName.replace(/[\r\n]/g, " ")}`,
          text:
            args.kind === "confirmation"
              ? "Thanks for your interest in the BUY HARD pilot. Your inquiry is saved. We aim to reply within one business day.\n\nBring one item you regularly reorder to a 20-minute walkthrough: https://cal.com/facundolucci/buyhard\n\nYou have not been signed up for marketing emails."
              : `${lead.businessName}\n${lead.email}\n${lead.challenge}\n\nReply within one business day.\nPrivate list: ${(env.APP_URL ?? env.CONVEX_SITE_URL).replace(/\/$/, "")}/leads\nSource: ${lead.source.utm_source ?? "direct"} / ${lead.source.utm_campaign ?? "none"}`,
        }),
      });
      if (!response.ok) {
        await ctx.runMutation(internal.marketing.delivery, {
          ...args,
          status: response.status >= 500 ? "unknown" : "failed",
        });
        return null;
      }
      const body: unknown = await response.json();
      const reported =
        body && typeof body === "object" && "status" in body ? body.status : undefined;
      await ctx.runMutation(internal.marketing.delivery, {
        ...args,
        status:
          reported === "delivered" ? "delivered" : reported === "queued" ? "queued" : "unknown",
      });
    } catch {
      await ctx.runMutation(internal.marketing.delivery, { ...args, status: "unknown" });
      // The bridge has no idempotency guarantee. Reconcile ambiguous sends before retrying.
    }
    return null;
  },
});
