import schema from "./schema";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, env, internalQuery, internalAction } from "./_generated/server";
import { internalMutation } from "./audited";
import { ownedCompany } from "./onboarding";

export const context = internalQuery({
  args: {},
  returns: v.object({
    organizationId: v.id("organizations"),
    name: v.string(),
    podId: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", organization._id).eq("provider", "agentmail"),
      )
      .unique();
    return {
      organizationId: organization._id,
      name: organization.name,
      podId: organization.mailPodId ?? null,
      email: inbox?.email ?? null,
    };
  },
});

export const storePod = internalMutation({
  args: { organizationId: v.id("organizations"), podId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    if (organization._id !== args.organizationId)
      throw new ConvexError("Company changed. Try again.");
    if (organization.mailPodId && organization.mailPodId !== args.podId)
      throw new ConvexError("Company inbox setup needs review.");
    await ctx.db.patch("organizations", organization._id, { mailPodId: args.podId });
    return null;
  },
});

export const storeInbox = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    podId: v.string(),
    inboxId: v.string(),
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    if (organization._id !== args.organizationId || organization.mailPodId !== args.podId)
      throw new ConvexError("Company changed. Try again.");
    const prior = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_inbox_id", (q) => q.eq("inboxId", args.inboxId))
      .unique();
    if (prior && prior.organizationId !== organization._id)
      throw new ConvexError("This inbox belongs to another company.");
    const existing = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", organization._id).eq("provider", "agentmail"),
      )
      .unique();
    if (existing && existing.inboxId !== args.inboxId)
      throw new ConvexError("Your company already has a different purchasing inbox.");
    if (!existing)
      await ctx.db.insert("purchasingInboxes", {
        ...args,
        provider: "agentmail",
        selectedAt: Date.now(),
      });
    return null;
  },
});

function field(value: unknown, key: string) {
  const result =
    value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  if (typeof result !== "string" || !result.trim()) throw new Error("Invalid inbox response.");
  return result;
}

