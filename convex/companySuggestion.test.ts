/// <reference types="vite/client" />
import { test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { passkeyEmail, businessDomain } from "./companySuggestionFields";
const modules = import.meta.glob("./**/*.ts");
test("email is normalized and personal domains do not trigger business lookup", () => {
  expect(passkeyEmail(" Buyer@LuhvFood.com ")).toBe("buyer@luhvfood.com");
  expect(() => passkeyEmail("old-account-name")).toThrow(/email/);
  expect(businessDomain("buyer@luhvfood.com")).toBe("luhvfood.com");
  for (const email of [
    "buyer@gmail.com",
    "buyer@yahoo.co.uk",
    "buyer@outlook.com",
    "buyer@proton.me",
  ])
    expect(businessDomain(email)).toBeNull();
});
test("passkey email is profile data, not verified identity or account linking", async () => {
  const t = convexTest(schema, modules);
  const id = await t.mutation(internal.authData.createPasskeyUser, {
    provider: "passkey",
    providerAccountId: "new",
    profile: { username: "BUYER@gmail.com" },
  });
  const user = await t.run((ctx) => ctx.db.get("users", id));
  expect(user).toMatchObject({ onboardingEmail: "buyer@gmail.com", role: "viewer" });
  expect(user?.email).toBeUndefined();
  expect(user?.emailVerificationTime).toBeUndefined();
  expect(await t.withIdentity({ subject: id }).query(api.companySuggestion.current, {})).toBeNull();
});
test("lookup results are private suggestions and never create a company", async () => {
  const t = convexTest(schema, modules);
  const id = await t.mutation(internal.authData.createPasskeyUser, {
    provider: "passkey",
    providerAccountId: "new",
    profile: { username: "buyer@luhvfood.com" },
  });
  const a = t.withIdentity({ subject: id });
  const row = await a.query(api.companySuggestion.current, {});
  expect(row?.status).toBe("pending");
  await t.mutation(internal.companySuggestion.finish, {
    id: row!._id,
    companyName: "LUHV FOOD",
    shippingAddress: "123 Test Street, Philadelphia PA 19103, USA",
  });
  expect((await a.query(api.companySuggestion.current, {}))?.status).toBe("ready");
  expect((await t.run((ctx) => ctx.db.get("users", id)))?.organizationId).toBeUndefined();
  const other = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Other", role: "viewer", isActive: true }),
  );
  expect(
    await t.withIdentity({ subject: other }).query(api.companySuggestion.current, {}),
  ).toBeNull();
  await t.run((ctx) => ctx.db.patch("companySuggestions", row!._id, { status: "dismissed" }));
  await t.mutation(internal.companySuggestion.finish, { id: row!._id, companyName: "Late result" });
  expect((await a.query(api.companySuggestion.current, {}))?.status).toBe("dismissed");
});
test("late research never replaces a setup conversation already in progress", async () => {
  const t = convexTest(schema, modules);
  const id = await t.mutation(internal.authData.createPasskeyUser, {
    provider: "passkey",
    providerAccountId: "new",
    profile: { username: "buyer@luhvfood.com" },
  });
  const a = t.withIdentity({ subject: id });
  const row = await a.query(api.companySuggestion.current, {});
  await t.run((ctx) =>
    ctx.db.insert("taskChats", {
      userId: id,
      task: "onboarding",
      threadId: "fixture",
      draft: { companyName: "User's company" },
      busy: false,
      updatedAt: Date.now(),
    }),
  );
  await t.mutation(internal.companySuggestion.finish, {
    id: row!._id,
    companyName: "Public company",
  });
  expect((await a.query(api.companySuggestion.current, {}))?.status).toBe("dismissed");
});
