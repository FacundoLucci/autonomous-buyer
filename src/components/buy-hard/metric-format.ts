const units = [
  { divisor: 1_000, suffix: "k" },
  { divisor: 1_000_000, suffix: "m" },
  { divisor: 1_000_000_000, suffix: "b" },
  { divisor: 1_000_000_000_000, suffix: "t" },
];

/** Four display characters, including the sign, decimal point, and unit. */
export function formatCompactMetric(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";

  const wholeValue = Math.sign(value) * Math.round(Math.abs(value));
  if (Math.abs(wholeValue) < 1_000) return String(wholeValue);

  for (const { divisor, suffix } of units) {
    const scaled = wholeValue / divisor;
    if (Math.abs(scaled) >= 1_000) continue;

    for (let decimals = 2; decimals >= 0; decimals--) {
      const rounded = Number(scaled.toFixed(decimals));
      // Rounding at a unit boundary must advance to the next unit.
      if (Math.abs(rounded) >= 1_000) break;
      if (rounded === 0) continue;

      const digits = String(rounded).replace(/^-0\./, "-.");
      const compact = `${digits}${suffix}`;
      if (compact.length <= 4) return compact;
    }
  }

  // The exact value remains available when a number exceeds the display range.
  return value < 0 ? "-MAX" : "MAX";
}
