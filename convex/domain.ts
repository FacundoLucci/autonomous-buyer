import { v } from "convex/values";

export const inventoryStatuses = [
  "healthy",
  "watch",
  "action_required",
  "sourcing",
  "awaiting_quotes",
  "evaluating",
  "approval_required",
  "ordered",
  "confirmed",
  "exception",
] as const;

export const inventoryStatusValidator = v.union(
  v.literal("healthy"),
  v.literal("watch"),
  v.literal("action_required"),
  v.literal("sourcing"),
  v.literal("awaiting_quotes"),
  v.literal("evaluating"),
  v.literal("approval_required"),
  v.literal("ordered"),
  v.literal("confirmed"),
  v.literal("exception"),
);

export const procurementStates = [
  "detected",
  "analyzing",
  "sourcing",
  "rfq_ready",
  "rfq_sent",
  "awaiting_quotes",
  "evaluating",
  "approval_required",
  "approved",
  "po_sent",
  "confirmation_pending",
  "confirmed",
  "closed",
  "no_viable_supplier",
  "rejected",
  "exception",
  "cancelled",
] as const;

export const procurementStateValidator = v.union(
  v.literal("detected"),
  v.literal("analyzing"),
  v.literal("sourcing"),
  v.literal("rfq_ready"),
  v.literal("rfq_sent"),
  v.literal("awaiting_quotes"),
  v.literal("evaluating"),
  v.literal("approval_required"),
  v.literal("approved"),
  v.literal("po_sent"),
  v.literal("confirmation_pending"),
  v.literal("confirmed"),
  v.literal("closed"),
  v.literal("no_viable_supplier"),
  v.literal("rejected"),
  v.literal("exception"),
  v.literal("cancelled"),
);

export const reviewStatusValidator = v.union(v.literal("required"), v.literal("resolved"));

export const matchStatusValidator = v.union(
  v.literal("exact_match"),
  v.literal("likely_match"),
  v.literal("possible_match"),
  v.literal("not_compatible"),
  v.literal("insufficient_information"),
);

export const sourceKindValidator = v.union(
  v.literal("website"),
  v.literal("supplier_confirmed"),
  v.literal("historical"),
  v.literal("agent_inference"),
);

export const supplierClaimFieldValidator = v.union(
  v.literal("product_title"),
  v.literal("manufacturer"),
  v.literal("manufacturer_sku"),
  v.literal("material"),
  v.literal("dimensions"),
  v.literal("pack_size"),
  v.literal("price"),
  v.literal("minimum_order_quantity"),
  v.literal("availability"),
  v.literal("lead_time"),
  v.literal("contact_email"),
  v.literal("freight"),
  v.literal("certification"),
);

export const missingQuoteFieldValidator = v.union(
  v.literal("quantity_available"),
  v.literal("unit_price"),
  v.literal("freight"),
  v.literal("arrival_date"),
  v.literal("minimum_order_quantity"),
  v.literal("pack_size"),
  v.literal("payment_terms"),
  v.literal("quote_expiration"),
);

export const integrationNames = ["openai", "openrouter", "firecrawl", "agentmail"] as const;

export const integrationNameValidator = v.union(
  v.literal("openai"),
  v.literal("openrouter"),
  v.literal("firecrawl"),
  v.literal("agentmail"),
);

export const integrationStatusValidator = v.union(v.literal("configured"), v.literal("missing"));

export const integrationOperationValidator = v.union(
  v.literal("firecrawl_search"),
  v.literal("firecrawl_scrape"),
  v.literal("agentmail_send_rfq"),
  v.literal("agentmail_send_follow_up"),
  v.literal("agentmail_send_purchase_order"),
  v.literal("agentmail_receive_message"),
  v.literal("openai_structured_task"),
  v.literal("openrouter_structured_task"),
);

export const procurementEventTypeValidator = v.union(
  v.literal("risk_detected"),
  v.literal("state_transitioned"),
  v.literal("review_required"),
  v.literal("search_started"),
  v.literal("search_completed"),
  v.literal("supplier_discovered"),
  v.literal("rfq_prepared"),
  v.literal("rfq_sent"),
  v.literal("email_received"),
  v.literal("follow_up_sent"),
  v.literal("quote_recorded"),
  v.literal("recommendation_created"),
  v.literal("approval_recorded"),
  v.literal("purchase_order_sent"),
  v.literal("confirmation_received"),
  v.literal("exception_recorded"),
);

export const aiTaskValidator = v.union(
  v.literal("supplier_search_queries"),
  v.literal("product_equivalency"),
  v.literal("quote_extraction"),
  v.literal("missing_information"),
  v.literal("follow_up_wording"),
  v.literal("recommendation_explanation"),
  v.literal("confirmation_extraction"),
  v.literal("exception_explanation"),
);
