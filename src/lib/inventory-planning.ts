export type BuyingPriority = "cost" | "availability" | "flexible";
export const buyingPriorities = {
  cost: "Keep costs down",
  availability: "Never run out",
  flexible: "Can wait",
} as const;
export type StockFacts = {
  quantity: number | null;
  dailyUsage: number | null;
  leadTimeDays: number | null;
  stockCountedAt: number | null;
  forecastQuantity?: number;
  forecastAt?: number;
  preparationDays?: number;
  replenishmentEnabled?: boolean;
  safetyStockDays: number;
  buyingPriority: BuyingPriority | null;
  dailyLossCents: number | null;
  lossCurrency: string;
};
export type Delivery = { quantity: number; expectedOn: string | null };
const DAY = 86_400_000;
export function arrivalDays(date: string, now = Date.now()) {
  // A date without a delivery time must allow for arrival at the end of that day.
  return Math.max(0, (Date.parse(`${date}T23:59:59.999Z`) - now) / DAY);
}
export function availableStock(item: StockFacts, now = Date.now()) {
  if (item.quantity === null) return null;
  const baselineAt = item.forecastAt ?? item.stockCountedAt;
  const elapsed = baselineAt !== null ? Math.max(0, (now - baselineAt) / DAY) : 0;
  return Math.max(0, (item.forecastQuantity ?? item.quantity) - (item.dailyUsage ?? 0) * elapsed);
}
export function shortageBefore(
  item: StockFacts,
  deliveries: Delivery[],
  arrival: string,
  now = Date.now(),
) {
  let stock = availableStock(item, now);
  if (stock === null || item.dailyUsage === null) return null;
  if (item.dailyUsage === 0) return 0;
  const end = arrivalDays(arrival, now);
  let at = 0,
    shortage = 0;
  for (const delivery of deliveries
    .filter((d) => d.expectedOn && Date.parse(`${d.expectedOn}T23:59:59.999Z`) >= now)
    .map((d) => ({ ...d, day: arrivalDays(d.expectedOn!, now) }))
    .filter((d) => d.day < end)
    .sort((a, b) => a.day - b.day)) {
    const span = delivery.day - at;
    shortage += Math.max(0, span - stock / item.dailyUsage);
    stock = Math.max(0, stock - span * item.dailyUsage) + delivery.quantity;
    at = delivery.day;
  }
  return shortage + Math.max(0, end - at - stock / item.dailyUsage);
}
export function inventoryPlan(item: StockFacts, deliveries: Delivery[], now = Date.now()) {
  const stock = availableStock(item, now);
  const daysLeft =
    stock !== null && item.dailyUsage && item.dailyUsage > 0 ? stock / item.dailyUsage : null;
  const low =
    stock !== null &&
    (stock === 0 ||
      (item.dailyUsage !== null &&
        item.leadTimeDays !== null &&
        stock <=
          item.dailyUsage *
            (item.leadTimeDays +
              item.safetyStockDays +
              (item.preparationDays ?? (item.replenishmentEnabled ? 1 : 0)))));
  const dated = deliveries
    .filter((d) => d.expectedOn && d.quantity > 0)
    .sort((a, b) => a.expectedOn!.localeCompare(b.expectedOn!));
  const next = dated[0];
  const interval =
    item.buyingPriority === "availability"
      ? 1
      : Math.min(7, Math.max(1, Math.floor((daysLeft ?? 14) / 2)));
  const countAt = item.stockCountedAt ? item.stockCountedAt + interval * DAY : now;
  const result = (
    label: string,
    attention: boolean,
    nextCheck = countAt,
    arriving = next?.expectedOn ?? null,
  ) => ({ label, attention, low, daysLeft, nextCheck, arriving });
  if (stock === null) return result("Count stock", true, now);
  if (next && Date.parse(`${next.expectedOn}T23:59:59.999Z`) < now)
    return result("Check delivery", true, now);
  if (deliveries.some((d) => !d.expectedOn)) return result("Confirm arrival", true, now);
  if (next) {
    const gap = shortageBefore(item, [], next.expectedOn!, now);
    if (gap !== null && gap > 0)
      return result(
        item.buyingPriority === "flexible" ? "Waiting for delivery" : "Get it sooner",
        item.buyingPriority !== "flexible",
        Math.min(countAt, Date.parse(`${next.expectedOn}T00:00:00Z`)),
      );
    const horizon = new Date(
      now + Math.max(item.leadTimeDays ?? 0, 1) * DAY + item.safetyStockDays * DAY,
    )
      .toISOString()
      .slice(0, 10);
    const covered = shortageBefore(item, deliveries, horizon, now);
    if (gap === 0 && (covered === 0 || !low))
      return result(
        "On the way",
        false,
        Math.min(countAt, Date.parse(`${next.expectedOn}T00:00:00Z`)),
      );
  }
  if (low && item.buyingPriority === "flexible")
    return result(stock === 0 ? "Out · can wait" : "Low · can wait", false);
  if (low)
    return result(
      stock === 0 ? (item.quantity === 0 ? "Out of stock" : "May be out") : "Order more",
      true,
      now,
    );
  if (countAt <= now) return result("Count today", true, now);
  if (item.dailyUsage === null || item.leadTimeDays === null)
    return result("Add usage / delivery time", true, now);
  return result("In stock", false);
}
export type BuyingOption = {
  supplier: string;
  url: string;
  quantity: number;
  unit: string;
  currency: string;
  unitPriceCents: number;
  freightCents: number;
  taxCents: number;
  expectedOn: string;
};
export function rankBuyingOptions(
  item: StockFacts,
  deliveries: Delivery[],
  options: BuyingOption[],
  now = Date.now(),
) {
  if (!item.buyingPriority) throw new Error("Choose what matters most for this item first.");
  if (options.length < 2 || options.length > 5)
    throw new Error("Compare two to five buying options.");
  const first = options[0];
  if (
    options.some(
      (o) =>
        o.currency !== first.currency || o.unit !== first.unit || o.quantity !== first.quantity,
    )
  )
    throw new Error("Compare the same quantity, stock unit, and currency.");
  if (
    item.buyingPriority === "cost" &&
    (item.dailyLossCents === null || item.lossCurrency !== first.currency)
  )
    throw new Error(
      "Add the daily loss in the quote currency before comparing the cost of waiting.",
    );
  const ranked = options
    .map((option, index) => {
      const totalCents =
        Math.round(option.quantity * option.unitPriceCents) + option.freightCents + option.taxCents;
      const shortageDays = shortageBefore(item, deliveries, option.expectedOn, now);
      if (shortageDays === null && item.buyingPriority !== "flexible")
        throw new Error("Add a stock count and daily usage before comparing delivery timing.");
      const lossCents =
        shortageDays !== null &&
        item.dailyLossCents !== null &&
        item.lossCurrency === option.currency
          ? Math.round(shortageDays * item.dailyLossCents)
          : null;
      return {
        index,
        ...option,
        totalCents,
        shortageDays,
        lossCents,
        effectiveCents: totalCents + (item.buyingPriority === "cost" ? lossCents! : 0),
      };
    })
    .sort((a, b) =>
      item.buyingPriority === "availability"
        ? Number((a.shortageDays ?? 0) > 0) - Number((b.shortageDays ?? 0) > 0) ||
          ((a.shortageDays ?? 0) > 0 ? a.expectedOn.localeCompare(b.expectedOn) : 0) ||
          a.totalCents - b.totalCents
        : a.effectiveCents - b.effectiveCents || a.expectedOn.localeCompare(b.expectedOn),
    );
  return { priority: item.buyingPriority, options: ranked, selected: ranked[0].index };
}

