import { ConvexError, v } from "convex/values";
import {
  action,
  query,
  internalQuery,
  internalMutation,
  internalAction,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { ownedCompany } from "./onboarding";
import { mailRequest, segment, MailProviderError } from "./mailProvider";
import { record, string } from "./mailContent";
import { domainRecord } from "./mailFields";
import { activeInbox, findInbox } from "./mailIdentity";
import { limits } from "./rateLimits";
export function normalizeDomain(input: string) {
  const domain = input.trim().toLowerCase().replace(/\.$/, "");
  if (
    domain.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ||
    /(^|\.)(agentmail\.to|buyhard\.app)$/.test(domain)
  )
    throw new ConvexError("Enter your company’s email subdomain, such as purchasing.acme.com.");
  return domain;
}
export function verifiedDomain(status: unknown) {
  return string(status).toLowerCase() === "verified";
}
export const current = query({
  args: {},
  returns: v.union(schema.doc("mailDomains"), v.null()),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    return ctx.db
      .query("mailDomains")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .unique();
  },
});
export const get = internalQuery({
  args: { id: v.id("mailDomains") },
  returns: v.union(schema.doc("mailDomains"), v.null()),
  handler: (ctx, { id }) => ctx.db.get("mailDomains", id),
});
export const reserve = internalMutation({
  args: { domain: v.string(), username: v.string() },
  returns: v.id("mailDomains"),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    await limits.limit(ctx, "mailDomain", { key: organization._id, throws: true });
    const domain = normalizeDomain(args.domain),
      username = args.username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(username))
      throw new ConvexError("Use letters, numbers, dots or hyphens for the address name.");
    const own = await ctx.db
      .query("mailDomains")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .unique();
    if (own) {
      if (own.domain !== domain || own.username !== username)
        throw new ConvexError(
          "Finish your existing domain setup first. Contact support to change it.",
        );
      return own._id;
    }
    const other = await ctx.db
      .query("mailDomains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();
    if (other)
      throw new ConvexError("This domain already has a setup in progress. Contact support.");
    return ctx.db.insert("mailDomains", {
      organizationId: organization._id,
      domain,
      username,
      status: "pending",
      records: [],
      updatedAt: Date.now(),
    });
  },
});
export const save = internalMutation({
  args: {
    id: v.id("mailDomains"),
    podId: v.string(),
    providerId: v.string(),
    status: v.string(),
    records: v.array(domainRecord),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...fields }) => {
    const row = await ctx.db.get("mailDomains", id);
    if (!row || (row.podId && row.podId !== fields.podId)) throw new Error("Domain setup changed.");
    const org = await ctx.db.get("organizations", row.organizationId);
    if (!org || (org.mailPodId && org.mailPodId !== fields.podId))
      throw new Error("Company space changed.");
    await ctx.db.patch("organizations", org._id, { mailPodId: fields.podId });
    await ctx.db.patch("mailDomains", id, { ...fields, updatedAt: Date.now() });
    return null;
  },
});
export const activate = internalMutation({
  args: { id: v.id("mailDomains"), inboxId: v.string(), podId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("mailDomains", args.id);
    if (
      !row ||
      !verifiedDomain(row.status) ||
      row.podId !== args.podId ||
      args.inboxId !== `${row.username}@${row.domain}`
    )
      throw new Error("Email identity is not verified.");
    if (row.inboxId) {
      if (row.inboxId !== args.inboxId) throw new Error("Inbox changed.");
      return null;
    }
    const other = await findInbox(ctx, args.inboxId);
    if (other && other.organizationId !== row.organizationId)
      throw new Error("Inbox belongs to another company.");
    const current = await activeInbox(ctx, row.organizationId);
    if (current && current.inboxId !== args.inboxId) {
      await ctx.db.insert("mailInboxHistory", {
        organizationId: current.organizationId,
        inboxId: current.inboxId,
        email: current.email,
        podId: current.podId,
        selectedAt: current.selectedAt,
      });
      await ctx.db.patch("purchasingInboxes", current._id, {
        inboxId: args.inboxId,
        email: args.inboxId,
        podId: args.podId,
        selectedAt: Date.now(),
      });
    } else if (!current) {
      await ctx.db.insert("purchasingInboxes", {
        organizationId: row.organizationId,
        provider: "agentmail",
        inboxId: args.inboxId,
        email: args.inboxId,
        podId: args.podId,
        selectedAt: Date.now(),
      });
    }
    await ctx.db.patch("mailDomains", row._id, { inboxId: args.inboxId, updatedAt: Date.now() });
    return null;
  },
});
async function sync(ctx: ActionCtx, row: Doc<"mailDomains">) {
  const org = await ctx.runQuery(internal.companyMail.backgroundContext, {
    organizationId: row.organizationId,
  });
  const podId =
    row.podId ??
    org.podId ??
    string(
      (
        await mailRequest("/pods", {
          method: "POST",
          body: { client_id: `buyer-${row.organizationId}`, name: org.name },
        })
      ).pod_id,
    );
  if (!podId) throw new Error("Email space could not be created.");
  const path = `/pods/${segment(podId)}/domains`;
  let remote: Record<string, unknown>;
  try {
    remote = await mailRequest(`${path}/${segment(row.providerId ?? row.domain)}`);
  } catch (error) {
    if (!(error instanceof MailProviderError) || error.status !== 404) throw error;
    remote = await mailRequest(path, { method: "POST", body: { domain: row.domain } });
  }
  if (
    string(remote.domain).toLowerCase() !== row.domain ||
    remote.pod_id !== podId ||
    !string(remote.domain_id)
  )
    throw new Error("Domain ownership could not be confirmed.");
  const providerId = string(remote.domain_id);
  if (!verifiedDomain(remote.status)) {
    await mailRequest(`${path}/${segment(providerId)}/verify`, { method: "POST" });
    remote = await mailRequest(`${path}/${segment(providerId)}`);
    if (remote.pod_id !== podId || string(remote.domain).toLowerCase() !== row.domain)
      throw new Error("Domain ownership changed.");
  }
  const records = (Array.isArray(remote.records) ? remote.records : [])
    .slice(0, 30)
    .map((value) => {
      const r = record(value);
      return {
        type: string(r.type),
        name: string(r.name),
        value: string(r.value),
        status: string(r.status),
        ...(typeof r.priority === "number" ? { priority: r.priority } : {}),
      };
    });
  await ctx.runMutation(internal.mailDomains.save, {
    id: row._id,
    podId,
    providerId,
    status: string(remote.status).toLowerCase(),
    records,
    reason: string(remote.reason) || undefined,
  });
  if (verifiedDomain(remote.status) && !row.inboxId) {
    const inbox = await mailRequest(`/pods/${segment(podId)}/inboxes`, {
      method: "POST",
      body: {
        username: row.username,
        domain: row.domain,
        display_name: `${org.name} Purchasing`,
        client_id: `buyer-domain-${row._id}`,
      },
    });
    if (inbox.pod_id !== podId) throw new Error("Inbox ownership could not be confirmed.");
    await ctx.runMutation(internal.mailDomains.activate, {
      id: row._id,
      inboxId: string(inbox.inbox_id),
      podId,
    });
  }
}
export const poll = internalAction({
  args: { id: v.id("mailDomains"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(internal.mailDomains.get, { id: args.id });
    if (!row || row.inboxId) return null;
    try {
      await sync(ctx, row);
    } catch {
      /* DNS and provider outages are retried; manual checking remains available. */
    }
    if (args.attempt < 12)
      await ctx.scheduler.runAfter(5 * 60_000, internal.mailDomains.poll, {
        ...args,
        attempt: args.attempt + 1,
      });
    return null;
  },
});
export const connect = action({
  args: { domain: v.string(), username: v.string(), ownsDomain: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.ownsDomain) throw new ConvexError("Confirm you can manage DNS for this domain.");
    const id: Id<"mailDomains"> = await ctx.runMutation(internal.mailDomains.reserve, {
      domain: args.domain,
      username: args.username,
    });
    // Schedule first, so a timeout while registering does not strand setup.
    await ctx.scheduler.runAfter(5 * 60_000, internal.mailDomains.poll, { id, attempt: 0 });
    const row = await ctx.runQuery(internal.mailDomains.get, { id });
    if (row) await sync(ctx, row);
    return null;
  },
});
export const check = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.runQuery(internal.mailDomains.owned, {});
    if (!row) throw new ConvexError("Add your domain first.");
    await ctx.runMutation(internal.mailDomains.reserve, {
      domain: row.domain,
      username: row.username,
    });
    await sync(ctx, row);
    return null;
  },
});
export const owned = internalQuery({
  args: {},
  returns: v.union(schema.doc("mailDomains"), v.null()),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    return ctx.db
      .query("mailDomains")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .unique();
  },
});
export const setupLink = action({
  args: {},
  returns: v.object({
    url: v.union(v.string(), v.null()),
    provider: v.string(),
    conflict: v.string(),
  }),
  handler: async (ctx) => {
    const row = await ctx.runQuery(internal.mailDomains.owned, {});
    if (!row?.providerId || !row.podId) throw new ConvexError("Check domain setup first.");
    const remote = await mailRequest(
      `/pods/${segment(row.podId)}/domains/${segment(row.providerId)}`,
    );
    if (remote.pod_id !== row.podId || remote.domain !== row.domain)
      throw new ConvexError("Domain ownership could not be confirmed.");
    const link = await mailRequest(`/domains/${segment(row.providerId)}/setup-link`);
    const conflict = string(link.conflicting_provider);
    // Never offer a link that would replace an existing business mail provider.
    const url = string(link.url);
    return {
      url: link.supported === true && !conflict && url.startsWith("https://") ? url : null,
      provider: string(link.provider_name),
      conflict,
    };
  },
});
