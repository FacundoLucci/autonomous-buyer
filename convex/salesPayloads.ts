import type { SalesSourceEvent } from "../src/lib/sales-planning";
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid provider response.");
  return value as Record<string, unknown>;
}
export function text(value: unknown): string {
  if (typeof value !== "string" || value.length > 500) throw new Error("Invalid provider field.");
  return value;
}
export function timestamp(value: unknown) {
  const time = Date.parse(text(value));
  if (!Number.isFinite(time)) throw new Error("Invalid source timestamp.");
  return time;
}
export function number(value: unknown) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new Error("Invalid source quantity.");
  return n;
}
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error("Invalid source item list.");
  return value;
}
export function squareOrder(value: unknown): SalesSourceEvent | null {
  const o = object(value);
  if (o.state !== "COMPLETED") return null;
  const lines = list(o.line_items ?? []).map((value) => {
    const l = object(value);
    return {
      key: typeof l.catalog_object_id === "string" ? l.catalog_object_id : "unmapped",
      name: typeof l.name === "string" ? l.name : "Square item",
      quantity: number(l.quantity),
    };
  });
  return {
    key: text(o.id) + ":" + String(o.version),
    resourceId: text(o.id),
    kind: "sales",
    locationId: text(o.location_id),
    occurredAt: timestamp(o.closed_at),
    updatedAt: timestamp(o.updated_at),
    lines,
  };
}
export function shopifyOrder(value: unknown): SalesSourceEvent | null {
  const o = object(value);
  if (
    o.cancelledAt ||
    !["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(String(o.displayFinancialStatus))
  )
    return null;
  const lines = list(o.lines).map((value) => {
    const l = object(value),
      variant = l.variant ? object(l.variant) : null;
    return {
      key: variant ? text(variant.id) : "unmapped",
      name: text(l.name),
      quantity: number(l.quantity),
    };
  });
  return {
    key: text(o.id) + ":" + text(o.updatedAt),
    resourceId: text(o.id),
    kind: "sales",
    locationId: "all",
    occurredAt: timestamp(o.processedAt ?? o.createdAt),
    updatedAt: timestamp(o.updatedAt),
    lines,
    adjustment: o.displayFinancialStatus !== "PAID",
  };
}
