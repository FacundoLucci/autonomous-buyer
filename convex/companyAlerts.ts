import { ConvexError, v } from "convex/values";
import { WorkflowManager } from "@convex-dev/workflow";
import { paginationOptsValidator } from "convex/server";
import { components, internal } from "./_generated/api";
import { env, query, type MutationCtx } from "./_generated/server";
import { mutation, internalMutation } from "./audited";
import type { Id } from "./_generated/dataModel";
import { ownedCompany } from "./onboarding";
import { validEmail } from "./companyRules";
import { limits } from "./rateLimits";
import { alertKind, alertStatus } from "./companyFields";
import { availableStock, inventoryPlan } from "../src/lib/inventory-planning";
import schema from "./schema";
import { activeCompanyItems, stockFacts } from "./companyStock";

const workflow = new WorkflowManager(components.workflow);
export async function queueAlert(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  kind: "low_stock" | "order_update",
  key: string,
  subject: string,
  text: string,
  orderId?: Id<"companyOrders">,
) {
  const settings = await ctx.db
    .query("companyAlertSettings")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .unique();
  if (!settings?.verifiedAt || !(kind === "low_stock" ? settings.lowStock : settings.orderUpdates))
    return;
  const prior = await ctx.db
    .query("companyAlerts")
    .withIndex("by_organizationId_and_key", (q) =>
      q.eq("organizationId", organizationId).eq("key", key),
    )
    .unique();
  if (prior) return;
  const id = await ctx.db.insert("companyAlerts", {
    organizationId,
    settingsId: settings._id,
    email: settings.email,
    kind,
    key,
    subject: subject.replace(/[\r\n]/g, " ").slice(0, 200),
    text: `${text.slice(0, 14000)}\n\nOpen your buy desk: ${(env.APP_URL ?? env.CONVEX_SITE_URL).replace(/\/$/, "")}${orderId ? `/?companyOrder=${orderId}` : "/"}\nManage email alerts from Company settings in your buy desk.`,
    status: "pending",
    attempt: 0,
    createdAt: Date.now(),
  });
  await workflow.start(ctx, internal.companyAlerts.deliver, { alertId: id });
}

