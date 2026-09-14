/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { expect, test, vi, afterEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { replyDueAt } from "./marketing";
const modules = import.meta.glob("./**/*.ts");
const source = {
  visitorId: "visitor-1",
  landingPath: "/",
  referrer: "https://example.com",
  capturedAt: 1,
  utm_source: "linkedin",
  utm_campaign: "pilot",
};
const inquiry = {
  email: " Test@example.com ",
  businessName: "Test cafe",
  challenge: "Cups",
  website: "",
  source,
};
function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  return t;
}
afterEach(() => {
  vi.unstubAllEnvs();
});
test("anonymous inquiry saves attribution, queues follow-up, and deduplicates email", async () => {
  const t = setup();
  expect(await t.mutation(api.marketing.inquire, inquiry)).toEqual({ ok: true });
  await t.mutation(api.marketing.inquire, inquiry);
  const rows = await t.query(internal.marketing.list, {
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(rows.page).toHaveLength(1);
  expect(rows.page[0]).toMatchObject({
    email: "test@example.com",
    source,
    confirmation: "pending",
    notification: "pending",
    stage: "new",
  });
  await t.run(async (ctx) => {
    expect(await ctx.db.system.query("_scheduled_functions").take(10)).toHaveLength(2);
  });
  await expect(
    t.query(api.marketing.ownerList, { paginationOpts: { numItems: 25, cursor: null } }),
  ).rejects.toThrow("private");
});
test("spam, invalid fields, oversized attribution and repeated emails cannot enqueue mail", async () => {
  const t = setup();
  for (const patch of [
    { website: "spam" },
    { email: "invalid" },
    { businessName: " " },
    { challenge: "x".repeat(1001) },
    { source: { ...source, utm_source: "x".repeat(251) } },
  ])
    await expect(t.mutation(api.marketing.inquire, { ...inquiry, ...patch })).rejects.toThrow();
  await t.mutation(api.marketing.inquire, inquiry);
  await t.mutation(api.marketing.inquire, inquiry);
  expect(await t.mutation(api.marketing.inquire, inquiry)).toEqual({ ok: false });
});
test("bookings use captured source, deduplicate webhooks and reject stale updates", async () => {
  const t = setup();
  await t.mutation(api.marketing.track, { source, event: "visit" });
  const booking = {
    uid: "cal-1",
    email: "booker@example.com",
    name: "Booker",
    status: "confirmed",
    startTime: "2026-09-14T10:00:00Z",
    updatedAt: 100,
    visitorId: source.visitorId,
  };
  await t.mutation(internal.marketing.booking, booking);
  await t.mutation(internal.marketing.booking, booking);
  await t.mutation(internal.marketing.booking, { ...booking, status: "cancelled", updatedAt: 200 });
  await t.mutation(internal.marketing.booking, booking);
  const leads = await t.query(internal.marketing.list, {
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(leads.page).toHaveLength(1);
  expect(leads.page[0].source).toEqual(source);
  await t.run(async (ctx) => {
    expect((await ctx.db.query("marketingBookings").take(5))[0].status).toBe("cancelled");
  });
  const events = await t.query(internal.marketing.events, {
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(events.page.filter((e) => e.event === "booking_confirmed")).toHaveLength(1);
});
test("only the configured owner can view leads or mark a pilot started", async () => {
  const t = setup();
  await t.mutation(api.marketing.inquire, inquiry);
  const lead = (
    await t.query(internal.marketing.list, { paginationOpts: { numItems: 25, cursor: null } })
  ).page[0];
  const ownerId = await t.run((ctx) => ctx.db.insert("users", { name: "Owner" }));
  vi.stubEnv("MARKETING_OWNER_USER_ID", ownerId);
  const owner = t.withIdentity({ subject: ownerId });
  await expect(
    t
      .withIdentity({ subject: "someone-else" })
      .mutation(api.marketing.updateStage, { leadId: lead._id, stage: "pilot_started" }),
  ).rejects.toThrow("private");
  await owner.mutation(api.marketing.updateStage, { leadId: lead._id, stage: "pilot_started" });
  expect(
    (await owner.query(api.marketing.ownerList, { paginationOpts: { numItems: 25, cursor: null } }))
      .page[0].pilotStartedAt,
  ).toBeTypeOf("number");
});
test("reply target skips weekends", () => {
  expect(new Date(replyDueAt(Date.parse("2026-09-11T16:00:00Z"))).toISOString()).toBe(
    "2026-09-14T16:00:00.000Z",
  );
});
test("unsigned booking callbacks are rejected", async () => {
  vi.stubEnv("CAL_WEBHOOK_SECRET", "test-secret");
  const t = setup();
  expect((await t.fetch("/api/marketing/cal", { method: "POST", body: "{}" })).status).toBe(401);
});
test("late Chicago Friday inquiries are due Monday, not Sunday night", () => {
  expect(new Date(replyDueAt(Date.parse("2026-09-12T03:00:00Z"))).toISOString()).toBe(
    "2026-09-15T03:00:00.000Z",
  );
});
test("valid signed Cal events are saved and tampered events are rejected", async () => {
  vi.stubEnv("CAL_WEBHOOK_SECRET", "test-secret");
  const t = setup();
  const body = JSON.stringify({
    triggerEvent: "BOOKING_CREATED",
    createdAt: "2026-09-11T12:00:00Z",
    payload: {
      uid: "signed-booking",
      type: "buyhard",
      startTime: "2026-09-14T10:00:00Z",
      attendees: [{ email: "booker@example.com", name: "Test" }],
      metadata: { attribution: JSON.stringify(source) },
    },
  });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("test-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const signature = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join(
    "",
  );
  expect(
    (
      await t.fetch("/api/marketing/cal", {
        method: "POST",
        body,
        headers: { "x-cal-signature-256": signature },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await t.fetch("/api/marketing/cal", {
        method: "POST",
        body: body.replace("booker@", "attacker@"),
        headers: { "x-cal-signature-256": signature },
      })
    ).status,
  ).toBe(401);
  expect(
    (await t.query(internal.marketing.list, { paginationOpts: { numItems: 25, cursor: null } }))
      .page[0].source,
  ).toEqual(source);
});
test("email provider acceptance is recorded without claiming inbox delivery", async () => {
  const t = setup();
  await t.mutation(api.marketing.inquire, inquiry);
  const lead = (
    await t.query(internal.marketing.list, { paginationOpts: { numItems: 25, cursor: null } })
  ).page[0];
  vi.stubEnv("ALERT_EMAIL_URL", "https://mail.example.test/send");
  vi.stubEnv("ALERT_EMAIL_SECRET", "test");
  const fetchMock = vi
    .fn()
    .mockResolvedValue(Response.json({ status: "queued", messageId: "mail-1" }));
  vi.stubGlobal("fetch", fetchMock);
  try {
    await t.action(internal.marketingDelivery.send, { leadId: lead._id, kind: "confirmation" });
    const saved = await t.query(internal.marketing.get, { leadId: lead._id });
    expect(saved?.confirmation).toBe("queued");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ to: "test@example.com" });
    await t.action(internal.marketingDelivery.send, { leadId: lead._id, kind: "confirmation" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
test("rescheduling retires the old booking even when creation arrives late", async () => {
  const t = setup();
  const booking = {
    uid: "new-uid",
    email: "booker@example.com",
    name: "Booker",
    status: "confirmed",
    startTime: "2026-09-15T10:00:00Z",
    updatedAt: 200,
    rescheduleUid: "old-uid",
    rescheduleStartTime: "2026-09-14T10:00:00Z",
  };
  await t.mutation(internal.marketing.booking, booking);
  await t.mutation(internal.marketing.booking, {
    uid: "old-uid",
    email: booking.email,
    name: booking.name,
    status: "confirmed",
    startTime: "2026-09-14T10:00:00Z",
    updatedAt: 100,
  });
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("marketingBookings").take(5);
    expect(rows.find((b) => b.uid === "old-uid")?.status).toBe("rescheduled");
    expect(rows.find((b) => b.uid === "new-uid")?.status).toBe("confirmed");
  });
});

test("Cal signed test pings do not need a booking UID or create leads", async () => {
  const t = setup();
  vi.stubEnv("CAL_WEBHOOK_SECRET", "ping-secret");
  const body = JSON.stringify({
    triggerEvent: "BOOKING_CREATED",
    createdAt: new Date().toISOString(),
    payload: { type: "Test", attendees: [{ email: "jdoe@example.com", name: "John Doe" }] },
  });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("ping-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const signature = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join(
    "",
  );
  expect(
    (
      await t.fetch("/api/marketing/cal", {
        method: "POST",
        body,
        headers: { "x-cal-signature-256": signature },
      })
    ).status,
  ).toBe(200);
  expect(
    (await t.query(internal.marketing.list, { paginationOpts: { numItems: 25, cursor: null } }))
      .page,
  ).toHaveLength(0);
});
