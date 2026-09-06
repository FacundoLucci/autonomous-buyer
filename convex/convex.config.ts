import { defineApp } from "convex/server";
import { v } from "convex/values";
import agentmail from "@agentmail/convex/convex.config";
import agent from "@convex-dev/agent/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import firecrawl from "@firecrawl/firecrawl-convex/convex.config";
import auth from "@convex-dev/auth2/core/convex.config";
import passkey from "@convex-dev/auth2/providers/passkey/convex.config";
import username from "@convex-dev/auth2/username/convex.config";
import anonymous from "@convex-dev/auth2/providers/anonymous/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

// Your own HTTP endpoints (convex/http.ts) are served under /api so the
// static site can own the root.
const app = defineApp({
  httpPrefix: "/",
  env: {
    AUTH_PRIVATE_KEY: v.string(),
    AUTH_JWKS: v.string(),
    AUTH_ORIGIN: v.optional(v.string()),
    AUTH_RP_ID: v.optional(v.string()),
    OPENAI_API_KEY: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
    FIRECRAWL_API_KEY: v.string(),
    FIRECRAWL_WEBHOOK_SECRET: v.optional(v.string()),
    AGENTMAIL_API_KEY: v.optional(v.string()),
    AGENTMAIL_WEBHOOK_SECRET: v.optional(v.string()),
    AGENTMAIL_BASE_URL: v.optional(v.string()),
    AGENTMAIL_INBOX_ID: v.optional(v.string()),
    AGENTMAIL_INBOX_EMAIL: v.optional(v.string()),
    BUYER_EMAIL: v.optional(v.string()),
    ALERT_EMAIL_URL: v.optional(v.string()),
    ALERT_EMAIL_SECRET: v.optional(v.string()),
    APP_URL: v.optional(v.string()),
  },
});

app.use(staticHosting, { httpPrefix: "/" });
app.use(auth, {
  httpPrefix: "/auth",
  env: {
    AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
    AUTH_JWKS: app.env.AUTH_JWKS,
  },
});
app.use(passkey);
app.use(username);
app.use(anonymous);
app.use(agent);
app.use(workflow);
app.use(rateLimiter);
app.use(firecrawl, {
  httpPrefix: "/api/firecrawl/",
  env: {
    FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY,
    FIRECRAWL_WEBHOOK_SECRET: app.env.FIRECRAWL_WEBHOOK_SECRET,
  },
});
app.use(agentmail, {
  env: {
    AGENTMAIL_API_KEY: app.env.AGENTMAIL_API_KEY,
    AGENTMAIL_BASE_URL: app.env.AGENTMAIL_BASE_URL,
    AGENTMAIL_WEBHOOK_SECRET: app.env.AGENTMAIL_WEBHOOK_SECRET,
  },
});

export default app;
