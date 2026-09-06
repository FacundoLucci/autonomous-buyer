import { ConvexError } from "convex/values";

export function boundedText(value: string, label: string, max = 120) {
  const text = value.trim();
  if (
    !text ||
    text.length > max ||
    [...text].some((c) => c.charCodeAt(0) < 32 && !["\t", "\n", "\r"].includes(c))
  )
    throw new ConvexError(`Enter ${label} under ${max + 1} characters.`);
  return text;
}
export function validEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))
    throw new ConvexError("Enter a valid email address.");
  return email;
}
export function validDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new ConvexError("Choose a valid date.");
  return value;
}
export function amount(value: number, label: string, max = 1_000_000_000) {
  if (!Number.isFinite(value) || value < 0 || value > max)
    throw new ConvexError(`Enter a valid ${label}.`);
  return value;
}
export function quantity(value: number, unit: string) {
  amount(value, "quantity");
  if (
    value <= 0 ||
    ((unit === "units" || unit === "cases" || unit === "rolls") && !Number.isInteger(value))
  )
    throw new ConvexError(
      "Enter a positive quantity in your stock unit; use whole units, cases, or rolls.",
    );
  return value;
}
export function cents(value: number) {
  amount(value, "price", 100_000_000_00);
  if (!Number.isSafeInteger(value))
    throw new ConvexError("Prices must have at most two decimal places.");
  return value;
}
export function orderTotal(qty: number, price: number, freight: number, tax: number) {
  const total = Math.round(qty * cents(price)) + cents(freight) + cents(tax);
  if (!Number.isSafeInteger(total) || total > 100_000_000_00)
    throw new ConvexError("Order total is too large.");
  return total;
}
