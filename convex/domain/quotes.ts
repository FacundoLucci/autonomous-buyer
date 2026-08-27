export const PRODUCT_MATCH_CONFIDENCE_THRESHOLD = 0.85;

export type QuoteQualification = "viable" | "disqualified" | "human_review";

export type QuoteQualificationInput = {
  arrivalDate?: string;
  requiredBy: string;
  quantityAvailable?: number;
  requestedQuantity: number;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  criticalPropertiesConfirmed: boolean;
  productMatchConfidence: number;
  requiredCertifications: string[];
  confirmedCertifications: string[];
  missingInformation: string[];
};

export type RankedQuote = {
  quoteId: string;
  qualification: QuoteQualification;
  landedCostCents: number;
  arrivalDate: string;
  projectedStockoutDays: number;
  productMatchConfidence: number;
  excessInventory: number;
  supplierReliability: number;
  paymentTermsScore: number;
};

function compareNumber(left: number, right: number) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function requireFiniteNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number.`);
  }
}

function requireIsoDate(value: string, name: string) {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${name} must be a valid ISO date.`);
  }
}

export function qualifyQuote(input: QuoteQualificationInput): {
  qualification: QuoteQualification;
  reasons: string[];
} {
  requireIsoDate(input.requiredBy, "requiredBy");
  if (input.arrivalDate !== undefined) requireIsoDate(input.arrivalDate, "arrivalDate");
  requireFiniteNonNegative(input.requestedQuantity, "requestedQuantity");
  if (input.quantityAvailable !== undefined) {
    requireFiniteNonNegative(input.quantityAvailable, "quantityAvailable");
  }
  if (input.minimumOrderQuantity !== undefined) {
    requireFiniteNonNegative(input.minimumOrderQuantity, "minimumOrderQuantity");
  }
  if (input.maximumOrderQuantity !== undefined) {
    requireFiniteNonNegative(input.maximumOrderQuantity, "maximumOrderQuantity");
  }
  if (
    !Number.isFinite(input.productMatchConfidence) ||
    input.productMatchConfidence < 0 ||
    input.productMatchConfidence > 1
  ) {
    throw new Error("productMatchConfidence must be between zero and one.");
  }

  const reasons: string[] = [];

  if (input.arrivalDate !== undefined && input.arrivalDate > input.requiredBy) {
    reasons.push("arrival_after_required_by");
  }
  if (input.quantityAvailable !== undefined && input.quantityAvailable < input.requestedQuantity) {
    reasons.push("insufficient_quantity");
  }
  if (
    input.minimumOrderQuantity !== undefined &&
    input.maximumOrderQuantity !== undefined &&
    input.minimumOrderQuantity > input.maximumOrderQuantity
  ) {
    reasons.push("moq_exceeds_maximum");
  }
  if (!input.criticalPropertiesConfirmed) reasons.push("critical_properties_unconfirmed");
  if (input.productMatchConfidence < PRODUCT_MATCH_CONFIDENCE_THRESHOLD) {
    reasons.push("product_match_below_threshold");
  }

  const confirmed = new Set(input.confirmedCertifications);
  if (input.requiredCertifications.some((certification) => !confirmed.has(certification))) {
    reasons.push("required_certification_missing");
  }

  if (reasons.length > 0) return { qualification: "disqualified", reasons };
  if (
    input.arrivalDate === undefined ||
    input.quantityAvailable === undefined ||
    input.missingInformation.length > 0
  ) {
    return { qualification: "human_review", reasons: ["required_terms_missing"] };
  }

  return { qualification: "viable", reasons: [] };
}

export function rankViableQuotes(quotes: RankedQuote[]) {
  for (const quote of quotes) {
    requireIsoDate(quote.arrivalDate, "arrivalDate");
    for (const [name, value] of [
      ["landedCostCents", quote.landedCostCents],
      ["projectedStockoutDays", quote.projectedStockoutDays],
      ["productMatchConfidence", quote.productMatchConfidence],
      ["excessInventory", quote.excessInventory],
      ["supplierReliability", quote.supplierReliability],
      ["paymentTermsScore", quote.paymentTermsScore],
    ] as const) {
      requireFiniteNonNegative(value, name);
    }
  }

  return [...quotes]
    .filter((quote) => quote.qualification === "viable")
    .sort((left, right) => {
      return (
        compareNumber(left.projectedStockoutDays, right.projectedStockoutDays) ||
        compareNumber(right.productMatchConfidence, left.productMatchConfidence) ||
        compareNumber(left.landedCostCents, right.landedCostCents) ||
        compareNumber(left.excessInventory, right.excessInventory) ||
        compareNumber(right.supplierReliability, left.supplierReliability) ||
        compareNumber(right.paymentTermsScore, left.paymentTermsScore) ||
        left.arrivalDate.localeCompare(right.arrivalDate) ||
        left.quoteId.localeCompare(right.quoteId)
      );
    });
}

export function approvalRequirement(input: { totalCents: number }) {
  requireFiniteNonNegative(input.totalCents, "totalCents");
  return "required" as const;
}

export type ApprovedPurchaseOrder = {
  quantity: number;
  unitPriceMicrodollars: number;
  freightCents: number;
  totalCents: number;
  requiredBy: string;
};

export function compareConfirmation(
  approved: ApprovedPurchaseOrder,
  confirmed: ApprovedPurchaseOrder,
) {
  const fields = [
    "quantity",
    "unitPriceMicrodollars",
    "freightCents",
    "totalCents",
    "requiredBy",
  ] as const;
  const differences = fields
    .filter((field) => approved[field] !== confirmed[field])
    .map((field) => ({ field, approved: approved[field], confirmed: confirmed[field] }));

  return { matchesApprovedPurchaseOrder: differences.length === 0, differences };
}
