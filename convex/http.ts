import { AgentMail } from "@agentmail/convex";
import { httpRouter } from "convex/server";
import { callback as salesCallback } from "./salesAuth";
import { receive as salesWebhook } from "./salesWebhook";

import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { authorizeCommitHttp } from "./browserCheckout";
import { upload, options } from "./inventoryUpload";

const agentmail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.inbound.onMessageReceived,
  onEvent: internal.companyOrders.onMailEvent,
});
const http = httpRouter();
http.route({ path: "/api/sales/square/callback", method: "GET", handler: salesCallback });
http.route({ path: "/api/sales/shopify/callback", method: "GET", handler: salesCallback });
http.route({ path: "/api/sales/square/events", method: "POST", handler: salesWebhook });
http.route({ pathPrefix: "/api/sales/shopify/events/", method: "POST", handler: salesWebhook });

auth.addHttpRoutes(http);
http.route({ path: "/api/browser/authorize", method: "POST", handler: authorizeCommitHttp });
http.route({ path: "/api/inventory/invoice", method: "POST", handler: upload });
http.route({ path: "/api/inventory/invoice", method: "OPTIONS", handler: options });

http.route({
  path: "/api/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    agentmail.handleWebhook(
      ctx as unknown as Parameters<typeof agentmail.handleWebhook>[0],
      request,
    ),
  ),
});

export default http;
