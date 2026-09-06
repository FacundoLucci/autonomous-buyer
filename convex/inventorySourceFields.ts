import { v } from "convex/values";
export const sourceProduct = v.object({
  name: v.string(),
  sku: v.union(v.string(), v.null()),
  supplier: v.union(v.string(), v.null()),
  unit: v.union(v.string(), v.null()),
  packSize: v.union(v.number(), v.null()),
  leadTimeDays: v.union(v.number(), v.null()),
  leadTimeEvidence: v.union(v.string(), v.null()),
  evidence: v.string(),
});
export const sourceState = v.union(
  v.literal("uploading"),
  v.literal("reading"),
  v.literal("ready"),
  v.literal("failed"),
);
