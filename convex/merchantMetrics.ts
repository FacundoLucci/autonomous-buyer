import { v } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { supplierWebsite } from "./supplierDirectoryFields";

function reservedHost(domain: string) {
  return (
    /(?:^|\.)(?:example|invalid|test|localhost)$/.test(domain) ||
    /(?:^|\.)example\.(?:com|net|org)$/.test(domain)
  );
}

function merchantIdentity(order: Doc<"companyOrders">, channel: "email" | "browser") {
  const candidates = [order.buyUrl, order.sourceUrl];
  if (channel === "email" && order.supplierEmail) {
    const emailDomain = order.supplierEmail.trim().split("@");
    const sharedMailHosts = new Set([
      "gmail.com",
      "googlemail.com",
      "outlook.com",
      "hotmail.com",
      "live.com",
      "msn.com",
      "yahoo.com",
      "ymail.com",
      "aol.com",
      "icloud.com",
      "me.com",
      "mac.com",
      "proton.me",
      "protonmail.com",
      "pm.me",
      "mail.com",
      "gmx.com",
      "gmx.net",
    ]);
    if (emailDomain.length === 2 && !sharedMailHosts.has(emailDomain[1].toLowerCase()))
      candidates.push(`https://${emailDomain[1]}`);
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const { domain } = supplierWebsite(candidate);
      // Domain identities do not expose customer-supplied business names.
      if (reservedHost(domain)) continue;
      return {
        key: domain,
        domain,
        name:
          domain === "amazon.com"
            ? "Amazon"
            : domain === "webstaurantstore.com"
              ? "WebstaurantStore"
              : domain,
      };
    } catch {
      /* A missing public website must not interrupt order confirmation. */
    }
  }
  if (channel === "email" && order.supplierEmail) {
    const email = order.supplierEmail.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !reservedHost(email.split("@")[1]))
      return {
        key: `email:${email}`,
        domain: "",
        name:
          order.supplier
            .trim()
            .replace(/[^\s<>]+@[^\s<>]+/g, "")
            .trim()
            .slice(0, 120) || "Email supplier",
      };
  }
  return null;
}

// Called only inside trusted receipt/confirmation mutations, never by manual
// order reporting. The order marker and both counters commit in one transaction.
export async function recordMerchantOrder(
  ctx: MutationCtx,
  orderId: Id<"companyOrders">,
  channel: "email" | "browser",
) {
  const order = await ctx.db.get("companyOrders", orderId);
  if (
    !order ||
    order.merchantMetricKey ||
    order.status !== "placed" ||
    order.executionState !== "confirmed" ||
    !order.confirmation ||
    !order.approvedAt
  )
    return;
  if (channel === "browser") {
    if (
      order.orderingMethod !== "website" ||
      !order.browserCommitAuthorizedAt ||
      !order.browserJobId ||
      order.browserPhase !== "submit"
    )
      return;
  } else if (
    order.orderingMethod !== "purchase_order" ||
    !order.purchaseOrderSentAt ||
    !order.providerOutboundId ||
    !order.providerThreadId
  )
    return;
  const organization = await ctx.db.get("organizations", order.organizationId);
  const item = await ctx.db.get("inventoryItems", order.inventoryItemId);
  if (
    !organization ||
    organization.isDemo ||
    !item ||
    item.isDemo ||
    item.demoRunId ||
    item.organizationId !== order.organizationId
  )
    return;
  const identity = merchantIdentity(order, channel);
  if (!identity) return;
  const merchant = await ctx.db
    .query("merchantOrderCounts")
    .withIndex("by_key", (q) => q.eq("key", identity.key))
    .unique();
  if (merchant)
    await ctx.db.patch("merchantOrderCounts", merchant._id, { orders: merchant.orders + 1 });
  else await ctx.db.insert("merchantOrderCounts", { ...identity, orders: 1 });
  const totals = await ctx.db
    .query("merchantOrderTotals")
    .withIndex("by_key", (q) => q.eq("key", "all"))
    .unique();
  if (totals)
    await ctx.db.patch("merchantOrderTotals", totals._id, {
      totalOrders: totals.totalOrders + 1,
      merchantCount: totals.merchantCount + (merchant ? 0 : 1),
    });
  else await ctx.db.insert("merchantOrderTotals", { key: "all", totalOrders: 1, merchantCount: 1 });
  await ctx.db.patch("companyOrders", orderId, { merchantMetricKey: identity.key });
}

// Public landing-page proof only: no orders, tenants, emails or purchase amounts.
export const summary = query({
  args: {},
  returns: v.object({
    totalOrders: v.number(),
    merchantCount: v.number(),
    merchants: v.array(v.object({ name: v.string(), domain: v.string(), orders: v.number() })),
  }),
  handler: async (ctx) => {
    const totals = await ctx.db
      .query("merchantOrderTotals")
      .withIndex("by_key", (q) => q.eq("key", "all"))
      .unique();
    const merchants = await ctx.db
      .query("merchantOrderCounts")
      .withIndex("by_orders")
      .order("desc")
      .take(20);
    return {
      totalOrders: totals?.totalOrders ?? 0,
      merchantCount: totals?.merchantCount ?? 0,
      merchants: merchants.map(({ name, domain, orders }) => ({ name, domain, orders })),
    };
  },
});
