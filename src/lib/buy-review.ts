type Terms = {
  quantity?: number;
  supplier?: string;
  buyUrl?: string;
  supplierEmail?: string;
  currency?: string;
  unitPriceCents?: number;
  freightCents?: number;
  taxCents?: number;
  requiredBy?: string;
  expectedOn?: string;
};
export function quoteKey(terms: Terms) {
  return JSON.stringify([
    terms.quantity,
    terms.supplier,
    terms.buyUrl,
    terms.supplierEmail,
    terms.currency,
    terms.unitPriceCents,
    terms.freightCents,
    terms.taxCents,
    terms.requiredBy,
    terms.expectedOn,
  ]);
}
export function approvalKey(
  order: Terms & {
    shipTo: string;
    totalCents: number;
    reviewRequired?: boolean;
    requestedQuantity?: number;
    quotedArrival?: string;
    orderingMethod?: "purchase_order" | "website";
    supplierPoVerified?: boolean;
    sku?: string;
    unit?: string;
    itemName?: string;
    supplierSku?: string;
  },
) {
  return JSON.stringify([
    quoteKey(order),
    order.shipTo,
    order.totalCents,
    !!order.reviewRequired,
    order.requestedQuantity,
    order.quotedArrival,
    order.orderingMethod,
    order.supplierPoVerified,
    order.sku,
    order.unit,
    order.itemName,
    order.supplierSku,
  ]);
}
