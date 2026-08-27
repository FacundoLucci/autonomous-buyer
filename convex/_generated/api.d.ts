/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiContracts from "../aiContracts.js";
import type * as aiNode from "../aiNode.js";
import type * as approvals from "../approvals.js";
import type * as auth from "../auth.js";
import type * as authData from "../authData.js";
import type * as demo from "../demo.js";
import type * as domain from "../domain.js";
import type * as domain_inventory from "../domain/inventory.js";
import type * as domain_money from "../domain/money.js";
import type * as domain_procurement from "../domain/procurement.js";
import type * as domain_quotes from "../domain/quotes.js";
import type * as http from "../http.js";
import type * as inbound from "../inbound.js";
import type * as integrations from "../integrations.js";
import type * as mail from "../mail.js";
import type * as procurements from "../procurements.js";
import type * as purchaseOrders from "../purchaseOrders.js";
import type * as purchasing from "../purchasing.js";
import type * as recommendations from "../recommendations.js";
import type * as rfqs from "../rfqs.js";
import type * as sourcing from "../sourcing.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiContracts: typeof aiContracts;
  aiNode: typeof aiNode;
  approvals: typeof approvals;
  auth: typeof auth;
  authData: typeof authData;
  demo: typeof demo;
  domain: typeof domain;
  "domain/inventory": typeof domain_inventory;
  "domain/money": typeof domain_money;
  "domain/procurement": typeof domain_procurement;
  "domain/quotes": typeof domain_quotes;
  http: typeof http;
  inbound: typeof inbound;
  integrations: typeof integrations;
  mail: typeof mail;
  procurements: typeof procurements;
  purchaseOrders: typeof purchaseOrders;
  purchasing: typeof purchasing;
  recommendations: typeof recommendations;
  rfqs: typeof rfqs;
  sourcing: typeof sourcing;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
};
