import { expect, test } from "vitest";
import {
  amountPresent,
  arrivalPresent,
  quantityPresent,
  skuPresent,
} from "./companyPurchasingAgent";
test("supplier prices and explicit dates accept ordinary formats without inventing values", () => {
  expect(amountPresent("Price $10 per roll", 1000)).toBe(true);
  expect(amountPresent("Freight USD 1,000.00", 100000)).toBe(true);
  expect(amountPresent("Tax USD 10.01", 1000)).toBe(false);
  expect(amountPresent("Free shipping", 0)).toBe(true);
  expect(amountPresent("Tax calculated at checkout", 0)).toBe(false);
  expect(arrivalPresent("Arrives October 10, 2026", "2026-10-10")).toBe(true);
  expect(arrivalPresent("Arrives next Friday", "2026-10-10")).toBe(false);
});

test("supplier quantity and SKU evidence cannot match a substring of another value", () => {
  expect(quantityPresent("Quote for 24 cases", 2)).toBe(false);
  expect(quantityPresent("Quote for 2.5 kg", 2)).toBe(false);
  expect(quantityPresent("Quote for 2 cases", 2)).toBe(true);
  expect(quantityPresent("Quote for 1,200 units", 1200)).toBe(true);
  expect(skuPresent("SKU ABC-OTHER", "ABC")).toBe(false);
  expect(skuPresent("SKU PREFIX-ABC", "ABC")).toBe(false);
  expect(skuPresent("SKU ABC/XL", "ABC")).toBe(false);
  expect(skuPresent("SKU ABC (case)", "ABC")).toBe(true);
  expect(skuPresent("SKU A+B (case)", "A+B")).toBe(true);
});
