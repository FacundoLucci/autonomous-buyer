// A model's number is only a proposal. Delivery evidence must support that
// exact number; dispatch estimates and business-day promises do not qualify.
export function confirmedDeliveryDays(quote: string | null, proposed: number | null) {
  if (!quote || proposed === null || !Number.isInteger(proposed) || proposed < 0 || proposed > 365)
    return null;
  if (
    /\b(ship\w*|dispatch\w*|business|working|usually|typically|estimated?|may|might)\b/i.test(quote)
  )
    return null;
  if (
    !/\b(deliver\w*|arriv\w*|receiv\w*)\b/i.test(quote) ||
    !/\b(order\w*|purchase\w*)\b/i.test(quote)
  )
    return null;
  if (/\d\s*(?:-|–|to|or)\s*\d/.test(quote)) return null;
  const matches = [...quote.matchAll(/\b(\d+)\s+(?:calendar\s+)?days?\b/gi)];
  return matches.length === 1 && Number(matches[0][1]) === proposed ? proposed : null;
}

export function sourceUnit(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  const names: Record<string, string> = {
    case: "cases",
    cases: "cases",
    unit: "units",
    units: "units",
    each: "units",
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    liter: "liters",
    liters: "liters",
    roll: "rolls",
    rolls: "rolls",
  };
  return normalized ? (names[normalized] ?? null) : null;
}
