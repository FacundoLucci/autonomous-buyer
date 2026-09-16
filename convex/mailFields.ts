import { defineTable } from "convex/server";
import { v } from "convex/values";
export const mailAttachment = v.object({
  id: v.string(),
  filename: v.string(),
  contentType: v.string(),
  size: v.number(),
});
export const mailMessage = v.object({
  id: v.string(),
  threadId: v.string(),
  from: v.string(),
  to: v.array(v.string()),
  subject: v.string(),
  text: v.string(),
  timestamp: v.string(),
  risk: v.optional(v.string()),
  attachments: v.array(mailAttachment),
});
export const documentFacts = v.object({
  kind: v.string(),
  supplier: v.string(),
  reference: v.string(),
  currency: v.string(),
  total: v.string(),
  arrival: v.string(),
  summary: v.string(),
  lines: v.array(
    v.object({
      name: v.string(),
      sku: v.string(),
      quantity: v.string(),
      unit: v.string(),
      unitPrice: v.string(),
      evidence: v.string(),
    }),
  ),
});
export const domainRecord = v.object({
  type: v.string(),
  name: v.string(),
  value: v.string(),
  status: v.string(),
  priority: v.optional(v.number()),
});
export const mailTables = {
  mailDomains: defineTable({
    organizationId: v.id("organizations"),
    domain: v.string(),
    username: v.string(),
    podId: v.optional(v.string()),
    providerId: v.optional(v.string()),
    status: v.string(),
    records: v.array(domainRecord),
    reason: v.optional(v.string()),
    inboxId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_domain", ["domain"]),
  mailInboxHistory: defineTable({
    organizationId: v.id("organizations"),
    inboxId: v.string(),
    email: v.string(),
    podId: v.optional(v.string()),
    selectedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_inboxId", ["inboxId"]),
  mailReceipts: defineTable({
    organizationId: v.id("organizations"),
    inboxId: v.string(),
    messageId: v.string(),
    threadId: v.string(),
    from: v.string(),
    subject: v.string(),
    text: v.string(),
    risk: v.optional(v.string()),
    attachments: v.array(mailAttachment),
    orderId: v.optional(v.id("companyOrders")),
    buyId: v.optional(v.id("companyBuys")),
    reviewedAt: v.optional(v.number()),
    receivedAt: v.number(),
  })
    .index("by_inbox_message", ["inboxId", "messageId"])
    .index("by_company", ["organizationId"])
    .index("by_company_thread", ["organizationId", "threadId"]),
  mailDocuments: defineTable({
    organizationId: v.id("organizations"),
    receiptId: v.id("mailReceipts"),
    attachmentId: v.string(),
    filename: v.string(),
    contentType: v.string(),
    status: v.union(v.literal("reading"), v.literal("ready"), v.literal("failed")),
    fileId: v.optional(v.id("_storage")),
    facts: v.optional(documentFacts),
    error: v.optional(v.string()),
    orderId: v.optional(v.id("companyOrders")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_receipt_attachment", ["receiptId", "attachmentId"])
    .index("by_company", ["organizationId"])
    .index("by_order", ["orderId"]),
  mailDrafts: defineTable({
    organizationId: v.id("organizations"),
    inboxId: v.string(),
    messageId: v.string(),
    threadId: v.string(),
    to: v.string(),
    text: v.string(),
    providerDraftId: v.optional(v.string()),
    version: v.number(),
    state: v.union(
      v.literal("saving"),
      v.literal("ready"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("unknown"),
      v.literal("failed"),
    ),
    contextKey: v.string(),
    lastMessageId: v.string(),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_company", ["organizationId"]),
  mailCredentials: defineTable({
    organizationId: v.id("organizations"),
    inboxId: v.string(),
    encryptedKey: v.optional(v.string()),
    keyId: v.optional(v.string()),
    state: v.union(v.literal("creating"), v.literal("ready"), v.literal("failed")),
    updatedAt: v.number(),
  })
    .index("by_company", ["organizationId"])
    .index("by_company_inbox", ["organizationId", "inboxId"]),
};