/** One planner for unattended replenishment. Only confirmed, dated deliveries count. */
export function replenishmentPlan(
  item: StockFacts & {
    preferredCoverageDays: number;
    preparationDays?: number;
    orderMultiple?: number;
  },
  deliveries: Delivery[],
  now = Date.now(),
) {
  const stock = availableStock(item, now);
  if (stock === null)
    return {
      state: "needs_details" as const,
      note: "Add a stock count.",
      quantity: 0,
      requiredBy: null,
    };
  if (item.dailyUsage === null || item.leadTimeDays === null || !item.buyingPriority)
    return {
      state: "needs_details" as const,
      note: "Add daily usage, delivery time, and buying priorities.",
      quantity: 0,
      requiredBy: null,
    };
  if (item.dailyUsage === 0)
    return {
      state: "watching" as const,
      note: "No replenishment needed at zero daily usage.",
      quantity: 0,
      requiredBy: null,
    };
  if (
    deliveries.some(
      (d) => d.quantity > 0 && (!d.expectedOn || Date.parse(`${d.expectedOn}T23:59:59.999Z`) < now),
    )
  )
    return {
      state: "needs_details" as const,
      note: "Confirm the outstanding delivery before ordering again.",
      quantity: 0,
      requiredBy: null,
    };
  const usage = item.dailyUsage;
  const reserve = item.safetyStockDays * usage;
  const ordered = deliveries
    .filter((d) => d.quantity > 0 && d.expectedOn)
    .map((d) => ({ quantity: d.quantity, day: arrivalDays(d.expectedOn!, now) }))
    .sort((a, b) => a.day - b.day);
  // Find the first time stock reaches reserve, allowing each confirmed receipt
  // to extend cover. Consumption stops at zero; unmet demand is not inventory debt.
  let quantity = stock,
    at = 0,
    reserveAt = Math.max(0, (stock - reserve) / usage);
  for (const delivery of ordered) {
    if (reserveAt < delivery.day) break;
    quantity = Math.max(0, quantity - usage * (delivery.day - at)) + delivery.quantity;
    at = delivery.day;
    reserveAt = at + Math.max(0, (quantity - reserve) / usage);
  }
  const lead = item.leadTimeDays + (item.preparationDays ?? 1);
  const requiredBy = new Date(now + reserveAt * DAY).toISOString().slice(0, 10);
  if (reserveAt > lead)
    return {
      state: "watching" as const,
      note: `Stock is covered until ${requiredBy}.`,
      quantity: 0,
      requiredBy,
      nextAt: now + (reserveAt - lead) * DAY,
    };
  let atArrival = stock,
    last = 0;
  for (const delivery of ordered.filter((d) => d.day <= lead)) {
    atArrival = Math.max(0, atArrival - usage * (delivery.day - last)) + delivery.quantity;
    last = delivery.day;
  }
  atArrival = Math.max(0, atArrival - usage * (lead - last));
  const coverage = Math.max(item.preferredCoverageDays, item.safetyStockDays);
  const later = ordered
    .filter((d) => d.day > lead && d.day <= lead + coverage)
    .reduce((sum, d) => sum + d.quantity, 0);
  // A later large delivery cannot erase a shortfall before it arrives.
  const firstLater = ordered.find((d) => d.day > lead);
  const bridge = firstLater
    ? Math.max(0, usage * Math.min(firstLater.day - lead, coverage) + reserve - atArrival)
    : 0;
  const emergencyGap =
    item.buyingPriority !== "flexible" && ordered[0]
      ? Math.max(0, ordered[0].day * usage - stock)
      : 0;
  const need = Math.max(bridge, emergencyGap, usage * coverage - atArrival - later, 0);
  const pack = Math.max(1, item.orderMultiple ?? 1);
  const orderQuantity = Math.ceil(need / pack) * pack;
  return {
    state: orderQuantity > 0 ? ("buying" as const) : ("watching" as const),
    note:
      orderQuantity > 0
        ? `Preparing ${orderQuantity} units, needed by ${requiredBy}.`
        : "Confirmed deliveries cover replenishment.",
    quantity: orderQuantity,
    requiredBy,
  };
}
