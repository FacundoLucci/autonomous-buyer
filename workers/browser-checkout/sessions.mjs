import { fingerprint, sameSnapshot } from "./runner.mjs";

export const retainedStates = new Set(["prepared", "changed", "needs_help", "needs_payment"]);

export function sessionKey(order) {
  return fingerprint([
    order.organizationId,
    order.paymentOwnerId || "no-payment-owner",
    new URL(order.buyUrl).origin,
  ]);
}

export function samePurchase(left, right) {
  return [
    "organizationId",
    "paymentOwnerId",
    "_id",
    "buyUrl",
    "sku",
    "unit",
    "quantity",
    "shipTo",
  ].every((key) => left?.[key] === right?.[key]);
}

// A live browser can only move from preparation into the exact approved order.
// Prices can change the app's intent key during preparation, so compare the
// complete prepared snapshot instead of the earlier draft intent key.
export function canTransferPrepared(source, destination) {
  if (
    !source ||
    !["prepare", "submit"].includes(source.phase) ||
    !["prepared", "changed"].includes(source.state) ||
    source.submitStarted ||
    source.supersededBy ||
    destination.phase !== "submit" ||
    !samePurchase(source.order, destination.order)
  )
    return false;
  try {
    return sameSnapshot(source.snapshot, destination.snapshot);
  } catch {
    return false;
  }
}

export function canRetry(job, intent) {
  return (
    typeof intent === "string" &&
    intent === job.intent &&
    !job.submitStarted &&
    !job.supersededBy &&
    ["needs_help", "needs_payment"].includes(job.state)
  );
}

export function safeProgress(progress, previous) {
  const steps = Number.isSafeInteger(progress?.steps)
    ? Math.max(0, Math.min(500, progress.steps))
    : previous?.steps || 0;
  const summaries = {
    prepare: "Checking the supplier cart and total.",
    submit: "Completing the approved purchase.",
    receipt: "Checking the supplier confirmation.",
    payment: "Waiting for your payment approval.",
  };
  return {
    steps,
    summary: summaries[progress?.phase] || "Checking the supplier checkout.",
  };
}

export function publicJob(job) {
  return {
    id: job.id,
    state: job.state,
    ...(job.snapshot ? { snapshot: job.snapshot } : {}),
    ...(job.confirmation ? { confirmation: job.confirmation } : {}),
    ...(job.error ? { error: job.error } : {}),
    ...(job.progress ? { progress: job.progress } : {}),
    ...(["needs_payment", "needs_help"].includes(job.state)
      ? { helpKind: job.state === "needs_payment" ? "payment" : "supplier" }
      : {}),
  };
}
