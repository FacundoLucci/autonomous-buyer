import { ConvexError, v } from "convex/values";
import { WorkflowManager } from "@convex-dev/workflow";
import { createThread, saveMessage } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { account } from "./onboarding";
import { sourceProduct } from "./inventorySourceFields";
import schema from "./schema";
const workflow = new WorkflowManager(components.workflow);

export function productUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ConvexError("Paste a full product page link, starting with https://.");
  }
  // Only the crawler fetches this URL. Reject local addresses and credentials.
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    value.length > 2000 ||
    !url.hostname.includes(".") ||
    /(^localhost$|\.local$|\.internal$|^\d|:)/i.test(url.hostname)
  )
    throw new ConvexError("Use a public https product page link.");
  return url.href;
}
async function reserve(ctx: MutationCtx, kind: "link" | "invoice", url?: string) {
  const user = await account(ctx);
  if (user.organizationId) {
    const org = await ctx.db.get("organizations", user.organizationId);
    if (org?.isDemo) throw new ConvexError("Use your own account to import inventory.");
  }
  const recent = await ctx.db
    .query("inventorySources")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .order("desc")
    .take(10);
  if (recent.filter((s) => s._creationTime > Date.now() - 3_600_000).length >= 10)
    throw new ConvexError("You’ve added 10 sources this hour. Try again later.");
  const threadId = await createThread(ctx, components.agent, {
    userId: user._id,
    title: "Inventory source",
  });
  return await ctx.db.insert("inventorySources", {
    userId: user._id,
    kind,
    url,
    status: kind === "link" ? "reading" : "uploading",
    threadId,
  });
}
export const startLink = mutation({
  args: { url: v.string() },
  returns: v.id("inventorySources"),
  handler: async (ctx, args) => {
    const sourceId = await reserve(ctx, "link", productUrl(args.url));
    await workflow.start(ctx, internal.inventorySources.readSource, { sourceId });
    return sourceId;
  },
});
export const reserveInvoice = internalMutation({
  args: {},
  returns: v.id("inventorySources"),
  handler: (ctx) => reserve(ctx, "invoice"),
});
export const attachInvoice = internalMutation({
  args: { sourceId: v.id("inventorySources"), fileId: v.id("_storage"), filename: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("inventorySources", args.sourceId, {
      fileId: args.fileId,
      filename: args.filename,
      status: "reading",
    });
    await workflow.start(ctx, internal.inventorySources.readSource, { sourceId: args.sourceId });
    return null;
  },
});
export const get = query({
  args: { sourceId: v.id("inventorySources") },
  returns: v.union(schema.doc("inventorySources"), v.null()),
  handler: async (ctx, args) => {
    const user = await account(ctx);
    const source = await ctx.db.get("inventorySources", args.sourceId);
    return source?.userId === user._id ? source : null;
  },
});
export const read = internalQuery({
  args: { sourceId: v.id("inventorySources") },
  returns: v.union(schema.doc("inventorySources"), v.null()),
  handler: (ctx, args) => ctx.db.get("inventorySources", args.sourceId),
});
export const finish = internalMutation({
  args: {
    sourceId: v.id("inventorySources"),
    products: v.array(sourceProduct),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.products.length > 20) throw new Error("Too many invoice lines.");
    const source = await ctx.db.get("inventorySources", args.sourceId);
    await ctx.db.patch("inventorySources", args.sourceId, {
      status: "ready",
      products: args.products,
      message: args.message,
    });
    if (source?.threadId)
      await saveMessage(ctx, components.agent, {
        threadId: source.threadId,
        message: {
          role: "assistant",
          content: JSON.stringify({ sourceId: source._id, products: args.products }),
        },
      });
    return null;
  },
});
export const fail = internalMutation({
  args: { sourceId: v.id("inventorySources"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("inventorySources", args.sourceId, {
      status: "failed",
      message: args.message,
    });
    return null;
  },
});
export const readSource = workflow
  .define({ args: { sourceId: v.id("inventorySources") }, returns: v.null() })
  .handler(async (step, args): Promise<null> => {
    try {
      await step.runAction(internal.inventorySourceNode.extract, args, {
        retry: { maxAttempts: 2, initialBackoffMs: 2000, base: 2 },
      });
    } catch {
      await step.runMutation(internal.inventorySources.fail, {
        ...args,
        message:
          "We couldn’t read this source. Try another link or invoice, or add the item yourself.",
      });
    }
    return null;
  });
