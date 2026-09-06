import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmedDeliveryDays, sourceUnit } from "./source-evidence.ts";
test("dispatch and business days never become delivery time", () => {
  for (const quote of [
    "Usually ships in 1 business day",
    "Ships within 7 days of order",
    "Delivery in 5 business days after ordering",
    "Delivery 3–5 days after your order",
    "Estimated delivery 4 days after order",
  ])
    assert.equal(confirmedDeliveryDays(quote, 5), null);
  assert.equal(confirmedDeliveryDays("Usually ships in 1 business day", 1), null);
});
test("explicit order-to-delivery evidence must match the proposed number", () => {
  assert.equal(confirmedDeliveryDays("Delivered within 5 calendar days of your order.", 5), 5);
  assert.equal(confirmedDeliveryDays("Delivered within 5 calendar days of your order.", 7), null);
  assert.equal(confirmedDeliveryDays(null, 7), null);
  assert.equal(confirmedDeliveryDays("Arrives in 5 days", 5), null);
});
test("sales-unit variants are normalized without inventing a pack", () => {
  assert.equal(sourceUnit("case"), "cases");
  assert.equal(sourceUnit("each"), "units");
  assert.equal(sourceUnit("unknown"), null);
  assert.equal(sourceUnit(null), null);
});
