"use node";

import { chat, type AnyTextAdapter } from "@tanstack/ai";
import { createOpenaiChat } from "@tanstack/ai-openai";
import { createOpenRouterText } from "@tanstack/ai-openrouter";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";
import { taskSchemas, type AiTask, type StructuredAiResult } from "./aiContracts";

const OPENAI_MODEL = "gpt-5.4-mini";
const OPENROUTER_MODEL = "openai/gpt-5.4-mini";

type ModelSelection = {
  adapter: AnyTextAdapter;
  transport: "openai" | "openrouter";
  model: string;
};

function configured(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized !== "not-configured" ? normalized : undefined;
}

function getLanguageModel(): ModelSelection {
  const openAiKey = configured(env.OPENAI_API_KEY);
  if (openAiKey !== undefined) {
    return {
      adapter: createOpenaiChat(OPENAI_MODEL, openAiKey),
      transport: "openai",
      model: OPENAI_MODEL,
    };
  }
  const openRouterKey = configured(env.OPENROUTER_API_KEY);
  if (openRouterKey !== undefined) {
    return {
      adapter: createOpenRouterText(OPENROUTER_MODEL, openRouterKey),
      transport: "openrouter",
      model: OPENROUTER_MODEL,
    };
  }
  throw new Error("Neither OPENAI_API_KEY nor OPENROUTER_API_KEY is configured.");
}

const systemPrompt = `You perform one structured procurement-language task.
Use only the supplied stored evidence. Never do inventory arithmetic, price calculations,
policy decisions, state transitions, approvals, or purchase-order totals. Do not reveal raw
reasoning. Put facts directly supported by evidence in confirmedFields and interpretations in
inferredFields. Every field must cite only evidence IDs supplied in the prompt.`;

async function runTask(
  adapter: AnyTextAdapter,
  task: AiTask,
  intent: string,
  evidenceRefs: string[],
  evidenceJson: string,
): Promise<StructuredAiResult> {
  const prompt = `${intent}\n\nAllowed evidence IDs:\n${evidenceRefs.join("\n")}\n\nStored evidence:\n${evidenceJson}`;
  const options = {
    adapter,
    systemPrompts: [systemPrompt],
    messages: [{ role: "user" as const, content: prompt }],
  };
  switch (task) {
    case "supplier_search_queries":
      return await chat({ ...options, outputSchema: taskSchemas.supplier_search_queries });
    case "product_equivalency":
      return await chat({ ...options, outputSchema: taskSchemas.product_equivalency });
    case "quote_extraction":
      return await chat({ ...options, outputSchema: taskSchemas.quote_extraction });
    case "missing_information":
      return await chat({ ...options, outputSchema: taskSchemas.missing_information });
    case "follow_up_wording":
      return await chat({ ...options, outputSchema: taskSchemas.follow_up_wording });
    case "recommendation_explanation":
      return await chat({ ...options, outputSchema: taskSchemas.recommendation_explanation });
    case "confirmation_extraction":
      return await chat({ ...options, outputSchema: taskSchemas.confirmation_extraction });
    case "exception_explanation":
      return await chat({ ...options, outputSchema: taskSchemas.exception_explanation });
  }
}

function requireStoredEvidence(result: StructuredAiResult, evidenceRefs: string[]) {
  const allowed = new Set(evidenceRefs);
  const fields = [...result.confirmedFields, ...result.inferredFields];
  for (const field of fields) {
    if (field.evidenceRefs.length === 0 || field.evidenceRefs.some((ref) => !allowed.has(ref))) {
      throw new Error("Structured output cited missing or unknown evidence.");
    }
  }
}

export const runStructuredTask = internalAction({
  args: { aiRunId: v.id("aiRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    let selection: ModelSelection = {
      adapter: createOpenaiChat(OPENAI_MODEL, "not-configured"),
      transport: "openai",
      model: OPENAI_MODEL,
    };
    try {
      selection = getLanguageModel();
      const evidence = await ctx.runQuery(internal.ai.getEvidence, { aiRunId: args.aiRunId });
      const result = await runTask(
        selection.adapter,
        evidence.task,
        evidence.intent,
        evidence.evidenceRefs,
        evidence.evidenceJson,
      );
      requireStoredEvidence(result, evidence.evidenceRefs);
      await ctx.runMutation(internal.ai.completeRun, {
        aiRunId: args.aiRunId,
        transport: selection.transport,
        model: selection.model,
        evidenceRefs: evidence.evidenceRefs,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Structured AI task failed.";
      await ctx.runMutation(internal.ai.failRun, {
        aiRunId: args.aiRunId,
        transport: selection.transport,
        model: selection.model,
        errorMessage,
      });
    }
    return null;
  },
});
