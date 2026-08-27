const DAY_MS = 86_400_000;

export type DailyUsage = {
  date: string;
  quantityConsumed: number;
};

export type PriceBreak = {
  minimumQuantity: number;
  unitPriceMicrodollars: number;
};

function requireFiniteNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number.`);
  }
}

function requirePositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function parseIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid ISO date: ${date}.`);
  }

  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid ISO date: ${date}.`);
  }

  return timestamp;
}

function toIsoDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function roundUpToPack(quantity: number, casePack: number) {
  return Math.ceil(quantity / casePack) * casePack;
}

export function trailing30DayAverageUsage(usage: DailyUsage[], asOfDate: string) {
  const end = parseIsoDate(asOfDate);
  const start = end - 29 * DAY_MS;
  let consumed = 0;

  for (const entry of usage) {
    requireFiniteNonNegative(entry.quantityConsumed, "quantityConsumed");
    const entryDate = parseIsoDate(entry.date);
    if (entryDate >= start && entryDate <= end) {
      consumed += entry.quantityConsumed;
    }
  }

  return consumed / 30;
}

export function daysRemaining(quantityOnHand: number, averageDailyUsage: number): number | null {
  requireFiniteNonNegative(quantityOnHand, "quantityOnHand");
  requireFiniteNonNegative(averageDailyUsage, "averageDailyUsage");
  return averageDailyUsage === 0 ? null : quantityOnHand / averageDailyUsage;
}

export function projectedStockoutDate(
  asOfDate: string,
  quantityOnHand: number,
  averageDailyUsage: number,
): string | null {
  const days = daysRemaining(quantityOnHand, averageDailyUsage);
  if (days === null) return null;

  return toIsoDate(parseIsoDate(asOfDate) + Math.ceil(days) * DAY_MS);
}

export function coverageDemand(
  averageDailyUsage: number,
  leadTimeDays: number,
  safetyStockDays: number,
  coverageDays: number,
) {
  for (const [name, value] of [
    ["averageDailyUsage", averageDailyUsage],
    ["leadTimeDays", leadTimeDays],
    ["safetyStockDays", safetyStockDays],
    ["coverageDays", coverageDays],
  ] as const) {
    requireFiniteNonNegative(value, name);
  }

  return Math.ceil(averageDailyUsage * (leadTimeDays + safetyStockDays + coverageDays));
}

export function maximumInventoryQuantity(averageDailyUsage: number, maximumInventoryDays?: number) {
  requireFiniteNonNegative(averageDailyUsage, "averageDailyUsage");
  if (maximumInventoryDays === undefined) return null;
  requireFiniteNonNegative(maximumInventoryDays, "maximumInventoryDays");
  return Math.floor(averageDailyUsage * maximumInventoryDays);
}

export function roundOrderQuantity(input: {
  requiredQuantity: number;
  casePack: number;
  minimumOrderQuantity?: number;
  priceBreaks?: PriceBreak[];
  maximumQuantity?: number | null;
}) {
  requireFiniteNonNegative(input.requiredQuantity, "requiredQuantity");
  requirePositiveInteger(input.casePack, "casePack");
  if (input.minimumOrderQuantity !== undefined) {
    requirePositiveInteger(input.minimumOrderQuantity, "minimumOrderQuantity");
  }
  if (input.maximumQuantity !== undefined && input.maximumQuantity !== null) {
    requireFiniteNonNegative(input.maximumQuantity, "maximumQuantity");
  }

  const minimum = Math.max(input.requiredQuantity, input.minimumOrderQuantity ?? 0);
  const baseQuantity = roundUpToPack(minimum, input.casePack);
  const maximum = input.maximumQuantity ?? null;

  if (maximum !== null && baseQuantity > maximum) {
    return {
      status: "exceeds_maximum" as const,
      quantity: null,
      maximumQuantity: maximum,
    };
  }

  let quantity = baseQuantity;
  let unitPriceMicrodollars: number | null = null;
  let merchandiseMicrodollars: bigint | null = null;

  for (const priceBreak of input.priceBreaks ?? []) {
    requirePositiveInteger(priceBreak.minimumQuantity, "priceBreak.minimumQuantity");
    requirePositiveInteger(priceBreak.unitPriceMicrodollars, "priceBreak.unitPriceMicrodollars");
    const candidateQuantity = roundUpToPack(
      Math.max(baseQuantity, priceBreak.minimumQuantity),
      input.casePack,
    );
    if (maximum !== null && candidateQuantity > maximum) continue;

    const candidateCost = BigInt(candidateQuantity) * BigInt(priceBreak.unitPriceMicrodollars);
    if (
      merchandiseMicrodollars === null ||
      candidateCost < merchandiseMicrodollars ||
      (candidateCost === merchandiseMicrodollars && candidateQuantity < quantity)
    ) {
      quantity = candidateQuantity;
      unitPriceMicrodollars = priceBreak.unitPriceMicrodollars;
      merchandiseMicrodollars = candidateCost;
    }
  }

  return {
    status: "ok" as const,
    quantity,
    appliedUnitPriceMicrodollars: unitPriceMicrodollars,
  };
}
