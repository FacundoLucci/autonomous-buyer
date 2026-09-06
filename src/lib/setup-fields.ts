export const units = ["units", "cases", "kg", "liters", "rolls"] as const;
export type InventoryUnit = (typeof units)[number];

export type CompanySetup = {
  companyName: string;
  shippingAddress: string;
  itemName: string;
  sku: string;
  unit: InventoryUnit;
  quantity: string;
  dailyUsage: string;
  leadTimeDays: string;
  safetyStockDays: string;
};

export const emptySetup: CompanySetup = {
  companyName: "",
  shippingAddress: "",
  itemName: "",
  sku: "",
  unit: "units",
  quantity: "",
  dailyUsage: "",
  leadTimeDays: "",
  safetyStockDays: "3",
};

export function setupFieldError(field: keyof CompanySetup, value: string): string | null {
  if (!value.trim()) return "Add an answer to continue.";
  if (field === "unit") return units.includes(value as InventoryUnit) ? null : "Choose a unit.";
  if (["quantity", "dailyUsage", "leadTimeDays", "safetyStockDays"].includes(field)) {
    const n = Number(value);
    const isDays = field.endsWith("Days");
    if (!Number.isFinite(n) || n < 0 || n > (isDays ? 365 : 1_000_000_000)) {
      return isDays ? "Use a number from 0 to 365 days." : "Use a number from 0 to 1,000,000,000.";
    }
    if (isDays && !Number.isInteger(n)) return "Use a whole number of days.";
    return null;
  }
  const max = field === "shippingAddress" ? 500 : field === "sku" ? 64 : 120;
  if (value.trim().length > max) return `Keep this under ${max + 1} characters.`;
  if (field === "shippingAddress" && value.trim().length < 12)
    return "Include the street, city, region, postal code, and country.";
  return null;
}

export function stockOutlook(
  quantity: number | null,
  dailyUsage: number | null,
  leadTimeDays: number | null,
  safetyStockDays: number,
) {
  const daysLeft =
    quantity !== null && dailyUsage !== null && dailyUsage > 0 ? quantity / dailyUsage : null;
  const reorderAt =
    dailyUsage !== null && dailyUsage > 0 && leadTimeDays !== null
      ? dailyUsage * (leadTimeDays + safetyStockDays)
      : null;
  const needsAction = quantity !== null && reorderAt !== null && quantity <= reorderAt;
  return { daysLeft, reorderAt, needsAction };
}
