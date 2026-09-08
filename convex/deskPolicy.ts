import type { Doc } from "./_generated/dataModel";
export const questions = {
  companyName: "What’s your company called?",
  companyWebsite: "What’s your company’s website?",
  shippingAddress:
    "Where should deliveries go? Enter the full address, including postal code and country.",
  confirmAddress: "Is this the right delivery address?",
  name: "What’s the item called?",
  itemId: "Which inventory item do you need?",
  stock: "How many do you have on hand? You can leave this for later.",
  unit: "Do you track this in individual units or cases?",
  dailyUsage: "How much do you use each day?",
  buyingPriority:
    "What matters most: keeping costs down, never running out, or being able to wait?",
  dailyLossCents: "About how much do you lose for each day without this item?",
  quantity: "How many do you need?",
  requiredBy: "When do you need it?",
  unitPriceCents: "What’s the current price per stock unit?",
  freightCents: "What’s the shipping charge?",
  taxCents: "How much is the tax?",
  currency: "Which currency is the quote in?",
  supplier: "Who do you buy this from?",
  supplierContact: "Do you have a supplier link or email?",
  confirmation: "What’s the supplier’s order confirmation number?",
  expectedOn: "When is it expected to arrive?",
  quote:
    "The supplier needs to confirm the new price, shipping, and arrival. Share their updated quote when it’s ready.",
  ready: "Ready to save.",
  unsupported: "I can help with your company, inventory, and buys.",
  noResults: "I couldn’t verify that. Do you have a link or another detail?",
} as const;
export type Question = keyof typeof questions;
export function questionMessage(question: Question, draft: Doc<"taskChats">["draft"]) {
  if (question === "confirmAddress") {
    const address = draft.shippingAddress?.trim();
    return address
      ? `${address}\n\nIs this the right delivery address? If not, enter the correct one.`
      : `I don’t have a delivery address yet. ${questions.shippingAddress}`;
  }
  return questions[question];
}
export type Task = Doc<"taskChats">["task"];
const fields: Record<Task, readonly string[]> = {
  stock_update: ["itemId", "name", "stock"],
  onboarding: [
    "companyName",
    "shippingAddress",
    "name",
    "sku",
    "unit",
    "stock",
    "dailyUsage",
    "leadTimeDays",
    "supplier",
    "buyUrl",
    "supplierEmail",
  ],
  add_item: [
    "name",
    "sku",
    "unit",
    "stock",
    "dailyUsage",
    "leadTimeDays",
    "supplier",
    "buyUrl",
    "supplierEmail",
  ],
  edit_item: ["name", "stock", "dailyUsage", "leadTimeDays", "supplier", "buyUrl", "supplierEmail"],
  new_buy: ["itemId", "name", "unit", "quantity", "requiredBy", "notes"],
  buy: [
    "expectedOn",
    "quantity",
    "requiredBy",
    "notes",
    "unitPriceCents",
    "freightCents",
    "taxCents",
    "currency",
    "supplier",
    "buyUrl",
    "supplierEmail",
  ],
  settings: ["companyName", "shippingAddress"],
  receive: ["quantity"],
  confirm: ["confirmation", "expectedOn"],
};
export function allowedDraft(task: Task, draft: Doc<"taskChats">["draft"]) {
  for (const [key, value] of Object.entries(draft))
    if (
      value !== undefined &&
      !fields[task].includes(key) &&
      !(
        ["onboarding", "add_item", "edit_item"].includes(task) &&
        ["buyingPriority", "dailyLossCents", "lossCurrency", "stockoutImpact"].includes(key)
      )
    )
      throw new Error(`This task cannot change ${key}.`);
}
export function allowedQuestion(task: Task, question: Question) {
  if (question === "quote" && task === "buy") return;
  if (["ready", "unsupported", "noResults"].includes(question)) return;
  const field =
    question === "confirmAddress"
      ? "shippingAddress"
      : question === "supplierContact"
        ? "buyUrl"
        : question === "companyWebsite"
          ? "companyName"
          : question;
  if (
    ["buyingPriority", "dailyLossCents"].includes(field) &&
    ["buy", "onboarding", "add_item", "edit_item"].includes(task)
  )
    return;
  if (!fields[task].includes(field)) throw new Error("That question does not belong to this task.");
}
export function requiredQuestion(task: Task, d: Doc<"taskChats">["draft"]): Question {
  if (task === "onboarding" || task === "settings")
    return !d.companyName ? "companyName" : !d.shippingAddress ? "shippingAddress" : "ready";
  if (task === "add_item") return d.name ? "ready" : "name";
  if (task === "new_buy") return d.itemId ? "ready" : "itemId";
  if (task === "stock_update") return d.itemId ? "stock" : "itemId";
  if (task === "receive") return d.quantity && d.quantity > 0 ? "ready" : "quantity";
  if (task === "confirm")
    return !d.confirmation ? "confirmation" : !d.expectedOn ? "expectedOn" : "ready";
  if (task === "buy") {
    for (const f of [
      "quantity",
      "supplier",
      "unitPriceCents",
      "freightCents",
      "taxCents",
      "currency",
      "requiredBy",
    ] as const)
      if (d[f] === undefined || d[f] === "") return f;
    if (!d.buyUrl && !d.supplierEmail) return "supplierContact";
  }
  return "ready";
}
// Only application-authored messages can become assistant bubbles. LLM prose
// remains in the component trace for debugging and is never returned to the UI.
export function visibleMessage(m: {
  agentName?: string;
  message?: { role: string; content: unknown };
}) {
  if (m.message?.role === "user" && typeof m.message.content === "string")
    return { role: "user" as const, text: m.message.content };
  if (
    m.agentName === "BUY HARD UI" &&
    m.message?.role === "assistant" &&
    typeof m.message.content === "string"
  )
    return { role: "assistant" as const, text: m.message.content };
  return null;
}
