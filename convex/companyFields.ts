import { v } from "convex/values";

export const orderTerms = {
  quantity: v.number(),
  unitPriceCents: v.number(),
  freightCents: v.number(),
  taxCents: v.number(),
  currency: v.string(),
  requiredBy: v.string(),
  notes: v.string(),
};

export const companyOrderStatus = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("placed"),
  v.literal("part_received"),
  v.literal("received"),
  v.literal("cancelled"),
  v.literal("send_failed"),
);
export const alertStatus = v.union(
  v.literal("pending"),
  v.literal("sending"),
  v.literal("delivered"),
  v.literal("queued"),
  v.literal("failed"),
  v.literal("unknown"),
  v.literal("skipped"),
);
export const alertKind = v.union(
  v.literal("verification"),
  v.literal("low_stock"),
  v.literal("order_update"),
);
