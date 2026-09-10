import { ConvexError, v } from "convex/values";
import schema from "./schema";
import { internal } from "./_generated/api";
import { query, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { mutation, internalMutation } from "./audited";
import { ownedCompany } from "./onboarding";
import { limits } from "./rateLimits";
import type { Id } from "./_generated/dataModel";
import {
  supplierWebsite,
  supplierEvidence,
  emailOrderingEvidence,
  browserOrderingEvidence,
} from "./supplierDirectoryFields";
const job = { supplierId: v.id("companySuppliers"), version: v.number() };
export const list = query({
  args: {},
  returns: v.array(schema.doc("companySuppliers")),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    return ctx.db
      .query("companySuppliers")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .take(200);
  },
});
async function own(ctx: MutationCtx, id: Id<"companySuppliers">) {
  const { organization } = await ownedCompany(ctx);
  const supplier = await ctx.db.get("companySuppliers", id);
  if (!supplier || supplier.organizationId !== organization._id)
    throw new ConvexError("Supplier not found.");
  return supplier;
}
export async function supplierAllowed(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  url?: string,
) {
  if (!url) return true;
  const { domain } = supplierWebsite(url);
  const entry = await ctx.db
    .query("companySuppliers")
    .withIndex("by_organizationId_and_domain", (q) =>
      q.eq("organizationId", organizationId).eq("domain", domain),
    )
    .unique();
  return entry?.approved !== false;
}
async function schedule(ctx: MutationCtx, supplierId: Id<"companySuppliers">, version: number) {
  await ctx.scheduler.runAfter(0, internal.companySupplierAgent.assess, { supplierId, version });
  await ctx.scheduler.runAfter(10 * 60_000, internal.companySuppliers.expire, {
    supplierId,
    version,
  });
}
export const add = mutation({
  args: { url: v.string(), name: v.optional(v.string()), notes: v.optional(v.string()) },
  returns: v.id("companySuppliers"),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const site = supplierWebsite(args.url);
    const existing = await ctx.db
      .query("companySuppliers")
      .withIndex("by_organizationId_and_domain", (q) =>
        q.eq("organizationId", organization._id).eq("domain", site.domain),
      )
      .unique();
    if (existing) return existing._id;
    const entries = await ctx.db
      .query("companySuppliers")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .take(200);
    if (entries.length >= 200) throw new ConvexError("This company already has 200 suppliers.");
    if ((args.name?.length ?? 0) > 150 || (args.notes?.length ?? 0) > 2000)
      throw new ConvexError("Keep supplier names under 150 characters and notes under 2,000.");
    await limits.limit(ctx, "supplierAssessment", { key: organization._id, throws: true });
    const id = await ctx.db.insert("companySuppliers", {
      organizationId: organization._id,
      ...site,
      name: args.name?.trim() || site.domain,
      notes: args.notes?.trim() ?? "",
      approved: true,
      channels: "unknown",
      assessmentState: "pending",
      readiness: "unverified",
      assessmentVersion: 1,
      updatedAt: Date.now(),
    });
    await schedule(ctx, id, 1);
    return id;
  },
});
export const update = mutation({
  args: {
    supplierId: v.id("companySuppliers"),
    approved: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await own(ctx, args.supplierId);
    if ((args.notes?.length ?? 0) > 2000)
      throw new ConvexError("Keep notes under 2,000 characters.");
    await ctx.db.patch("companySuppliers", args.supplierId, {
      ...(args.approved !== undefined ? { approved: args.approved } : {}),
      ...(args.notes !== undefined ? { notes: args.notes.trim() } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const reassess = mutation({
  args: { supplierId: v.id("companySuppliers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const supplier = await own(ctx, args.supplierId);
    await limits.limit(ctx, "supplierAssessment", { key: supplier.organizationId, throws: true });
    const version = supplier.assessmentVersion + 1;
    await ctx.db.patch("companySuppliers", supplier._id, {
      assessmentVersion: version,
      assessmentState: "pending",
      readiness: "unverified",
      channels: "unknown",
      email: undefined,
      evidence: undefined,
      assessmentNotes: undefined,
      checkedAt: undefined,
      updatedAt: Date.now(),
    });
    await schedule(ctx, supplier._id, version);
    return null;
  },
});
export const begin = internalMutation({
  args: job,
  returns: v.union(v.null(), schema.doc("companySuppliers")),
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get("companySuppliers", args.supplierId);
    if (
      !supplier ||
      supplier.assessmentVersion !== args.version ||
      supplier.assessmentState !== "pending"
    )
      return null;
    await ctx.db.patch("companySuppliers", supplier._id, { assessmentState: "analyzing" });
    return supplier;
  },
});
export const context = internalQuery({
  args: job,
  returns: v.union(v.null(), schema.doc("companySuppliers")),
  handler: async (ctx, args) => {
    const s = await ctx.db.get("companySuppliers", args.supplierId);
    return s?.assessmentVersion === args.version ? s : null;
  },
});
export const finish = internalMutation({
  args: {
    ...job,
    browser: v.optional(supplierEvidence),
    emailEvidence: v.optional(supplierEvidence),
    email: v.optional(v.string()),
    note: v.string(),
    failed: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const s = await ctx.db.get("companySuppliers", args.supplierId);
    if (!s || s.assessmentVersion !== args.version || s.assessmentState !== "analyzing")
      return false;
    const same = (e?: { url: string; excerpt: string }) =>
      !!e && e.excerpt.length <= 1500 && supplierWebsite(e.url).domain === s.domain;
    const browser = same(args.browser) && browserOrderingEvidence(args.browser!.excerpt);
    const email =
      same(args.emailEvidence) &&
      !!args.email &&
      emailOrderingEvidence(args.emailEvidence!.excerpt, args.email);
    const channels = browser ? (email ? "both" : "browser") : email ? "email" : "unknown";
    await ctx.db.patch("companySuppliers", s._id, {
      channels,
      assessmentState: args.failed || channels === "unknown" ? "needs_help" : "complete",
      readiness: channels === "unknown" ? "unverified" : "needs_setup",
      assessmentNotes: args.note.slice(0, 2000),
      email: email ? args.email : undefined,
      evidence: [...(browser ? [args.browser!] : []), ...(email ? [args.emailEvidence!] : [])],
      checkedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  },
});
export const expire = internalMutation({
  args: job,
  returns: v.null(),
  handler: async (ctx, args) => {
    const s = await ctx.db.get("companySuppliers", args.supplierId);
    if (
      s?.assessmentVersion === args.version &&
      ["pending", "analyzing"].includes(s.assessmentState)
    )
      await ctx.db.patch("companySuppliers", s._id, {
        assessmentState: "needs_help",
        readiness: "unverified",
        assessmentNotes: "The website check did not finish. Try checking it again.",
        updatedAt: Date.now(),
      });
    return null;
  },
});
