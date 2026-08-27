import { z } from "zod";

export const aiTasks = [
  "supplier_search_queries",
  "product_equivalency",
  "quote_extraction",
  "missing_information",
  "follow_up_wording",
  "recommendation_explanation",
  "confirmation_extraction",
  "exception_explanation",
] as const;

export type AiTask = (typeof aiTasks)[number];

const evidenceFieldSchema = z
  .object({
    field: z.string().min(1),
    value: z.string().min(1),
    evidenceRefs: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1).nullable(),
  })
  .strict();

const common = {
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  confirmedFields: z.array(evidenceFieldSchema),
  inferredFields: z.array(evidenceFieldSchema),
};

const missingQuoteFieldSchema = z.enum([
  "quantity_available",
  "unit_price",
  "freight",
  "arrival_date",
  "minimum_order_quantity",
  "pack_size",
  "payment_terms",
  "quote_expiration",
]);

export const taskSchemas = {
  supplier_search_queries: z
    .object({
      ...common,
      output: z
        .object({
          task: z.literal("supplier_search_queries"),
          queries: z.array(z.string().min(1)).min(1).max(8),
          rationale: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
  product_equivalency: z
    .object({
      ...common,
      output: z
        .object({
          task: z.literal("product_equivalency"),
          assessment: z.enum([
            "exact_match",
            "likely_match",
            "possible_match",
            "not_compatible",
            "insufficient_information",
          ]),
          matchingAttributes: z.array(z.string()),
          conflicts: z.array(z.string()),
          missingEvidence: z.array(z.string()),
        })
        .strict(),
    })
    .strict(),
  quote_extraction: z
    .object({
      ...common,
      output: z
        .object({
          task: z.literal("quote_extraction"),
          supplierName: z.string().nullable(),
          quantityAvailable: z.number().int().nonnegative().nullable(),
          unitPriceMicrodollars: z.number().int().nonnegative().nullable(),
          freightCents: z.number().int().nonnegative().nullable(),
          estimatedArrivalDate: z.string().nullable(),
          missingFields: z.array(missingQuoteFieldSchema),
        })
        .strict(),
    })
    .strict(),
  missing_information: z
    .object({
      ...common,
      output: z
        .object({
          task: z.literal("missing_information"),
          missingFields: z.array(missingQuoteFieldSchema),
          needsFollowUp: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  follow_up_wording: z
    .object({
      ...common,
      output: z
        .object({
          task: z.literal("follow_up_wording"),
          subject: z.string().min(1),
          body: z.string().min(1),
          requestedFields: z.array(missingQuoteFieldSchema),
        })
        .strict(),
    })
    .strict(),
  recommendation_explanation: z
    .object({
      ...common,
      output: z
        .object({
          task: z.literal("recommendation_explanation"),
          explanation: z.string().min(1),
          strengths: z.array(z.string()),
          tradeoffs: z.array(z.string()),
        })
        .strict(),
    })
    .strict(),
  confirmation_extraction: z
    .object({
      ...common,
      output: z
        .object({
          task: z.literal("confirmation_extraction"),
          confirmed: z.boolean(),
          supplierConfirmationNumber: z.string().nullable(),
          quantity: z.number().int().nonnegative().nullable(),
          estimatedArrivalDate: z.string().nullable(),
          changedTerms: z.array(z.string()),
        })
        .strict(),
    })
    .strict(),
  exception_explanation: z
    .object({
      ...common,
      output: z
        .object({
          task: z.literal("exception_explanation"),
          explanation: z.string().min(1),
          severity: z.enum(["low", "medium", "high"]),
          differences: z.array(z.string()),
        })
        .strict(),
    })
    .strict(),
} satisfies Record<AiTask, z.ZodType>;

export type StructuredAiResult = z.infer<(typeof taskSchemas)[AiTask]>;
