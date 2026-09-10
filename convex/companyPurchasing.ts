import schema from "./schema";
import { supplierAllowed } from "./companySuppliers";
import { ConvexError, v } from "convex/values";
import { WorkflowManager } from "@convex-dev/workflow";
import { createThread } from "@convex-dev/agent";
import { AgentMail, type OutboundId } from "@agentmail/convex";
import { components, internal } from "./_generated/api";
import { internalQuery, type MutationCtx } from "./_generated/server";
import { mutation, internalMutation } from "./audited";
import { ownedCompany } from "./onboarding";
import { orderTotal, validDate } from "./companyRules";
import { productUrl } from "./inventorySources";
import { orderEvent } from "./companyOrders";
import { stockFacts } from "./companyStock";
import { rankBuyingOptions } from "../src/lib/inventory-planning";
const workflow = new WorkflowManager(components.workflow);
const mail = new AgentMail(components.agentmail);
const job = { buyId: v.id("companyBuys"), planVersion: v.number() };
export const context = internalQuery({
  args: job,
  returns: v.union(
    v.null(),
    v.object({
      buy: schema.doc("companyBuys"),
      item: schema.doc("inventoryItems"),
      company: schema.doc("organizations"),
      requests: v.array(schema.doc("companyQuoteRequests")),
      suppliers: v.array(schema.doc("companySuppliers")),
    }),
  ),
  handler: async (ctx, { buyId, planVersion }) => {
    const buy = await ctx.db.get("companyBuys", buyId);
    if (!buy || buy.closed || (buy.planVersion ?? 0) !== planVersion) return null;
    const item = await ctx.db.get("inventoryItems", buy.itemId);
    const company = await ctx.db.get("organizations", buy.organizationId);
    if (!item || !company || item.archived || (buy.automatic && !item.replenishmentEnabled))
      return null;
    const requests = await ctx.db
      .query("companyQuoteRequests")
      .withIndex("by_buyId_and_planVersion", (q) =>
        q.eq("buyId", buyId).eq("planVersion", planVersion),
      )
      .take(10);
    const suppliers = await ctx.db
      .query("companySuppliers")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", buy.organizationId))
      .take(200);
    return {
      buy,
      item,
      company,
      suppliers,
      requests: requests.filter((r) => r.planVersion === planVersion),
    };
  },
});
export const start = internalMutation({
  args: job,
  returns: v.null(),
  handler: async (ctx, args) => {
    const buy = await ctx.db.get("companyBuys", args.buyId);
    if (
      !buy ||
      buy.closed ||
      (buy.planVersion ?? 0) !== args.planVersion ||
      (buy.purchasingState === "researching" &&
        buy.workflowId &&
        buy.researchPlanVersion === args.planVersion)
    )
      return null;
    const item = await ctx.db.get("inventoryItems", buy.itemId);
    if (!item || item.archived || (buy.automatic && !item.replenishmentEnabled)) return null;
    const order = buy.orderId ? await ctx.db.get("companyOrders", buy.orderId) : null;
    if (order && (order.status !== "draft" || !order.reviewRequired)) return null;
    const attempts = buy.researchPlanVersion === args.planVersion ? (buy.researchAttempt ?? 0) : 0;
    if (attempts >= 6) {
      await ctx.db.patch("companyBuys", buy._id, {
        purchasingState: "needs_details",
        purchasingNote:
          "Supplier research reached its limit. Update the supplier or buying facts to continue.",
      });
      return null;
    }
    const threadId =
      buy.researchThreadId ??
      (await createThread(ctx, components.agent, { title: `${item.name} purchasing` }));
    await ctx.db.patch("companyBuys", buy._id, {
      researchThreadId: threadId,
      researchPlanVersion: args.planVersion,
      purchasingState: "researching",
      purchasingNote: "Checking supplier availability and final terms.",
      researchAttempt: attempts + 1,
    });
    const workflowId = await workflow.start(ctx, internal.companyPurchasing.run, args);
    await ctx.db.patch("companyBuys", buy._id, { workflowId });
    return null;
  },
});
export const run = workflow
  .define({ args: job, returns: v.null() })
  .handler(async (step, args): Promise<null> => {
    try {
      await step.runAction(internal.companyPurchasingAgent.research, args, {
        retry: { maxAttempts: 2, initialBackoffMs: 2000, base: 2 },
      });
    } catch {
      await step.runMutation(internal.companyPurchasing.needsHelp, {
        ...args,
        note: "Supplier research could not finish. Retry or provide supplier details.",
      });
    }
    return null;
  });
