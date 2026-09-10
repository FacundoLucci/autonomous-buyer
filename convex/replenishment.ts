import { v } from "convex/values";
import { internalMutation } from "./audited";
import { internal } from "./_generated/api";
import { stockFacts } from "./companyStock";
import { replenishmentPlan } from "../src/lib/inventory-planning";

export const evaluate = internalMutation({
  args: { itemId: v.id("inventoryItems") },
  returns: v.null(),
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("inventoryItems", itemId);
    if (!item || item.isDemo) return null;
    if (item.replenishmentScheduledId) {
      const prior = await ctx.db.system.get(item.replenishmentScheduledId);
      if (prior?.state.kind === "pending")
        await ctx.scheduler.cancel(item.replenishmentScheduledId);
      await ctx.db.patch("inventoryItems", itemId, { replenishmentScheduledId: undefined });
    }
    if (item.archived || !item.replenishmentEnabled) return null;
    if (
      item.supplierLeadTimeDays === undefined &&
      item.stockCountKnown !== false &&
      item.estimatedDailyUsage !== undefined &&
      item.estimatedDailyUsage > 0 &&
      item.buyingPriority
    ) {
      await ctx.runMutation(internal.companyLeadTime.start, { itemId });
      return null;
    }
    const orders = await ctx.db
      .query("companyOrders")
      .withIndex("by_inventoryItemId_and_isOpen", (q) =>
        q.eq("inventoryItemId", itemId).eq("isOpen", true),
      )
      .take(101);
    const buys = await ctx.db
      .query("companyBuys")
      .withIndex("by_itemId_and_closed", (q) => q.eq("itemId", itemId).eq("closed", false))
      .take(101);
    const uncertain = orders.some((o) => !["draft", "placed", "part_received"].includes(o.status));
    if (orders.length > 100 || buys.length > 100 || uncertain) {
      await ctx.db.patch("inventoryItems", itemId, {
        automationState: "waiting",
        automationNote:
          "An order is awaiting confirmation. I will reconcile it before buying again.",
      });
      return null;
    }
    const confirmed = orders.filter((o) => ["placed", "part_received"].includes(o.status));
    const plan = replenishmentPlan(
      {
        ...stockFacts(item),
        preferredCoverageDays: item.preferredCoverageDays,
        preparationDays: item.preparationDays,
        orderMultiple: item.orderMultiple,
      },
      confirmed.map((o) => ({
        quantity: Math.max(0, o.quantity - o.receivedQuantity),
        expectedOn: o.expectedOn ?? null,
      })),
    );
    const nextAt = "nextAt" in plan ? plan.nextAt : undefined;
    const scheduled =
      nextAt === undefined
        ? undefined
        : await ctx.scheduler.runAt(
            Math.max(Date.now() + 60_000, nextAt),
            internal.replenishment.evaluate,
            { itemId },
          );
    await ctx.db.patch("inventoryItems", itemId, {
      automationState: plan.state,
      automationNote: plan.note,
      replenishmentScheduledId: scheduled,
    });
    const open = buys.find(
      (b) => !b.orderId || orders.some((o) => o._id === b.orderId && o.status === "draft"),
    );
    if (plan.state !== "buying") {
      if (open?.automatic && plan.state === "watching") {
        if (open.orderId) {
          const order = orders.find((o) => o._id === open.orderId);
          if (order?.status === "draft")
            await ctx.db.patch("companyOrders", order._id, {
              status: "cancelled",
              isOpen: false,
              reviewRequired: true,
              approvedAt: undefined,
              approvedBy: undefined,
              approvedTermsKey: undefined,
              updatedAt: Date.now(),
            });
        }
        await ctx.db.patch("companyBuys", open._id, {
          closed: true,
          planVersion: (open.planVersion ?? 0) + 1,
          purchasingNote: "Stock is covered; this purchase is no longer needed.",
        });
      }
      return null;
    }
    // User-created work is never overwritten. Its existence still prevents a duplicate.
    if (open && !open.automatic) return null;
    if (!open && orders.some((o) => o.status === "draft")) return null;
    const key = JSON.stringify([
      item.planningRevision ?? 0,
      confirmed.map((o) => [o._id, o.quantity, o.receivedQuantity, o.expectedOn]),
    ]);
    if (open?.planningKey === key) return null;
    const version = (open?.planVersion ?? 0) + 1;
    const fields = {
      quantity: plan.quantity,
      requiredBy: plan.requiredBy!,
      planningKey: key,
      planVersion: version,
      purchasingState: "researching" as const,
      purchasingNote: "Finding a delivery that meets your buying rules.",
    };
    const buyId =
      open?._id ??
      (await ctx.db.insert("companyBuys", {
        organizationId: item.organizationId,
        itemId,
        automatic: true,
        notes: "Automatic replenishment",
        closed: false,
        createdAt: Date.now(),
        ...fields,
      }));
    if (open) await ctx.db.patch("companyBuys", buyId, fields);
    await ctx.db.insert("deskActivity", {
      organizationId: item.organizationId,
      itemId,
      buyId,
      summary: `${item.name}: ${open ? "updated" : "started"} replenishment for ${plan.quantity} ${item.unit ?? "units"}, needed by ${plan.requiredBy}.`,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.companyPurchasing.start, {
      buyId,
      planVersion: version,
    });
    return null;
  },
});
