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
import type * as audit from "../audit.js";
import type * as audited from "../audited.js";
import type * as auth from "../auth.js";
import type * as authData from "../authData.js";
import type * as authz from "../authz.js";
import type * as companyAlerts from "../companyAlerts.js";
import type * as companyEmail from "../companyEmail.js";
import type * as companyFields from "../companyFields.js";
import type * as companyInventory from "../companyInventory.js";
import type * as companyMail from "../companyMail.js";
import type * as companyOrders from "../companyOrders.js";
import type * as companyRules from "../companyRules.js";
import type * as companyStock from "../companyStock.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as desk from "../desk.js";
import type * as deskAgent from "../deskAgent.js";
import type * as deskFields from "../deskFields.js";
import type * as deskPolicy from "../deskPolicy.js";
import type * as domain from "../domain.js";
import type * as domain_inventory from "../domain/inventory.js";
import type * as domain_money from "../domain/money.js";
import type * as domain_procurement from "../domain/procurement.js";
import type * as domain_quotes from "../domain/quotes.js";
import type * as http from "../http.js";
import type * as identity from "../identity.js";
import type * as inbound from "../inbound.js";
import type * as integrations from "../integrations.js";
import type * as inventorySourceFields from "../inventorySourceFields.js";
import type * as inventorySourceNode from "../inventorySourceNode.js";
import type * as inventorySources from "../inventorySources.js";
import type * as inventoryUpload from "../inventoryUpload.js";
import type * as mail from "../mail.js";
import type * as onboarding from "../onboarding.js";
import type * as passkeyAuth from "../passkeyAuth.js";
import type * as procurements from "../procurements.js";
import type * as purchaseOrders from "../purchaseOrders.js";
import type * as purchasing from "../purchasing.js";
import type * as rateLimits from "../rateLimits.js";
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
  audit: typeof audit;
  audited: typeof audited;
  auth: typeof auth;
  authData: typeof authData;
  authz: typeof authz;
  companyAlerts: typeof companyAlerts;
  companyEmail: typeof companyEmail;
  companyFields: typeof companyFields;
  companyInventory: typeof companyInventory;
  companyMail: typeof companyMail;
  companyOrders: typeof companyOrders;
  companyRules: typeof companyRules;
  companyStock: typeof companyStock;
  crons: typeof crons;
  demo: typeof demo;
  desk: typeof desk;
  deskAgent: typeof deskAgent;
  deskFields: typeof deskFields;
  deskPolicy: typeof deskPolicy;
  domain: typeof domain;
  "domain/inventory": typeof domain_inventory;
  "domain/money": typeof domain_money;
  "domain/procurement": typeof domain_procurement;
  "domain/quotes": typeof domain_quotes;
  http: typeof http;
  identity: typeof identity;
  inbound: typeof inbound;
  integrations: typeof integrations;
  inventorySourceFields: typeof inventorySourceFields;
  inventorySourceNode: typeof inventorySourceNode;
  inventorySources: typeof inventorySources;
  inventoryUpload: typeof inventoryUpload;
  mail: typeof mail;
  onboarding: typeof onboarding;
  passkeyAuth: typeof passkeyAuth;
  procurements: typeof procurements;
  purchaseOrders: typeof purchaseOrders;
  purchasing: typeof purchasing;
  rateLimits: typeof rateLimits;
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
  auth: import("@convex-dev/auth2/core/_generated/component.js").ComponentApi<"auth">;
  authPasskey: import("@convex-dev/auth2/providers/passkey/_generated/component.js").ComponentApi<"authPasskey">;
  authUsername: import("@convex-dev/auth2/username/_generated/component.js").ComponentApi<"authUsername">;
  authAnonymous: import("@convex-dev/auth2/providers/anonymous/_generated/component.js").ComponentApi<"authAnonymous">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
};
