import { findInbox } from "./mailIdentity";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { ownedCompany } from "./onboarding";
import {
  record,
  string,
  address,
  attachments,
  mailBody,
  mailRisk,
  FILE_LIMIT,
} from "./mailContent";
import { documentFacts } from "./mailFields";
import { limits } from "./rateLimits";
const workflow = new WorkflowManager(components.workflow);
export async function captureMail(ctx: MutationCtx, message: Record<string, unknown>) {
  const inboxId = string(message.inbox_id),
    messageId = string(message.message_id),
    threadId = string(message.thread_id);
  if (!inboxId || !messageId || !threadId) return null;
  const inbox = await findInbox(ctx, inboxId);
  if (!inbox) return null;
  const prior = await ctx.db
    .query("mailReceipts")
    .withIndex("by_inbox_message", (q) => q.eq("inboxId", inboxId).eq("messageId", messageId))
    .unique();
  if (prior) return prior._id;
  const order = await ctx.db
    .query("companyOrders")
    .withIndex("by_providerThreadId", (q) => q.eq("providerThreadId", threadId))
    .unique();
  const quote = await ctx.db
    .query("companyQuoteRequests")
    .withIndex("by_providerThreadId", (q) => q.eq("providerThreadId", threadId))
    .unique();
  const sender = address(message.from);
  const orderId =
    order?.organizationId === inbox.organizationId &&
    sender &&
    sender === address(order.supplierEmail)
      ? order._id
      : undefined;
  const buyId =
    quote?.organizationId === inbox.organizationId && sender && sender === address(quote.email)
      ? quote.buyId
      : undefined;
  const risk =
    mailRisk(message) ??
    ((order || quote) && !orderId && !buyId
      ? "Sender does not match the supplier. Review this email before using it."
      : undefined);
  const files = attachments(message);
  const receiptId = await ctx.db.insert("mailReceipts", {
    organizationId: inbox.organizationId,
    inboxId,
    messageId,
    threadId,
    from: string(message.from).slice(0, 500),
    subject: string(message.subject).slice(0, 500),
    text: mailBody(message),
    risk,
    attachments: files,
    orderId,
    buyId,
    receivedAt: Date.now(),
  });
  // Suspicious mail is preserved but never sent to extraction or purchasing automation.
  if (!risk)
    for (const attachment of files.slice(0, 5)) {
      if (
        !["application/pdf", "image/png", "image/jpeg"].includes(attachment.contentType) ||
        attachment.size > FILE_LIMIT
      )
        continue;
      const allowed = await limits.limit(ctx, "mailDocument", { key: inbox.organizationId });
      if (!allowed.ok) break;
      await startDocument(ctx, receiptId, attachment.id);
    }
  return receiptId;
}
export const capture = internalMutation({
  args: { message: v.any() },
  returns: v.union(v.id("mailReceipts"), v.null()),
  handler: (ctx, args) => captureMail(ctx, record(args.message)),
});
export const reviews = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(schema.doc("mailReceipts")),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const result = await ctx.db
      .query("mailReceipts")
      .withIndex("by_company", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, 30) });
    return { page: result.page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});
