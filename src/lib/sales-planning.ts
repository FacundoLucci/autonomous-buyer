export const SALES_DAY = 86_400_000;
export type SalesProvider = "square" | "shopify";
export type SalesSourceEvent = {
  key: string;
  resourceId: string;
  locationId: string;
  occurredAt: number;
  updatedAt: number;
  kind: "sales" | "inventory";
  lines: { key: string; name: string; quantity: number }[];
  adjustment?: boolean;
};

/** A confirmed count anchors the window. Observed sales REPLACE its estimate. */
export function observedStock(input: {
  baselineQuantity: number;
  consumed: number;
  observedThrough: number;
  dailyUsage: number;
  now: number;
}) {
  const remaining = Math.max(0, input.baselineQuantity - input.consumed);
  return Math.max(
    0,
    remaining - (input.dailyUsage * Math.max(0, input.now - input.observedThrough)) / SALES_DAY,
  );
}

export function consumptionDelta(
  quantity: number,
  previous: number,
  unitsPerSale: number,
  pack: number,
) {
  for (const n of [quantity, previous, unitsPerSale, pack]) {
    if (!Number.isFinite(n) || n < 0)
      throw new Error("Supply quantities must be finite and non-negative.");
  }
  if (pack === 0 || unitsPerSale === 0) throw new Error("Confirm a positive supply conversion.");
  // A refund does not return a used cup to the shelf. A physical count corrects it.
  const consumed = (quantity * unitsPerSale) / pack;
  return {
    total: Math.max(previous, consumed),
    delta: Math.max(0, consumed - previous),
    decreased: consumed < previous,
  };
}

export function shopDomain(value: string) {
  const shop = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))
    throw new Error("Enter your store.myshopify.com domain.");
  return shop;
}
