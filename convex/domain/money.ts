const MICRODOLLARS_PER_CENT = 10_000n;

function requireInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer.`);
  }
}

function safeNumber(value: bigint, name: string) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${name} exceeds the safe integer range.`);
  }
  return result;
}

export function microdollarsToCents(microdollars: bigint) {
  const sign = microdollars < 0n ? -1n : 1n;
  const absolute = microdollars * sign;
  const rounded = (absolute + MICRODOLLARS_PER_CENT / 2n) / MICRODOLLARS_PER_CENT;
  return rounded * sign;
}

export function extendedPriceCents(quantity: number, unitPriceMicrodollars: number) {
  requireInteger(quantity, "quantity");
  requireInteger(unitPriceMicrodollars, "unitPriceMicrodollars");
  if (quantity < 0 || unitPriceMicrodollars < 0) {
    throw new Error("Quantity and unit price must be non-negative.");
  }

  return safeNumber(
    microdollarsToCents(BigInt(quantity) * BigInt(unitPriceMicrodollars)),
    "extended price",
  );
}

export function landedCostCents(input: {
  quantity: number;
  unitPriceMicrodollars: number;
  freightCents?: number;
  taxesCents?: number;
}) {
  const extended = extendedPriceCents(input.quantity, input.unitPriceMicrodollars);
  const freight = input.freightCents ?? 0;
  const taxes = input.taxesCents ?? 0;
  requireInteger(freight, "freightCents");
  requireInteger(taxes, "taxesCents");
  if (freight < 0 || taxes < 0) throw new Error("Freight and taxes must be non-negative.");

  const total = extended + freight + taxes;
  requireInteger(total, "landed cost");
  return { extendedPriceCents: extended, landedCostCents: total };
}

export function purchaseOrderTotals(input: {
  quantity: number;
  unitPriceMicrodollars: number;
  freightCents: number;
  taxesCents?: number;
}) {
  const result = landedCostCents(input);
  return { extendedPriceCents: result.extendedPriceCents, totalCents: result.landedCostCents };
}

export function savingsCents(baselineLandedCostCents: number, selectedLandedCostCents: number) {
  requireInteger(baselineLandedCostCents, "baselineLandedCostCents");
  requireInteger(selectedLandedCostCents, "selectedLandedCostCents");
  return baselineLandedCostCents - selectedLandedCostCents;
}