export const documents = query({
  args: {},
  returns: v.array(schema.doc("mailDocuments")),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    return ctx.db
      .query("mailDocuments")
      .withIndex("by_company", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(100);
  },
});
async function startDocument(
  ctx: MutationCtx,
  receiptId: Id<"mailReceipts">,
  attachmentId: string,
) {
  const receipt = await ctx.db.get("mailReceipts", receiptId);
  const file = receipt?.attachments.find((a) => a.id === attachmentId);
  if (!receipt || !file || receipt.risk)
    throw new ConvexError(
      "This attachment needs sender verification. It cannot be read automatically.",
    );
  if (
    file.size > FILE_LIMIT ||
    !["application/pdf", "image/png", "image/jpeg"].includes(file.contentType)
  )
    throw new ConvexError("Use a PDF, PNG or JPG under 8 MB.");
  const existing = await ctx.db
    .query("mailDocuments")
    .withIndex("by_receipt_attachment", (q) =>
      q.eq("receiptId", receiptId).eq("attachmentId", attachmentId),
    )
    .unique();
  if (existing && existing.status !== "failed") return existing._id;
  const documentId =
    existing?._id ??
    (await ctx.db.insert("mailDocuments", {
      organizationId: receipt.organizationId,
      receiptId,
      attachmentId,
      filename: file.filename,
      contentType: file.contentType,
      status: "reading",
      orderId: receipt.orderId,
    }));
  if (existing)
    await ctx.db.patch("mailDocuments", documentId, { status: "reading", error: undefined });
  await workflow.start(ctx, internal.mailReview.readDocument, { documentId });
  return documentId;
}
export const requestDocument = mutation({
  args: { receiptId: v.id("mailReceipts"), attachmentId: v.string() },
  returns: v.id("mailDocuments"),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx),
      receipt = await ctx.db.get("mailReceipts", args.receiptId);
    if (receipt?.organizationId !== organization._id) throw new ConvexError("Email not found.");
    await limits.limit(ctx, "mailDocument", { key: organization._id, throws: true });
    return startDocument(ctx, args.receiptId, args.attachmentId);
  },
});
export const linkDocument = mutation({
  args: { documentId: v.id("mailDocuments"), orderId: v.id("companyOrders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx),
      doc = await ctx.db.get("mailDocuments", args.documentId),
      order = await ctx.db.get("companyOrders", args.orderId);
    if (doc?.organizationId !== organization._id || order?.organizationId !== organization._id)
      throw new ConvexError("Document or purchase not found.");
    if (doc.status !== "ready") throw new ConvexError("Wait until this document has been read.");
    await ctx.db.patch("mailDocuments", doc._id, { orderId: order._id, reviewedAt: Date.now() });
    return null;
  },
});
export const acknowledge = mutation({
  args: { receiptId: v.id("mailReceipts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx),
      receipt = await ctx.db.get("mailReceipts", args.receiptId);
    if (receipt?.organizationId !== organization._id) throw new ConvexError("Email not found.");
    // Acknowledgement never clears risk or replays an unverified business event.
    await ctx.db.patch("mailReceipts", receipt._id, { reviewedAt: Date.now() });
    return null;
  },
});
export const source = internalQuery({
  args: { documentId: v.id("mailDocuments") },
  returns: v.object({ document: schema.doc("mailDocuments"), receipt: schema.doc("mailReceipts") }),
  handler: async (ctx, args) => {
    const document = await ctx.db.get("mailDocuments", args.documentId);
    if (!document) throw new Error("Document missing.");
    const receipt = await ctx.db.get("mailReceipts", document.receiptId);
    if (!receipt || receipt.organizationId !== document.organizationId || receipt.risk)
      throw new Error("Source needs review.");
    return { document, receipt };
  },
});
export const saveFile = internalMutation({
  args: { documentId: v.id("mailDocuments"), fileId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get("mailDocuments", args.documentId);
    if (!doc || doc.status !== "reading") {
      await ctx.storage.delete(args.fileId);
      return null;
    }
    if (doc.fileId) await ctx.storage.delete(doc.fileId);
    await ctx.db.patch("mailDocuments", doc._id, { fileId: args.fileId });
    return null;
  },
});
export const finish = internalMutation({
  args: {
    documentId: v.id("mailDocuments"),
    facts: v.optional(documentFacts),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("mailDocuments", args.documentId, {
      status: args.facts ? "ready" : "failed",
      facts: args.facts,
      error: args.error,
    });
    return null;
  },
});
export const download = query({
  args: { documentId: v.id("mailDocuments") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx),
      doc = await ctx.db.get("mailDocuments", args.documentId);
    if (doc?.organizationId !== organization._id || !doc.fileId) return null;
    return ctx.storage.getUrl(doc.fileId);
  },
});
export const readDocument = workflow
  .define({ args: { documentId: v.id("mailDocuments") }, returns: v.null() })
  .handler(async (step, args): Promise<null> => {
    try {
      await step.runAction(internal.mailDocument.extract, args);
    } catch {
      await step.runMutation(internal.mailReview.finish, {
        ...args,
        error: "We couldn't read this file. Check the original or try again.",
      });
    }
    return null;
  });

export const forOrder = query({
  args: { orderId: v.id("companyOrders") },
  returns: v.array(schema.doc("mailDocuments")),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx),
      order = await ctx.db.get("companyOrders", args.orderId);
    if (order?.organizationId !== organization._id) return [];
    return ctx.db
      .query("mailDocuments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .take(50);
  },
});
