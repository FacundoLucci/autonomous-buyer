import { test, expect } from "vitest";
import {
  inventoryPlan,
  rankBuyingOptions,
  shortageBefore,
  type StockFacts,
  type BuyingOption,
} from "../src/lib/inventory-planning";
import { reportedStock, stockItemMatch } from "../src/lib/stock-message";
const now = Date.parse("2026-09-06T12:00:00Z");
const item: StockFacts = {
  quantity: 2,
  dailyUsage: 1,
  stockCountedAt: now,
  leadTimeDays: 3,
  safetyStockDays: 1,
  buyingPriority: "cost",
  dailyLossCents: 20000,
  lossCurrency: "USD",
};
const base = {
  supplier: "Standard",
  url: "https://example.com/lids",
  quantity: 10,
  unit: "cases",
  currency: "USD",
  unitPriceCents: 1000,
  freightCents: 0,
  taxCents: 0,
  expectedOn: "2026-09-10",
};
const offers: BuyingOption[] = [
  base,
  { ...base, supplier: "Express", freightCents: 8000, expectedOn: "2026-09-07" },
];
test("daily loss makes faster shipping worth its higher price", () => {
  const result = rankBuyingOptions(item, [], offers, now);
  expect(result.selected).toBe(1);
  expect(result.options[0].totalCents).toBe(18000);
  expect(result.options[1].lossCents).toBeGreaterThan(40000);
});
test("can-wait items choose the cheapest purchase even when the saved daily loss is high", () => {
  expect(rankBuyingOptions({ ...item, buyingPriority: "flexible" }, [], offers, now).selected).toBe(
    0,
  );
});
test("never-run-out chooses the cheapest option that arrives in time; if none do, it chooses the fastest", () => {
  const critical = { ...item, buyingPriority: "availability" as const };
  expect(rankBuyingOptions(critical, [], offers, now).selected).toBe(1);
  expect(rankBuyingOptions({ ...critical, quantity: 20 }, [], offers, now).selected).toBe(0);
  expect(rankBuyingOptions({ ...critical, quantity: 0 }, [], offers, now).selected).toBe(1);
  expect(
    rankBuyingOptions({ ...critical, quantity: 0 }, [], offers, now).options[0].shortageDays,
  ).toBeGreaterThan(0);
});
test("confirmed stock arriving in time changes the recommendation", () => {
  expect(
    rankBuyingOptions(item, [{ quantity: 10, expectedOn: "2026-09-07" }], offers, now).selected,
  ).toBe(0);
  expect(
    rankBuyingOptions(item, [{ quantity: 10, expectedOn: "2026-09-05" }], offers, now).selected,
  ).toBe(1);
});
test("unknown loss, currency mismatches and incomparable pack quantities stay gaps", () => {
  expect(() => rankBuyingOptions({ ...item, dailyLossCents: null }, [], offers, now)).toThrow(
    /daily loss/,
  );
  expect(() => rankBuyingOptions({ ...item, lossCurrency: "CAD" }, [], offers, now)).toThrow(
    /currency/,
  );
  expect(() => rankBuyingOptions(item, [], [base, { ...base, quantity: 20 }], now)).toThrow(
    /same quantity/,
  );
  expect(() => rankBuyingOptions({ ...item, quantity: null }, [], offers, now)).toThrow(
    /stock count/,
  );
});
test("partial deliveries do not conceal a gap before the next delivery", () => {
  const gap = shortageBefore(
    { ...item, quantity: 1 },
    [{ quantity: 1, expectedOn: "2026-09-07" }],
    "2026-09-10",
    now,
  );
  expect(gap).toBeGreaterThan(2);
  expect(inventoryPlan(item, [{ quantity: 1, expectedOn: "2026-09-07" }], now).attention).toBe(
    true,
  );
});
test("an early buy is not coverage, while a sufficient on-time delivery is", () => {
  expect(inventoryPlan(item, [], now)).toMatchObject({
    low: true,
    attention: true,
    label: "Order more",
  });
  expect(inventoryPlan(item, [{ quantity: 10, expectedOn: "2026-09-07" }], now)).toMatchObject({
    low: true,
    attention: false,
    label: "On the way",
  });
  expect(inventoryPlan(item, [{ quantity: 10, expectedOn: "2026-09-10" }], now)).toMatchObject({
    attention: true,
    label: "Get it sooner",
  });
  expect(inventoryPlan(item, [{ quantity: 10, expectedOn: "2026-09-05" }], now).label).toBe(
    "Check delivery",
  );
});
test("unknown or stale counts have a concrete next action and zero stock is low without a usage estimate", () => {
  expect(inventoryPlan({ ...item, quantity: null }, [], now).label).toBe("Count stock");
  expect(
    inventoryPlan({ ...item, quantity: 100, stockCountedAt: now - 8 * 86400000 }, [], now).label,
  ).toBe("Count today");
  expect(inventoryPlan({ ...item, quantity: 0, dailyUsage: null }, [], now).low).toBe(true);
});
test("damage statements use the remaining count, never the amount lost or a hypothetical", () => {
  expect(
    reportedStock(
      "All of the deli lids got crushed in an accident. We only have two cases left.",
      "cases",
    ),
  ).toBe(2);
  expect(reportedStock("2 cases", "cases")).toBe(2);
  expect(reportedStock("We have zero cases left", "cases")).toBe(0);
  expect(reportedStock("We lost two cases", "cases")).toBeNull();
  expect(reportedStock("What if we only have two cases left?", "cases")).toBeNull();
  expect(reportedStock("We have two units left", "cases")).toBeNull();
  expect(reportedStock("We had 10 cases; now we have two cases left", "cases")).toBe(2);
});
test("ambiguous item names require clarification", () => {
  const lids = [
    { id: "a", name: "Deli lids" },
    { id: "b", name: "Cup lids" },
  ];
  expect(reportedStock("We need to have two cases left", "cases")).toBeNull();
  expect(reportedStock("We have -2 cases left", "cases")).toBeNull();
  expect(stockItemMatch("Two cases of lids left", lids)).toBeNull();
  expect(stockItemMatch("Two cases of deli lids left", lids)?.id).toBe("a");
});
