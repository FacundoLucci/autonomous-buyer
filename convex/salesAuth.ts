import { v, ConvexError } from "convex/values";
import { action, internalMutation, query, httpAction, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { salesProvider } from "./salesFields";
import { ownedCompany } from "./onboarding";
import { randomKey, seal, verifyHmac } from "./salesCrypto";
import { object, text, timestamp } from "./salesPayloads";
import { shopDomain } from "../src/lib/sales-planning";
import type { Doc, Id } from "./_generated/dataModel";

export const squareBase = (sandbox: boolean) =>
  sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
export const salesCallbackBase = () =>
  (env.SALES_CALLBACK_BASE_URL ?? env.CONVEX_SITE_URL).replace(/\/$/, "");
export const squareCallbackUrl = () =>
  (env.SQUARE_SANDBOX !== "false" && env.SQUARE_SANDBOX_CALLBACK_URL) ||
  salesCallbackBase() + "/api/sales/square/callback";
export function needed(value: string | undefined, name: string): string {
  if (!value) throw new ConvexError(name + " is not configured yet.");
  return value;
}
export async function jsonRequest(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("Provider request failed (" + response.status + ").");
  const value = object(await response.json());
  if (value.errors) throw new Error("The provider could not complete this request.");
  return value;
}
export async function shopifyGraph(
  shop: string,
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
) {
  const body = await jsonRequest(
    "https://" + shopDomain(shop) + "/admin/api/2026-07/graphql.json",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    },
  );
  return object(body.data);
}
export const readiness = query({
  args: {},
  returns: v.object({ square: v.boolean(), shopify: v.boolean(), squareSandbox: v.boolean() }),
  handler: async (ctx) => {
    await ownedCompany(ctx);
    return {
      square: !!(
        env.SQUARE_APP_ID &&
        env.SQUARE_APP_SECRET &&
        env.SQUARE_WEBHOOK_SIGNATURE_KEY &&
        env.SALES_CREDENTIAL_KEY
      ),
      shopify: !!(env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET && env.SALES_CREDENTIAL_KEY),
      squareSandbox: env.SQUARE_SANDBOX !== "false",
    };
  },
});
export const beginState = internalMutation({
  args: { provider: salesProvider, state: v.string(), shop: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const { user, organization } = await ownedCompany(ctx);
    await ctx.db.insert("salesAuthStates", {
      ...a,
      userId: user._id,
      organizationId: organization._id,
      expiresAt: Date.now() + 600_000,
    });
    return null;
  },
});
export const consumeState = internalMutation({
  args: { state: v.string(), provider: salesProvider, shop: v.optional(v.string()) },
  returns: v.id("organizations"),
  handler: async (ctx, a) => {
    const state = await ctx.db
      .query("salesAuthStates")
      .withIndex("by_state", (q) => q.eq("state", a.state))
      .unique();
    if (
      !state ||
      state.provider !== a.provider ||
      state.shop !== a.shop ||
      state.usedAt ||
      state.expiresAt < Date.now()
    )
      throw new Error("This connection link expired. Start again in BUY HARD.");
    const user = await ctx.db.get("users", state.userId);
    if (
      !user ||
      !user.isActive ||
      user.organizationId !== state.organizationId ||
      !["admin", "buyer"].includes(user.role ?? "")
    )
      throw new Error("Company access changed. Sign in again.");
    await ctx.db.patch("salesAuthStates", state._id, { usedAt: Date.now() });
    return state.organizationId;
  },
});
export const begin = action({
  args: { provider: salesProvider, shop: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, a) => {
    needed(env.SALES_CREDENTIAL_KEY, "Sales connections");
    const shop = a.provider === "shopify" ? shopDomain(a.shop ?? "") : undefined;
    const callback =
      a.provider === "square"
        ? squareCallbackUrl()
        : salesCallbackBase() + "/api/sales/shopify/callback";
    const state = randomKey();
    let url: URL;
    if (a.provider === "square") {
      needed(env.SQUARE_APP_SECRET, "Square");
      needed(env.SQUARE_WEBHOOK_SIGNATURE_KEY, "Square webhooks");
      url = new URL(squareBase(env.SQUARE_SANDBOX !== "false") + "/oauth2/authorize");
      url.searchParams.set("client_id", needed(env.SQUARE_APP_ID, "Square"));
      url.searchParams.set("scope", "ORDERS_READ INVENTORY_READ ITEMS_READ MERCHANT_PROFILE_READ");
      // Sandbox authorization uses the already-open test seller dashboard.
      // Square only supports forced sign-in for production sellers.
      if (env.SQUARE_SANDBOX === "false") url.searchParams.set("session", "false");
    } else {
      needed(env.SHOPIFY_CLIENT_SECRET, "Shopify");
      url = new URL("https://" + shop + "/admin/oauth/authorize");
      url.searchParams.set("client_id", needed(env.SHOPIFY_CLIENT_ID, "Shopify"));
      url.searchParams.set("scope", "read_orders,read_products,read_inventory,read_locations");
    }
    url.searchParams.set("redirect_uri", callback);
    url.searchParams.set("state", state);
    await ctx.runMutation(internal.salesAuth.beginState, { provider: a.provider, state, shop });
    return url.href;
  },
});
export const save = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    provider: salesProvider,
    accountId: v.string(),
    name: v.string(),
    sandbox: v.boolean(),
    credentials: v.string(),
    webhookKey: v.string(),
  },
  returns: v.id("salesConnections"),
  handler: async (ctx, a) => {
    const existing = await ctx.db
      .query("salesConnections")
      .withIndex("by_provider_and_accountId", (q) =>
        q.eq("provider", a.provider).eq("accountId", a.accountId),
      )
      .unique();
    if (existing && existing.organizationId !== a.organizationId)
      throw new Error("This store is already connected to another workspace.");
    if (existing) {
      await ctx.db.patch("salesConnections", existing._id, {
        credentials: a.credentials,
        status: "connected",
        message: undefined,
        name: a.name,
        refreshLease: undefined,
        refreshLeaseUntil: undefined,
      });
      return existing._id;
    }
    const rows = await ctx.db
      .query("salesConnections")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", a.organizationId))
      .take(20);
    if (rows.length >= 20) throw new Error("This workspace supports 20 connections.");
    return await ctx.db.insert("salesConnections", {
      ...a,
      status: "connected",
      createdAt: Date.now(),
    });
  },
});

