import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";

function formatDestination(address: {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}) {
  return [
    address.line1,
    address.line2,
    `${address.city}, ${address.region} ${address.postalCode}`,
    address.countryCode,
  ]
    .filter(Boolean)
    .join(", ");
}

export const prepare = mutation({
  args: { procurementId: v.id("procurements") },
  returns: v.array(v.id("rfqs")),
  handler: async (ctx, args) => {
    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null || procurement.status !== "sourcing") {
      throw new Error("Procurement is not ready for RFQ preparation.");
    }
    const run = await ctx.db.get("demoRuns", procurement.demoRunId);
    if (run === null || !run.isDemo) {
      throw new Error("Controlled RFQ preparation is limited to the authorized demo run.");
    }
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", procurement.demoRunId))
      .take(100);
    if (
      suppliers.filter((supplier) => supplier.relationship === "discovered" && !supplier.isDemo)
        .length < 2
    ) {
      throw new Error(
        "At least two real suppliers must be discovered before preparing controlled RFQs.",
      );
    }
    const identities = await ctx.db
      .query("demoSupplierIdentities")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", procurement.demoRunId))
      .take(10);
    if (identities.length !== 3) {
      throw new Error("The three controlled supplier identities are required.");
    }
    const existing = await ctx.db
      .query("rfqs")
      .withIndex("by_procurement", (q) => q.eq("procurementId", procurement._id))
      .take(10);
    if (existing.length > 0) return existing.map((rfq) => rfq._id);
    const organization = await ctx.db.get("organizations", procurement.organizationId);
    if (organization === null) throw new Error("Organization not found.");
    const now = Date.now();
    const ids = [];
    for (const [index, identity] of identities.entries()) {
      const rfqId = await ctx.db.insert("rfqs", {
        procurementId: procurement._id,
        supplierId: identity.supplierId,
        demoRunId: procurement.demoRunId,
        status: "draft",
        requestedQuantity: procurement.quantityRequired,
        requiredBy: procurement.requiredBy,
        destination: formatDestination(organization.address),
        recipientEmail: identity.email,
        isControlledRecipient: true,
        automaticFollowUpCount: 0,
        createdAt: now + index,
      });
      ids.push(rfqId);
      const aiRunId = await ctx.db.insert("aiRuns", {
        organizationId: procurement.organizationId,
        procurementId: procurement._id,
        rfqId,
        intent:
          "Write the subject and body only. Ask for availability, unit price, freight, earliest ship date, estimated arrival, MOQ, pack size, payment terms, and quote expiration. Do not change any supplied field.",
        task: "rfq_wording",
        transport: "openai",
        model: "gpt-5.4-mini",
        status: "pending",
        evidenceRefs: [],
        createdAt: now + index,
      });
      await ctx.scheduler.runAfter(0, internal.aiNode.runStructuredTask, { aiRunId });
    }
    return ids;
  },
});

export const listForProcurement = query({
  args: { procurementId: v.id("procurements") },
  returns: v.array(
    v.object({
      rfqId: v.id("rfqs"),
      supplierName: v.string(),
      recipientEmail: v.string(),
      isControlledRecipient: v.boolean(),
      status: v.union(
        v.literal("draft"),
        v.literal("ready"),
        v.literal("queued"),
        v.literal("sent"),
        v.literal("responded"),
        v.literal("closed"),
        v.literal("failed"),
      ),
      requestedQuantity: v.number(),
      requiredBy: v.string(),
      destination: v.string(),
      subject: v.union(v.string(), v.null()),
      body: v.union(v.string(), v.null()),
      recipientApprovedAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_procurement", (q) => q.eq("procurementId", args.procurementId))
      .take(20);
    const rows = [];
    for (const rfq of rfqs) {
      const supplier = await ctx.db.get("suppliers", rfq.supplierId);
      if (supplier === null) continue;
      rows.push({
        rfqId: rfq._id,
        supplierName: supplier.name,
        recipientEmail: rfq.recipientEmail ?? supplier.email ?? "",
        isControlledRecipient: rfq.isControlledRecipient ?? false,
        status: rfq.status,
        requestedQuantity: rfq.requestedQuantity,
        requiredBy: rfq.requiredBy,
        destination: rfq.destination,
        subject: rfq.subject ?? null,
        body: rfq.body ?? null,
        recipientApprovedAt: rfq.recipientApprovedAt ?? null,
      });
    }
    return rows;
  },
});