// The installed component has no Pod API. These two calls use AgentMail's documented
// REST endpoints; normal mail delivery still uses the existing component.
async function createResource(path: string, body: Record<string, string>): Promise<unknown> {
  if (!env.AGENTMAIL_API_KEY)
    throw new ConvexError("Your workspace is saved. Purchasing email is not configured yet.");
  const base = (env.AGENTMAIL_BASE_URL ?? "https://api.agentmail.to/v0").replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AGENTMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Inbox provider returned ${response.status}.`);
  return await response.json();
}

export const provision = action({
  args: {},
  returns: v.object({ email: v.string() }),
  handler: async (ctx): Promise<{ email: string }> => {
    const company = await ctx.runQuery(internal.companyMail.context, {});
    if (company.email) return { email: company.email };
    try {
      const clientId = `buyer-${company.organizationId}`;
      let podId = company.podId;
      if (!podId) {
        const pod = await createResource("/pods", { client_id: clientId, name: company.name });
        podId = field(pod, "pod_id");
        await ctx.runMutation(internal.companyMail.storePod, {
          organizationId: company.organizationId,
          podId,
        });
      }
      const inbox = await createResource(`/pods/${encodeURIComponent(podId)}/inboxes`, {
        client_id: `${clientId}-purchasing-v1`,
        display_name: `${company.name} Purchasing`,
      });
      if (field(inbox, "pod_id") !== podId) throw new Error("Inbox is in the wrong Pod.");
      const inboxId = field(inbox, "inbox_id");
      // AgentMail identifies inboxes by their email address.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inboxId)) throw new Error("Invalid inbox address.");
      await ctx.runMutation(internal.companyMail.storeInbox, {
        organizationId: company.organizationId,
        podId,
        inboxId,
        email: inboxId,
      });
      return { email: inboxId };
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      throw new ConvexError(
        "Your company and item are saved. We couldn't finish your purchasing inbox. Try again.",
      );
    }
  },
});

async function readInbox(path: string): Promise<unknown> {
  if (!env.AGENTMAIL_API_KEY) throw new ConvexError("Purchasing email is not configured.");
  const base = (env.AGENTMAIL_BASE_URL ?? "https://api.agentmail.to/v0").replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${env.AGENTMAIL_API_KEY}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new ConvexError("Could not read the purchasing inbox. Try again.");
  return await response.json();
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
export const messages = action({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      from: v.string(),
      subject: v.string(),
      preview: v.string(),
      timestamp: v.string(),
    }),
  ),
  handler: async (
    ctx,
  ): Promise<
    { id: string; from: string; subject: string; preview: string; timestamp: string }[]
  > => {
    const company = await ctx.runQuery(internal.companyMail.context, {});
    if (!company.email) return [];
    const result = record(
      await readInbox(`/inboxes/${encodeURIComponent(company.email)}/messages?limit=30`),
    );
    const messages = Array.isArray(result.messages) ? result.messages : [];
    return messages
      .slice(0, 30)
      .map((value) => {
        const m = record(value);
        return {
          id: text(m.message_id),
          from: text(m.from),
          subject: text(m.subject),
          preview: text(m.preview).slice(0, 500),
          timestamp: text(m.timestamp),
        };
      })
      .filter((m) => m.id);
  },
});
export const readMessage = action({
  args: { messageId: v.string() },
  returns: v.object({ from: v.string(), subject: v.string(), text: v.string() }),
  handler: async (ctx, args): Promise<{ from: string; subject: string; text: string }> => {
    const company = await ctx.runQuery(internal.companyMail.context, {});
    if (!company.email || !args.messageId || args.messageId.length > 500)
      throw new ConvexError("Message not found.");
    const m = record(
      await readInbox(
        `/inboxes/${encodeURIComponent(company.email)}/messages/${encodeURIComponent(args.messageId)}`,
      ),
    );
    return {
      from: text(m.from),
      subject: text(m.subject),
      text: (text(m.extracted_text) || text(m.text) || text(m.preview)).slice(0, 30000),
    };
  },
});

// Company-scoped background provisioning uses stable provider client IDs. Only
// internal jobs can select a company; the public action still derives identity.
export const backgroundContext = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    name: v.string(),
    podId: v.optional(v.string()),
    email: v.optional(v.string()),
  }),
  handler: async (ctx, { organizationId }) => {
    const organization = await ctx.db.get("organizations", organizationId);
    if (!organization) throw new Error("Company not found.");
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", organizationId).eq("provider", "agentmail"),
      )
      .unique();
    return { name: organization.name, podId: organization.mailPodId, email: inbox?.email };
  },
});
export const saveBackgroundInbox = internalMutation({
  args: { organizationId: v.id("organizations"), podId: v.string(), inboxId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization || (organization.mailPodId && organization.mailPodId !== args.podId))
      throw new Error("Company inbox changed.");
    const existing = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    const other = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_inbox_id", (q) => q.eq("inboxId", args.inboxId))
      .unique();
    if (
      (existing && existing.inboxId !== args.inboxId) ||
      (other && other.organizationId !== args.organizationId)
    )
      throw new Error("Inbox ownership changed.");
    await ctx.db.patch("organizations", args.organizationId, { mailPodId: args.podId });
    if (!existing)
      await ctx.db.insert("purchasingInboxes", {
        ...args,
        email: args.inboxId,
        provider: "agentmail",
        selectedAt: Date.now(),
      });
    return null;
  },
});
export const provisionForCompany = internalAction({
  args: { organizationId: v.id("organizations") },
  returns: v.object({ email: v.string() }),
  handler: async (ctx, { organizationId }): Promise<{ email: string }> => {
    const company = await ctx.runQuery(internal.companyMail.backgroundContext, { organizationId });
    if (company.email) return { email: company.email };
    const clientId = `buyer-${organizationId}`;
    const podId =
      company.podId ??
      field(await createResource("/pods", { client_id: clientId, name: company.name }), "pod_id");
    const inbox = await createResource(`/pods/${encodeURIComponent(podId)}/inboxes`, {
      client_id: `${clientId}-purchasing-v1`,
      display_name: `${company.name} Purchasing`,
    });
    if (field(inbox, "pod_id") !== podId) throw new Error("Inbox is in the wrong Pod.");
    const inboxId = field(inbox, "inbox_id");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inboxId)) throw new Error("Invalid inbox address.");
    await ctx.runMutation(internal.companyMail.saveBackgroundInbox, {
      organizationId,
      podId,
      inboxId,
    });
    return { email: inboxId };
  },
});
export const prepareOrderInbox = internalAction({
  args: { orderId: v.id("companyOrders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.runQuery(internal.companyMail.orderContext, { orderId });
    if (!order || order.status !== "approved" || order.executionState !== "queued") return null;
    try {
      await ctx.runAction(internal.companyMail.provisionForCompany, {
        organizationId: order.organizationId,
      });
      await ctx.runMutation(internal.companyOrders.executeApproved, { orderId });
    } catch {
      await ctx.runMutation(internal.companyMail.inboxNeedsHelp, { orderId });
    }
    return null;
  },
});
export const orderContext = internalQuery({
  args: { orderId: v.id("companyOrders") },
  returns: v.union(v.null(), schema.doc("companyOrders")),
  handler: async (ctx, { orderId }) => await ctx.db.get("companyOrders", orderId),
});
export const inboxNeedsHelp = internalMutation({
  args: { orderId: v.id("companyOrders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get("companyOrders", orderId);
    if (
      order?.status === "approved" &&
      order.executionState === "queued" &&
      !order.providerOutboundId
    )
      await ctx.db.patch("companyOrders", orderId, {
        executionState: "needs_attention",
        error: "Purchasing inbox setup failed. Retry when email is configured.",
        updatedAt: Date.now(),
      });
    return null;
  },
});
