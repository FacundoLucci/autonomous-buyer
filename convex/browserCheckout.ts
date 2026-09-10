import { recordMerchantOrder } from "./merchantMetrics";
import { supplierAllowed } from "./companySuppliers";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalQuery,
  httpAction,
  env,
  type ActionCtx,
} from "./_generated/server";
import { internalMutation } from "./audited";
import schema from "./schema";
import { validDate, quantity, orderTotal } from "./companyRules";
import { approvalKey } from "../src/lib/buy-review";
import { orderEvent } from "./companyOrders";
import type { Doc } from "./_generated/dataModel";

const orderArgs = { orderId: v.id("companyOrders") };
const phase = v.union(v.literal("prepare"), v.literal("submit"));
const snapshot = v.object({
  sku: v.string(),
  unit: v.string(),
  quantity: v.number(),
  currency: v.string(),
  unitPriceCents: v.number(),
  freightCents: v.number(),
  taxCents: v.number(),
  totalCents: v.number(),
  shipTo: v.string(),
  expectedOn: v.string(),
});
const result = v.object({
  id: v.string(),
  state: v.string(),
  snapshot: v.optional(snapshot),
  confirmation: v.optional(v.string()),
  error: v.optional(v.string()),
});

async function worker(path: string, body?: unknown): Promise<unknown> {
  if (!env.BROWSER_WORKER_URL || !env.BROWSER_WORKER_SECRET)
    throw new Error("Website ordering needs the hosted browser worker to be configured.");
  const base = new URL(env.BROWSER_WORKER_URL);
  if (base.protocol !== "https:") throw new Error("The browser worker must use HTTPS.");
  const response = await fetch(new URL(path, base), {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${env.BROWSER_WORKER_SECRET}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 422
        ? "The browser agent could not start this checkout. Review the website address and try again."
        : "The browser worker could not complete this request.",
    );
  return await response.json();
}
export const read = internalQuery({
  args: orderArgs,
  returns: v.union(schema.doc("companyOrders"), v.null()),
  handler: async (ctx, { orderId }) => await ctx.db.get("companyOrders", orderId),
});
export const reserve = internalMutation({
  args: { ...orderArgs, phase },
  returns: v.union(schema.doc("companyOrders"), v.null()),
  handler: async (ctx, args) => {
    const order = await ctx.db.get("companyOrders", args.orderId);
    if (
      !order ||
      !order.isOpen ||
      !order.buyUrl ||
      order.providerOutboundId ||
      order.browserCommitAuthorizedAt
    )
      return null;
    if (!(await supplierAllowed(ctx, order.organizationId, order.buyUrl))) return null;
    if (args.phase === "prepare" && order.status !== "draft") return null;
    if (
      args.phase === "submit" &&
      (order.status !== "approved" ||
        order.approvedTermsKey !== approvalKey(order) ||
        order.browserPreparedKey !== approvalKey(order))
    )
      return null;
    if (
      order.browserJobId &&
      order.browserPhase === args.phase &&
      (args.phase === "submit" || order.browserJobIntent === approvalKey(order))
    )
      return null;
    await ctx.db.patch("companyOrders", order._id, {
      browserPhase: args.phase,
      browserPollCount: 0,
      error: undefined,
      ...(args.phase === "submit" ? { executionState: "submitting" as const } : {}),
      updatedAt: Date.now(),
    });
    return order;
  },
});
export const recordJob = internalMutation({
  args: { ...orderArgs, jobId: v.string(), phase, intent: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get("companyOrders", args.orderId);
    if (!order || order.browserPhase !== args.phase || approvalKey(order) !== args.intent)
      return null;
    await ctx.db.patch("companyOrders", order._id, {
      browserJobId: args.jobId,
      browserJobIntent: args.intent,
    });
    await ctx.scheduler.runAfter(3000, internal.browserCheckout.poll, {
      orderId: order._id,
      jobId: args.jobId,
      intent: args.intent,
    });
    return null;
  },
});
export const fail = internalMutation({
  args: {
    ...orderArgs,
    message: v.string(),
    uncertain: v.boolean(),
    jobId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get("companyOrders", args.orderId);
    if (
      !order ||
      !order.isOpen ||
      order.executionState === "confirmed" ||
      (args.jobId && order.browserJobId !== args.jobId)
    )
      return null;
    await ctx.db.patch("companyOrders", order._id, {
      error: args.message,
      executionState:
        args.uncertain || order.browserCommitAuthorizedAt ? "outcome_unknown" : "needs_attention",
      updatedAt: Date.now(),
    });
    await orderEvent(ctx, order, "browser_attention", args.message);
    return null;
  },
});
async function dispatch(ctx: ActionCtx, order: Doc<"companyOrders">, mode: "prepare" | "submit") {
  const intent = approvalKey(order);
  const approvedSnapshot = {
    sku: order.supplierSku ?? order.sku,
    unit: order.unit,
    quantity: order.quantity,
    currency: order.currency,
    unitPriceCents: order.unitPriceCents,
    freightCents: order.freightCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    shipTo: order.shipTo,
    expectedOn: order.quotedArrival || order.expectedOn,
  };
  try {
    const response = await worker("/jobs", {
      phase: mode,
      intent,
      order: {
        _id: order._id,
        organizationId: order.organizationId,
        buyUrl: order.buyUrl,
        sku: order.supplierSku ?? order.sku,
        itemName: order.itemName,
        unit: order.unit,
        quantity: order.quantity,
        shipTo: order.shipTo,
      },
      ...(mode === "submit" ? { snapshot: approvedSnapshot } : {}),
    });
    if (
      typeof response !== "object" ||
      response === null ||
      !("id" in response) ||
      typeof response.id !== "string"
    )
      throw new Error("The browser worker returned an invalid job.");
    await ctx.runMutation(internal.browserCheckout.recordJob, {
      orderId: order._id,
      jobId: response.id,
      phase: mode,
      intent,
    });
  } catch (error) {
    await ctx.runMutation(internal.browserCheckout.fail, {
      orderId: order._id,
      message: error instanceof Error ? error.message : "Website checkout needs help.",
      uncertain: false,
    });
  }
}
export const prepare = internalAction({
  args: orderArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const order: Doc<"companyOrders"> | null = await ctx.runMutation(
      internal.browserCheckout.reserve,
      { ...args, phase: "prepare" },
    );
    if (order) await dispatch(ctx, order, "prepare");
    return null;
  },
});
export const submit = internalAction({
  args: orderArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const order: Doc<"companyOrders"> | null = await ctx.runMutation(
      internal.browserCheckout.reserve,
      { ...args, phase: "submit" },
    );
    if (order) await dispatch(ctx, order, "submit");
    return null;
  },
});
export const apply = internalMutation({
  args: { ...orderArgs, jobId: v.string(), intent: v.string(), result },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get("companyOrders", args.orderId);
    if (!order || !order.isOpen || order.browserJobId !== args.jobId) return null;
    if (order.executionState === "confirmed") return null;
    if (args.result.id !== args.jobId) throw new ConvexError("Unexpected browser job result.");
    if (
      approvalKey(order) !== args.intent &&
      !(order.browserCommitAuthorizedAt && order.approvedTermsKey === args.intent)
    ) {
      await ctx.db.patch("companyOrders", order._id, {
        error:
          "The purchase changed during website checkout. Reconcile the supplier before continuing.",
        executionState: "needs_attention",
      });
      return null;
    }
    const output = args.result;
    if (output.state === "running") {
      const count = (order.browserPollCount || 0) + 1;
      if (count < 60) {
        await ctx.db.patch("companyOrders", order._id, { browserPollCount: count });
        await ctx.scheduler.runAfter(10000, internal.browserCheckout.poll, {
          orderId: order._id,
          jobId: args.jobId,
          intent: args.intent,
        });
        return null;
      }
    }
    if (
      ((output.state === "prepared" && order.status === "draft") ||
        (output.state === "changed" && order.status === "approved")) &&
      output.snapshot
    ) {
      const s = output.snapshot;
      validDate(s.expectedOn);
      quantity(s.quantity, s.unit);
      if (
        s.sku !== (order.supplierSku ?? order.sku) ||
        s.unit !== order.unit ||
        s.quantity !== order.quantity ||
        s.shipTo !== order.shipTo ||
        s.totalCents !== orderTotal(s.quantity, s.unitPriceCents, s.freightCents, s.taxCents) ||
        !/^[A-Z]{3}$/.test(s.currency) ||
        ![s.unitPriceCents, s.freightCents, s.taxCents, s.totalCents].every(
          (n) => Number.isSafeInteger(n) && n >= 0,
        )
      )
        throw new ConvexError("Invalid supplier cart.");
      const terms = {
        unitPriceCents: s.unitPriceCents,
        freightCents: s.freightCents,
        taxCents: s.taxCents,
        totalCents: s.totalCents,
        currency: s.currency,
        quotedArrival: s.expectedOn,
        reviewRequired: false,
      };
      await ctx.db.patch("companyOrders", order._id, {
        ...terms,
        status: "draft",
        approvedBy: undefined,
        approvedAt: undefined,
        approvedTermsKey: undefined,
        browserJobId: undefined,
        browserJobIntent: undefined,
        browserPhase: undefined,
        browserPreparedKey: approvalKey({ ...order, ...terms }),
        executionState: undefined,
        error: undefined,
        updatedAt: Date.now(),
      });
      await orderEvent(ctx, order, "browser_prepared", "Supplier checkout is ready for approval.");
      return null;
    }
    if (
      output.state === "confirmed" &&
      output.snapshot &&
      output.confirmation &&
      order.status === "approved" &&
      order.browserPhase === "submit" &&
      order.browserCommitAuthorizedAt
    ) {
      const s = output.snapshot;
      validDate(s.expectedOn);
      quantity(s.quantity, s.unit);
      if (
        s.totalCents !== order.totalCents ||
        s.currency !== order.currency ||
        s.quantity !== order.quantity ||
        s.sku !== (order.supplierSku ?? order.sku) ||
        s.unit !== order.unit ||
        s.unitPriceCents !== order.unitPriceCents ||
        s.freightCents !== order.freightCents ||
        s.taxCents !== order.taxCents ||
        s.shipTo !== order.shipTo ||
        s.expectedOn !== (order.quotedArrival || order.expectedOn)
      )
        throw new ConvexError("Supplier receipt differs from approved terms.");
      await ctx.db.patch("companyOrders", order._id, {
        status: "placed",
        executionState: "confirmed",
        confirmation: output.confirmation,
        expectedOn: s.expectedOn,
        placedAt: Date.now(),
        error: undefined,
        updatedAt: Date.now(),
      });
      await recordMerchantOrder(ctx, order._id, "browser");
      await orderEvent(
        ctx,
        order,
        "placed",
        `Supplier website confirmed order ${output.confirmation}.`,
      );
      await ctx.scheduler.runAfter(0, internal.companyAlerts.evaluateItem, {
        itemId: order.inventoryItemId,
      });
      return null;
    }
    await ctx.db.patch("companyOrders", order._id, {
      executionState:
        order.browserCommitAuthorizedAt ||
        output.state === "outcome_unknown" ||
        output.state === "running"
          ? "outcome_unknown"
          : "needs_attention",
      error: output.error || "Website checkout needs your help.",
      updatedAt: Date.now(),
    });
    await orderEvent(
      ctx,
      order,
      "browser_attention",
      output.error || "Website checkout needs your help.",
    );
    return null;
  },
});
export const poll = internalAction({
  args: { ...orderArgs, jobId: v.string(), intent: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const response = await worker(`/jobs/${encodeURIComponent(args.jobId)}`);
      await ctx.runMutation(internal.browserCheckout.apply, {
        ...args,
        result: response as typeof result.type,
      });
    } catch {
      await ctx.runMutation(internal.browserCheckout.fail, {
        orderId: args.orderId,
        jobId: args.jobId,
        message:
          "Cannot verify website checkout. Check the supplier order history before retrying.",
        uncertain: true,
      });
    }
    return null;
  },
});
export const helpSession = action({
  args: orderArgs,
  returns: v.string(),
  handler: async (ctx, args) => {
    const order: Doc<"companyOrders"> | null = await ctx.runQuery(api.companyOrders.get, {
      orderId: args.orderId,
    });
    if (!order?.browserJobId) throw new ConvexError("No supplier session is available yet.");
    const response = await worker(`/jobs/${encodeURIComponent(order.browserJobId)}/takeover`, {});
    if (
      typeof response !== "object" ||
      response === null ||
      !("url" in response) ||
      typeof response.url !== "string"
    )
      throw new ConvexError("The supplier session is unavailable.");
    return response.url;
  },
});

