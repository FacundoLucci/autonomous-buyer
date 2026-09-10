import type { FunctionReturnType } from "convex/server";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { api } from "../../../convex/_generated/api";
export type Workspace = NonNullable<FunctionReturnType<typeof api.onboarding.getWorkspace>>;
export type Item = Workspace["items"][number];
export type Snapshot = FunctionReturnType<typeof api.desk.snapshot>;
export type Buy = Snapshot["buys"][number];
export type Draft = Doc<"taskChats">["draft"];
export type Task = Doc<"taskChats">["task"];
export type ChatRequest = {
  task: Task;
  contextId?: string;
  name?: string;
  prompt?: string;
  revision?: boolean;
};
export function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
export function buyStatus(buy: Buy) {
  if (buy.order?.reviewRequired) return "Checking changes";
  if (!buy.order) {
    if (buy.closed) return "Cancelled";
    if (buy.purchasingState === "waiting_supplier") return "Waiting for supplier terms";
    if (buy.purchasingState === "needs_details" || buy.purchasingState === "failed")
      return "Needs attention";
    return buy.automatic || buy.purchasingState === "researching" ? "Finding supply" : "Started";
  }
  if (buy.order.executionState === "outcome_unknown") return "Checking order outcome";
  if (buy.order.executionState === "needs_attention") return "Needs attention";
  return {
    draft: "Needs approval",
    approved: "Completing order",
    sending: "Sending order",
    sent: "Awaiting confirmation",
    placed: "On the way",
    part_received: "Part delivered",
    received: "Received",
    cancelled: "Cancelled",
    send_failed: "Needs attention",
  }[buy.order.status];
}
export function isOpen(buy: Buy) {
  return buy.order ? buy.order.isOpen : !buy.closed;
}
export function dateLabel(date: string | null | undefined) {
  return date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
}
export function errorText(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "string"
    ? error.data
    : "That didn’t go through. Try again.";
}
export function draftReady(task: Task, d: Draft) {
  if (task === "stock_update") return false;
  if (task === "onboarding" || task === "settings")
    return !!d.companyName && (d.shippingAddress?.length ?? 0) >= 12;
  if (task === "add_item") return !!d.name;
  if (task === "new_buy") return !!d.itemId;
  if (task === "buy")
    return (
      !!d.quantity &&
      d.unitPriceCents !== undefined &&
      d.freightCents !== undefined &&
      d.taxCents !== undefined &&
      !!d.requiredBy &&
      !!d.currency &&
      !!d.supplier &&
      !!(d.buyUrl || d.supplierEmail)
    );
  if (task === "receive") return !!d.quantity;
  if (task === "confirm") return !!d.confirmation && !!d.expectedOn;
  return true;
}