export const getSettings = query({
  args: {},
  returns: v.object({
    configured: v.boolean(),
    email: v.string(),
    verified: v.boolean(),
    lowStock: v.boolean(),
    orderUpdates: v.boolean(),
    recent: v.array(
      v.object({
        id: v.id("companyAlerts"),
        kind: alertKind,
        subject: v.string(),
        status: alertStatus,
        error: v.union(v.string(), v.null()),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const { organization } = await ownedCompany(ctx);
    const settings = await ctx.db
      .query("companyAlertSettings")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .unique();
    const recent = await ctx.db
      .query("companyAlerts")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(15);
    return {
      configured: !!env.ALERT_EMAIL_URL && !!env.ALERT_EMAIL_SECRET,
      email: settings?.email ?? "",
      verified: !!settings?.verifiedAt,
      lowStock: settings?.lowStock ?? true,
      orderUpdates: settings?.orderUpdates ?? true,
      recent: recent.map((a) => ({
        id: a._id,
        kind: a.kind,
        subject: a.subject,
        status: a.status,
        error: a.error ?? null,
        createdAt: a.createdAt,
      })),
    };
  },
});

export const beginVerification = internalMutation({
  args: { email: v.string(), hash: v.string(), code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, organization } = await ownedCompany(ctx);
    if (!env.ALERT_EMAIL_URL || !env.ALERT_EMAIL_SECRET)
      throw new ConvexError("Email alerts are not configured yet.");
    const email = validEmail(args.email);
    await limits.limit(ctx, "verifyEmail", { key: organization._id, throws: true });
    await limits.limit(ctx, "verifyAddress", { key: email, throws: true });
    const settings = await ctx.db
      .query("companyAlertSettings")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .unique();
    const fields = {
      organizationId: organization._id,
      userId: user._id,
      email,
      verifiedAt: undefined,
      lowStock: settings?.lowStock ?? true,
      orderUpdates: settings?.orderUpdates ?? true,
      challengeHash: args.hash,
      challengeExpiresAt: Date.now() + 15 * 60_000,
      challengeAttempts: 0,
      updatedAt: Date.now(),
    };
    const settingsId = settings
      ? settings._id
      : await ctx.db.insert("companyAlertSettings", fields);
    if (settings) await ctx.db.patch("companyAlertSettings", settingsId, fields);
    const alertId = await ctx.db.insert("companyAlerts", {
      organizationId: organization._id,
      settingsId,
      email,
      kind: "verification",
      key: `verify:${args.hash}`,
      subject: "Verify your BUY HARD email alerts",
      text: `Your BUY HARD verification code is ${args.code}.\n\nEnter it in your buy desk within 15 minutes to enable alerts for ${organization.name}.\nIf you did not request this, ignore this email.`,
      status: "pending",
      attempt: 0,
      createdAt: Date.now(),
    });
    await workflow.start(ctx, internal.companyAlerts.deliver, { alertId });
    return null;
  },
});
export const verifyHash = internalMutation({
  args: { hash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    await limits.limit(ctx, "verifyAttempt", { key: organization._id, throws: true });
    const s = await ctx.db
      .query("companyAlertSettings")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .unique();
    if (
      !s ||
      !s.challengeHash ||
      !s.challengeExpiresAt ||
      s.challengeExpiresAt < Date.now() ||
      (s.challengeAttempts ?? 0) >= 5
    )
      return false;
    if (s.challengeHash !== args.hash) {
      await ctx.db.patch("companyAlertSettings", s._id, {
        challengeAttempts: (s.challengeAttempts ?? 0) + 1,
      });
      return false;
    }
    await ctx.db.patch("companyAlertSettings", s._id, {
      verifiedAt: Date.now(),
      challengeHash: undefined,
      challengeExpiresAt: undefined,
      updatedAt: Date.now(),
    });
    const items = await ctx.db
      .query("inventoryItems")
      .withIndex("by_org_sku", (q) => q.eq("organizationId", organization._id))
      .take(100);
    for (const item of items)
      await ctx.scheduler.runAfter(0, internal.companyAlerts.evaluateItem, { itemId: item._id });
    return true;
  },
});
export const preferences = mutation({
  args: { lowStock: v.boolean(), orderUpdates: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    const s = await ctx.db
      .query("companyAlertSettings")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .unique();
    if (!s) throw new ConvexError("Add your alert email first.");
    await ctx.db.patch("companyAlertSettings", s._id, { ...args, updatedAt: Date.now() });
    return null;
  },
});

export const evaluateItem = internalMutation({
  args: { itemId: v.id("inventoryItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("inventoryItems", args.itemId);
    if (!item || item.isDemo || item.archived) return null;
    const projected = availableStock(stockFacts(item));
    const orders = await ctx.db
      .query("companyOrders")
      .withIndex("by_inventoryItemId_and_isOpen", (q) =>
        q.eq("inventoryItemId", item._id).eq("isOpen", true),
      )
      .take(101);
    const plan = inventoryPlan(
      stockFacts(item),
      orders
        .filter((o) => ["placed", "part_received"].includes(o.status))
        .map((o) => ({
          quantity: Math.max(0, o.quantity - o.receivedQuantity),
          expectedOn: o.expectedOn ?? null,
        })),
    );
    const needsAction = plan.attention && plan.low;
    await ctx.db.patch("inventoryItems", item._id, {
      estimatedQuantity: projected ?? undefined,
      status: needsAction
        ? "action_required"
        : projected === null ||
            item.estimatedDailyUsage === undefined ||
            item.supplierLeadTimeDays === undefined
          ? "watch"
          : "healthy",
    });
    await ctx.scheduler.runAfter(0, internal.replenishment.evaluate, { itemId: item._id });
    if (needsAction) {
      const settings = await ctx.db
        .query("companyAlertSettings")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", item.organizationId))
        .unique();
      const day = new Date().toISOString().slice(0, 10);
      await queueAlert(
        ctx,
        item.organizationId,
        "low_stock",
        `stock:${item._id}:${settings?.verifiedAt ?? 0}:${day}`,
        `Low stock: ${item.name}`,
        `${item.name} (${item.sku}) is at its reorder point.\nEstimated stock: ${Math.floor(projected!)} ${item.unit ?? "units"}. Last recorded count: ${item.quantityOnHand}.\n${item.replenishmentEnabled ? "Your purchasing agent is checking replenishment using your saved usage. Update the count if it has changed unexpectedly." : "Estimates use your daily usage; update the shelf count if it has changed unexpectedly."}\n${item.buyUrl ? `Buy link: ${item.buyUrl}` : "Add a buy link or supplier email in your buy desk."}`,
      );
    }
    return null;
  },
});

export const sweep = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("organizations")
      .withIndex("by_is_demo_and_name", (q) => q.eq("isDemo", false))
      .paginate(args.paginationOpts);
    for (const org of page.page)
      await ctx.scheduler.runAfter(0, internal.companyAlerts.checkCompany, {
        organizationId: org._id,
      });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.companyAlerts.sweep, {
        paginationOpts: { numItems: 25, cursor: page.continueCursor },
      });
    return null;
  },
});
export const checkCompany = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const items = await activeCompanyItems(ctx, args.organizationId);
    for (const item of items)
      await ctx.scheduler.runAfter(0, internal.companyAlerts.evaluateItem, { itemId: item._id });
    const orders = await ctx.db
      .query("companyOrders")
      .withIndex("by_organizationId_and_isOpen", (q) =>
        q.eq("organizationId", args.organizationId).eq("isOpen", true),
      )
      .take(100);
    const today = new Date().toISOString().slice(0, 10);
    for (const order of orders)
      if (
        order.expectedOn &&
        order.expectedOn < today &&
        ["placed", "part_received"].includes(order.status)
      )
        await queueAlert(
          ctx,
          args.organizationId,
          "order_update",
          `late:${order._id}:${today}`,
          `Delivery overdue: ${order.number}`,
          `${order.itemName} was expected ${order.expectedOn}. Check with ${order.supplier} or record the delivery from your buy desk.`,
          order._id,
        );
    return null;
  },
});

