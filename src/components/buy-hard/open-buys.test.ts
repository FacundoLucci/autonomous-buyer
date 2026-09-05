import assert from "node:assert/strict";
import { test } from "node:test";

import { getOpenBuys } from "./open-buys.ts";

function item(
  code: string,
  status: string,
  isOpen: boolean | undefined,
  requiredBy = "2026-09-10",
) {
  return { procurement: { code, status, isOpen, requiredBy } };
}

test("uses the server's open flag, not the presence of a linked or selected purchase", () => {
  const items = [
    item("active", "awaiting_quotes", true),
    item("confirmed", "confirmed", false),
    item("closed", "closed", false),
    item("cancelled", "cancelled", false),
    item("rejected", "rejected", false),
    item("inactive", "awaiting_quotes", false),
    item("unknown", "awaiting_quotes", undefined),
    { procurement: null },
  ];
  assert.deepEqual(getOpenBuys(items), [items[0]]);
});

test("puts reviews and exceptions first, then sorts by required date", () => {
  const items = [
    item("later", "sourcing", true, "2026-09-15"),
    item("due", "awaiting_quotes", true, "2026-09-01"),
    item("approval", "approval_required", true, "2026-09-11"),
    item("exception", "exception", true, "2026-09-10"),
  ];
  const original = [...items];
  assert.deepEqual(
    getOpenBuys(items).map((row) => row.procurement.code),
    ["exception", "approval", "due", "later"],
  );
  assert.deepEqual(items, original, "The queue must not reorder the recent or inventory views");
});

test("an empty open queue stays empty even when completed demo evidence exists", () => {
  assert.deepEqual(getOpenBuys([item("recorded-demo", "confirmed", false)]), []);
  assert.deepEqual(getOpenBuys([]), []);
});
