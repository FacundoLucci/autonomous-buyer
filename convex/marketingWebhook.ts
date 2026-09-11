import { httpAction, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { z } from "zod";
const payload = z.object({
  triggerEvent: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  payload: z.object({
    uid: z.string().min(1).max(200),
    type: z.string(),
    startTime: z.string().datetime({ offset: true }),
    attendees: z
      .array(z.object({ email: z.email().max(254), name: z.string().max(120) }))
      .min(1)
      .max(100),
    metadata: z.record(z.string(), z.unknown()).optional(),
    status: z.string().optional(),
    requiresConfirmation: z.boolean().optional(),
    rescheduleUid: z.string().max(200).nullable().optional(),
    rescheduleStartTime: z.string().datetime({ offset: true }).nullable().optional(),
  }),
});
export const webhook = httpAction(async (ctx, request) => {
  if (!env.CAL_WEBHOOK_SECRET) return new Response("Not configured", { status: 503 });
  const raw = await request.text();
  if (raw.length > 100000) return new Response("Too large", { status: 413 });
  const signature = request.headers.get("x-cal-signature-256") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(signature)) return new Response("Unauthorized", { status: 401 });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.CAL_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.match(/../g)!, (x) => parseInt(x, 16));
  if (!(await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(raw))))
    return new Response("Unauthorized", { status: 401 });
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  // Cal's signed ping uses type "Test" and has no booking UID.
  const eventType = z.object({ payload: z.object({ type: z.string() }) }).safeParse(decoded);
  if (eventType.success && eventType.data.payload.type !== "buyhard")
    return new Response("Ignored");
  const parsed = payload.safeParse(decoded);
  if (!parsed.success) return new Response("Invalid booking", { status: 400 });
  const { triggerEvent, createdAt, payload: booking } = parsed.data;
  if (booking.type !== "buyhard") return new Response("Ignored");
  const states: Record<string, string> = {
    BOOKING_CREATED: "confirmed",
    BOOKING_CONFIRMED: "confirmed",
    BOOKING_REQUESTED: "requested",
    BOOKING_RESCHEDULED: "confirmed",
    BOOKING_CANCELLED: "cancelled",
    BOOKING_REJECTED: "cancelled",
  };
  const status = states[triggerEvent];
  if (!status) return new Response("Ignored");
  const visitorId = booking.metadata?.visitorId;
  const sourceSchema = z.object({
    visitorId: z.string().max(250),
    landingPath: z.string().max(250),
    referrer: z.string().max(250),
    capturedAt: z.number().finite(),
    utm_source: z.string().max(200).optional(),
    utm_medium: z.string().max(200).optional(),
    utm_campaign: z.string().max(200).optional(),
    utm_content: z.string().max(200).optional(),
    utm_term: z.string().max(200).optional(),
  });
  let source: z.infer<typeof sourceSchema> | undefined;
  try {
    source = sourceSchema.safeParse(JSON.parse(String(booking.metadata?.attribution))).data;
  } catch {
    /* External bookings may not have site attribution. */
  }

  await ctx.runMutation(internal.marketing.booking, {
    uid: booking.uid,
    email: booking.attendees[0].email,
    name: booking.attendees[0].name,
    startTime: booking.startTime,
    status:
      status === "confirmed" &&
      (booking.status === "PENDING" ||
        (booking.requiresConfirmation === true &&
          booking.status !== "ACCEPTED" &&
          triggerEvent !== "BOOKING_CONFIRMED"))
        ? "requested"
        : status,
    rescheduleUid:
      triggerEvent === "BOOKING_RESCHEDULED" ? (booking.rescheduleUid ?? undefined) : undefined,
    rescheduleStartTime: booking.rescheduleStartTime ?? undefined,
    updatedAt: Date.parse(createdAt),
    source,
    visitorId: typeof visitorId === "string" ? visitorId.slice(0, 200) : undefined,
  });
  return new Response("OK");
});