// Preparation may resume after sign-in. An uncertain submission is only reconciled.
export const retry = action({
  args: orderArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const order: Doc<"companyOrders"> | null = await ctx.runQuery(api.companyOrders.get, {
      orderId: args.orderId,
    });
    if (!order || !order.isOpen) throw new ConvexError("Purchase not found.");
    if (!order.browserJobId) {
      if (order.browserCommitAuthorizedAt || order.providerOutboundId)
        throw new ConvexError("Reconcile the supplier before retrying.");
      if (order.status === "draft") await ctx.runAction(internal.browserCheckout.prepare, args);
      else if (order.status === "approved" && order.executionState === "needs_attention")
        await ctx.runAction(internal.browserCheckout.submit, args);
      else throw new ConvexError("Review the purchase before retrying.");
      return null;
    }
    if (
      order.status === "draft" &&
      order.browserJobIntent !== approvalKey(order) &&
      !order.browserCommitAuthorizedAt
    ) {
      await ctx.runAction(internal.browserCheckout.prepare, args);
      return null;
    }
    const path =
      order.browserPhase === "submit" && order.browserCommitAuthorizedAt ? "reconcile" : "retry";
    if (path === "retry")
      await ctx.runMutation(internal.browserCheckout.resume, { orderId: order._id });
    await worker(`/jobs/${encodeURIComponent(order.browserJobId)}/${path}`, {});
    await ctx.runAction(internal.browserCheckout.poll, {
      orderId: order._id,
      jobId: order.browserJobId,
      intent:
        order.browserCommitAuthorizedAt && order.approvedTermsKey
          ? order.approvedTermsKey
          : approvalKey(order),
    });
    return null;
  },
});

