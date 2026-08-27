import { createThread, listUIMessages, saveMessage } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { aiTaskValidator, structuredAiResultValidator } from "./domain";
import schema from "./schema";

const intentByTask = {
  supplier_search_queries: "Prepare supplier search queries from stored procurement evidence.",
  product_equivalency: "Assess product equivalency from stored product evidence.",
  quote_extraction: "Extract quote fields from a stored supplier message.",
  missing_information: "Detect missing quote fields from stored evidence.",
  follow_up_wording: "Draft a follow-up that requests only missing stored fields.",
  recommendation_explanation: "Explain a completed deterministic quote ranking.",
  confirmation_extraction: "Extract confirmation terms from a stored supplier message.",
  exception_explanation: "Explain a deterministic difference using stored evidence.",
} as const;

const threadMessageValidator = v.object({
  id: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  text: v.string(),
  createdAt: v.number(),
});

function requireStableAnchor(anchorKey: string) {
  const normalized = anchorKey.trim();
  if (!/^[a-z][a-z0-9_-]*(?::[a-z0-9_-]+)*(?:\.[a-z0-9_-]+)*$/.test(normalized)) {
    throw new Error("Anchor keys must name stable product concepts.");
  }
  return normalized;
}

async function findBuyer(ctx: MutationCtx, organizationId: Id<"organizations">) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .take(20);
  return users.find((user) => user.isActive && (user.role === "buyer" || user.role === "admin"));
}

