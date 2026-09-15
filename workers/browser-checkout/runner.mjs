import { createHash } from "node:crypto";
export const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function validateSnapshot(s) {
  if (
    !s ||
    !["sku", "unit", "currency", "shipTo", "expectedOn"].every(
      (k) => typeof s[k] === "string" && s[k].trim(),
    ) ||
    !["unitPriceCents", "freightCents", "taxCents", "totalCents"].every(
      (k) => Number.isSafeInteger(s[k]) && s[k] >= 0,
    ) ||
    !Number.isFinite(s.quantity) ||
    s.quantity <= 0 ||
    (["unit", "units", "case", "cases", "roll", "rolls"].includes(s.unit) &&
      !Number.isInteger(s.quantity)) ||
    s.totalCents !== Math.round(s.quantity * s.unitPriceCents) + s.freightCents + s.taxCents ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.expectedOn) ||
    !/^[A-Z]{3}$/.test(s.currency) ||
    !Number.isFinite(Date.parse(s.expectedOn)) ||
    new Date(s.expectedOn).toISOString().slice(0, 10) !== s.expectedOn
  )
    throw Error("Supplier cart is incomplete.");
  return Object.fromEntries(
    [
      "sku",
      "unit",
      "quantity",
      "currency",
      "unitPriceCents",
      "freightCents",
      "taxCents",
      "totalCents",
      "shipTo",
      "expectedOn",
    ].map((k) => [k, s[k]]),
  );
}
export function sameSnapshot(a, b) {
  return fingerprint(validateSnapshot(a)) === fingerprint(validateSnapshot(b));
}
export async function computerStep(page, action) {
  if (action.type === "click") {
    if (!Number.isFinite(action.x) || !Number.isFinite(action.y) || action.x < 0 || action.y < 0)
      throw Error("Invalid pointer position");
    await page.mouse.click(action.x, action.y);
  } else if (action.type === "type") {
    if (typeof action.text !== "string" || action.text.length > 1000)
      throw Error("Invalid form text");
    await page.keyboard.insertText(action.text);
  } else if (action.type === "key") {
    if (
      // Enter must go through performAction with a visible target and the
      // purchase-form guard. A raw keyboard event can submit the whole cart.
      !["Tab", "Backspace", "ArrowDown", "ArrowUp", "Escape", "ControlOrMeta+A"].includes(
        action.key,
      )
    )
      throw Error("Unsupported key");
    await page.keyboard.press(action.key);
  } else if (action.type === "scroll") {
    if (!Number.isFinite(action.y)) throw Error("Invalid scroll distance");
    await page.mouse.wheel(0, Math.max(-800, Math.min(800, action.y)));
  } else throw Error("Unsupported computer action");
}
