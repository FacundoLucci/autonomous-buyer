import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { buyingPriorities } from "@/lib/inventory-planning";
import { Empty } from "./primitives";

export type AuditEntry = Pick<
  Doc<"auditEntries">,
  "name" | "action" | "actor" | "via" | "changes" | "createdAt"
> & { _id: string };
const labels: Record<string, string> = {
  quantityOnHand: "Last physical count",
  forecastQuantity: "Estimated stock",
  forecastAt: "Estimate updated at",
  replenishmentEnabled: "Agent replenishment",
  orderMultiple: "Order multiple",
  preparationDays: "Research and approval allowance",
  preferredCoverageDays: "Target days of supply",
  orderingMethod: "Ordering method",
  executionState: "Order progress",
  stockCountKnown: "Count known",
  stockCountedAt: "Counted at",
  estimatedDailyUsage: "Daily usage",
  supplierLeadTimeDays: "Delivery takes",
  safetyStockDays: "Extra days of stock",
  supplierName: "Supplier",
  buyingPriority: "When buying",
  dailyLossCents: "Daily loss",
  lossCurrency: "Loss currency",
  stockoutImpact: "What stops",
  buyUrl: "Buy link",
  supplierEmail: "Supplier email",
  unitPriceCents: "Price per unit",
  freightCents: "Shipping",
  taxCents: "Tax",
  totalCents: "Total",
  receivedQuantity: "Received",
  expectedOn: "Arrival",
  requiredBy: "Needed by",
  shipTo: "Deliver to",
  shippingAddress: "Deliver to",
  approvedAt: "Approved at",
  itemName: "Item",
  orderId: "Purchase",
  itemId: "Item",
  lowStockEnabled: "Low stock alerts",
  orderUpdatesEnabled: "Order alerts",
};
function value(field: string, text: string | null) {
  if (text === null) return "not set";
  if (field === "buyingPriority" && text in buyingPriorities)
    return buyingPriorities[text as keyof typeof buyingPriorities];
  if (field.endsWith("Cents"))
    return (Number(text) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
  if (field.endsWith("At") && Number.isFinite(Number(text)))
    return new Date(Number(text)).toLocaleString();
  if (text === "true") return "Yes";
  if (text === "false") return "No";
  return text.replaceAll("_", " ");
}
export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="desk-audit">
      {entries.map((entry) => (
        <details key={entry._id} className="desk-audit-entry">
          <summary>
            <span>
              <strong>{entry.name}</strong>
              <small>
                {entry.action === "created"
                  ? "Added"
                  : entry.action === "deleted"
                    ? "Removed"
                    : "Updated"}{" "}
                · {entry.actor}
                {entry.via === "chat" ? " via chat" : ""}
              </small>
            </span>
            <time dateTime={new Date(entry.createdAt).toISOString()}>
              {new Date(entry.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}
            </time>
          </summary>
          <div className="desk-audit-changes">
            {entry.changes.map((change) => (
              <p className="desk-sentence" key={change.field}>
                {labels[change.field] ??
                  change.field
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (s) => s.toUpperCase())}{" "}
                changed from{" "}
                <strong className="desk-fact">{value(change.field, change.before)}</strong> to{" "}
                <strong className="desk-fact">{value(change.field, change.after)}</strong>.
              </p>
            ))}
          </div>
        </details>
      ))}
      {!entries.length && <Empty>Changes will appear here as you work.</Empty>}
    </div>
  );
}
export function LiveAuditLog() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.audit.list,
    {},
    { initialNumItems: 30 },
  );
  if (status === "LoadingFirstPage") return <output>Loading changes…</output>;
  return (
    <>
      <AuditLog entries={results} />
      {status !== "Exhausted" && (
        <Button variant="outline" disabled={status === "LoadingMore"} onClick={() => loadMore(30)}>
          {status === "LoadingMore" ? "Loading…" : "Older changes"}
        </Button>
      )}
    </>
  );
}