export const startStructuredTask = mutation({
  args: {
    procurementId: v.id("procurements"),
    task: aiTaskValidator,
    anchorKey: v.string(),
  },
  returns: v.object({
    aiRunId: v.id("aiRuns"),
    componentThreadId: v.string(),
  }),
  handler: async (ctx, args) => {
    const procurement = await ctx.db.get("procurements", args.procurementId);
    if (procurement === null) throw new Error("Procurement not found.");
    const demoRun = await ctx.db.get("demoRuns", procurement.demoRunId);
    if (demoRun === null || !demoRun.isDemo) {
      throw new Error("Structured tasks require an authorized demo procurement until BC-14.");
    }
    const anchorKey = requireStableAnchor(args.anchorKey);
    const buyer = await findBuyer(ctx, procurement.organizationId);
    let link = await ctx.db
      .query("agentThreadLinks")
      .withIndex("by_procurement_and_anchor", (q) =>
        q.eq("procurementId", procurement._id).eq("anchorKey", anchorKey),
      )
      .unique();
    const now = Date.now();
    if (link === null) {
      const componentThreadId = await createThread(ctx, components.agent, {
        userId: buyer?._id,
        title: `${procurement.code ?? "Open buy"} · ${anchorKey}`,
        summary: "Contextual buying guidance backed by stored evidence.",
      });
      const linkId = await ctx.db.insert("agentThreadLinks", {
        organizationId: procurement.organizationId,
        buyerUserId: buyer?._id,
        procurementId: procurement._id,
        anchorKey,
        componentThreadId,
        unreadCount: 0,
        status: "thinking",
        createdAt: now,
        updatedAt: now,
      });
      link = await ctx.db.get("agentThreadLinks", linkId);
    } else {
      await ctx.db.patch("agentThreadLinks", link._id, {
        status: "thinking",
        updatedAt: now,
      });
    }
    if (link === null) throw new Error("Could not create the contextual thread.");

    const recentRuns = await ctx.db
      .query("aiRuns")
      .withIndex("by_procurement_and_task", (q) =>
        q.eq("procurementId", procurement._id).eq("task", args.task),
      )
      .order("desc")
      .take(10);
    const alreadyPending = recentRuns.find(
      (run) =>
        run.agentThreadLinkId === link._id &&
        run.status === "pending" &&
        run.createdAt > now - 120_000,
    );
    if (alreadyPending !== undefined) {
      return { aiRunId: alreadyPending._id, componentThreadId: link.componentThreadId };
    }

    const aiRunId = await ctx.db.insert("aiRuns", {
      organizationId: procurement.organizationId,
      buyerUserId: buyer?._id,
      procurementId: procurement._id,
      agentThreadLinkId: link._id,
      anchorKey,
      intent: intentByTask[args.task],
      task: args.task,
      transport: "openai",
      model: "gpt-5.4-mini",
      status: "pending",
      evidenceRefs: [],
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.aiNode.runStructuredTask, { aiRunId });
    return { aiRunId, componentThreadId: link.componentThreadId };
  },
});

export const getEvidence = internalQuery({
  args: { aiRunId: v.id("aiRuns") },
  returns: v.object({
    task: aiTaskValidator,
    intent: v.string(),
    componentThreadId: v.string(),
    evidenceRefs: v.array(v.string()),
    evidenceJson: v.string(),
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("aiRuns", args.aiRunId);
    if (run === null || run.procurementId === undefined || run.agentThreadLinkId === undefined) {
      throw new Error("AI run is missing its procurement context.");
    }
    const procurement = await ctx.db.get("procurements", run.procurementId);
    const link = await ctx.db.get("agentThreadLinks", run.agentThreadLinkId);
    if (procurement === null || link === null) throw new Error("AI run context not found.");
    const item = await ctx.db.get("inventoryItems", procurement.inventoryItemId);
    if (item === null) throw new Error("Inventory evidence not found.");
    const events = await ctx.db
      .query("procurementEvents")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .order("desc")
      .take(20);
    const evidenceRefs = [
      `procurements:${procurement._id}`,
      `inventoryItems:${item._id}`,
      ...events.map((event) => `procurementEvents:${event._id}`),
    ];
    return {
      task: run.task,
      intent: run.intent ?? intentByTask[run.task],
      componentThreadId: link.componentThreadId,
      evidenceRefs,
      evidenceJson: JSON.stringify({
        procurement: {
          id: evidenceRefs[0],
          status: procurement.status,
          triggerReason: procurement.triggerReason,
          quantityRequired: procurement.quantityRequired,
          requiredBy: procurement.requiredBy,
          averageDailyUsage: procurement.averageDailyUsage,
          projectedStockoutDate: procurement.projectedStockoutDate,
          calculationVersion: procurement.calculationVersion,
        },
        inventoryItem: {
          id: evidenceRefs[1],
          sku: item.sku,
          name: item.name,
          description: item.description,
          specification: item.specification,
          quantityOnHand: item.quantityOnHand,
          casePack: item.casePack,
        },
        events: events.map((event, index) => ({
          id: evidenceRefs[index + 2],
          type: event.type,
          summary: event.summary,
          createdAt: event.createdAt,
        })),
      }),
    };
  },
});

export const completeRun = internalMutation({
  args: {
    aiRunId: v.id("aiRuns"),
    transport: v.union(v.literal("openai"), v.literal("openrouter")),
    model: v.string(),
    evidenceRefs: v.array(v.string()),
    result: structuredAiResultValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("aiRuns", args.aiRunId);
    if (run === null || run.agentThreadLinkId === undefined) throw new Error("AI run not found.");
    const link = await ctx.db.get("agentThreadLinks", run.agentThreadLinkId);
    if (link === null) throw new Error("Contextual thread link not found.");
    const now = Date.now();
    await saveMessage(ctx, components.agent, {
      threadId: link.componentThreadId,
      userId: link.buyerUserId,
      agentName: "Autonomous Buyer",
      message: { role: "assistant", content: args.result.summary },
      metadata: { provider: args.transport, model: args.model },
    });
    await ctx.db.patch("aiRuns", run._id, {
      transport: args.transport,
      model: args.model,
      status: "succeeded",
      evidenceRefs: args.evidenceRefs,
      outputConfidence: args.result.confidence,
      result: args.result,
      completedAt: now,
      errorMessage: undefined,
    });
    await ctx.db.patch("agentThreadLinks", link._id, {
      unreadCount: link.unreadCount + 1,
      status: "unread",
      lastMessageAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const failRun = internalMutation({
  args: {
    aiRunId: v.id("aiRuns"),
    transport: v.union(v.literal("openai"), v.literal("openrouter")),
    model: v.string(),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("aiRuns", args.aiRunId);
    if (run === null) return null;
    const now = Date.now();
    await ctx.db.patch("aiRuns", run._id, {
      transport: args.transport,
      model: args.model,
      status: "failed",
      errorMessage: args.errorMessage.slice(0, 500),
      completedAt: now,
    });
    if (run.agentThreadLinkId !== undefined) {
      await ctx.db.patch("agentThreadLinks", run.agentThreadLinkId, {
        status: "failed",
        updatedAt: now,
      });
    }
    return null;
  },
});

export const getRun = query({
  args: { aiRunId: v.id("aiRuns") },
  returns: v.union(schema.doc("aiRuns"), v.null()),
  handler: async (ctx, args) => await ctx.db.get("aiRuns", args.aiRunId),
});

export const listThreadMessages = query({
  args: { threadId: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(threadMessageValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("agentThreadLinks")
      .withIndex("by_component_thread_id", (q) => q.eq("componentThreadId", args.threadId))
      .unique();
    if (link === null) throw new Error("Contextual thread not found.");
    const result = await listUIMessages(ctx, components.agent, args);
    return {
      page: result.page.flatMap((message) =>
        message.role === "user" || message.role === "assistant" || message.role === "system"
          ? [
              {
                id: message.id,
                role: message.role,
                text: message.text,
                createdAt: message._creationTime,
              },
            ]
          : [],
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const markThreadRead = mutation({
  args: { threadId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("agentThreadLinks")
      .withIndex("by_component_thread_id", (q) => q.eq("componentThreadId", args.threadId))
      .unique();
    if (link === null) throw new Error("Contextual thread not found.");
    await ctx.db.patch("agentThreadLinks", link._id, {
      unreadCount: 0,
      status: "read",
      updatedAt: Date.now(),
    });
    return null;
  },
});
