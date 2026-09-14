import { salesCallbackBase } from "./salesAuth";
import { httpAction, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyHmac } from "./salesCrypto";
import { object, text, timestamp, list } from "./salesPayloads";

export const receive = httpAction(async (ctx, request) => {
  const url = new URL(request.url),
    isSquare = url.pathname === "/api/sales/square/events";
  const length = request.headers.get("content-length");
  if (length && Number(length) > 1_000_000) return new Response("Too large", { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > 1_000_000) return new Response("Too large", { status: 413 });
  const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const secret = isSquare ? env.SQUARE_WEBHOOK_SIGNATURE_KEY : env.SHOPIFY_CLIENT_SECRET;
  if (!secret) return new Response("Connection unavailable", { status: 503 });
  const signature =
    request.headers.get(isSquare ? "x-square-hmacsha256-signature" : "x-shopify-hmac-sha256") ?? "";
  const signed = isSquare ? salesCallbackBase() + "/api/sales/square/events" + raw : raw;
  if (!(await verifyHmac(secret, signed, signature)))
    return new Response("Invalid signature", { status: 401 });
  try {
    const data = object(JSON.parse(raw));
    const c = isSquare
      ? await ctx.runQuery(internal.sales.byAccount, {
          provider: "square",
          accountId: text(data.merchant_id),
        })
      : await ctx.runQuery(internal.sales.byWebhook, { key: url.pathname.split("/").at(-1) ?? "" });
    if (
      !c ||
      c.provider !== (isSquare ? "square" : "shopify") ||
      (!isSquare && c.accountId !== request.headers.get("x-shopify-shop-domain"))
    )
      return new Response("Unknown connection", { status: 404 });
    const key = isSquare
      ? text(data.event_id)
      : (request.headers.get("x-shopify-event-id") ?? request.headers.get("x-shopify-webhook-id"));
    if (!key || key.length > 200) return new Response("Missing event ID", { status: 400 });
    const topic = isSquare ? text(data.type) : request.headers.get("x-shopify-topic");
    if (topic === "app/uninstalled") {
      await ctx.runMutation(internal.sales.setState, {
        id: c._id,
        status: "paused",
        message: "Shopify was disconnected. Reconnect to resume updates.",
      });
      return new Response("OK");
    }
    if (topic === "order.updated" || topic === "order.created") {
      const ref = object(
        object(object(data.data).object)[
          topic === "order.updated" ? "order_updated" : "order_created"
        ],
      );
      await ctx.runMutation(internal.sales.enqueue, {
        connectionId: c._id,
        key,
        resourceId: text(ref.order_id),
        kind: "sales",
      });
    } else if (topic === "orders/paid" || topic === "orders/updated") {
      let resourceId =
        typeof data.admin_graphql_api_id === "string" ? data.admin_graphql_api_id : String(data.id);
      if (!/^gid:\/\/shopify\/Order\/\d+$/.test(resourceId) && !/^\d+$/.test(resourceId))
        throw new Error("Invalid order ID.");
      if (!resourceId.startsWith("gid://")) resourceId = "gid://shopify/Order/" + resourceId;
      await ctx.runMutation(internal.sales.enqueue, {
        connectionId: c._id,
        key,
        resourceId,
        kind: "sales",
      });
    } else if (topic === "inventory.count.updated") {
      const counts = list(object(object(data.data).object).inventory_counts);
      for (const [index, value] of counts.entries()) {
        const count = object(value);
        if (count.state !== "IN_STOCK") continue;
        const id = text(count.catalog_object_id),
          at = timestamp(count.calculated_at),
          location = text(count.location_id);
        const payload = {
          key: key + ":" + index,
          resourceId: id,
          kind: "inventory" as const,
          occurredAt: at,
          updatedAt: at,
          locationId: location,
          lines: [{ key: id, name: "Square stock", quantity: Math.max(0, Number(count.quantity)) }],
        };
        await ctx.runMutation(internal.sales.enqueue, {
          connectionId: c._id,
          key: payload.key,
          resourceId: id,
          kind: "inventory",
          payload,
        });
      }
    } else if (topic === "inventory_levels/update") {
      if (
        !Number.isSafeInteger(data.inventory_item_id) ||
        !Number.isSafeInteger(data.location_id) ||
        typeof data.available !== "number"
      )
        throw new Error("Invalid inventory update.");
      const id = "gid://shopify/InventoryItem/" + data.inventory_item_id,
        location = "gid://shopify/Location/" + data.location_id,
        at = timestamp(data.updated_at);
      const payload = {
        key,
        resourceId: id,
        kind: "inventory" as const,
        occurredAt: at,
        updatedAt: at,
        locationId: location,
        lines: [{ key: id, name: "Shopify stock", quantity: Math.max(0, data.available) }],
      };
      await ctx.runMutation(internal.sales.enqueue, {
        connectionId: c._id,
        key,
        resourceId: id,
        kind: "inventory",
        payload,
      });
    }
    return new Response("OK");
  } catch {
    // A retried provider delivery can finish any entries accepted before failure.
    return new Response("Could not accept update", { status: 503 });
  }
});