export const authorizeCommit = internalMutation({
  args: { orderId: v.string(), jobId: v.string(), intent: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("companyOrders", args.orderId);
    const order = id && (await ctx.db.get("companyOrders", id));
    if (
      !order ||
      !order.isOpen ||
      order.status !== "approved" ||
      order.browserPhase !== "submit" ||
      order.browserJobId !== args.jobId ||
      order.browserCommitAuthorizedAt ||
      order.executionState !== "submitting" ||
      order.approvedTermsKey !== args.intent ||
      order.browserPreparedKey !== args.intent ||
      approvalKey(order) !== args.intent ||
      order.reviewRequired ||
      !order.quotedArrival ||
      Date.parse(`${order.quotedArrival}T23:59:59Z`) < Date.now()
    )
      return false;
    if (!(await supplierAllowed(ctx, order.organizationId, order.buyUrl ?? order.sourceUrl)))
      return false;
    await ctx.db.patch("companyOrders", order._id, { browserCommitAuthorizedAt: Date.now() });
    return true;
  },
});
export const authorizeCommitHttp = httpAction(async (ctx, request) => {
  if (
    !env.BROWSER_WORKER_SECRET ||
    request.headers.get("Authorization") !== `Bearer ${env.BROWSER_WORKER_SECRET}`
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const input: unknown = await request.json();
    if (
      !input ||
      typeof input !== "object" ||
      !("orderId" in input) ||
      typeof input.orderId !== "string" ||
      !("jobId" in input) ||
      typeof input.jobId !== "string" ||
      !("intent" in input) ||
      typeof input.intent !== "string"
    )
      return new Response("Invalid request", { status: 400 });
    const authorized: boolean = await ctx.runMutation(internal.browserCheckout.authorizeCommit, {
      orderId: input.orderId,
      jobId: input.jobId,
      intent: input.intent,
    });
    return Response.json({ authorized }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
});

export const resume = internalMutation({
  args: orderArgs,
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get("companyOrders", orderId);
    if (!order || order.browserCommitAuthorizedAt)
      throw new ConvexError("Reconcile the supplier before retrying.");
    if (order.browserPhase === "submit") {
      if (
        order.status !== "approved" ||
        order.approvedTermsKey !== approvalKey(order) ||
        order.browserPreparedKey !== approvalKey(order)
      )
        throw new ConvexError("Review the changed purchase before retrying.");
      await ctx.db.patch("companyOrders", orderId, {
        executionState: "submitting",
        error: undefined,
        browserPollCount: 0,
      });
    }
    return null;
  },
});
