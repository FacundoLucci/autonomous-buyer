import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Existing items predate the archive flag. Both unset and false mean active.
export async function activeCompanyItems(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const pages = await Promise.all(
    [undefined, false].map((archived) =>
      ctx.db
        .query("inventoryItems")
        .withIndex("by_org_archived", (q) =>
          q.eq("organizationId", organizationId).eq("archived", archived),
        )
        .take(101),
    ),
  );
  return pages.flat().sort((a, b) => a.sku.localeCompare(b.sku));
}

import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { availableStock, type StockFacts } from "../src/lib/inventory-planning";

export function stockFacts(item: Doc<"inventoryItems">): StockFacts {
  return {
    quantity: item.stockCountKnown === false ? null : item.quantityOnHand,
    stockCountedAt: item.stockCountedAt ?? null,
    forecastQuantity: item.forecastQuantity,
    forecastAt: item.forecastAt,
    preparationDays: item.preparationDays,
    replenishmentEnabled: item.replenishmentEnabled,
    dailyUsage: item.estimatedDailyUsage ?? null,
    leadTimeDays: item.supplierLeadTimeDays ?? null,
    safetyStockDays: item.safetyStockDays,
    buyingPriority: item.buyingPriority ?? null,
    dailyLossCents: item.dailyLossCents ?? null,
    lossCurrency: item.lossCurrency ?? "USD",
  };
}

// Invalidate approvals in the same transaction as their underlying facts change.
// An external submission already in progress must be reconciled, never silently reset.
export async function planningChanged(ctx: MutationCtx, item: Doc<"inventoryItems">) {
  await ctx.db.patch("inventoryItems", item._id, {
    planningRevision: (item.planningRevision ?? 0) + 1,
  });
  const orders = await ctx.db
    .query("companyOrders")
    .withIndex("by_inventoryItemId_and_isOpen", (q) =>
      q.eq("inventoryItemId", item._id).eq("isOpen", true),
    )
    .take(101);
  for (const order of orders) {
    if (
      order.browserPhase === "submit" &&
      order.browserCommitAuthorizedAt &&
      order.executionState !== "confirmed"
    ) {
      await ctx.db.patch("companyOrders", order._id, {
        reviewRequired: true,
        error:
          "Stock or buying rules changed during website submission. Confirm the existing order before buying again.",
        updatedAt: Date.now(),
      });
      continue;
    }
    const browserBeforeCommit = order.browserPhase === "submit" && !order.browserCommitAuthorizedAt;
    if (
      !["draft", "approved"].includes(order.status) ||
      (order.executionState &&
        !["queued", "needs_attention"].includes(order.executionState) &&
        !browserBeforeCommit)
    )
      continue;
    await ctx.db.patch("companyOrders", order._id, {
      status: "draft",
      reviewRequired: true,
      approvedAt: undefined,
      approvedBy: undefined,
      approvedTermsKey: undefined,
      executionState: undefined,
      updatedAt: Date.now(),
    });
  }
  await ctx.scheduler.runAfter(0, internal.companyAlerts.evaluateItem, { itemId: item._id });
}

export async function applyStockReceipt(
  ctx: MutationCtx,
  item: Doc<"inventoryItems">,
  quantity: number,
  orderId?: Id<"companyOrders">,
) {
  const now = Date.now();
  const projected = availableStock(stockFacts(item), now);
  if (projected === null) throw new ConvexError("Record a stock count before adding a delivery.");
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new ConvexError("Enter a positive delivery quantity.");
  await ctx.db.patch("inventoryItems", item._id, {
    forecastQuantity: projected + quantity,
    forecastAt: now,
    estimatedQuantity: projected + quantity,
  });
  await ctx.db.insert("stockEvents", {
    organizationId: item.organizationId,
    itemId: item._id,
    kind: "receipt",
    quantity,
    orderId,
    createdAt: now,
  });
  await planningChanged(ctx, item);
}

export async function baselineUsageChange(
  ctx: MutationCtx,
  item: Doc<"inventoryItems">,
  nextUsage: number,
) {
  const now = Date.now();
  const projected = availableStock(stockFacts(item), now);
  await ctx.db.patch("inventoryItems", item._id, {
    forecastQuantity: projected ?? undefined,
    forecastAt: now,
    estimatedQuantity: projected ?? undefined,
  });
  await ctx.db.insert("stockEvents", {
    organizationId: item.organizationId,
    itemId: item._id,
    kind: "usage_change",
    quantity: nextUsage,
    createdAt: now,
  });
}
