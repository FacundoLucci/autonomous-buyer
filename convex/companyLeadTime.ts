import { v } from "convex/values";
import schema from "./schema";
import { createThread } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { internalMutation } from "./audited";
import { planningChanged } from "./companyStock";
import type { Doc } from "./_generated/dataModel";

function researchKey(item: Doc<"inventoryItems">, address: string) {
  return JSON.stringify([item.buyUrl, item.supplierName, item.supplierSku, address]);
}
// Shipping/dispatch estimates and business days cannot become calendar delivery lead.
// Extract the conservative end of an explicit calendar-day delivery promise.
export function calendarDeliveryDays(excerpt: string): number | null {
  if (
    /\b(business|working|dispatch|ships?|shipping|processing|not|cannot|except|excluding|unavailable)\b/i.test(
      excerpt,
    )
  )
    return null;
  const match = excerpt.match(
    /\b(?:delivery|delivered|arrives?|arrival)\b[^.\n\d]{0,40}(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?\s+calendar\s+days?\b/i,
  );
  if (!match) return null;
  const days = Number(match[2] ?? match[1]);
  return days >= Number(match[1]) && days >= 1 && days <= 365 ? days : null;
}
const job = { itemId: v.id("inventoryItems"), key: v.string() };
export const start = internalMutation({
  args: { itemId: v.id("inventoryItems") },
  returns: v.null(),
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("inventoryItems", itemId);
    if (
      !item ||
      item.isDemo ||
      item.archived ||
      !item.replenishmentEnabled ||
      item.supplierLeadTimeDays !== undefined ||
      item.stockCountKnown === false ||
      item.estimatedDailyUsage === undefined ||
      item.estimatedDailyUsage <= 0 ||
      !item.buyingPriority
    )
      return null;
    const company = await ctx.db.get("organizations", item.organizationId);
    if (!company) return null;
    const key = researchKey(item, company.shippingAddress ?? "");
    if (item.leadResearchKey === key) {
      if (
        item.leadResearchState === "researching" &&
        (item.leadResearchStartedAt ?? 0) < Date.now() - 15 * 60_000
      )
        await ctx.db.patch("inventoryItems", itemId, {
          leadResearchState: "needs_details",
          automationState: "needs_details",
          automationNote:
            "I could not finish checking delivery time. Add the supplier's confirmed calendar delivery time.",
        });
      return null;
    }
    if (!item.buyUrl) {
      await ctx.db.patch("inventoryItems", itemId, {
        leadResearchKey: key,
        leadResearchState: "needs_details",
        automationState: "needs_details",
        automationNote: "Add the supplier product link so I can check delivery time.",
      });
      return null;
    }
    const threadId =
      item.leadResearchThreadId ??
      (await createThread(ctx, components.agent, { title: `${item.name} delivery planning` }));
    await ctx.db.patch("inventoryItems", itemId, {
      leadResearchKey: key,
      leadResearchState: "researching",
      leadResearchThreadId: threadId,
      leadResearchStartedAt: Date.now(),
      automationState: "researching",
      automationNote: "Checking the supplier's delivery time before scheduling replenishment.",
    });
    await ctx.scheduler.runAfter(0, internal.companyLeadTimeAgent.research, { itemId, key });
    return null;
  },
});
export const context = internalQuery({
  args: job,
  returns: v.union(v.null(), v.object({ item: schema.doc("inventoryItems"), address: v.string() })),
  handler: async (ctx, { itemId, key }) => {
    const item = await ctx.db.get("inventoryItems", itemId);
    if (
      !item ||
      !item.replenishmentEnabled ||
      item.archived ||
      item.leadResearchKey !== key ||
      item.leadResearchState !== "researching" ||
      item.supplierLeadTimeDays !== undefined
    )
      return null;
    const company = await ctx.db.get("organizations", item.organizationId);
    if (!company || researchKey(item, company.shippingAddress ?? "") !== key) return null;
    return { item, address: company.shippingAddress ?? "" };
  },
});
export const finish = internalMutation({
  args: {
    ...job,
    url: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("inventoryItems", args.itemId);
    if (
      !item ||
      !item.replenishmentEnabled ||
      item.archived ||
      item.leadResearchKey !== args.key ||
      item.leadResearchState !== "researching" ||
      item.supplierLeadTimeDays !== undefined
    )
      return null;
    const company = await ctx.db.get("organizations", item.organizationId);
    if (!company || researchKey(item, company.shippingAddress ?? "") !== args.key) return null;
    const days = args.excerpt ? calendarDeliveryDays(args.excerpt) : null;
    if (
      days !== null &&
      args.url &&
      item.buyUrl &&
      new URL(args.url).hostname === new URL(item.buyUrl).hostname
    ) {
      await ctx.db.patch("inventoryItems", item._id, {
        supplierLeadTimeDays: days,
        leadTimeEvidence: `${args.url}\n${args.excerpt}`,
        leadTimeConfirmedAt: Date.now(),
        leadResearchState: "complete",
      });
      await ctx.db.insert("deskActivity", {
        organizationId: item.organizationId,
        itemId: item._id,
        summary: `${item.name}: supplier delivery is ${days} calendar days. Checking when replenishment is needed.`,
        createdAt: Date.now(),
      });
      await planningChanged(ctx, item);
    } else {
      await ctx.db.patch("inventoryItems", item._id, {
        leadResearchState: "needs_details",
        automationState: "needs_details",
        automationNote:
          args.note ??
          "I could not verify calendar delivery time. Add the supplier's confirmed delivery time.",
      });
    }
    return null;
  },
});
