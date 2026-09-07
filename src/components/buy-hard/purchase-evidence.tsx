import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";

import type { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/legacy-ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { SponsorCredit } from "./sponsor-credit";
import "./purchase-evidence.css";

type Comparison = NonNullable<FunctionReturnType<typeof api.recommendations.getLatestComparison>>;
type Quote = FunctionReturnType<typeof api.inbound.listQuotes>[number];
type FollowUp = FunctionReturnType<typeof api.mail.listFollowUps>[number];

const fieldLabels: Record<string, string> = {
  quantity_available: "Available quantity",
  unit_price: "Unit price",
  freight: "Freight",
  arrival_date: "Arrival date",
  minimum_order_quantity: "Minimum order",
  pack_size: "Pack size",
  payment_terms: "Payment terms",
  quote_expiration: "Quote expiration",
};

const reasonLabels: Record<string, string> = {
  arrival_after_required_by: "Arrives after the required date",
  insufficient_quantity: "Available quantity is below the requested amount",
  moq_exceeds_maximum: "Minimum order exceeds the inventory limit",
  critical_properties_unconfirmed: "Required product properties are unconfirmed",
  product_match_below_threshold: "Product match is below the required threshold",
  required_certification_missing: "A required certification is missing",
  required_terms_missing: "Required quote terms are missing",
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

const unitPrice = (microdollars: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(microdollars / 1_000_000);

function fieldLabel(field: string) {
  return fieldLabels[field] ?? field.replaceAll("_", " ");
}

function qualificationLabel(value: string) {
  return (
    {
      viable: "Viable",
      disqualified: "Not viable",
      human_review: "Needs review",
      pending: "Pending",
    }[value] ?? value.replaceAll("_", " ")
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bh-evidence-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function StoredTime({ timestamp }: { timestamp: number }) {
  return (
    <time dateTime={new Date(timestamp).toISOString()}>
      {new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }).format(timestamp)}{" "}
      UTC
    </time>
  );
}

function comparisonSummary(comparison: Comparison) {
  const selected = comparison.entries.find((entry) => entry.selected);
  if (!selected) return "No supplier is selected in this saved comparison.";

  const total =
    selected.landedCostCents === null ? "an incomplete total" : money(selected.landedCostCents);
  const intro = `${selected.supplierName} is the stored recommendation at ${total}, with ${selected.estimatedArrivalDate ? `arrival on ${selected.estimatedArrivalDate}` : "no arrival date recorded"}.`;
  const cheaper = comparison.entries
    .filter((entry) => entry.quoteId !== selected.quoteId && entry.landedCostCents !== null)
    .sort((left, right) => left.landedCostCents! - right.landedCostCents!)[0];

  if (
    selected.landedCostCents !== null &&
    cheaper?.landedCostCents !== null &&
    cheaper !== undefined &&
    cheaper.landedCostCents < selected.landedCostCents
  ) {
    return `${intro} It costs ${money(selected.landedCostCents - cheaper.landedCostCents)} more than ${cheaper.supplierName} (${qualificationLabel(cheaper.qualification).toLowerCase()}). The stored ranking considers stockout risk and product match before price.`;
  }

  const viable = comparison.entries.filter((entry) => entry.qualification === "viable");
  const knownViableTotals = viable.every((entry) => entry.landedCostCents !== null);
  const isLeastCost =
    selected.qualification === "viable" &&
    selected.landedCostCents !== null &&
    knownViableTotals &&
    viable.every((entry) => entry.landedCostCents! >= selected.landedCostCents!);
  return `${intro}${isLeastCost && viable.length > 1 ? " Its total is the lowest among the viable quotes in this comparison." : ""}`;
}

/** Explain stored numbers directly; generated narrative is not a source of purchase facts. */
export function QuoteComparison({ comparison }: { comparison: Comparison }) {
  const entries = [...comparison.entries].sort(
    (left, right) =>
      Number(right.selected) - Number(left.selected) || (left.rank ?? 999) - (right.rank ?? 999),
  );

  return (
    <Card className="bh-purchase-evidence" data-demo-target="comparison">
      <CardHeader>
        <CardDescription>Latest supplier terms</CardDescription>
        <CardTitle>Quote comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="bh-evidence-summary">{comparisonSummary(comparison)}</p>
        <div className="bh-evidence-candidates">
          {entries.map((entry) => (
            <article
              className="bh-evidence-candidate"
              data-selected={entry.selected}
              key={entry.quoteId}
            >
              <header>
                <p className="bh-evidence-eyebrow">
                  {entry.rank === null ? "Unranked" : `Rank ${entry.rank}`}
                </p>
                <h3>{entry.supplierName}</h3>
                <Badge variant={entry.selected ? "default" : "outline"}>
                  {entry.selected ? "Recommended" : qualificationLabel(entry.qualification)}
                </Badge>
              </header>
              <dl className="bh-evidence-facts">
                <Fact label="Total including freight">
                  {entry.landedCostCents === null ? "Incomplete" : money(entry.landedCostCents)}
                </Fact>
                <Fact label="Supplier arrival date">
                  {entry.estimatedArrivalDate ?? "Not provided"}
                </Fact>
                <Fact label="Projected stockout">
                  {entry.projectedStockoutDays} {entry.projectedStockoutDays === 1 ? "day" : "days"}
                </Fact>
                <Fact label="Purchase rules">{qualificationLabel(entry.qualification)}</Fact>
              </dl>
              <p className="bh-evidence-provenance">
                {entry.matchConfidenceSource === "controlled_demo_assumption"
                  ? "Demo product-match assumption"
                  : "Product match not independently verified"}
              </p>
              {entry.reasons.length > 0 ? (
                <ul className="bh-evidence-reasons">
                  {entry.reasons.map((reason) => (
                    <li key={reason}>{reasonLabels[reason] ?? reason.replaceAll("_", " ")}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuoteTerms({ quote }: { quote: Quote }) {
  return (
    <dl className="bh-evidence-facts">
      <Fact label="Available">
        {quote.quantityAvailable === null
          ? "Not provided"
          : `${quote.quantityAvailable.toLocaleString("en-US")} units`}
      </Fact>
      <Fact label="Total including freight">
        {quote.landedCostCents === null ? "Incomplete" : money(quote.landedCostCents)}
      </Fact>
      <Fact label="Arrival">{quote.estimatedArrivalDate ?? "Not provided"}</Fact>
      <Fact label="Unit price">
        {quote.unitPriceMicrodollars === null
          ? "Not provided"
          : unitPrice(quote.unitPriceMicrodollars)}
      </Fact>
      <Fact label="Freight">
        {quote.freightCents === null ? "Not provided" : money(quote.freightCents)}
      </Fact>
      {quote.minimumOrderQuantity != null ? (
        <Fact label="Minimum order">
          {quote.minimumOrderQuantity.toLocaleString("en-US")} units
        </Fact>
      ) : null}
      {quote.paymentTerms ? <Fact label="Payment terms">{quote.paymentTerms}</Fact> : null}
    </dl>
  );
}

function MissingTerms({ quote }: { quote: Quote }) {
  return quote.missingInformation.length > 0 ? (
    <p className="bh-evidence-missing">
      Missing: {quote.missingInformation.map(fieldLabel).join(", ")}
    </p>
  ) : (
    <p className="bh-evidence-provenance">No missing terms listed in this extracted reply.</p>
  );
}

function fieldIsPresent(quote: Quote, field: string) {
  if (quote.missingInformation.some((missing) => missing === field)) return false;
  return requestedTermValue(quote, field) !== undefined;
}

function requestedTermValue(quote: Quote, field: string): string | undefined {
  switch (field) {
    case "quantity_available":
      return quote.quantityAvailable === null
        ? undefined
        : `${quote.quantityAvailable.toLocaleString("en-US")} units`;
    case "unit_price":
      return quote.unitPriceMicrodollars === null
        ? undefined
        : unitPrice(quote.unitPriceMicrodollars);
    case "freight":
      return quote.freightCents === null ? undefined : money(quote.freightCents);
    case "arrival_date":
      return quote.estimatedArrivalDate ?? undefined;
    case "minimum_order_quantity":
      return quote.minimumOrderQuantity == null
        ? undefined
        : `${quote.minimumOrderQuantity.toLocaleString("en-US")} units`;
    case "pack_size":
      return quote.packSize == null ? undefined : `${quote.packSize.toLocaleString("en-US")} units`;
    case "payment_terms":
      return quote.paymentTerms?.trim() || undefined;
    case "quote_expiration":
      return quote.expiresOn ?? undefined;
    default:
      return undefined;
  }
}

function FollowUpEvidence({ followUp, quotes }: { followUp: FollowUp; quotes: readonly Quote[] }) {
  const source = quotes.find((quote) => quote.quoteId === followUp.sourceQuoteId);
  const wasSent = followUp.status === "sent" && followUp.sentAt !== null;
  const response =
    source && followUp.rfqId && source.rfqId === followUp.rfqId && wasSent
      ? quotes
          .filter(
            (quote) =>
              quote.rfqId === followUp.rfqId &&
              quote.revision > source.revision &&
              quote.createdAt >= followUp.sentAt!,
          )
          .sort(
            (left, right) => left.revision - right.revision || left.createdAt - right.createdAt,
          )[0]
      : undefined;
  const provided = response
    ? followUp.requestedFields.filter((field) => fieldIsPresent(response, field))
    : [];
  const unresolved = followUp.requestedFields.filter((field) => !provided.includes(field));

  return (
    <article className="bh-evidence-followup">
      <header className="bh-evidence-followup-header">
        <div>
          <p className="bh-evidence-eyebrow">Clarification {followUp.attempt}</p>
          <h3>{followUp.supplierName}</h3>
        </div>
        <Badge variant="outline">{followUp.status.replaceAll("_", " ")}</Badge>
      </header>
      <ol className="bh-evidence-timeline">
        <li>
          <p className="bh-evidence-timeline-label">
            01 · Missing in {source ? `revision ${source.revision}` : "source quote"}
          </p>
          <p>
            {source
              ? source.missingInformation.map(fieldLabel).join(", ") ||
                "No missing fields recorded."
              : "Source quote is not available in this history."}
          </p>
        </li>
        <li>
          <p className="bh-evidence-timeline-label">
            02 · {wasSent ? "Clarification sent" : "Clarification prepared"}
          </p>
          <p>Requested: {followUp.requestedFields.map(fieldLabel).join(", ")}</p>
          <div className="bh-evidence-mail-meta">
            <StoredTime timestamp={followUp.sentAt ?? followUp.createdAt} />
            {wasSent ? <SponsorCredit sponsor="agentmail" prefix="Sent via" /> : null}
          </div>
          <details className="bh-evidence-disclosure">
            <summary>{wasSent ? "Read sent email" : "Read prepared email"}</summary>
            <div className="bh-evidence-email bh-receipt">
              <p>{followUp.subject}</p>
              <p>{followUp.body}</p>
            </div>
          </details>
          {followUp.errorMessage ? (
            <p className="bh-evidence-missing">{followUp.errorMessage}</p>
          ) : null}
        </li>
        <li>
          <p className="bh-evidence-timeline-label">
            03 · {response ? `Next reply · revision ${response.revision}` : "Next reply"}
          </p>
          {response ? (
            <>
              <dl className="bh-evidence-facts">
                {followUp.requestedFields.map((field) => (
                  <Fact key={field} label={fieldLabel(field)}>
                    {requestedTermValue(response, field) ?? "Not provided"}
                  </Fact>
                ))}
              </dl>
              <p className="bh-evidence-provenance">
                <StoredTime timestamp={response.createdAt} />
              </p>
              {provided.length > 0 ? (
                <p className="bh-evidence-resolved">
                  Provided: {provided.map(fieldLabel).join(", ")}
                </p>
              ) : null}
              {unresolved.length > 0 ? (
                <p className="bh-evidence-missing">
                  Still missing or not verifiable here: {unresolved.map(fieldLabel).join(", ")}
                </p>
              ) : (
                <p className="bh-evidence-resolved">
                  All requested fields are present in this reply.
                </p>
              )}
            </>
          ) : (
            <p className="bh-evidence-provenance">
              {wasSent
                ? "No later linked quote is available in this history."
                : "A sent clarification is required before a response can be linked."}
            </p>
          )}
        </li>
      </ol>
    </article>
  );
}

/** Keep current offers prominent; retain revisions and exact mail as inspectable evidence. */
export function QuoteHistory({
  quotes,
  followUps,
  quoteCredit,
  followUpCredit,
}: {
  quotes: readonly Quote[];
  followUps: readonly FollowUp[];
  quoteCredit?: ReactNode;
  followUpCredit?: ReactNode;
}) {
  const groups = new Map<string, Quote[]>();
  for (const quote of quotes) {
    const key = quote.rfqId ?? quote.supplierName;
    const history = groups.get(key) ?? [];
    history.push(quote);
    groups.set(key, history);
  }
  const histories = [...groups.values()].map((history) =>
    [...history].sort(
      (left, right) => right.revision - left.revision || right.createdAt - left.createdAt,
    ),
  );

  return (
    <>
      {quotes.length > 0 ? (
        <Card className="bh-purchase-evidence">
          <CardHeader>
            <CardDescription>Supplier replies</CardDescription>
            <CardTitle>Latest quotes</CardTitle>
            {quoteCredit}
          </CardHeader>
          <CardContent>
            <div className="bh-evidence-candidates">
              {histories.map(([latest, ...older]) =>
                latest ? (
                  <article
                    className="bh-evidence-candidate"
                    key={latest.rfqId ?? latest.supplierName}
                  >
                    <header>
                      <p className="bh-evidence-eyebrow">Revision {latest.revision}</p>
                      <h3>{latest.supplierName}</h3>
                      <Badge variant="outline">{qualificationLabel(latest.qualification)}</Badge>
                    </header>
                    <QuoteTerms quote={latest} />
                    <MissingTerms quote={latest} />
                    <p className="bh-evidence-provenance">
                      <StoredTime timestamp={latest.createdAt} />
                    </p>
                    {older.length > 0 ? (
                      <details className="bh-evidence-disclosure">
                        <summary>
                          {older.length} earlier {older.length === 1 ? "revision" : "revisions"}
                        </summary>
                        {older.map((quote) => (
                          <div className="bh-evidence-old-quote" key={quote.quoteId}>
                            <p className="bh-evidence-eyebrow">Revision {quote.revision}</p>
                            <QuoteTerms quote={quote} />
                            <MissingTerms quote={quote} />
                            <p className="bh-evidence-provenance">
                              <StoredTime timestamp={quote.createdAt} />
                            </p>
                          </div>
                        ))}
                      </details>
                    ) : null}
                  </article>
                ) : null,
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card className="bh-purchase-evidence" data-demo-target="followups">
        <CardHeader>
          <CardDescription>Missing terms → clarification → reply</CardDescription>
          <CardTitle>Supplier follow-ups</CardTitle>
          {followUps.length > 0 ? followUpCredit : null}
        </CardHeader>
        <CardContent className="bh-evidence-followups">
          {followUps.length === 0 ? (
            <p className="bh-evidence-provenance">
              No supplier clarifications are recorded for this buy.
            </p>
          ) : null}
          {[...followUps]
            .sort((left, right) => left.createdAt - right.createdAt)
            .map((followUp) => (
              <FollowUpEvidence key={followUp.followUpId} followUp={followUp} quotes={quotes} />
            ))}
        </CardContent>
      </Card>
    </>
  );
}
