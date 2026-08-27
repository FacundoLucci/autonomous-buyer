import { defineApp } from "convex/server";
import { v } from "convex/values";
import agentmail from "@agentmail/convex/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import firecrawl from "@firecrawl/firecrawl-convex/convex.config";

// Your own HTTP endpoints (convex/http.ts) are served under /api so the
// static site can own the root.
const app = defineApp({
  httpPrefix: "/api",
  env: {
    OPENAI_API_KEY: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
    FIRECRAWL_API_KEY: v.string(),
    FIRECRAWL_WEBHOOK_SECRET: v.optional(v.string()),
    AGENTMAIL_API_KEY: v.optional(v.string()),
    AGENTMAIL_WEBHOOK_SECRET: v.optional(v.string()),
    AGENTMAIL_BASE_URL: v.optional(v.string()),
  },
});

app.use(staticHosting, { httpPrefix: "/" });
app.use(workflow);
app.use(firecrawl, {
  httpPrefix: "/api/firecrawl/",
  env: {
    FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY,
    FIRECRAWL_WEBHOOK_SECRET: app.env.FIRECRAWL_WEBHOOK_SECRET,
  },
});
app.use(agentmail);

export default app;
