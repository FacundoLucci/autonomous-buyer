import { z } from "zod";
import { requiredQuestion, questions } from "./deskPolicy";
import type { Doc } from "./_generated/dataModel";

export const clarificationSchema = z.strictObject({
  kind: z.enum(["explain", "example", "rephrase", "no_website", "which_address", "why_needed"]),
  field: z.enum(["companyName", "shippingAddress", "current"]),
});
export type Clarification = z.infer<typeof clarificationSchema>;

// The model selects the help needed; only application-approved wording reaches
// the conversation. User text and website content cannot become help copy.
export function onboardingHelp(draft: Doc<"taskChats">["draft"], help: Clarification) {
  const parsed = clarificationSchema.parse(help);
  const next = requiredQuestion("onboarding", draft);
  const field = parsed.field === "current" ? next : parsed.field;
  let explanation: string;
  if (parsed.kind === "no_website") {
    explanation = "You don’t need a website. The name you use for your business is enough.";
  } else if (parsed.kind === "which_address") {
    explanation =
      "Use the address where you want supplies delivered. It can be different from your registered business address.";
  } else if (field === "companyName") {
    explanation = {
      explain: "I mean the name you use for your business. Your trading name is fine.",
      example:
        "For example, a bakery might enter ‘River Street Bakery’. Use your own business name.",
      rephrase: "What name do customers know your business by? That’s the name to enter.",
      why_needed:
        "The company name labels your workspace so you can recognize which business you’re buying for.",
    }[parsed.kind];
  } else if (field === "shippingAddress") {
    explanation = {
      explain:
        "Enter the place where supplies should arrive: street and unit, city, state or region, postal code, and country.",
      example:
        "Use this format: [street and unit], [city], [state or region], [postal code], [country]. Replace each part with your delivery details.",
      rephrase:
        "If a supplier sent you a package, where should it go? Include the full address and country.",
      why_needed:
        "The delivery address tells us where you want supplies sent. Entering it here does not place an order.",
    }[parsed.kind];
  } else {
    explanation =
      "Your company name and delivery address are filled in. You can correct either one in chat, or select ‘Open my workspace’ to continue.";
  }
  return `${explanation}\n\n${questions[next]}`;
}
