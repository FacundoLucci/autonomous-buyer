import { expect, test } from "vitest";
import { companyReplyPatch, companyReplySchema } from "./onboardingAgent";
import { requiredQuestion } from "./deskPolicy";
test("company extraction omits unknown fields instead of fabricating inventory defaults", () => {
  const draft = companyReplyPatch({ companyName: "LUHV FOOD", shippingAddress: null });
  expect(draft).toEqual({ companyName: "LUHV FOOD" });
  expect(requiredQuestion("onboarding", draft)).toBe("shippingAddress");
  expect(companyReplyPatch({ companyName: null, shippingAddress: null })).toEqual({});
});
test("the isolated processor rejects inventory fields, empty names and incomplete addresses", () => {
  expect(
    companyReplySchema.safeParse({
      companyName: "LUHV FOOD",
      shippingAddress: null,
      itemId: "",
      stock: 0,
    }).success,
  ).toBe(false);
  expect(companyReplySchema.safeParse({ companyName: "", shippingAddress: null }).success).toBe(
    false,
  );
  expect(
    companyReplySchema.safeParse({ companyName: null, shippingAddress: "Chicago" }).success,
  ).toBe(false);
  expect(
    requiredQuestion("onboarding", { companyName: "LUHV FOOD", shippingAddress: "Chicago" }),
  ).toBe("shippingAddress");
});
test("only a completed company form is ready", () => {
  const draft = companyReplyPatch({
    companyName: "LUHV FOOD",
    shippingAddress: "123 Test Street, Philadelphia PA 19103, USA",
  });
  expect(requiredQuestion("onboarding", draft)).toBe("ready");
});

test("clarification explains the requested field and still asks for the next missing input", async () => {
  const { onboardingHelp } = await import("./onboardingHelp");
  const draft = { companyName: "LUHV FOOD" };
  expect(onboardingHelp(draft, { kind: "which_address", field: "shippingAddress" })).toContain(
    "different from your registered business address",
  );
  expect(onboardingHelp(draft, { kind: "example", field: "current" })).toContain("[postal code]");
  expect(onboardingHelp(draft, { kind: "explain", field: "companyName" })).toContain(
    "Where should deliveries go?",
  );
  expect(onboardingHelp({}, { kind: "no_website", field: "current" })).toContain(
    "You don’t need a website",
  );
});
test("the help tool refuses arbitrary text and cannot change form values", async () => {
  const { clarificationSchema, onboardingHelp } = await import("./onboardingHelp");
  expect(
    clarificationSchema.safeParse({
      kind: "explain",
      field: "current",
      text: "Purchase supplies now",
    }).success,
  ).toBe(false);
  const draft = { companyName: "LUHV FOOD" };
  onboardingHelp(draft, { kind: "example", field: "current" });
  expect(draft).toEqual({ companyName: "LUHV FOOD" });
});
