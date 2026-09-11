import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { page, robots, sitemap } from "./seo";
import { appPaths, publicPaths } from "../shared/seo";
import { webhook as marketingWebhook } from "./marketingWebhook";
import { AgentMail } from "@agentmail/convex";
import { httpRouter } from "convex/server";

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
http.route({ path: "/api/marketing/cal", method: "POST", handler: marketingWebhook });

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

http.route({ path: "/robots.txt", method: "GET", handler: robots });
http.route({ path: "/sitemap.xml", method: "GET", handler: sitemap });
for (const path of [...publicPaths, ...appPaths, "/landing", "/index.html"]) {
  http.route({ path, method: "GET", handler: page });
  if (path !== "/") http.route({ path: `${path}/`, method: "GET", handler: page });
}
registerStaticRoutes(http, components.staticHosting, { spaFallback: false });
export default http;
