import { v } from "convex/values";
export const attribution = v.object({
  visitorId: v.string(),
  landingPath: v.string(),
  referrer: v.string(),
  capturedAt: v.number(),
  utm_source: v.optional(v.string()),
  utm_medium: v.optional(v.string()),
  utm_campaign: v.optional(v.string()),
  utm_content: v.optional(v.string()),
  utm_term: v.optional(v.string()),
});
export const stage = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("pilot_started"),
  v.literal("closed"),
);
export const event = v.union(
  v.literal("visit"),
  v.literal("demo_use"),
  v.literal("inquiry"),
  v.literal("booking_confirmed"),
  v.literal("pilot_started"),
);
export const deliveryStatus = v.union(
  v.literal("pending"),
  v.literal("queued"),
  v.literal("delivered"),
  v.literal("unknown"),
  v.literal("cal_managed"),
  v.literal("failed"),
);