export const claim = internalMutation({
  args: { alertId: v.id("companyAlerts") },
  returns: v.union(schema.doc("companyAlerts"), v.null()),
  handler: async (ctx, args) => {
    const alert = await ctx.db.get("companyAlerts", args.alertId);
    if (!alert || alert.status !== "pending") return null;
    const settings = await ctx.db.get("companyAlertSettings", alert.settingsId);
    const active =
      settings?.email === alert.email &&
      (alert.kind === "verification"
        ? alert.key === `verify:${settings.challengeHash}` &&
          (settings.challengeExpiresAt ?? 0) > Date.now()
        : !!settings.verifiedAt &&
          (alert.kind === "low_stock" ? settings.lowStock : settings.orderUpdates));
    if (!active) {
      await ctx.db.patch("companyAlerts", alert._id, {
        status: "skipped",
        text: alert.kind === "verification" ? "Verification superseded." : alert.text,
      });
      return null;
    }
    await ctx.db.patch("companyAlerts", alert._id, {
      status: "sending",
      attempt: alert.attempt + 1,
    });
    return alert;
  },
});
export const finish = internalMutation({
  args: {
    alertId: v.id("companyAlerts"),
    status: alertStatus,
    error: v.optional(v.string()),
    providerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const alert = await ctx.db.get("companyAlerts", args.alertId);
    if (!alert || alert.status !== "sending") return null;
    await ctx.db.patch("companyAlerts", alert._id, {
      status: args.status,
      error: args.error,
      providerId: args.providerId,
      completedAt: Date.now(),
      ...(alert.kind === "verification" ? { text: "Verification email sent." } : {}),
    });
    return null;
  },
});
export const deliver = workflow
  .define({ args: { alertId: v.id("companyAlerts") }, returns: v.null() })
  .handler(async (step, args): Promise<null> => {
    const alert = await step.runMutation(internal.companyAlerts.claim, args);
    if (!alert) return null;
    try {
      const result = await step.runAction(
        internal.companyEmail.sendAlert,
        { email: alert.email, subject: alert.subject, text: alert.text },
        { retry: false },
      );
      await step.runMutation(internal.companyAlerts.finish, { ...args, ...result });
    } catch {
      await step.runMutation(internal.companyAlerts.finish, {
        ...args,
        status: "unknown",
        error:
          "Delivery could not be confirmed. Check the inbox before requesting another message.",
      });
    }
    return null;
  });
