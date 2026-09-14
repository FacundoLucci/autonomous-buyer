/// <reference types="vite/client" />
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { stockFacts, applyStockReceipt } from "./companyStock";
import { availableStock } from "../src/lib/inventory-planning";
import { base64, hmac, verifyHmac, seal, unseal } from "./salesCrypto";
import { squareOrder, shopifyOrder } from "./salesPayloads";
import { shopDomain } from "../src/lib/sales-planning";
import type { SalesSourceEvent } from "../src/lib/sales-planning";
const modules = import.meta.glob("./**/*.ts");
const NOW = Date.parse("2026-09-14T15:42:00Z"),
  DAY = 86_400_000;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function fixture(
  provider: "square" | "shopify" = "square",
  mode: "sales" | "inventory" = "sales",
) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Test cafe",
      isDemo: false,
      timezone: "America/Chicago",
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 1 },
    });
    const userId = await ctx.db.insert("users", {
      organizationId,
      name: "Owner",
      role: "admin",
      isActive: true,
    });
    const itemId = await ctx.db.insert("inventoryItems", {
      organizationId,
      sku: "CUP",
      name: "Cups",
      description: "Cups",
      specification: { productType: "cups" },
      quantityOnHand: 800,
      unit: "cups",
      stockCountKnown: true,
      stockCountedAt: NOW,
      estimatedDailyUsage: 100,
      supplierLeadTimeDays: 3,
      safetyStockDays: 1,
      preferredCoverageDays: 7,
      preparationDays: 1,
      casePack: 100,
      orderMultiple: 100,
      buyingPriority: "availability",
      replenishmentEnabled: true,
      status: "healthy",
      isDemo: false,
    });
    const connectionId = await ctx.db.insert("salesConnections", {
      organizationId,
      provider,
      accountId: provider === "square" ? "merchant" : "cafe.myshopify.com",
      name: "Test source",
      status: "connected",
      sandbox: true,
      credentials: "not-a-token",
      webhookKey: "test-key",
      createdAt: NOW,
    });
    return { userId, organizationId, itemId, connectionId };
  });
  const user = t.withIdentity({ subject: ids.userId });
  const locationId = provider === "shopify" && mode === "sales" ? "all" : "cafe";
  const mappingId = await user.mutation(api.sales.saveMapping, {
    connectionId: ids.connectionId,
    itemId: ids.itemId,
    externalId: "coffee",
    externalName: "Coffee",
    locationId,
    mode,
    unitsPerSale: 1,
    unitsPerStockUnit: 1,
  });
  const data = (patch: Partial<SalesSourceEvent> = {}): SalesSourceEvent => ({
    key: "evt-1",
    resourceId: "order-1",
    locationId,
    occurredAt: NOW,
    updatedAt: NOW,
    kind: mode,
    lines: [{ key: "coffee", name: "Coffee", quantity: 300 }],
    ...patch,
  });
  async function apply(d = data()) {
    const eventId = await t.mutation(internal.sales.enqueue, {
      connectionId: ids.connectionId,
      key: d.key,
      resourceId: d.resourceId,
      kind: d.kind,
      payload: d.kind === "inventory" ? d : undefined,
    });
    await t.mutation(internal.sales.apply, { eventId, data: d });
    return eventId;
  }
  return { t, user, ...ids, mappingId, data, apply };
}