export const needsHelp = internalMutation({
  args: { ...job, note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const buy = await ctx.db.get("companyBuys", args.buyId);
    if (
      buy &&
      !buy.closed &&
      (buy.planVersion ?? 0) === args.planVersion &&
      buy.purchasingState === "researching"
    )
      await ctx.db.patch("companyBuys", buy._id, {
        purchasingState: "needs_details",
        purchasingNote: args.note.slice(0, 500),
      });
    return null;
  },
});
export const retry = mutation({
  args: { buyId: v.id("companyBuys") },
  returns: v.null(),
  handler: async (ctx, { buyId }) => {
    const { organization } = await ownedCompany(ctx);
    const buy = await ctx.db.get("companyBuys", buyId);
    if (!buy || buy.organizationId !== organization._id) throw new ConvexError("Buy not found.");
    if (["researching", "waiting_supplier"].includes(buy.purchasingState ?? "")) return null;
    await ctx.scheduler.runAfter(0, internal.companyPurchasing.start, {
      buyId,
      planVersion: buy.planVersion ?? 0,
    });
    return null;
  },
});
const offer = v.object({
  supplierSku: v.optional(v.string()),
  supplier: v.string(),
  url: v.string(),
  email: v.optional(v.string()),
  poVerified: v.boolean(),
  quantity: v.number(),
  unit: v.string(),
  currency: v.string(),
  unitPriceCents: v.number(),
  freightCents: v.number(),
  taxCents: v.number(),
  expectedOn: v.string(),
  evidence: v.string(),
});
export const saveOffers = internalMutation({
  args: { ...job, offers: v.array(offer) },
  returns: v.union(v.id("companyOrders"), v.null()),
  handler: async (ctx, args) => {
    const buy = await ctx.db.get("companyBuys", args.buyId);
    if (
      !buy ||
      buy.closed ||
      (buy.planVersion ?? 0) !== args.planVersion ||
      buy.purchasingState !== "researching"
    )
      return null;
    const item = await ctx.db.get("inventoryItems", buy.itemId),
      company = await ctx.db.get("organizations", buy.organizationId);
    if (
      !item ||
      !company?.shippingAddress ||
      item.archived ||
      (buy.automatic && !item.replenishmentEnabled)
    )
      return null;
    if (!buy.quantity || !buy.requiredBy || args.offers.length < 1 || args.offers.length > 5)
      throw new Error("Purchase quantity, deadline and supplier options are required.");
    for (const o of args.offers) {
      productUrl(o.url);
      if (!(await supplierAllowed(ctx, buy.organizationId, o.url)))
        throw new ConvexError("This supplier is paused in your supplier directory.");
      validDate(o.expectedOn);
      if (Date.parse(`${o.expectedOn}T23:59:59.999Z`) < Date.now())
        throw new Error("Supplier arrival date has passed.");
      if (
        o.quantity !== buy.quantity ||
        o.unit !== item.unit ||
        !/^[A-Z]{3}$/.test(o.currency) ||
        !o.evidence ||
        o.evidence.length > 22000 ||
        (o.poVerified && (!o.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)))
      )
        throw new Error("Supplier terms are incomplete.");
      orderTotal(o.quantity, o.unitPriceCents, o.freightCents, o.taxCents);
    }
    const incoming = await ctx.db
      .query("companyOrders")
      .withIndex("by_inventoryItemId_and_isOpen", (q) =>
        q.eq("inventoryItemId", item._id).eq("isOpen", true),
      )
      .take(100);
    const chosen =
      args.offers.length === 1
        ? args.offers[0]
        : args.offers[
            rankBuyingOptions(
              stockFacts(item),
              incoming
                .filter((o) => ["placed", "part_received"].includes(o.status))
                .map((o) => ({
                  quantity: o.quantity - o.receivedQuantity,
                  expectedOn: o.expectedOn ?? null,
                })),
              args.offers,
            ).selected
          ];
    const existing = buy.orderId ? await ctx.db.get("companyOrders", buy.orderId) : null;
    if (existing && (existing.status !== "draft" || !existing.reviewRequired)) return existing._id;
    const owner = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organizationId", company._id))
      .take(100);
    const responsible = owner.find((u) => u.isActive && ["buyer", "admin"].includes(u.role ?? ""));
    if (!responsible) throw new Error("No purchasing member is available.");
    const terms = {
      itemName: item.name,
      sku: item.sku,
      supplierSku: chosen.supplierSku,
      sourceUrl: chosen.url,
      termsEvidence: chosen.evidence,
      unit: item.unit ?? "units",
      quantity: buy.quantity,
      unitPriceCents: chosen.unitPriceCents,
      freightCents: chosen.freightCents,
      taxCents: chosen.taxCents,
      totalCents: orderTotal(
        chosen.quantity,
        chosen.unitPriceCents,
        chosen.freightCents,
        chosen.taxCents,
      ),
      currency: chosen.currency,
      supplier: chosen.supplier,
      supplierEmail: chosen.email?.toLowerCase(),
      buyUrl: chosen.url,
      shipTo: company.shippingAddress,
      requiredBy: buy.requiredBy,
      quotedArrival: chosen.expectedOn,
      notes: buy.notes,
      orderingMethod: chosen.poVerified ? ("purchase_order" as const) : ("website" as const),
      supplierPoVerified: chosen.poVerified,
      reviewRequired: !chosen.poVerified,
      approvedAt: undefined,
      approvedBy: undefined,
      approvedTermsKey: undefined,
      executionState: undefined,
      updatedAt: Date.now(),
    };
    const id =
      existing?._id ??
      (await ctx.db.insert("companyOrders", {
        organizationId: company._id,
        inventoryItemId: item._id,
        createdBy: responsible._id,
        number: "Pending",
        receivedQuantity: 0,
        status: "draft",
        isOpen: true,
        createdAt: Date.now(),
        ...terms,
      }));
    if (existing) await ctx.db.patch("companyOrders", id, terms);
    else await ctx.db.patch("companyOrders", id, { number: `BH-${id.slice(-10).toUpperCase()}` });
    await ctx.db.patch("companyBuys", buy._id, {
      orderId: id,
      purchasingState: "ready",
      purchasingNote: chosen.poVerified
        ? "Purchase prepared. Approval will send the purchase order."
        : "Checking the supplier checkout before approval.",
    });
    const saved = (await ctx.db.get("companyOrders", id))!;
    await orderEvent(
      ctx,
      saved,
      "draft",
      `Purchase prepared for review. Supplier terms checked at ${chosen.url}.`,
    );
    if (!chosen.poVerified)
      await ctx.scheduler.runAfter(0, internal.browserCheckout.prepare, { orderId: id });
    return id;
  },
});
export const requestQuote = internalMutation({
  args: { ...job, supplier: v.string(), email: v.string(), url: v.string() },
  returns: v.union(
    v.literal("requested"),
    v.literal("waiting"),
    v.literal("needs_details"),
    v.literal("stale"),
  ),
  handler: async (ctx, args) => {
    const buy = await ctx.db.get("companyBuys", args.buyId);
    if (!buy || buy.closed || (buy.planVersion ?? 0) !== args.planVersion) return "stale";
    const item = await ctx.db.get("inventoryItems", buy.itemId);
    if (!item || item.archived || (buy.automatic && !item.replenishmentEnabled)) return "stale";
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid supplier email.");
    productUrl(args.url);
    if (!(await supplierAllowed(ctx, buy.organizationId, args.url)))
      throw new ConvexError("This supplier is paused in your supplier directory.");
    const requests = await ctx.db
      .query("companyQuoteRequests")
      .withIndex("by_buyId_and_planVersion", (q) =>
        q.eq("buyId", buy._id).eq("planVersion", args.planVersion),
      )
      .take(10);
    const prior = requests.find((r) => r.planVersion === args.planVersion && r.email === email);
    if (prior) {
      const canFollow = prior.state === "replied" && prior.followups < 2;
      if (canFollow) {
        await ctx.db.patch("companyQuoteRequests", prior._id, { state: "waiting" });
        await ctx.scheduler.runAfter(0, internal.companyPurchasing.followup, {
          requestId: prior._id,
        });
      }
      if (canFollow || ["waiting", "sending"].includes(prior.state))
        await ctx.db.patch("companyBuys", buy._id, {
          purchasingState: "waiting_supplier",
          purchasingNote: canFollow
            ? "Asking the supplier to complete the missing terms."
            : "The existing quote request needs checking. No duplicate request was sent.",
        });
      return canFollow || ["waiting", "sending"].includes(prior.state)
        ? "waiting"
        : "needs_details";
    }
    if (requests.filter((r) => r.planVersion === args.planVersion).length >= 3)
      return "needs_details";
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", buy.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    const company = await ctx.db.get("organizations", buy.organizationId);
    if (!inbox || !company?.shippingAddress)
      throw new Error("Purchasing inbox and shipping address are required.");
    const outboundId = await mail.sendMessage(ctx, inbox.inboxId, {
      to: email,
      subject: `Quote request: ${item.name}`,
      text: `Please quote ${buy.quantity} ${item.unit} of ${item.name}, ${item.supplierSku ? `supplier SKU ${item.supplierSku}` : `product ${args.url} (internal item reference ${item.sku})`}, delivered to ${company.shippingAddress} by ${buy.requiredBy}. Confirm exact SKU and stock unit, quantity, currency, unit price, freight, taxes, final total, arrival date (YYYY-MM-DD), and whether you accept emailed purchase orders. This is a request for a quote, not an order.`,
    });
    const requestId = await ctx.db.insert("companyQuoteRequests", {
      buyId: buy._id,
      organizationId: buy.organizationId,
      itemId: item._id,
      planVersion: args.planVersion,
      supplier: args.supplier,
      email,
      url: args.url,
      providerOutboundId: outboundId,
      followups: 0,
      state: "sending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch("companyBuys", buy._id, {
      purchasingState: "waiting_supplier",
      purchasingNote: "Asked the supplier for complete terms. No purchase has been placed.",
    });
    await ctx.scheduler.runAfter(1000, internal.companyPurchasing.reconcileQuote, {
      requestId,
      attempt: 0,
    });
    return "requested";
  },
});
export const reconcileQuote = internalMutation({
  args: { requestId: v.id("companyQuoteRequests"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get("companyQuoteRequests", args.requestId);
    if (!request?.providerOutboundId || request.state !== "sending") return null;
    const status = await mail.status(ctx, request.providerOutboundId as OutboundId);
    if ((!status || status.status === "pending") && args.attempt < 60) {
      await ctx.scheduler.runAfter(5000, internal.companyPurchasing.reconcileQuote, {
        ...args,
        attempt: args.attempt + 1,
      });
      return null;
    }
    const success = status?.status === "sent" || status?.status === "delivered";
    await ctx.db.patch("companyQuoteRequests", request._id, {
      state: success ? "waiting" : "failed",
      providerThreadId: status?.threadId ?? undefined,
      updatedAt: Date.now(),
    });
    if (success)
      await ctx.scheduler.runAfter(24 * 60 * 60 * 1000, internal.companyPurchasing.followup, {
        requestId: request._id,
      });
    else {
      const buy = await ctx.db.get("companyBuys", request.buyId);
      if (buy && (buy.planVersion ?? 0) === request.planVersion)
        await ctx.db.patch("companyBuys", buy._id, {
          purchasingState: "needs_details",
          purchasingNote:
            "Quote request delivery is unconfirmed. Check the purchasing inbox before contacting the supplier again.",
        });
    }
    return null;
  },
});
export const followup = internalMutation({
  args: { requestId: v.id("companyQuoteRequests") },
  returns: v.null(),
  handler: async (ctx, { requestId }) => {
    const request = await ctx.db.get("companyQuoteRequests", requestId);
    if (!request || request.state !== "waiting" || !request.providerOutboundId) return null;
    const buy = await ctx.db.get("companyBuys", request.buyId),
      item = await ctx.db.get("inventoryItems", request.itemId);
    if (
      !buy ||
      buy.closed ||
      (buy.planVersion ?? 0) !== request.planVersion ||
      !item ||
      item.archived ||
      (buy.automatic && !item.replenishmentEnabled)
    )
      return null;
    const order = buy.orderId ? await ctx.db.get("companyOrders", buy.orderId) : null;
    if (order && (order.status !== "draft" || !order.reviewRequired)) return null;
    if (request.followups >= 2 || (buy.requiredBy && Date.parse(buy.requiredBy) < Date.now())) {
      await ctx.db.patch("companyBuys", buy._id, {
        purchasingState: "needs_details",
        purchasingNote: "The supplier has not supplied complete terms. Checking another supplier.",
      });
      await ctx.scheduler.runAfter(0, internal.companyPurchasing.start, {
        buyId: buy._id,
        planVersion: request.planVersion,
      });
      return null;
    }
    const inbox = await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_organization_and_provider", (q) =>
        q.eq("organizationId", request.organizationId).eq("provider", "agentmail"),
      )
      .unique();
    const status = await mail.status(ctx, request.providerOutboundId as OutboundId);
    if (!inbox || !status?.agentmailMessageId) return null;
    await mail.replyToMessage(ctx, inbox.inboxId, status.agentmailMessageId, {
      to: request.email,
      text: "Following up on the quote request below. Please confirm exact product, quantity, all charges, arrival date, and whether you accept emailed purchase orders. This is not a purchase order.",
    });
    await ctx.db.patch("companyQuoteRequests", requestId, {
      followups: request.followups + 1,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(24 * 60 * 60 * 1000, internal.companyPurchasing.followup, {
      requestId,
    });
    return null;
  },
});
export async function receiveQuoteReply(
  ctx: MutationCtx,
  message: Record<string, unknown>,
  _eventId: string,
) {
  if (typeof message.thread_id !== "string") return false;
  const request = await ctx.db
    .query("companyQuoteRequests")
    .withIndex("by_providerThreadId", (q) => q.eq("providerThreadId", message.thread_id as string))
    .unique();
  if (!request) return false;
  const inbox = await ctx.db
    .query("purchasingInboxes")
    .withIndex("by_organization_and_provider", (q) =>
      q.eq("organizationId", request.organizationId).eq("provider", "agentmail"),
    )
    .unique();
  const from =
    typeof message.from === "string"
      ? (message.from.match(/<([^<>]+)>/)?.[1] ?? message.from).trim().toLowerCase()
      : "";
  const body = [message.extracted_text, message.text].find(
    (value) => typeof value === "string" && value.trim(),
  ) as string | undefined;
  if (
    !inbox ||
    message.inbox_id !== inbox.inboxId ||
    from !== request.email ||
    !body ||
    request.reply === body.slice(0, 22000)
  )
    return true;
  await ctx.db.patch("companyQuoteRequests", request._id, {
    reply: body.slice(0, 22000),
    state: "replied",
    updatedAt: Date.now(),
  });
  const buy = await ctx.db.get("companyBuys", request.buyId);
  if (buy && !buy.closed && (buy.planVersion ?? 0) === request.planVersion) {
    await ctx.db.patch("companyBuys", buy._id, { purchasingState: "needs_details" });
    await ctx.scheduler.runAfter(0, internal.companyPurchasing.start, {
      buyId: buy._id,
      planVersion: request.planVersion,
    });
  }
  return true;
}
