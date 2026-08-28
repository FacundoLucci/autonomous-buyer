import { AgentMail, type OutboundId, vOutboundId, vOutboundStatus } from "@agentmail/convex";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import { action, env, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { missingQuoteFieldValidator } from "./domain";
import { canSeePrivateProviderData, requireExternalBuyer } from "./authz";

const agentmail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.inbound.onMessageReceived,
});
const APPROVAL_TEXT = "APPROVE CONTROLLED RFQ RECIPIENTS";

type Inbox = { inbox_id: string; email: string; display_name?: string; client_id?: string };

function inboxesFrom(value: unknown): Inbox[] {
  if (Array.isArray(value)) return value as Inbox[];
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const list = record.inboxes ?? record.data;
    if (Array.isArray(list)) return list as Inbox[];
  }
  return [];
}

function validExternalEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.toLowerCase().endsWith(".example");
}

export const ensurePurchasingInbox = action({
  args: { procurementId: v.id("procurements"), createIfMissing: v.boolean() },
  returns: v.object({ inboxId: v.string(), email: v.string(), created: v.boolean() }),
  handler: async (ctx, args): Promise<{ inboxId: string; email: string; created: boolean }> => {
    await ctx.runQuery(internal.authz.assertExternalBuyer, {
      procurementId: args.procurementId,
    });
    const context = await ctx.runQuery(internal.mail.getInboxContext, {
      procurementId: args.procurementId,
    });
    const stored = context.inbox;
    if (stored !== null) return { inboxId: stored.inboxId, email: stored.email, created: false };
    const configuredInboxId = env.AGENTMAIL_INBOX_ID?.trim();
    const configuredInboxEmail =
      env.AGENTMAIL_INBOX_EMAIL?.trim() ??
      (configuredInboxId?.includes("@") ? configuredInboxId : undefined);
    if (configuredInboxId !== undefined && configuredInboxEmail !== undefined) {
      await ctx.runMutation(internal.mail.storeInbox, {
        organizationId: context.organizationId,
        inboxId: configuredInboxId,
        email: configuredInboxEmail,
      });
      return { inboxId: configuredInboxId, email: configuredInboxEmail, created: false };
    }
    const listed = inboxesFrom(await agentmail.listInboxes(ctx, { limit: 100 }));
    let inbox = listed.find((candidate) => candidate.client_id === "acme-purchasing-v1");
    let created = false;
    if (inbox === undefined) {
      if (!args.createIfMissing)
        throw new Error("No Acme purchasing inbox exists. Confirm creation from the browser.");
      inbox = (await agentmail.createInbox(ctx, {
        username: "acme-purchasing",
        displayName: "Acme Foods Purchasing",
        clientId: "acme-purchasing-v1",
      })) as Inbox;
      created = true;
    }
    if (typeof inbox.inbox_id !== "string" || typeof inbox.email !== "string")
      throw new Error("AgentMail returned an invalid inbox.");
    await ctx.runMutation(internal.mail.storeInbox, {
      organizationId: context.organizationId,
      inboxId: inbox.inbox_id,
      email: inbox.email,
    });
    return { inboxId: inbox.inbox_id, email: inbox.email, created };
  },
});

export const getInboxContext = internalQuery({
  args: { procurementId: v.id("procurements") },
  returns: v.object({
    organizationId: v.id("organizations"),
    inbox: v.union(v.object({ inboxId: v.string(), email: v.string() }), v.null()),
  }),
  handler: async (ctx, args) => {
    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null) throw new Error("Procurement not found.");
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", procurement.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    return {
      organizationId: procurement.organizationId,
      inbox: inbox === null ? null : { inboxId: inbox.inboxId, email: inbox.email },
    };
  },
});

