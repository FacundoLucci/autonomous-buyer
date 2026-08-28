import { procurementStates } from "../domain";

export type ProcurementState = (typeof procurementStates)[number];

export const allowedStateTransitions: Readonly<
  Record<ProcurementState, readonly ProcurementState[]>
> = {
  detected: ["analyzing", "exception", "cancelled"],
  analyzing: ["sourcing", "exception", "cancelled"],
  sourcing: ["rfq_ready", "no_viable_supplier", "exception", "cancelled"],
  rfq_ready: ["rfq_sent", "no_viable_supplier", "exception", "cancelled"],
  rfq_sent: ["awaiting_quotes", "exception", "cancelled"],
  awaiting_quotes: ["evaluating", "no_viable_supplier", "exception", "cancelled"],
  evaluating: ["approval_required", "no_viable_supplier", "exception", "cancelled"],
  approval_required: ["approved", "rejected", "exception", "cancelled"],
  approved: ["po_sent", "exception", "cancelled"],
  po_sent: ["confirmation_pending", "exception", "cancelled"],
  confirmation_pending: ["confirmed", "exception", "cancelled"],
  confirmed: ["closed", "exception"],
  closed: [],
  no_viable_supplier: [],
  rejected: [],
  exception: ["confirmed"],
  cancelled: [],
};

export function canTransition(from: ProcurementState, to: ProcurementState) {
  return allowedStateTransitions[from].includes(to);
}

export function assertAllowedTransition(from: ProcurementState, to: ProcurementState) {
  if (!canTransition(from, to)) {
    throw new Error(`Procurement cannot transition from ${from} to ${to}.`);
  }
}
