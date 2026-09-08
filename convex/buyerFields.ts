import { v } from "convex/values";

export const buyerFocus = v.object({
  page: v.union(
    v.literal("dashboard"),
    v.literal("inventory"),
    v.literal("buys"),
    v.literal("settings"),
    v.literal("audit"),
  ),
  item: v.optional(v.string()),
  buy: v.optional(v.string()),
});
export const buyerCredit = v.union(
  v.literal("openai"),
  v.literal("firecrawl"),
  v.literal("agentmail"),
);
export const buyerMessage = v.object({
  id: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant")),
  text: v.string(),
  createdAt: v.number(),
});
