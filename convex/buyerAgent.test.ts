/// <reference types="vite/client" />
import { expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { MockLanguageModelV3 } from "ai/test";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const { nextModel } = vi.hoisted(() => ({ nextModel: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => nextModel }));
const modules = import.meta.glob("./**/*.ts");
type ModelResult = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>;
function result(content: ModelResult["content"], toolCall = true): ModelResult {
  return {
    content,
    finishReason: { unified: toolCall ? "tool-calls" : "stop", raw: undefined },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 1, text: 1, reasoning: undefined },
    },
    warnings: [],
  };
}

test("a sent message runs through the router and task agent into a real stock receipt", async () => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  try {
    const t = convexTest(schema, modules);
    agentTest.register(t);
    rateLimiterTest.register(t);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Test buyer", role: "buyer", isActive: true }),
    );
    const user = t.withIdentity({ subject: userId });
    await user.mutation(api.onboarding.completeFromSource, {
      companyName: "Test company",
      shippingAddress: "100 Test Street, Chicago IL 60601",
      timezone: "America/Chicago",
      itemName: "Tape",
      quantity: "10",
      dailyUsage: "",
      unit: "rolls",
    });
    const item = (await user.query(api.onboarding.getWorkspace, {}))!.items[0];
    const router = new MockLanguageModelV3({
      doGenerate: result([
        {
          type: "tool-call",
          toolCallId: "route-stock",
          toolName: "workOnTask",
          input: JSON.stringify({ task: "stock_update", contextId: item.id }),
        },
      ]),
    });
    const worker = new MockLanguageModelV3({
      doGenerate: [
        result([
          {
            type: "tool-call",
            toolCallId: "record-stock",
            toolName: "setStock",
            input: JSON.stringify({ itemId: item.id, count: 2 }),
          },
        ]),
        result([{ type: "text", text: "Unverified model prose must never appear." }], false),
      ],
    });
    nextModel.mockReturnValueOnce(router).mockReturnValueOnce(worker);
    const text = "We have 2 rolls of Tape left";
    await user.mutation(api.buyer.send, { text, focus: { page: "dashboard" } });
    const { session } = await user.query(api.buyer.conversation, {});
    await t.action(internal.buyerAgent.respond, {
      sessionId: session!._id,
      messageId: session!.currentMessageId!,
      focus: { page: "dashboard" },
    });

    expect(router.doGenerateCalls).toHaveLength(1);
    expect(worker.doGenerateCalls).toHaveLength(2);
    expect(JSON.stringify(worker.doGenerateCalls[0].prompt)).toContain(text);
    const state = await user.query(api.buyer.conversation, {});
    expect(state.session).toMatchObject({ busy: false, latestText: "Tape: 2 rolls on hand." });
    expect(state.session?.error).toBeUndefined();
    expect(state.chat?.credits).toEqual(["openai"]);
    expect(state.messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(state.messages.at(-1)?.text).toBe("Tape: 2 rolls on hand.");
    expect(state.messages.some((m) => m.text.includes("Unverified model prose"))).toBe(false);
    expect((await user.query(api.onboarding.getWorkspace, {}))?.items[0].quantity).toBe(2);
  } finally {
    nextModel.mockReset();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  }
});