function returnToApp(ok: boolean) {
  const url = new URL(needed(env.APP_URL, "App URL"));
  url.pathname = "/";
  url.search = "?page=connections&sales=" + (ok ? "connected" : "retry");
  return Response.redirect(url.href, 303);
}
export const callback = httpAction(async (ctx, request) => {
  const url = new URL(request.url),
    provider = url.pathname.includes("/square/") ? "square" : "shopify";
  try {
    const code = needed(url.searchParams.get("code") ?? undefined, "Authorization code");
    const state = needed(url.searchParams.get("state") ?? undefined, "Connection state");
    let shop: string | undefined;
    if (provider === "shopify") {
      shop = shopDomain(url.searchParams.get("shop") ?? "");
      // Shopify signs the decoded, sorted parameter map, excluding hmac.
      if (new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length)
        throw new Error("Repeated callback parameter.");
      const message = [...url.searchParams.entries()]
        .filter(([k]) => k !== "hmac")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, value]) => k + "=" + value)
        .join("&");
      if (
        !(await verifyHmac(
          needed(env.SHOPIFY_CLIENT_SECRET, "Shopify"),
          message,
          url.searchParams.get("hmac") ?? "",
          "hex",
        ))
      )
        return new Response("Invalid signature", { status: 401 });
    }
    const organizationId: Id<"organizations"> = await ctx.runMutation(
      internal.salesAuth.consumeState,
      { state, provider, shop },
    );
    let accountId: string,
      name: string,
      sandbox = false;
    let tokens: Record<string, unknown>;
    if (provider === "square") {
      sandbox = env.SQUARE_SANDBOX !== "false";
      tokens = await jsonRequest(squareBase(sandbox) + "/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.SQUARE_APP_ID,
          client_secret: env.SQUARE_APP_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: squareCallbackUrl(),
        }),
      });
      accountId = text(tokens.merchant_id);
      name = "Square " + (sandbox ? "sandbox" : "account");
    } else {
      tokens = await jsonRequest("https://" + shop + "/admin/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.SHOPIFY_CLIENT_ID,
          client_secret: env.SHOPIFY_CLIENT_SECRET,
          code,
          expiring: "1",
        }),
      });
      accountId = shop!;
      name = shop!;
    }
    const accessToken = text(tokens.access_token);
    const credentials = await seal(
      {
        accessToken,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expires_at
          ? timestamp(tokens.expires_at)
          : typeof tokens.expires_in === "number"
            ? Date.now() + tokens.expires_in * 1000
            : null,
      },
      needed(env.SALES_CREDENTIAL_KEY, "Sales encryption"),
    );
    const prior: Doc<"salesConnections"> | null = await ctx.runQuery(internal.sales.byAccount, {
      provider,
      accountId,
    });
    if (prior && prior.organizationId !== organizationId)
      throw new Error("Store already connected.");
    const webhookKey = prior?.webhookKey ?? randomKey();
    if (provider === "shopify") {
      const uri = salesCallbackBase() + "/api/sales/shopify/events/" + webhookKey;
      const existing = await shopifyGraph(
        shop!,
        accessToken,
        "query { webhookSubscriptions(first:100) { nodes { topic uri } pageInfo { hasNextPage } } }",
      );
      const connection = object(existing.webhookSubscriptions);
      if (object(connection.pageInfo).hasNextPage)
        throw new Error("Too many subscriptions to reconcile safely.");
      const nodes = Array.isArray(connection.nodes) ? connection.nodes.map(object) : [];
      for (const topic of [
        "ORDERS_PAID",
        "ORDERS_UPDATED",
        "INVENTORY_LEVELS_UPDATE",
        "APP_UNINSTALLED",
      ]) {
        if (nodes.some((n) => n.topic === topic && n.uri === uri)) continue;
        const result = await shopifyGraph(
          shop!,
          accessToken,
          "mutation($topic:WebhookSubscriptionTopic!,$input:WebhookSubscriptionInput!){webhookSubscriptionCreate(topic:$topic,webhookSubscription:$input){userErrors{message}}}",
          { topic, input: { uri, format: "JSON" } },
        );
        const errors = object(result.webhookSubscriptionCreate).userErrors;
        if (Array.isArray(errors) && errors.length)
          throw new Error("Could not register Shopify updates.");
      }
    }
    const connectionId: Id<"salesConnections"> = await ctx.runMutation(internal.salesAuth.save, {
      organizationId,
      provider,
      accountId,
      name,
      sandbox,
      credentials,
      webhookKey,
    });
    await ctx.scheduler.runAfter(0, internal.salesProvider.sync, { connectionId });
    return returnToApp(true);
  } catch {
    return returnToApp(false);
  }
});
