import { findInbox } from "./mailIdentity";
import { ConvexError, v } from "convex/values";
import { action, query, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";
import { ownedCompany } from "./onboarding";
import type { Id, Doc } from "./_generated/dataModel";
import { companyInbox, mailRequest, segment } from "./mailProvider";
import { mailRisk, string, strings, address, record } from "./mailContent";
import { limits } from "./rateLimits";
const footer =
  "\n\nThis is a request for information, not a purchase order or authorization to change an existing order.";
async function contextKey(ctx: QueryCtx, organizationId: Id<"organizations">, threadId: string) {
  const order = await ctx.db
    .query("companyOrders")
    .withIndex("by_providerThreadId", (q) => q.eq("providerThreadId", threadId))
    .unique();
  const quote = await ctx.db
    .query("companyQuoteRequests")
    .withIndex("by_providerThreadId", (q) => q.eq("providerThreadId", threadId))
    .unique();
  const buy = quote ? await ctx.db.get("companyBuys", quote.buyId) : null;
  if (
    (order && order.organizationId !== organizationId) ||
    (quote && quote.organizationId !== organizationId)
  )
    throw new ConvexError("Conversation not found.");
  const latestMail = await ctx.db
    .query("mailReceipts")
    .withIndex("by_company_thread", (q) =>
      q.eq("organizationId", organizationId).eq("threadId", threadId),
    )
    .order("desc")
    .first();
  return JSON.stringify({
    receipt: latestMail?.messageId ?? null,
    order: order ? [order._id, order.status, order.updatedAt] : null,
    buy: buy ? [buy._id, buy.planVersion, buy.closed] : null,
  });
}
export const list = query({
  args: {},
  returns: v.array(schema.doc("mailDrafts")),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    return ctx.db
      .query("mailDrafts")
      .withIndex("by_company", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(50);
  },
});
export const reserve = internalMutation({
  args: {
    inboxId: v.optional(v.string()),
    messageId: v.string(),
    threadId: v.string(),
    to: v.string(),
    text: v.string(),
    lastMessageId: v.string(),
    draftId: v.optional(v.id("mailDrafts")),
    version: v.optional(v.number()),
  },
  returns: schema.doc("mailDrafts"),
  handler: async (ctx, args): Promise<Doc<"mailDrafts">> => {
    const { organization } = await ownedCompany(ctx);
    await limits.limit(ctx, "mailDraft", { key: organization._id, throws: true });
    const inbox = args.inboxId
      ? await findInbox(ctx, args.inboxId)
      : await ctx.db
          .query("purchasingInboxes")
          .withIndex("by_organization_and_provider", (q) =>
            q.eq("organizationId", organization._id).eq("provider", "agentmail"),
          )
          .unique();
    if (!inbox || inbox.organizationId !== organization._id)
      throw new ConvexError("Inbox missing.");
    if (!args.text.trim() || args.text.length > 8000)
      throw new ConvexError("Write a reply under 8,000 characters.");
    const key = await contextKey(ctx, organization._id, args.threadId);
    let id = args.draftId;
    if (id) {
      const d = await ctx.db.get("mailDrafts", id);
      if (
        d?.organizationId !== organization._id ||
        d.messageId !== args.messageId ||
        d.inboxId !== inbox.inboxId ||
        d.version !== args.version ||
        !["ready", "failed"].includes(d.state)
      )
        throw new ConvexError("Draft changed. Reload before editing.");
      await ctx.db.patch("mailDrafts", id, {
        text: args.text.trim() + footer,
        to: args.to,
        state: "saving",
        version: d.version + 1,
        contextKey: key,
        lastMessageId: args.lastMessageId,
        error: undefined,
        updatedAt: Date.now(),
      });
    } else
      id = await ctx.db.insert("mailDrafts", {
        organizationId: organization._id,
        inboxId: inbox.inboxId,
        messageId: args.messageId,
        threadId: args.threadId,
        to: args.to,
        text: args.text.trim() + footer,
        state: "saving",
        version: 1,
        contextKey: key,
        lastMessageId: args.lastMessageId,
        updatedAt: Date.now(),
      });
    return (await ctx.db.get("mailDrafts", id))!;
  },
});
export const saved = internalMutation({
  args: {
    draftId: v.id("mailDrafts"),
    version: v.number(),
    providerDraftId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const d = await ctx.db.get("mailDrafts", args.draftId);
    if (!d || d.version !== args.version || d.state !== "saving") throw new Error("Draft changed.");
    await ctx.db.patch("mailDrafts", d._id, {
      state: args.error ? "failed" : "ready",
      providerDraftId: args.providerDraftId ?? d.providerDraftId,
      error: args.error,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const save = action({
  args: {
    inboxId: v.optional(v.string()),
    messageId: v.string(),
    text: v.string(),
    draftId: v.optional(v.id("mailDrafts")),
    version: v.optional(v.number()),
  },
  returns: v.id("mailDrafts"),
  handler: async (ctx, args): Promise<Id<"mailDrafts">> => {
    const company = await companyInbox(ctx, args.inboxId);
    const message = await mailRequest(
      `/inboxes/${segment(company.email)}/messages/${segment(args.messageId)}`,
      { key: company.key },
    );
    if (
      message.inbox_id !== company.email ||
      message.message_id !== args.messageId ||
      mailRisk(message)
    )
      throw new ConvexError("This message needs sender verification before replying.");
    const to = address(message.from);
    if (
      !to ||
      to === address(company.email) ||
      strings(message.reply_to).some((r) => address(r) !== to)
    )
      throw new ConvexError(
        "Reply address needs checking. Choose a verified incoming supplier message.",
      );
    const thread = await mailRequest(
      `/inboxes/${segment(company.email)}/threads/${segment(string(message.thread_id))}?limit=1`,
      { key: company.key },
    );
    const draft = await ctx.runMutation(internal.mailDrafts.reserve, {
      ...args,
      inboxId: company.email,
      to,
      threadId: string(message.thread_id),
      lastMessageId: string(thread.last_message_id),
    });
    try {
      const result = await mailRequest(
        `/inboxes/${segment(company.email)}/drafts${draft.providerDraftId ? `/${segment(draft.providerDraftId)}` : ""}`,
        {
          key: company.key,
          method: draft.providerDraftId ? "PATCH" : "POST",
          body: draft.providerDraftId
            ? { text: draft.text, to: [to], cc: [], bcc: [], send_at: null }
            : {
                client_id: `buyer-${draft._id}`,
                in_reply_to: draft.messageId,
                text: draft.text,
                to: [to],
              },
        },
      );
      const providerDraftId = string(result.draft_id) || draft.providerDraftId;
      if (!providerDraftId) throw new Error("No draft receipt.");
      await mailRequest(`/inboxes/${segment(company.email)}/drafts/${segment(providerDraftId)}`, {
        key: company.key,
        method: "PATCH",
        body: { text: draft.text, to: [to], cc: [], bcc: [], html: null, send_at: null },
      });
      await ctx.runMutation(internal.mailDrafts.saved, {
        draftId: draft._id,
        version: draft.version,
        providerDraftId,
      });
    } catch {
      await ctx.runMutation(internal.mailDrafts.saved, {
        draftId: draft._id,
        version: draft.version,
        error: "Draft was not confirmed saved. You can retry saving; no email was sent.",
      });
    }
    return draft._id;
  },
});
export const read = internalQuery({
  args: { draftId: v.id("mailDrafts") },
  returns: schema.doc("mailDrafts"),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx),
      d = await ctx.db.get("mailDrafts", args.draftId);
    if (d?.organizationId !== organization._id) throw new ConvexError("Draft not found.");
    return d;
  },
});
export const claim = internalMutation({
  args: { draftId: v.id("mailDrafts"), version: v.number() },
  returns: schema.doc("mailDrafts"),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx),
      d = await ctx.db.get("mailDrafts", args.draftId);
    if (
      d?.organizationId !== organization._id ||
      d.version !== args.version ||
      d.state !== "ready" ||
      !d.providerDraftId
    )
      throw new ConvexError("Draft is not ready to send. Reload and review it.");
    if (d.contextKey !== (await contextKey(ctx, organization._id, d.threadId)))
      throw new ConvexError("The purchase changed. Save and review a fresh draft.");
    await ctx.db.patch("mailDrafts", d._id, { state: "sending", updatedAt: Date.now() });
    return d;
  },
});
export const complete = internalMutation({
  args: {
    draftId: v.id("mailDrafts"),
    messageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const d = await ctx.db.get("mailDrafts", args.draftId);
    if (!d || !["sending", "unknown"].includes(d.state)) return null;
    await ctx.db.patch("mailDrafts", d._id, {
      state: args.messageId ? "sent" : "unknown",
      providerMessageId: args.messageId,
      error: args.error,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const send = action({
  args: { draftId: v.id("mailDrafts"), version: v.number(), approvedText: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const d = await ctx.runQuery(internal.mailDrafts.read, { draftId: args.draftId });
    const company = await companyInbox(ctx, d.inboxId);
    if (
      d.state !== "ready" ||
      d.version !== args.version ||
      d.text !== args.approvedText ||
      !d.providerDraftId
    )
      throw new ConvexError("Review the latest saved draft before sending.");
    const remote = await mailRequest(
      `/inboxes/${segment(company.email)}/drafts/${segment(d.providerDraftId)}`,
      { key: company.key },
    );
    if (
      remote.text !== d.text ||
      strings(remote.to).length !== 1 ||
      address(strings(remote.to)[0]) !== d.to ||
      strings(remote.cc).length ||
      strings(remote.bcc).length ||
      remote.send_at ||
      remote.html ||
      (Array.isArray(remote.attachments) && remote.attachments.length)
    )
      throw new ConvexError("The provider draft changed. Save and review it again.");
    const thread = await mailRequest(
      `/inboxes/${segment(company.email)}/threads/${segment(d.threadId)}?limit=1`,
      { key: company.key },
    );
    if (thread.last_message_id !== d.lastMessageId)
      throw new ConvexError("A new email arrived. Read the conversation and save a fresh draft.");
    await ctx.runMutation(internal.mailDrafts.claim, { draftId: d._id, version: d.version });
    try {
      const receipt = await mailRequest(
        `/inboxes/${segment(company.email)}/drafts/${segment(d.providerDraftId)}/send`,
        {
          key: company.key,
          method: "POST",
          body: { add_labels: [`buyer-draft-${d._id}`] },
          idempotencyKey: `buyer-draft-${d._id}-${d.version}`,
        },
      );
      if (!string(receipt.message_id)) throw new Error("No send receipt.");
      await ctx.runMutation(internal.mailDrafts.complete, {
        draftId: d._id,
        messageId: string(receipt.message_id),
      });
    } catch {
      await ctx.runMutation(internal.mailDrafts.complete, {
        draftId: d._id,
        error:
          "Sending outcome is unknown. Check the conversation before taking another action. This draft will not be sent again automatically.",
      });
    }
    return null;
  },
});

export const checkSend = action({
  args: { draftId: v.id("mailDrafts") },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const d = await ctx.runQuery(internal.mailDrafts.read, args);
    const company = await companyInbox(ctx, d.inboxId);
    if (d.state === "sent") return true;
    if (!["sending", "unknown"].includes(d.state)) return false;
    const query = new URLSearchParams({ labels: `buyer-draft-${d._id}`, limit: "10" });
    const result = await mailRequest(`/inboxes/${segment(company.email)}/messages?${query}`, {
      key: company.key,
    });
    for (const candidate of Array.isArray(result.messages) ? result.messages : []) {
      const item = record(candidate);
      if (!string(item.message_id)) continue;
      const m = await mailRequest(
        `/inboxes/${segment(company.email)}/messages/${segment(string(item.message_id))}`,
        { key: company.key },
      );
      if (
        m.inbox_id === d.inboxId &&
        m.thread_id === d.threadId &&
        address(m.from) === address(d.inboxId) &&
        strings(m.to).length === 1 &&
        address(strings(m.to)[0]) === d.to &&
        m.text === d.text &&
        strings(m.labels).includes(`buyer-draft-${d._id}`)
      ) {
        await ctx.runMutation(internal.mailDrafts.complete, {
          draftId: d._id,
          messageId: string(m.message_id),
        });
        return true;
      }
    }
    return false; // Absence is not proof of failure; never resend automatically.
  },
});