test.each(["square", "shopify"] as const)(
  "%s sales prepare one buy without a browser; duplicate notifications cannot consume or buy twice",
  async (provider) => {
    const f = await fixture(provider);
    await f.t.mutation(internal.replenishment.evaluate, { itemId: f.itemId });
    expect(await f.t.run((ctx) => ctx.db.query("companyBuys").collect())).toHaveLength(0);
    await f.apply();
    await f.t.mutation(internal.replenishment.evaluate, { itemId: f.itemId });
    const first = await f.t.run((ctx) => ctx.db.query("companyBuys").collect());
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ automatic: true, quantity: 600 });
    await f.apply();
    await f.apply(f.data({ key: "different-delivery-same-order" }));
    await f.t.mutation(internal.replenishment.evaluate, { itemId: f.itemId });
    const result = await f.t.run(async (ctx) => ({
      item: await ctx.db.get("inventoryItems", f.itemId),
      buys: await ctx.db.query("companyBuys").collect(),
      decisions: await ctx.db.query("salesDecisions").collect(),
    }));
    expect(result.item?.forecastQuantity).toBe(500);
    expect(result.buys).toHaveLength(1);
    expect(result.buys[0].planVersion).toBe(first[0].planVersion);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]).toMatchObject({
      beforeQuantity: 800,
      afterQuantity: 500,
      orderQuantity: 600,
    });
  },
);
test("recorded sales replace elapsed estimates; a delivery survives the next sale and a recount becomes the new baseline", async () => {
  const f = await fixture();
  vi.setSystemTime(NOW + DAY);
  await f.apply(f.data({ occurredAt: NOW + DAY, updatedAt: NOW + DAY }));
  expect(
    await f.t.run(async (ctx) =>
      availableStock(stockFacts((await ctx.db.get("inventoryItems", f.itemId))!)),
    ),
  ).toBe(500);
  await f.t.run(async (ctx) =>
    applyStockReceipt(ctx, (await ctx.db.get("inventoryItems", f.itemId))!, 600),
  );
  await f.apply(
    f.data({
      key: "evt-2",
      resourceId: "order-2",
      occurredAt: NOW + DAY,
      updatedAt: NOW + DAY,
      lines: [{ key: "coffee", name: "Coffee", quantity: 100 }],
    }),
  );
  expect((await f.t.run((ctx) => ctx.db.get("inventoryItems", f.itemId)))?.forecastQuantity).toBe(
    1000,
  );
  vi.setSystemTime(NOW + 2 * DAY);
  await f.user.mutation(api.companyInventory.recordCount, { itemId: f.itemId, quantity: 700 });
  await f.apply(f.data({ key: "late-old-order", updatedAt: NOW + 2 * DAY }));
  expect((await f.t.run((ctx) => ctx.db.get("inventoryItems", f.itemId)))?.forecastQuantity).toBe(
    700,
  );
});
test("a stale order revision or refund never returns used packaging; wrong locations are ignored", async () => {
  const f = await fixture();
  await f.apply();
  vi.setSystemTime(NOW + 60_000);
  await f.apply(
    f.data({
      key: "refund",
      updatedAt: NOW + 60_000,
      lines: [{ key: "coffee", name: "Coffee", quantity: 200 }],
    }),
  );
  await f.apply(f.data({ key: "old-revision" }));
  await f.apply(f.data({ key: "other-location", resourceId: "order-2", locationId: "elsewhere" }));
  expect((await f.t.run((ctx) => ctx.db.get("inventoryItems", f.itemId)))?.salesConsumed).toBe(300);
});
test("direct counts use their source timestamp and ignore older counts", async () => {
  const f = await fixture("shopify", "inventory");
  vi.setSystemTime(NOW + 120_000);
  await f.apply(f.data({ key: "count-1", occurredAt: NOW + 60_000, updatedAt: NOW + 60_000 }));
  await f.apply(
    f.data({
      key: "old-count",
      occurredAt: NOW + 30_000,
      updatedAt: NOW + 30_000,
      lines: [{ key: "coffee", name: "Coffee", quantity: 1000 }],
    }),
  );
  expect((await f.t.run((ctx) => ctx.db.get("inventoryItems", f.itemId)))?.forecastQuantity).toBe(
    300,
  );
});
test("supply conversion is explicit and one item cannot take two consumption sources", async () => {
  const f = await fixture();
  await f.user.mutation(api.sales.removeMapping, { mappingId: f.mappingId });
  await f.user.mutation(api.sales.saveMapping, {
    connectionId: f.connectionId,
    itemId: f.itemId,
    externalId: "coffee",
    externalName: "Coffee",
    locationId: "cafe",
    mode: "sales",
    unitsPerSale: 2,
    unitsPerStockUnit: 100,
  });
  await f.apply();
  expect((await f.t.run((ctx) => ctx.db.get("inventoryItems", f.itemId)))?.forecastQuantity).toBe(
    794,
  );
  await expect(
    f.user.mutation(api.sales.saveMapping, {
      connectionId: f.connectionId,
      itemId: f.itemId,
      externalId: "other",
      externalName: "Other",
      locationId: "cafe",
      mode: "sales",
      unitsPerSale: 1,
      unitsPerStockUnit: 1,
    }),
  ).rejects.toThrow("already has a source");
});
test("unauthorized users cannot read credentials, create mappings, or reconnect another company", async () => {
  const f = await fixture();
  await expect(f.t.query(api.sales.list, {})).rejects.toThrow();
  const other = await f.t.run(async (ctx) => {
    const org = await ctx.db.insert("organizations", {
      name: "Other",
      isDemo: false,
      timezone: "UTC",
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 1 },
    });
    return await ctx.db.insert("users", { organizationId: org, role: "admin", isActive: true });
  });
  await expect(
    f.t
      .withIdentity({ subject: other })
      .mutation(api.sales.pause, { connectionId: f.connectionId, paused: true }),
  ).rejects.toThrow("Connection not found");
  const view = await f.user.query(api.sales.list, {});
  expect(view.connections[0]).not.toHaveProperty("credentials");
  expect(view.connections[0]).not.toHaveProperty("webhookKey");
});
test("Square signs URL plus raw body; Shopify signs raw body; modified data is refused", async () => {
  const key = "test-secret",
    body = '{"quantity":300}',
    url = "https://local.example/api/sales/square/events";
  expect(await verifyHmac(key, url + body, base64(await hmac(key, url + body)))).toBe(true);
  expect(await verifyHmac(key, body, base64(await hmac(key, body)))).toBe(true);
  expect(await verifyHmac(key, body + " ", base64(await hmac(key, body)))).toBe(false);
  expect(await verifyHmac(key, "other-url" + body, base64(await hmac(key, url + body)))).toBe(
    false,
  );
  const secret = base64(new Uint8Array(32).fill(3));
  const sealed = await seal({ accessToken: "private" }, secret);
  expect(sealed).not.toContain("private");
  expect(await unseal(sealed, secret)).toEqual({ accessToken: "private" });
});
test("provider adapters reject unpaid sales and arbitrary Shopify hosts", () => {
  expect(squareOrder({ state: "OPEN" })).toBeNull();
  expect(shopifyOrder({ displayFinancialStatus: "PENDING" })).toBeNull();
  expect(() => shopDomain("store.myshopify.com.attacker.example")).toThrow();
  expect(() => shopDomain("localhost:3000")).toThrow();
});

