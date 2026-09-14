import { action, internalAction, internalMutation, env, type ActionCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { unseal, seal, randomKey } from "./salesCrypto";
import { jsonRequest, needed, shopifyGraph, squareBase } from "./salesAuth";
import { object, list, text, timestamp, squareOrder, shopifyOrder } from "./salesPayloads";
import type { SalesSourceEvent } from "../src/lib/sales-planning";

async function token(ctx: ActionCtx, c: Doc<"salesConnections">): Promise<string> {
  const encryptionKey = needed(env.SALES_CREDENTIAL_KEY, "Sales encryption");
  const tokens = object(await unseal(c.credentials, encryptionKey));
  if (typeof tokens.expiresAt !== "number" || tokens.expiresAt > Date.now() + 300_000)
    return text(tokens.accessToken);
  if (typeof tokens.refreshToken !== "string")
    throw new Error("Authorization expired. Reconnect this store.");
  const lease = randomKey();
  const claimed: boolean = await ctx.runMutation(internal.sales.claimRefresh, {
    id: c._id,
    credentials: c.credentials,
    lease,
  });
  if (!claimed) {
    const fresh: Doc<"salesConnections"> | null = await ctx.runQuery(internal.sales.connection, {
      id: c._id,
    });
    if (fresh && fresh.status !== "paused" && fresh.credentials !== c.credentials) {
      c.credentials = fresh.credentials;
      const next = object(await unseal(fresh.credentials, encryptionKey));
      if (typeof next.expiresAt !== "number" || next.expiresAt > Date.now() + 60_000)
        return text(next.accessToken);
    }
    throw new Error("Authorization is being refreshed. Try the sync again shortly.");
  }
  try {
    const url =
      c.provider === "square"
        ? squareBase(c.sandbox) + "/oauth2/token"
        : "https://" + c.accountId + "/admin/oauth/access_token";
    const result = await jsonRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:
          c.provider === "square"
            ? needed(env.SQUARE_APP_ID, "Square")
            : needed(env.SHOPIFY_CLIENT_ID, "Shopify"),
        client_secret:
          c.provider === "square"
            ? needed(env.SQUARE_APP_SECRET, "Square")
            : needed(env.SHOPIFY_CLIENT_SECRET, "Shopify"),
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      }),
    });
    const accessToken = text(result.access_token);
    const credentials = await seal(
      {
        accessToken,
        refreshToken: result.refresh_token ?? tokens.refreshToken,
        expiresAt: result.expires_at
          ? timestamp(result.expires_at)
          : typeof result.expires_in === "number"
            ? Date.now() + result.expires_in * 1000
            : null,
      },
      encryptionKey,
    );
    const saved: boolean = await ctx.runMutation(internal.sales.finishRefresh, {
      id: c._id,
      lease,
      credentials,
    });
    if (!saved) throw new Error("Authorization changed during refresh. Try again.");
    c.credentials = credentials;
    return accessToken;
  } catch (error) {
    await ctx.runMutation(internal.sales.finishRefresh, { id: c._id, lease });
    throw error;
  }
}
async function square(
  ctx: ActionCtx,
  c: Doc<"salesConnections">,
  path: string,
  data?: Record<string, unknown>,
) {
  return jsonRequest(squareBase(c.sandbox) + path, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + (await token(ctx, c)),
      "Content-Type": "application/json",
      "Square-Version": "2026-08-19",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}
async function shopify(
  ctx: ActionCtx,
  c: Doc<"salesConnections">,
  query: string,
  variables: Record<string, unknown> = {},
) {
  return shopifyGraph(c.accountId, await token(ctx, c), query, variables);
}

async function owned(ctx: ActionCtx, id: Id<"salesConnections">): Promise<Doc<"salesConnections">> {
  const organizationId: Id<"organizations"> = await ctx.runQuery(internal.sales.owner, {});
  const c: Doc<"salesConnections"> | null = await ctx.runQuery(internal.sales.connection, { id });
  if (!c || c.organizationId !== organizationId) throw new ConvexError("Connection not found.");
  return c;
}

async function readOrder(ctx: ActionCtx, c: Doc<"salesConnections">, resourceId: string) {
  if (c.provider === "square")
    return squareOrder(
      (await square(ctx, c, "/v2/orders/" + encodeURIComponent(resourceId))).order,
    );
  const id = resourceId.startsWith("gid://shopify/Order/")
    ? resourceId
    : "gid://shopify/Order/" + resourceId;
  let after: string | null = null;
  let order: Record<string, unknown> | null = null;
  const lines: unknown[] = [];
  for (let page = 0; page < 10; page++) {
    const result = await shopify(
      ctx,
      c,
      "query($id:ID!,$after:String){order(id:$id){id createdAt processedAt updatedAt cancelledAt displayFinancialStatus lineItems(first:100,after:$after){nodes{name quantity variant{id}} pageInfo{hasNextPage endCursor}}}}",
      { id, after },
    );
    if (!result.order) throw new Error("The connected store could not read this order.");
    order = object(result.order);
    const connection = object(order.lineItems),
      info = object(connection.pageInfo);
    lines.push(...list(connection.nodes));
    if (!info.hasNextPage) return shopifyOrder({ ...order, lines });
    after = text(info.endCursor);
  }
  throw new Error("Order exceeds the 1,000 line processing limit.");
}

export const process = internalAction({
  args: { eventId: v.id("salesEvents") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const event: Doc<"salesEvents"> | null = await ctx.runQuery(internal.sales.event, {
      id: eventId,
    });
    if (!event || event.state !== "pending") return null;
    const c: Doc<"salesConnections"> | null = await ctx.runQuery(internal.sales.connection, {
      id: event.connectionId,
    });
    if (!c || c.status === "paused") return null;
    try {
      const data =
        event.kind === "inventory" ? event.payload : await readOrder(ctx, c, event.resourceId);
      await ctx.runMutation(internal.sales.apply, {
        eventId,
        data: data ?? {
          key: event.key,
          resourceId: event.resourceId,
          kind: event.kind,
          occurredAt: Date.now(),
          updatedAt: Date.now(),
          locationId: "unmapped",
          lines: [],
        },
      });
    } catch (error) {
      await ctx.runMutation(internal.sales.failed, {
        eventId,
        message: error instanceof Error ? error.message : "Source update failed.",
      });
    }
    return null;
  },
});

const choice = v.object({ id: v.string(), name: v.string(), inventoryId: v.string() });
export const catalog = action({
  args: { connectionId: v.id("salesConnections"), cursor: v.optional(v.string()) },
  returns: v.object({
    products: v.array(choice),
    locations: v.array(v.object({ id: v.string(), name: v.string() })),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const c = await owned(ctx, args.connectionId);
    await token(ctx, c);
    if (c.provider === "square") {
      const [catalog, places] = await Promise.all([
        square(
          ctx,
          c,
          "/v2/catalog/list?types=ITEM" +
            (args.cursor ? "&cursor=" + encodeURIComponent(args.cursor) : ""),
        ),
        square(ctx, c, "/v2/locations"),
      ]);
      return {
        products: list(catalog.objects ?? []).flatMap((value) => {
          const item = object(value),
            details = object(item.item_data);
          if (item.is_deleted || details.is_archived) return [];
          return list(details.variations ?? []).flatMap((value) => {
            const variation = object(value),
              data = object(variation.item_variation_data);
            if (variation.is_deleted) return [];
            return [
              {
                id: text(variation.id),
                inventoryId: text(variation.id),
                name: [details.name, data.name, data.sku]
                  .filter((part): part is string => typeof part === "string" && part.length > 0)
                  .join(" · "),
              },
            ];
          });
        }),
        locations: list(places.locations ?? []).map((value) => {
          const p = object(value);
          return { id: text(p.id), name: text(p.name) };
        }),
        cursor: typeof catalog.cursor === "string" ? catalog.cursor : null,
      };
    }
    const result = await shopify(
      ctx,
      c,
      "query($after:String){productVariants(first:100,after:$after){nodes{id displayName inventoryItem{id}} pageInfo{hasNextPage endCursor}} locations(first:100){nodes{id name} pageInfo{hasNextPage}}}",
      { after: args.cursor ?? null },
    );
    const products = object(result.productVariants),
      info = object(products.pageInfo),
      places = object(result.locations);
    if (object(places.pageInfo).hasNextPage)
      throw new ConvexError("This store exceeds the 100-location connection limit.");
    return {
      products: list(products.nodes).map((value) => {
        const p = object(value);
        return {
          id: text(p.id),
          name: text(p.displayName),
          inventoryId: text(object(p.inventoryItem).id),
        };
      }),
      locations: [
        { id: "all", name: "All paid orders (sales only)" },
        ...list(places.nodes).map((value) => {
          const p = object(value);
          return { id: text(p.id), name: text(p.name) };
        }),
      ],
      cursor: info.hasNextPage ? text(info.endCursor) : null,
    };
  },
});

async function enqueueData(
  ctx: ActionCtx,
  connectionId: Id<"salesConnections">,
  data: SalesSourceEvent,
) {
  const eventId: Id<"salesEvents"> = await ctx.runMutation(internal.sales.enqueue, {
    connectionId,
    key: data.key,
    resourceId: data.resourceId,
    kind: data.kind,
    payload: data.kind === "inventory" ? data : undefined,
  });
  // The sync already fetched authoritative sales data. Apply directly; a queued
  // worker observing processed state becomes a no-op.
  await ctx.runMutation(internal.sales.apply, { eventId, data });
}
async function syncConnection(
  ctx: ActionCtx,
  { connectionId }: { connectionId: Id<"salesConnections"> },
): Promise<null> {
  const c: Doc<"salesConnections"> | null = await ctx.runQuery(internal.sales.connection, {
    id: connectionId,
  });
  if (!c || c.status === "paused") return null;
  try {
    const mappings: Doc<"salesMappings">[] = await ctx.runQuery(internal.sales.mappings, {
      connectionId,
    });
    const since = new Date(
      Math.max(c.createdAt - 3600_000, (c.lastSyncAt ?? c.createdAt) - 86_400_000),
    ).toISOString();
    if (c.provider === "square") {
      const locations = [
        ...new Set(mappings.filter((m) => m.mode === "sales").map((m) => m.locationId)),
      ];
      for (let offset = 0; offset < locations.length; offset += 10) {
        let cursor: string | undefined;
        for (let page = 0; page < 20; page++) {
          const body = await square(ctx, c, "/v2/orders/search", {
            location_ids: locations.slice(offset, offset + 10),
            limit: 100,
            cursor,
            query: {
              filter: {
                date_time_filter: { updated_at: { start_at: since } },
                state_filter: { states: ["COMPLETED"] },
              },
              sort: { sort_field: "UPDATED_AT", sort_order: "ASC" },
            },
          });
          for (const value of list(body.orders ?? [])) {
            const data = squareOrder(value);
            if (data) await enqueueData(ctx, connectionId, data);
          }
          cursor = typeof body.cursor === "string" ? body.cursor : undefined;
          if (!cursor) break;
          if (page === 19)
            throw new Error("More than 2,000 changed orders need reconciliation. Contact support.");
        }
      }
      const stock = mappings.filter((m) => m.mode === "inventory");
      if (stock.length) {
        let cursor: string | undefined;
        for (let page = 0; page < 20; page++) {
          const body = await square(ctx, c, "/v2/inventory/counts/batch-retrieve", {
            catalog_object_ids: [...new Set(stock.map((m) => m.externalId))],
            location_ids: [...new Set(stock.map((m) => m.locationId))],
            states: ["IN_STOCK"],
            cursor,
          });
          for (const value of list(body.counts ?? [])) {
            const count = object(value),
              at = timestamp(count.calculated_at),
              id = text(count.catalog_object_id),
              location = text(count.location_id);
            const quantity = Math.max(0, Number(count.quantity));
            await enqueueData(ctx, connectionId, {
              key: "count:" + id + ":" + location + ":" + at,
              resourceId: id,
              locationId: location,
              kind: "inventory",
              occurredAt: at,
              updatedAt: at,
              lines: [{ key: id, name: "Square stock", quantity }],
            });
          }
          cursor = typeof body.cursor === "string" ? body.cursor : undefined;
          if (!cursor) break;
          if (page === 19) throw new Error("Inventory reconciliation exceeded its page limit.");
        }
      }
    } else {
      if (mappings.some((m) => m.mode === "sales")) {
        let after: string | null = null;
        for (let page = 0; page < 20; page++) {
          const result = await shopify(
            ctx,
            c,
            "query($after:String,$query:String!){orders(first:100,after:$after,query:$query,sortKey:UPDATED_AT){nodes{id} pageInfo{hasNextPage endCursor}}}",
            { after, query: "updated_at:>='" + since + "'" },
          );
          const orders = object(result.orders),
            info = object(orders.pageInfo);
          for (const value of list(orders.nodes)) {
            const data = await readOrder(ctx, c, text(object(value).id));
            if (data) await enqueueData(ctx, connectionId, data);
          }
          if (!info.hasNextPage) break;
          after = text(info.endCursor);
          if (page === 19)
            throw new Error("More than 2,000 changed orders need reconciliation. Contact support.");
        }
      }
      for (const mapping of mappings.filter((m) => m.mode === "inventory")) {
        const result = await shopify(
          ctx,
          c,
          'query($id:ID!,$location:ID!){inventoryItem(id:$id){inventoryLevel(locationId:$location){updatedAt quantities(names:["available"]){name quantity}}}}',
          { id: mapping.externalId, location: mapping.locationId },
        );
        const item = object(result.inventoryItem);
        if (!item.inventoryLevel) continue;
        const level = object(item.inventoryLevel),
          at = timestamp(level.updatedAt),
          quantities = list(level.quantities).map(object);
        const quantity = Math.max(
          0,
          Number(quantities.find((q) => q.name === "available")?.quantity),
        );
        await enqueueData(ctx, connectionId, {
          key: "count:" + mapping.externalId + ":" + mapping.locationId + ":" + at,
          resourceId: mapping.externalId,
          locationId: mapping.locationId,
          kind: "inventory",
          occurredAt: at,
          updatedAt: at,
          lines: [{ key: mapping.externalId, name: mapping.externalName, quantity }],
        });
      }
    }
    await ctx.runMutation(internal.sales.setState, {
      id: c._id,
      status: "connected",
      synced: true,
    });
  } catch (e) {
    await ctx.runMutation(internal.sales.setState, {
      id: c._id,
      status: "needs_attention",
      message: e instanceof Error ? e.message.slice(0, 200) : "Could not sync this store.",
    });
  }
  return null;
}
export const sync = internalAction({
  args: { connectionId: v.id("salesConnections") },
  returns: v.null(),
  handler: syncConnection,
});
export const requestSync = action({
  args: { connectionId: v.id("salesConnections") },
  returns: v.null(),
  handler: async (ctx, a) => {
    await owned(ctx, a.connectionId);
    await syncConnection(ctx, a);
    return null;
  },
});
export const sweep = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("salesConnections")
      .withIndex("by_creation_time")
      .paginate(a.paginationOpts);
    for (const c of page.page)
      if (c.status !== "paused")
        await ctx.scheduler.runAfter(0, internal.salesProvider.sync, { connectionId: c._id });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.salesProvider.sweep, {
        paginationOpts: { numItems: 20, cursor: page.continueCursor },
      });
    return null;
  },
});
