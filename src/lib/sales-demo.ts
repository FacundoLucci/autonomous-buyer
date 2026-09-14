import { replenishmentPlan } from "./inventory-planning.ts";
import { consumptionDelta, observedStock, type SalesProvider } from "./sales-planning.ts";
export const demoNow = Date.parse("2026-09-14T15:42:00Z");
export const salesScenarios = {
  square: {
    provider: "Square",
    business: "Northside Coffee",
    product: "Takeaway coffee",
    item: "12 oz paper cups",
    unit: "cups",
    sourceId: "SQ-DEMO-1042",
    location: "Northside café",
    stock: 800,
    dailyUsage: 100,
    leadTimeDays: 3,
    saleQuantity: 300,
    pack: 100,
    event: "A busy lunch",
    sourceLabel: "Completed coffee sales",
    supplier: "Sample packaging supplier",
  },
  shopify: {
    provider: "Shopify",
    business: "Morrow Goods",
    product: "Gift set",
    item: "Small shipping boxes",
    unit: "boxes",
    sourceId: "SHOP-DEMO-1042",
    location: "Online store",
    stock: 140,
    dailyUsage: 20,
    leadTimeDays: 2,
    saleQuantity: 60,
    pack: 25,
    event: "A launch-day rush",
    sourceLabel: "Paid gift-set orders",
    supplier: "Sample packaging supplier",
  },
} as const;
export function salesDemoPlan(provider: SalesProvider, sold = 0, received = 0) {
  const s = salesScenarios[provider];
  const consumed = consumptionDelta(sold, 0, 1, 1).total;
  const stock = observedStock({
    baselineQuantity: s.stock + received,
    consumed,
    observedThrough: demoNow,
    dailyUsage: s.dailyUsage,
    now: demoNow,
  });
  const facts = {
    quantity: stock,
    stockCountedAt: demoNow,
    dailyUsage: s.dailyUsage,
    leadTimeDays: s.leadTimeDays,
    safetyStockDays: 1,
    preparationDays: 1,
    preferredCoverageDays: 7,
    orderMultiple: s.pack,
    buyingPriority: "availability" as const,
    dailyLossCents: null,
    lossCurrency: "USD",
  };
  const plan = replenishmentPlan(facts, [], demoNow);
  return {
    stock,
    consumed,
    daysLeft: stock / s.dailyUsage,
    plan,
    orderPacks: Math.ceil(plan.quantity / s.pack),
    reorderInDays:
      "nextAt" in plan ? Math.max(0, Math.round((plan.nextAt! - demoNow) / 86_400_000)) : 0,
  };
}
