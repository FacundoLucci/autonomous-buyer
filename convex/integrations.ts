import { v } from "convex/values";

import { integrationNameValidator, integrationStatusValidator } from "./domain";
import { env, query } from "./_generated/server";

const integrationValidator = v.object({
  name: integrationNameValidator,
  status: integrationStatusValidator,
});

const configured = (value: string | undefined): "configured" | "missing" => {
  const normalized = value?.trim();
  return normalized && normalized !== "not-configured" ? "configured" : "missing";
};

export const getStatus = query({
  args: {},
  returns: v.array(integrationValidator),
  handler: async () => [
    { name: "openai" as const, status: configured(env.OPENAI_API_KEY) },
    { name: "openrouter" as const, status: configured(env.OPENROUTER_API_KEY) },
    { name: "firecrawl" as const, status: configured(env.FIRECRAWL_API_KEY) },
    { name: "agentmail" as const, status: configured(env.AGENTMAIL_API_KEY) },
  ],
});
