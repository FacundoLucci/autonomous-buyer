import { ConvexError, v } from "convex/values";
import { action, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ownedCompany } from "./onboarding";
import { activeInbox } from "./mailIdentity";
import { internal } from "./_generated/api";
import { mailMessage } from "./mailFields";
import { companyInbox, mailRequest, segment } from "./mailProvider";
import { record, string, strings, attachments, mailBody, mailRisk } from "./mailContent";
export function publicMessage(value: unknown) {
  const m = record(value);
  return {
    id: string(m.message_id),
    threadId: string(m.thread_id),
    from: string(m.from),
    to: strings(m.to),
    subject: string(m.subject),
    text: mailBody(m),
    timestamp: string(m.timestamp),
    risk: mailRisk(m),
    attachments: attachments(m),
  };
}
const threadSummary = v.object({
  id: v.string(),
  subject: v.string(),
  preview: v.string(),
  senders: v.array(v.string()),
  timestamp: v.string(),
  count: v.number(),
});
export const threads = action({
  args: {
    inboxId: v.optional(v.string()),
    search: v.optional(v.string()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({ threads: v.array(threadSummary), next: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const company = await companyInbox(ctx, args.inboxId);
    if ((args.search?.length ?? 0) > 300 || (args.cursor?.length ?? 0) > 4000)
      throw new ConvexError("Search is too long.");
    const query = new URLSearchParams({ limit: "30" });
    if (args.cursor) query.set("page_token", args.cursor);
    if (args.search?.trim()) query.set("q", args.search.trim());
    const result = await mailRequest(
      `/inboxes/${segment(company.email)}/threads${args.search?.trim() ? "/search" : ""}?${query}`,
      { key: company.key },
    );
    return {
      threads: (Array.isArray(result.threads) ? result.threads : []).map((value) => {
        const t = record(value);
        return {
          id: string(t.thread_id),
          subject: string(t.subject),
          preview: string(t.preview).slice(0, 400),
          senders: strings(t.senders),
          timestamp: string(t.timestamp),
          count: typeof t.message_count === "number" ? t.message_count : 0,
        };
      }),
      next: string(result.next_page_token) || null,
    };
  },
});
export const thread = action({
  args: { inboxId: v.optional(v.string()), threadId: v.string(), cursor: v.optional(v.string()) },
  returns: v.object({
    id: v.string(),
    subject: v.string(),
    messages: v.array(mailMessage),
    next: v.union(v.string(), v.null()),
    lastMessageId: v.string(),
  }),
  handler: async (ctx, args) => {
    const company = await companyInbox(ctx, args.inboxId),
      query = new URLSearchParams({ limit: "30" });
    if ((args.cursor?.length ?? 0) > 4000) throw new ConvexError("Invalid page.");
    if (args.cursor) query.set("page_token", args.cursor);
    const result = await mailRequest(
      `/inboxes/${segment(company.email)}/threads/${segment(args.threadId)}?${query}`,
      { key: company.key },
    );
    if (result.inbox_id !== company.email || result.thread_id !== args.threadId)
      throw new ConvexError("Conversation not found.");
    return {
      id: args.threadId,
      subject: string(result.subject),
      messages: (Array.isArray(result.messages) ? result.messages : []).map(publicMessage),
      next: string(result.next_page_token) || null,
      lastMessageId: string(result.last_message_id),
    };
  },
});
export const importMessage = action({
  args: { inboxId: v.optional(v.string()), messageId: v.string() },
  returns: v.union(v.id("mailReceipts"), v.null()),
  handler: async (ctx, args): Promise<Id<"mailReceipts"> | null> => {
    const company = await companyInbox(ctx, args.inboxId);
    const m = await mailRequest(
      `/inboxes/${segment(company.email)}/messages/${segment(args.messageId)}`,
      { key: company.key },
    );
    if (m.inbox_id !== company.email || m.message_id !== args.messageId)
      throw new ConvexError("Message not found.");
    return ctx.runMutation(internal.mailReview.capture, { message: m });
  },
});

export const refreshReview = action({
  args: { inboxId: v.optional(v.string()), cursor: v.optional(v.string()) },
  returns: v.object({ count: v.number(), next: v.union(v.string(), v.null()) }),
  handler: async (ctx, args): Promise<{ count: number; next: string | null }> => {
    const company = await companyInbox(ctx, args.inboxId);
    if ((args.cursor?.length ?? 0) > 4000) throw new ConvexError("Invalid page.");
    const params = new URLSearchParams({ labels: "unauthenticated", limit: "10" });
    if (args.cursor) params.set("page_token", args.cursor);
    const result = await mailRequest(`/inboxes/${segment(company.email)}/messages?${params}`, {
      key: company.key,
    });
    let count = 0;
    for (const value of Array.isArray(result.messages) ? result.messages : []) {
      const item = record(value);
      if (!string(item.message_id)) continue;
      const m = await mailRequest(
        `/inboxes/${segment(company.email)}/messages/${segment(string(item.message_id))}`,
        { key: company.key },
      );
      if (m.inbox_id !== company.email || !mailRisk(m)) continue;
      await ctx.runMutation(internal.mailReview.capture, { message: m });
      count++;
    }
    return { count, next: string(result.next_page_token) || null };
  },
});

export const addresses = query({
  args: {},
  returns: v.array(v.object({ email: v.string(), active: v.boolean() })),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    const current = await activeInbox(ctx, organization._id);
    const old = await ctx.db
      .query("mailInboxHistory")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .take(20);
    return [
      ...(current ? [{ email: current.email, active: true }] : []),
      ...old.map((i) => ({ email: i.email, active: false })),
    ];
  },
});