export const getStoredInbox = query({
  args: { organizationId: v.id("organizations") },
  returns: v.union(v.object({ inboxId: v.string(), email: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const canSeePrivate = await canSeePrivateProviderData(ctx, args.organizationId);
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    return inbox === null
      ? null
      : {
          inboxId: canSeePrivate ? inbox.inboxId : "private",
          email: canSeePrivate ? inbox.email : "Configured purchasing inbox",
        };
  },
});

export const getInboxForProcurement = query({
  args: { procurementId: v.id("procurements") },
  returns: v.union(v.object({ inboxId: v.string(), email: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null) return null;
    const canSeePrivate = await canSeePrivateProviderData(ctx, procurement.organizationId);
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", procurement.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    return inbox === null
      ? null
      : {
          inboxId: canSeePrivate ? inbox.inboxId : "private",
          email: canSeePrivate ? inbox.email : "Configured purchasing inbox",
        };
  },
});

export const readStoredInbox = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.union(v.object({ inboxId: v.string(), email: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    return inbox === null ? null : { inboxId: inbox.inboxId, email: inbox.email };
  },
});

export const storeInbox = internalMutation({
  args: { organizationId: v.id("organizations"), inboxId: v.string(), email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    const value = {
      provider: "agentmail" as const,
      inboxId: args.inboxId,
      email: args.email,
      selectedAt: Date.now(),
    };
    if (existing === null)
      await ctx.db.insert("purchasingInboxes", { organizationId: args.organizationId, ...value });
    else await ctx.db.patch("purchasingInboxes", existing._id, value);
    return null;
  },
});

export const approveRecipients = mutation({
  args: {
    procurementId: v.id("procurements"),
    recipients: v.array(v.object({ rfqId: v.id("rfqs"), email: v.string() })),
    confirmation: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireExternalBuyer(ctx, args.procurementId);
    if (args.confirmation !== APPROVAL_TEXT)
      throw new Error(`Type ${APPROVAL_TEXT} to approve the exact recipients.`);
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_procurement", (q) => q.eq("procurementId", args.procurementId))
      .take(20);
    if (rfqs.length !== 3 || args.recipients.length !== 3)
      throw new Error("Exactly three controlled recipients are required.");
    const emailByRfq = new Map(
      args.recipients.map((recipient) => [recipient.rfqId, recipient.email.trim().toLowerCase()]),
    );
    const now = Date.now();
    for (const rfq of rfqs) {
      const email = emailByRfq.get(rfq._id);
      if (email === undefined || !validExternalEmail(email))
        throw new Error("Every recipient must be a real external email address.");
      if (!rfq.isControlledRecipient || rfq.subject === undefined || rfq.body === undefined)
        throw new Error("Every controlled RFQ preview must be complete before approval.");
      await ctx.db.patch("rfqs", rfq._id, {
        recipientEmail: email,
        recipientApprovedAt: now,
        status: "ready",
      });
    }
    return null;
  },
});

export const sendApproved = mutation({
  args: { procurementId: v.id("procurements") },
  returns: v.array(vOutboundId),
  handler: async (ctx, args) => {
    const { procurement } = await requireExternalBuyer(ctx, args.procurementId);
    if (procurement.status !== "rfq_ready")
      throw new Error("Procurement is not ready to send RFQs.");
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", procurement.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    if (inbox === null) throw new Error("Select the Acme purchasing inbox first.");
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_procurement", (q) => q.eq("procurementId", procurement._id))
      .take(20);
    if (rfqs.length !== 3) throw new Error("Exactly three RFQs are required.");
    const outboundIds: OutboundId[] = [];
    for (const rfq of rfqs) {
      if (rfq.providerOutboundId !== undefined) {
        outboundIds.push(rfq.providerOutboundId as OutboundId);
        continue;
      }
      if (
        rfq.status !== "ready" ||
        rfq.recipientApprovedAt === undefined ||
        rfq.recipientEmail === undefined ||
        rfq.subject === undefined ||
        rfq.body === undefined
      ) {
        throw new Error("Every RFQ must have approved exact terms and a real recipient.");
      }
      const idempotencyKey = `${procurement.demoRunId}:rfq:${rfq._id}:v1`;
      const receipt = await ctx.db
        .query("integrationReceipts")
        .withIndex("by_provider_key", (q) =>
          q.eq("provider", "agentmail").eq("idempotencyKey", idempotencyKey),
        )
        .unique();
      if (receipt !== null) continue;
      const outboundId = await agentmail.sendMessage(ctx, inbox.inboxId, {
        to: rfq.recipientEmail,
        subject: rfq.subject,
        text: rfq.body,
        labels: ["autonomous-buyer", `procurement-${procurement._id}`, `rfq-${rfq._id}`],
        headers: { "X-Autonomous-Buyer-Key": idempotencyKey },
      });
      outboundIds.push(outboundId);
      await ctx.db.insert("integrationReceipts", {
        procurementId: procurement._id,
        provider: "agentmail",
        idempotencyKey,
        operation: "agentmail_send_rfq",
        status: "pending",
        providerRecordId: outboundId,
        requestHash: `${rfq.recipientEmail}|${rfq.subject}|${rfq.body}`,
        createdAt: Date.now(),
      });
      await ctx.db.patch("rfqs", rfq._id, {
        status: "queued",
        providerOutboundId: outboundId,
        deliveryState: "pending",
      });
    }
    await ctx.scheduler.runAfter(1_000, internal.mail.reconcileDelivery, {
      procurementId: procurement._id,
      attempt: 0,
    });
    return outboundIds;
  },
});

export const reconcileDelivery = internalMutation({
  args: { procurementId: v.id("procurements"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_procurement", (q) => q.eq("procurementId", args.procurementId))
      .take(20);
    let pending = false;
    for (const rfq of rfqs) {
      if (rfq.providerOutboundId === undefined) continue;
      const status = await agentmail.status(ctx, rfq.providerOutboundId as OutboundId);
      if (status === null || status.status === "pending") {
        pending = true;
        continue;
      }
      await ctx.db.patch("rfqs", rfq._id, {
        deliveryState: status.status,
        providerMessageId: status.agentmailMessageId ?? undefined,
        providerThreadId: status.threadId ?? undefined,
        status: status.status === "sent" || status.status === "delivered" ? "sent" : "failed",
        sentAt: status.status === "sent" || status.status === "delivered" ? Date.now() : undefined,
      });
      const receipt = await ctx.db
        .query("integrationReceipts")
        .withIndex("by_provider_key", (q) =>
          q.eq("provider", "agentmail").eq("idempotencyKey", `${rfq.demoRunId}:rfq:${rfq._id}:v1`),
        )
        .unique();
      if (receipt !== null) {
        await ctx.db.patch("integrationReceipts", receipt._id, {
          status:
            status.status === "sent" || status.status === "delivered" ? "succeeded" : "failed",
          providerRecordId: status.agentmailMessageId ?? rfq.providerOutboundId,
          errorMessage: status.errorMessage ?? undefined,
          completedAt: Date.now(),
        });
      }
      if (
        (status.status === "sent" || status.status === "delivered") &&
        status.agentmailMessageId !== null &&
        status.threadId !== null
      ) {
        const link = await ctx.db
          .query("emailLinks")
          .withIndex("by_provider_message", (q) =>
            q
              .eq("provider", "agentmail")
              .eq("providerMessageId", status.agentmailMessageId as string),
          )
          .unique();
        if (link === null)
          await ctx.db.insert("emailLinks", {
            procurementId: rfq.procurementId,
            rfqId: rfq._id,
            supplierId: rfq.supplierId,
            provider: "agentmail",
            providerMessageId: status.agentmailMessageId,
            providerThreadId: status.threadId,
            direction: "outbound",
            purpose: "rfq",
            createdAt: Date.now(),
          });
      }
    }
    const refreshed = await ctx.db
      .query("rfqs")
      .withIndex("by_procurement", (q) => q.eq("procurementId", args.procurementId))
      .take(20);
    if (refreshed.length === 3 && refreshed.every((rfq) => rfq.status === "sent")) {
      const procurement = await ctx.db.get("procurements", args.procurementId);
      if (procurement?.status === "rfq_ready") {
        await ctx.runMutation(internal.procurements.transition, {
          procurementId: procurement._id,
          toState: "rfq_sent",
          summary: "Three approved RFQs were sent through AgentMail.",
          actorType: "agent",
        });
        await ctx.runMutation(internal.procurements.transition, {
          procurementId: procurement._id,
          toState: "awaiting_quotes",
          summary: "The buyer is waiting for controlled supplier replies.",
          actorType: "agent",
        });
      }
    } else if (pending && args.attempt < 60) {
      await ctx.scheduler.runAfter(2_000, internal.mail.reconcileDelivery, {
        procurementId: args.procurementId,
        attempt: args.attempt + 1,
      });
    }
    return null;
  },
});

export const queueFollowUp = internalMutation({
  args: {
    rfqId: v.id("rfqs"),
    sourceQuoteId: v.id("quotes"),
    requestedFields: v.array(missingQuoteFieldValidator),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rfq = await ctx.db.get("rfqs", args.rfqId);
    const quote = await ctx.db.get("quotes", args.sourceQuoteId);
    if (rfq === null || quote === null || quote.rfqId !== rfq._id)
      throw new Error("Follow-up quote context is invalid.");
    if (rfq.automaticFollowUpCount >= 2) throw new Error("Automatic follow-up limit reached.");
    const attempt = rfq.automaticFollowUpCount + 1;
    const existing = await ctx.db
      .query("rfqFollowUps")
      .withIndex("by_rfq_and_attempt", (q) => q.eq("rfqId", rfq._id).eq("attempt", attempt))
      .unique();
    if (existing !== null) return null;
    const idempotencyKey = `${rfq.demoRunId}:rfq:${rfq._id}:followup:${attempt}`;
    const priorReceipt = await ctx.db
      .query("integrationReceipts")
      .withIndex("by_provider_key", (q) =>
        q.eq("provider", "agentmail").eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (priorReceipt !== null) return null;
    const now = Date.now();
    const followUpId = await ctx.db.insert("rfqFollowUps", {
      procurementId: rfq.procurementId,
      rfqId: rfq._id,
      sourceQuoteId: quote._id,
      sourceProviderMessageId: quote.rawProviderMessageId,
      attempt,
      requestedFields: args.requestedFields,
      subject: args.subject,
      body: args.body,
      status: "queued",
      createdAt: now,
    });
    await ctx.db.insert("integrationReceipts", {
      procurementId: rfq.procurementId,
      provider: "agentmail",
      idempotencyKey,
      operation: "agentmail_send_follow_up",
      status: "pending",
      requestHash: `${quote.rawProviderMessageId}|${args.subject}|${args.body}`,
      createdAt: now,
    });
    await ctx.db.patch("rfqs", rfq._id, { automaticFollowUpCount: attempt });
    await ctx.scheduler.runAfter(0, internal.mail.sendFollowUp, { followUpId });
    return null;
  },
});

export const sendFollowUp = internalMutation({
  args: { followUpId: v.id("rfqFollowUps") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const followUp = await ctx.db.get("rfqFollowUps", args.followUpId);
    if (followUp === null || followUp.providerOutboundId !== undefined) return null;
    const rfq = await ctx.db.get("rfqs", followUp.rfqId);
    const procurement = await ctx.db.get("procurements", followUp.procurementId);
    if (rfq === null || procurement === null) throw new Error("Follow-up context not found.");
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", procurement.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    if (inbox === null) throw new Error("The Acme purchasing inbox is not selected.");
    const outboundId = await agentmail.replyToMessage(
      ctx,
      inbox.inboxId,
      followUp.sourceProviderMessageId,
      {
        subject: followUp.subject,
        text: followUp.body,
        labels: ["autonomous-buyer", `procurement-${procurement._id}`, "automatic-follow-up"],
        headers: {
          "X-Autonomous-Buyer-Key": `${rfq.demoRunId}:rfq:${rfq._id}:followup:${followUp.attempt}`,
        },
      },
    );
    await ctx.db.patch("rfqFollowUps", followUp._id, { providerOutboundId: outboundId });
    await ctx.scheduler.runAfter(1_000, internal.mail.reconcileFollowUp, {
      followUpId: followUp._id,
      attempt: 0,
    });
    return null;
  },
});

export const reconcileFollowUp = internalMutation({
  args: { followUpId: v.id("rfqFollowUps"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const followUp = await ctx.db.get("rfqFollowUps", args.followUpId);
    if (followUp === null || followUp.providerOutboundId === undefined) return null;
    const status = await agentmail.status(ctx, followUp.providerOutboundId as OutboundId);
    if ((status === null || status.status === "pending") && args.attempt < 60) {
      await ctx.scheduler.runAfter(2_000, internal.mail.reconcileFollowUp, {
        followUpId: followUp._id,
        attempt: args.attempt + 1,
      });
      return null;
    }
    const succeeded = status?.status === "sent" || status?.status === "delivered";
    const now = Date.now();
    await ctx.db.patch("rfqFollowUps", followUp._id, {
      status: succeeded ? "sent" : "failed",
      providerMessageId: status?.agentmailMessageId ?? undefined,
      providerThreadId: status?.threadId ?? undefined,
      errorMessage:
        status?.errorMessage ?? (status === null ? "Delivery status unavailable." : undefined),
      sentAt: succeeded ? now : undefined,
    });
    const rfq = await ctx.db.get("rfqs", followUp.rfqId);
    if (rfq === null) return null;
    const receipt = await ctx.db
      .query("integrationReceipts")
      .withIndex("by_provider_key", (q) =>
        q
          .eq("provider", "agentmail")
          .eq("idempotencyKey", `${rfq.demoRunId}:rfq:${rfq._id}:followup:${followUp.attempt}`),
      )
      .unique();
    if (receipt !== null) {
      await ctx.db.patch("integrationReceipts", receipt._id, {
        status: succeeded ? "succeeded" : "failed",
        providerRecordId: status?.agentmailMessageId ?? followUp.providerOutboundId,
        errorMessage: status?.errorMessage ?? undefined,
        completedAt: now,
      });
    }
    if (succeeded && status?.agentmailMessageId && status.threadId) {
      await ctx.db.insert("emailLinks", {
        procurementId: followUp.procurementId,
        rfqId: followUp.rfqId,
        supplierId: rfq.supplierId,
        provider: "agentmail",
        providerMessageId: status.agentmailMessageId,
        providerThreadId: status.threadId,
        direction: "outbound",
        purpose: "follow_up",
        createdAt: now,
      });
      const procurement = await ctx.db.get("procurements", followUp.procurementId);
      if (procurement !== null) {
        await ctx.db.insert("procurementEvents", {
          procurementId: procurement._id,
          demoRunId: procurement.demoRunId,
          type: "follow_up_sent",
          summary: `Automatic follow-up ${followUp.attempt} requested ${followUp.requestedFields.join(", ").replaceAll("_", " ")}.`,
          actorType: "agent",
          relatedRecordId: followUp._id,
          createdAt: now,
        });
      }
    }
    return null;
  },
});

export const listFollowUps = query({
  args: { procurementId: v.id("procurements") },
  returns: v.array(
    v.object({
      followUpId: v.id("rfqFollowUps"),
      supplierName: v.string(),
      attempt: v.number(),
      requestedFields: v.array(missingQuoteFieldValidator),
      subject: v.string(),
      body: v.string(),
      status: v.union(
        v.literal("queued"),
        v.literal("sent"),
        v.literal("failed"),
        v.literal("human_review"),
      ),
      errorMessage: v.union(v.string(), v.null()),
      createdAt: v.number(),
      sentAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const followUps = await ctx.db
      .query("rfqFollowUps")
      .withIndex("by_procurement_and_created_at", (q) => q.eq("procurementId", args.procurementId))
      .order("desc")
      .take(20);
    const rows = [];
    for (const followUp of followUps) {
      const rfq = await ctx.db.get("rfqs", followUp.rfqId);
      const supplier = rfq === null ? null : await ctx.db.get("suppliers", rfq.supplierId);
      if (supplier === null) continue;
      rows.push({
        followUpId: followUp._id,
        supplierName: supplier.name,
        attempt: followUp.attempt,
        requestedFields: followUp.requestedFields,
        subject: followUp.subject,
        body: followUp.body,
        status: followUp.status,
        errorMessage: followUp.errorMessage ?? null,
        createdAt: followUp.createdAt,
        sentAt: followUp.sentAt ?? null,
      });
    }
    return rows;
  },
});

export const getDelivery = query({
  args: { procurementId: v.id("procurements") },
  returns: v.array(
    v.object({
      rfqId: v.id("rfqs"),
      status: v.union(vOutboundStatus, v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_procurement", (q) => q.eq("procurementId", args.procurementId))
      .take(20);
    const rows = [];
    for (const rfq of rfqs) {
      if (rfq.providerOutboundId === undefined) continue;
      const status = await agentmail.status(ctx, rfq.providerOutboundId as OutboundId);
      rows.push({
        rfqId: rfq._id,
        status: status?.status ?? null,
      });
    }
    return rows;
  },
});
