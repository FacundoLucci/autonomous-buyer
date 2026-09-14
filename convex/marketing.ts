import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  env,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./identity";
import { attribution, stage, deliveryStatus } from "./marketingFields";
import { limits } from "./rateLimits";
import type { Infer } from "convex/values";

function validSource(source: Infer<typeof attribution>) {
  if (
    !Number.isFinite(source.capturedAt) ||
    Object.values(source).some((x) => typeof x === "string" && x.length > 250) ||
    !source.visitorId
  )
    throw new ConvexError("Invalid visit details.");
}
export function replyDueAt(now: number) {
  const next = new Date(now + 86400000);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  });
  while (["Sat", "Sun"].includes(weekday.format(next))) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}
async function record(
  ctx: MutationCtx,
  source: Infer<typeof attribution>,
  event: "visit" | "demo_use" | "inquiry" | "booking_confirmed" | "pilot_started",
) {
  const prior = await ctx.db
    .query("marketingEvents")
    .withIndex("by_visitorId_and_event", (q) =>
      q.eq("visitorId", source.visitorId).eq("event", event),
    )
    .unique();
  if (!prior)
    await ctx.db.insert("marketingEvents", { visitorId: source.visitorId, event, source });
}
export const track = mutation({
  args: { source: attribution, event: v.union(v.literal("visit"), v.literal("demo_use")) },
  handler: async (ctx, args) => {
    validSource(args.source);
    const allowed = await limits.limit(ctx, "marketingEvent");
    if (allowed.ok) await record(ctx, args.source, args.event);
    return null;
  },
});
export const inquire = mutation({
  args: {
    email: v.string(),
    businessName: v.string(),
    challenge: v.string(),
    website: v.string(),
    source: attribution,
  },
  handler: async (ctx, args) => {
    if (args.website) throw new ConvexError("Please try again.");
    const email = args.email.trim().toLowerCase();
    const businessName = args.businessName.trim();
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) || email.length > 254)
      throw new ConvexError("Enter a valid email address.");
    if (!businessName || businessName.length > 120)
      throw new ConvexError("Enter your business name (up to 120 characters).");
    if (args.challenge.length > 1000)
      throw new ConvexError("Keep your challenge under 1,000 characters.");
    validSource(args.source);
    const emailLimit = await limits.limit(ctx, "marketingEmail", { key: email });
    const globalLimit = await limits.limit(ctx, "marketingGlobal");
    if (!emailLimit.ok || !globalLimit.ok) return { ok: false as const };
    const prior = await ctx.db
      .query("marketingLeads")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!prior) {
      const leadId = await ctx.db.insert("marketingLeads", {
        email,
        businessName,
        challenge: args.challenge.trim(),
        source: args.source,
        stage: "new",
        replyDueAt: replyDueAt(Date.now()),
        confirmation: "pending",
        notification: "pending",
      });
      await ctx.scheduler.runAfter(0, internal.marketingDelivery.send, {
        leadId,
        kind: "confirmation",
      });
      await ctx.scheduler.runAfter(0, internal.marketingDelivery.send, {
        leadId,
        kind: "notification",
      });
    } else {
      await ctx.db.patch("marketingLeads", prior._id, {
        businessName,
        challenge: args.challenge.trim(),
      });
    }
    await record(ctx, args.source, "inquiry");
    return { ok: true as const };
  },
});
export const list = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: (ctx, args) =>
    ctx.db.query("marketingLeads").order("desc").paginate(args.paginationOpts),
});
export const events = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: (ctx, args) =>
    ctx.db.query("marketingEvents").order("desc").paginate(args.paginationOpts),
});
export const get = internalQuery({
  args: { leadId: v.id("marketingLeads") },
  handler: (ctx, args) => ctx.db.get("marketingLeads", args.leadId),
});
export const delivery = internalMutation({
  args: {
    leadId: v.id("marketingLeads"),
    kind: v.union(v.literal("confirmation"), v.literal("notification")),
    status: deliveryStatus,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("marketingLeads", args.leadId, { [args.kind]: args.status });
    return null;
  },
});
export const ownerList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const id = await getAuthUserId(ctx);
    if (!id || id !== env.MARKETING_OWNER_USER_ID) throw new ConvexError("This list is private.");
    const page = await ctx.db.query("marketingLeads").order("desc").paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (lead) => ({
          ...lead,
          bookings: await ctx.db
            .query("marketingBookings")
            .withIndex("by_leadId", (q) => q.eq("leadId", lead._id))
            .order("desc")
            .take(10),
        })),
      ),
    };
  },
});
export const updateStage = mutation({
  args: { leadId: v.id("marketingLeads"), stage },
  handler: async (ctx, args) => {
    const id = await getAuthUserId(ctx);
    if (!id || id !== env.MARKETING_OWNER_USER_ID) throw new ConvexError("This list is private.");
    const lead = await ctx.db.get("marketingLeads", args.leadId);
    if (!lead) throw new ConvexError("Inquiry not found.");
    await ctx.db.patch("marketingLeads", args.leadId, {
      stage: args.stage,
      ...(args.stage === "pilot_started" && !lead.pilotStartedAt
        ? { pilotStartedAt: Date.now() }
        : {}),
    });
    if (args.stage === "pilot_started") await record(ctx, lead.source, "pilot_started");
  },
});
export const booking = internalMutation({
  args: {
    uid: v.string(),
    email: v.string(),
    name: v.string(),
    status: v.string(),
    startTime: v.string(),
    updatedAt: v.number(),
    visitorId: v.optional(v.string()),
    rescheduleUid: v.optional(v.string()),
    rescheduleStartTime: v.optional(v.string()),
    source: v.optional(attribution),
  },
  handler: async (ctx, args) => {
    const priorBooking = await ctx.db
      .query("marketingBookings")
      .withIndex("by_uid", (q) => q.eq("uid", args.uid))
      .unique();
    if (priorBooking && priorBooking.updatedAt >= args.updatedAt) return null;
    let lead = await ctx.db
      .query("marketingLeads")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .unique();
    if (!lead) {
      const visit = args.visitorId
        ? await ctx.db
            .query("marketingEvents")
            .withIndex("by_visitorId_and_event", (q) =>
              q.eq("visitorId", args.visitorId!).eq("event", "visit"),
            )
            .unique()
        : null;
      const source = args.source ??
        visit?.source ?? {
          visitorId: `cal:${args.uid}`,
          landingPath: "/walkthrough",
          referrer: "",
          capturedAt: Date.now(),
        };
      const id = await ctx.db.insert("marketingLeads", {
        email: args.email.toLowerCase(),
        businessName: args.name,
        challenge: "Booked through Cal.com. Business details to discuss.",
        source,
        stage: "new",
        replyDueAt: replyDueAt(Date.now()),
        confirmation: "cal_managed",
        notification: "pending",
      });
      lead = (await ctx.db.get("marketingLeads", id))!;
      await ctx.scheduler.runAfter(0, internal.marketingDelivery.send, {
        leadId: id,
        kind: "notification",
      });
    }
    if (args.rescheduleUid && args.rescheduleUid !== args.uid) {
      const previous = await ctx.db
        .query("marketingBookings")
        .withIndex("by_uid", (q) => q.eq("uid", args.rescheduleUid!))
        .unique();
      if (previous && previous.updatedAt < args.updatedAt)
        await ctx.db.patch("marketingBookings", previous._id, {
          status: "rescheduled",
          updatedAt: args.updatedAt,
        });
      else if (!previous)
        await ctx.db.insert("marketingBookings", {
          uid: args.rescheduleUid,
          leadId: lead._id,
          status: "rescheduled",
          startTime: args.rescheduleStartTime ?? args.startTime,
          updatedAt: args.updatedAt,
        });
    }
    const booking = {
      uid: args.uid,
      leadId: lead._id,
      status: args.status,
      startTime: args.startTime,
      updatedAt: args.updatedAt,
    };
    if (priorBooking) await ctx.db.patch("marketingBookings", priorBooking._id, booking);
    else await ctx.db.insert("marketingBookings", booking);
    if (args.status === "confirmed") {
      await ctx.db.patch("marketingLeads", lead._id, {
        confirmedBookingAt: lead.confirmedBookingAt ?? Date.now(),
      });
      await record(ctx, lead.source, "booking_confirmed");
    }
    return null;
  },
});
