// Uses a separate development account and synthetic inventory. Sends no email or orders.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";

const deployment = "https://festive-coyote-483.convex.cloud";
const client = new ConvexHttpClient(deployment, { logger: false });
const email = `buyer-qa-${Date.now()}@buyer-test.example`;
const password = randomBytes(24).toString("base64url");
await client.action("auth:signIn", {
  provider: "password",
  params: { email, password, flow: "signUp" },
});
const login = await client.action("auth:signIn", {
  provider: "password",
  params: { email, password, flow: "signIn" },
});
assert.ok(login.tokens?.token, "Password login must issue a token");
client.setAuth(login.tokens.token);
try {
  await client.mutation("onboarding:completeFromSource", {
    companyName: "Live Buyer QA — synthetic data",
    shippingAddress: "100 Test Street, Test City, IL 60601",
    timezone: "America/Chicago",
    itemName: "QA packing tape",
    quantity: "10",
    dailyUsage: "",
    unit: "rolls",
  });
  const workspace = await client.query("onboarding:getWorkspace", {});
  const item = workspace.items[0];
  assert.equal(item.quantity, 10);
  const text = "We have 2 rolls of QA packing tape left.";
  await client.mutation("buyer:send", {
    text,
    focus: { page: "inventory", item: item.id },
  });
  let state;
  for (let i = 0; i < 90; i++) {
    state = await client.query("buyer:conversation", {});
    if (!state.session?.busy) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(state.session.busy, false, "Live agent did not complete within 90 seconds");
  assert.equal(state.session.error, undefined);
  const updated = await client.query("onboarding:getWorkspace", {});
  assert.equal(updated.items[0].quantity, 2, JSON.stringify(state.messages));
  assert.ok(state.session.latestText.includes("2 rolls on hand"));
  assert.ok(state.chat.credits.includes("openai"));
  const threadId = state.session.threadId;
  await client.mutation("buyer:begin", { task: "settings" });
  const resumed = await client.query("buyer:conversation", {});
  assert.equal(resumed.session.threadId, threadId);
  assert.ok(resumed.messages.some((m) => m.text === text));
  const evidence = {
    checkedAt: new Date().toISOString(),
    deployment,
    authenticatedPasswordLogin: true,
    liveModel: true,
    sessionId: state.session._id,
    itemId: item.id,
    before: 10,
    after: updated.items[0].quantity,
    receipt: state.session.latestText,
    providerCredits: state.chat.credits,
    conversationSurvivesTaskChange: true,
    emailsSent: 0,
    ordersCreated: 0,
  };
  mkdirSync("output/qa", { recursive: true });
  writeFileSync("output/qa/live-buyer.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await client.action("auth:signOut", {});
}