test.each(["square", "shopify"] as const)(
  "%s HTTP notification is verified, fetches the authoritative order, and updates the buyer",
  async (provider) => {
    const f = await fixture(provider);
    const secret = base64(new Uint8Array(32).fill(4));
    vi.stubEnv("SALES_CREDENTIAL_KEY", secret);
    vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", "hook-secret");
    vi.stubEnv("SHOPIFY_CLIENT_SECRET", "hook-secret");
    vi.stubEnv("SALES_CALLBACK_BASE_URL", "https://buyer.test");
    await f.t.run((ctx) => ctx.db.patch("salesConnections", f.connectionId, { credentials: "" }));
    const credentials = await seal({ accessToken: "access-test", expiresAt: NOW + DAY }, secret);
    await f.t.run((ctx) => ctx.db.patch("salesConnections", f.connectionId, { credentials }));
    const id = provider === "square" ? "order-1" : "gid://shopify/Order/1042";
    const response =
      provider === "square"
        ? {
            order: {
              id,
              state: "COMPLETED",
              location_id: "cafe",
              closed_at: new Date(NOW).toISOString(),
              updated_at: new Date(NOW).toISOString(),
              line_items: [{ catalog_object_id: "coffee", name: "Coffee", quantity: "300" }],
            },
          }
        : {
            data: {
              order: {
                id,
                displayFinancialStatus: "PAID",
                createdAt: new Date(NOW).toISOString(),
                processedAt: new Date(NOW).toISOString(),
                updatedAt: new Date(NOW).toISOString(),
                cancelledAt: null,
                lineItems: {
                  nodes: [{ name: "Coffee", quantity: 300, variant: { id: "coffee" } }],
                  pageInfo: { hasNextPage: false },
                },
              },
            },
          };
    const fetchSource = vi.fn(
      async () =>
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchSource);
    const body =
      provider === "square"
        ? JSON.stringify({
            event_id: "hook-1",
            merchant_id: "merchant",
            type: "order.updated",
            data: { object: { order_updated: { order_id: id } } },
          })
        : JSON.stringify({ id: 1042 });
    const path =
      provider === "square" ? "/api/sales/square/events" : "/api/sales/shopify/events/test-key";
    const signature = base64(
      await hmac("hook-secret", (provider === "square" ? "https://buyer.test" + path : "") + body),
    );
    const headers: Record<string, string> =
      provider === "square"
        ? { "x-square-hmacsha256-signature": signature }
        : {
            "x-shopify-hmac-sha256": signature,
            "x-shopify-shop-domain": "cafe.myshopify.com",
            "x-shopify-event-id": "hook-1",
            "x-shopify-topic": "orders/paid",
          };
    expect((await f.t.fetch(path, { method: "POST", headers, body: body + " " })).status).toBe(401);
    expect((await f.t.fetch(path, { method: "POST", headers, body })).status).toBe(200);
    expect((await f.t.fetch(path, { method: "POST", headers, body })).status).toBe(200);
    const events = await f.t.run((ctx) => ctx.db.query("salesEvents").collect());
    expect(events).toHaveLength(1);
    await f.t.action(internal.salesProvider.process, { eventId: events[0]._id });
    expect(fetchSource).toHaveBeenCalledTimes(1);
    expect((await f.t.run((ctx) => ctx.db.get("inventoryItems", f.itemId)))?.forecastQuantity).toBe(
      500,
    );
    expect((await f.t.run((ctx) => ctx.db.get("salesEvents", events[0]._id)))?.state).toBe(
      "processed",
    );
  },
);
test("paused connections stay paused when an earlier sync finishes, and refreshes cannot overwrite a newer authorization", async () => {
  const f = await fixture();
  expect(
    await f.t.mutation(internal.sales.claimRefresh, {
      id: f.connectionId,
      credentials: "not-a-token",
      lease: "first",
    }),
  ).toBe(true);
  expect(
    await f.t.mutation(internal.sales.claimRefresh, {
      id: f.connectionId,
      credentials: "not-a-token",
      lease: "second",
    }),
  ).toBe(false);
  await f.user.mutation(api.sales.pause, { connectionId: f.connectionId, paused: true });
  await f.t.mutation(internal.sales.setState, {
    id: f.connectionId,
    status: "connected",
    synced: true,
  });
  expect((await f.t.run((ctx) => ctx.db.get("salesConnections", f.connectionId)))?.status).toBe(
    "paused",
  );
  await f.t.mutation(internal.salesAuth.save, {
    organizationId: f.organizationId,
    provider: "square",
    accountId: "merchant",
    name: "Reconnected",
    sandbox: true,
    credentials: "newer-token",
    webhookKey: "test-key",
  });
  expect(
    await f.t.mutation(internal.sales.finishRefresh, {
      id: f.connectionId,
      lease: "first",
      credentials: "stale-token",
    }),
  ).toBe(false);
  expect(
    (await f.t.run((ctx) => ctx.db.get("salesConnections", f.connectionId)))?.credentials,
  ).toBe("newer-token");
});
test("expired Square authorization refreshes once before parallel catalog requests", async () => {
  const f = await fixture();
  const key = base64(new Uint8Array(32).fill(5));
  vi.stubEnv("SALES_CREDENTIAL_KEY", key);
  vi.stubEnv("SQUARE_APP_ID", "test-app");
  vi.stubEnv("SQUARE_APP_SECRET", "test-secret");
  const credentials = await seal(
    { accessToken: "expired", refreshToken: "refresh", expiresAt: NOW - 1 },
    key,
  );
  await f.t.run((ctx) => ctx.db.patch("salesConnections", f.connectionId, { credentials }));
  let refreshes = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/oauth2/token")) {
        refreshes++;
        expect(JSON.parse(String(init.body)).grant_type).toBe("refresh_token");
        return new Response(
          JSON.stringify({
            access_token: "fresh",
            refresh_token: "fresh-refresh",
            expires_at: new Date(NOW + DAY).toISOString(),
          }),
        );
      }
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fresh");
      if (url.includes("/catalog/")) {
        expect(url).toContain("types=ITEM&cursor=next-page");
        return new Response(
          JSON.stringify({
            objects: [
              {
                id: "coffee-item",
                type: "ITEM",
                item_data: {
                  name: "Coffee",
                  variations: [
                    {
                      id: "coffee-regular",
                      type: "ITEM_VARIATION",
                      item_variation_data: { name: "Regular", sku: "COFFEE-12" },
                    },
                  ],
                },
              },
            ],
            cursor: "last-page",
          }),
        );
      }
      return new Response(JSON.stringify({ locations: [{ id: "cafe", name: "Cafe" }] }));
    }),
  );
  const catalog = await f.user.action(api.salesProvider.catalog, {
    connectionId: f.connectionId,
    cursor: "next-page",
  });
  expect(catalog).toEqual({
    products: [
      { id: "coffee-regular", inventoryId: "coffee-regular", name: "Coffee · Regular · COFFEE-12" },
    ],
    locations: [{ id: "cafe", name: "Cafe" }],
    cursor: "last-page",
  });
  expect(refreshes).toBe(1);
  const saved = (await f.t.run((ctx) => ctx.db.get("salesConnections", f.connectionId)))!;
  expect(await unseal(saved.credentials, key)).toMatchObject({
    accessToken: "fresh",
    refreshToken: "fresh-refresh",
  });
});
