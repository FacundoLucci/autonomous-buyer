import { ConvexError, v } from "convex/values";
import { action, internalQuery, internalMutation, env } from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";
import { ownedCompany } from "./onboarding";
import { mailRequest, segment } from "./mailProvider";
import { string } from "./mailContent";
import { seal } from "./salesCrypto";
export const credentials = internalQuery({
  args: { organizationId: v.id("organizations"), inboxId: v.optional(v.string()) },
  returns: v.union(schema.doc("mailCredentials"), v.null()),
  handler: async (ctx, args) => {
    const inboxId =
      args.inboxId ??
      (
        await ctx.db
          .query("purchasingInboxes")
          .withIndex("by_organization_and_provider", (q) =>
            q.eq("organizationId", args.organizationId).eq("provider", "agentmail"),
          )
          .unique()
      )?.inboxId;
    if (!inboxId) return null;
    return ctx.db
      .query("mailCredentials")
      .withIndex("by_company_inbox", (q) =>
        q.eq("organizationId", args.organizationId).eq("inboxId", inboxId),
      )
      .unique();
  },
});
export const reserveAccess = internalMutation({
  args: {},
  returns: v.union(v.id("mailCredentials"), v.null()),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", organization._id).eq("provider", "agentmail"),
      )
      .unique();
    const existing = await ctx.db
      .query("mailCredentials")
      .withIndex("by_company_inbox", (q) =>
        q.eq("organizationId", organization._id).eq("inboxId", inbox?.inboxId ?? ""),
      )
      .unique();
    if (existing?.state === "ready") return null;
    if (existing?.state === "creating")
      throw new ConvexError("Access setup needs checking before retrying.");
    if (!inbox) throw new ConvexError("Connect your purchasing inbox first.");
    if (existing) {
      await ctx.db.patch("mailCredentials", existing._id, {
        state: "creating",
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return ctx.db.insert("mailCredentials", {
      organizationId: organization._id,
      inboxId: inbox.inboxId,
      state: "creating",
      updatedAt: Date.now(),
    });
  },
});
export const saveAccess = internalMutation({
  args: { id: v.id("mailCredentials"), encryptedKey: v.string(), keyId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("mailCredentials", args.id);
    if (!row || row.state !== "creating") throw new Error("Access setup changed.");
    await ctx.db.patch("mailCredentials", args.id, {
      encryptedKey: args.encryptedKey,
      keyId: args.keyId,
      state: "ready",
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const enableRestrictedAccess = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!env.AGENTMAIL_CREDENTIAL_KEY)
      throw new ConvexError(
        "The workspace administrator must configure encrypted email access first.",
      );
    const company = await ctx.runQuery(internal.companyMail.context, {});
    if (!company.email) throw new ConvexError("Connect your purchasing inbox first.");
    const id = await ctx.runMutation(internal.mailSettings.reserveAccess, {});
    if (!id) return null;
    const result = await mailRequest(`/inboxes/${segment(company.email)}/api-keys`, {
      method: "POST",
      body: {
        name: "BUY HARD inbox access",
        permissions: {
          inbox_read: true,
          message_read: true,
          draft_read: true,
          draft_create: true,
          draft_update: true,
          draft_send: true,
          label_unauthenticated_read: true,
        },
      },
    });
    if (!string(result.api_key) || !string(result.api_key_id))
      throw new ConvexError("Email access setup needs checking.");
    const encryptedKey = await seal({ apiKey: result.api_key }, env.AGENTMAIL_CREDENTIAL_KEY);
    await ctx.runMutation(internal.mailSettings.saveAccess, {
      id,
      encryptedKey,
      keyId: string(result.api_key_id),
    });
    return null;
  },
});
export const status = action({
  args: {},
  returns: v.object({
    email: v.union(v.string(), v.null()),
    domain: v.string(),
    domainStatus: v.string(),
    restricted: v.boolean(),
    canRestrict: v.boolean(),
    accessStatus: v.string(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    email: string | null;
    domain: string;
    domainStatus: string;
    restricted: boolean;
    canRestrict: boolean;
    accessStatus: string;
  }> => {
    const company = await ctx.runQuery(internal.companyMail.context, {});
    const credentials = await ctx.runQuery(internal.mailSettings.credentials, {
      organizationId: company.organizationId,
    });
    const domain = company.email?.split("@")[1] ?? env.AGENTMAIL_DOMAIN ?? "agentmail.to";
    let domainStatus = domain === "agentmail.to" ? "Provider domain" : "Not checked";
    if (domain !== "agentmail.to") {
      try {
        const result = await mailRequest(`/domains/${segment(domain)}`);
        domainStatus = string(result.status) || "Check domain settings";
      } catch {
        domainStatus = "Could not verify domain settings";
      }
    }
    return {
      email: company.email,
      domain,
      domainStatus,
      restricted: credentials?.state === "ready",
      canRestrict: !!env.AGENTMAIL_CREDENTIAL_KEY,
      accessStatus: credentials?.state ?? "service",
    };
  },
});
export async function configuredDomain(): Promise<Record<string, string>> {
  const domain = env.AGENTMAIL_DOMAIN?.trim().toLowerCase();
  if (!domain) return {};
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain))
    throw new Error("Invalid purchasing domain.");
  const result = await mailRequest(`/domains/${segment(domain)}`);
  if (string(result.status).toLowerCase() !== "verified")
    throw new Error("Purchasing domain must be verified before creating inboxes.");
  return { domain };
}
