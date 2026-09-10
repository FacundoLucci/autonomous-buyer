import { expect, test } from "vitest";
import {
  exactSupplierNumber,
  exactSupplierToken,
  matchSupplierCancellation,
  matchSupplierConfirmation,
  newSupplierReply,
} from "./supplierConfirmation";
const order = {
  number: "BH-100",
  sku: "TAPE",
  quantity: 2,
  receivedQuantity: 0,
  unit: "rolls",
  currency: "USD",
  totalCents: 1000,
  requiredBy: "2026-10-10",
};
const cancelled = "Cancelled: yes\nPurchase order: BH-100\nRemaining quantity: 2 rolls";
const confirmed =
  "Confirmed: yes\nPurchase order: BH-100\nConfirmation: SUP-100\nSKU: TAPE\nQuantity: 2 rolls\nTotal: USD 10.00\nArrival: 2026-10-10";
test("only newly authored positive supplier cancellation can remove incoming stock", () => {
  expect(matchSupplierCancellation(cancelled, order)).toBe(true);
  for (const body of [
    `No, we cannot cancel.\n\nFrom: Purchasing <buyer@example.com>\n${cancelled}`,
    `We cannot cancel.\n${cancelled}`,
    `Received your request.\nOn September 9, 2026, Purchasing wrote:\n${cancelled}`,
    `We will check.\n${cancelled
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n")}`,
  ])
    expect(matchSupplierCancellation(body, order)).toBe(false);
});
test("quoted historical confirmations and contradictory prose cannot confirm a new order", () => {
  expect(matchSupplierConfirmation(confirmed, order).confirmed).toBe(true);
  expect(
    matchSupplierConfirmation(`We cannot supply this order.\n${confirmed}`, order).confirmed,
  ).toBe(false);
  expect(
    matchSupplierConfirmation(`Not accepted.\nFrom: Purchasing\n${confirmed}`, order).confirmed,
  ).toBe(false);
  expect(
    matchSupplierConfirmation(
      `Checking.\nOn September 9,\n2026, Purchasing wrote:\n${confirmed}`,
      order,
    ).confirmed,
  ).toBe(false);
  expect(newSupplierReply(`New reply\nFrom: Supplier\n${confirmed}`)).toBe("New reply");
});
test("extraction evidence matches complete numeric and SKU values", () => {
  expect(exactSupplierNumber("24 rolls", 2)).toBe(false);
  expect(exactSupplierNumber("Total USD 100", 10)).toBe(false);
  expect(exactSupplierNumber("Total USD 1,000.00", 1000)).toBe(true);
  expect(exactSupplierToken("SKU TAPE-XL", "TAPE")).toBe(false);
  expect(exactSupplierToken("SKU: TAPE", "TAPE")).toBe(true);
  expect(exactSupplierToken("24 rolls", "2 rolls")).toBe(false);
});
