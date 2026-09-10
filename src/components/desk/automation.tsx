import { Button } from "@/components/ui/button";
import { Fact, Sentence } from "./sentences";
import type { Buy, Item } from "./model";

type ManagedItem = Item & {
  replenishmentEnabled?: boolean;
  automationNote?: string | null;
};

export function ReplenishmentControl({
  item,
  busy,
  onChange,
}: {
  item: ManagedItem;
  busy: boolean;
  onChange: (enabled: boolean) => void | Promise<void>;
}) {
  return (
    <section className="desk-section" aria-label="Automatic replenishment">
      <Sentence>
        {item.replenishmentEnabled ? (
          <>
            <Fact>The agent manages replenishment.</Fact>{" "}
            {item.automationNote ??
              "I’ll use your stock and usage to prepare the next purchase when it’s needed."}
          </>
        ) : (
          "Let the agent use your stock and daily usage to keep this item supplied."
        )}
      </Sentence>
      <p className="desk-muted">
        The agent researches and contacts suppliers. You approve each purchase before it orders.
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void onChange(!item.replenishmentEnabled)}
      >
        {item.replenishmentEnabled ? "Pause replenishment" : "Let the agent replenish"}
      </Button>
    </section>
  );
}

type WorkingBuy = Buy & {
  automatic?: boolean;
  purchasingState?: string | null;
  purchasingNote?: string | null;
};

export function PurchasingProgress({
  buy,
  busy,
  onRetry,
  onHelp,
}: {
  buy: WorkingBuy;
  busy: boolean;
  onRetry: () => void | Promise<void>;
  onHelp: () => void;
}) {
  if (!buy.automatic && !buy.purchasingState) return null;
  return (
    <section aria-label="Agent purchasing progress">
      <Sentence>
        {buy.purchasingNote ?? "I’m finding supply for the stock you’re projected to need."}
      </Sentence>
      {["failed", "needs_details"].includes(buy.purchasingState ?? "") && (
        <Button variant="outline" disabled={busy} onClick={() => void onRetry()}>
          Try research again
        </Button>
      )}
      {buy.purchasingState === "needs_details" && (
        <Button variant="outline" disabled={busy} onClick={onHelp}>
          Resolve this
        </Button>
      )}
    </section>
  );
}

export function OrderProgress({
  buy,
  busy,
  onCheck,
  onHelp,
}: {
  buy: Buy;
  busy: boolean;
  onCheck: () => void | Promise<void>;
  onHelp: () => void | Promise<void>;
}) {
  const order = buy.order;
  const preparingWebsite =
    order?.status === "draft" && order.orderingMethod === "website" && order.reviewRequired;
  if (
    !order ||
    (!preparingWebsite && !["approved", "sending", "sent", "send_failed"].includes(order.status))
  )
    return null;
  const execution = order as typeof order & { executionState?: string; executionNote?: string };
  const unknown = execution.executionState === "outcome_unknown";
  const help = execution.executionState === "needs_attention";
  return (
    <section aria-label="Order progress">
      <Sentence>
        {execution.executionNote ??
          order.error ??
          (unknown
            ? "I’m checking whether the supplier received your order before another attempt."
            : help
              ? "This order needs help before I can continue."
              : order.status === "sent"
                ? "The purchase order was sent. I’m waiting for the supplier’s confirmation."
                : order.status === "send_failed"
                  ? "Order delivery needs checking before another attempt."
                  : preparingWebsite
                    ? "I’m checking the supplier’s checkout for the final price and delivery before asking for approval."
                    : "Your purchase is approved. I’m completing the order.")}
      </Sentence>
      {(unknown || help || order.status === "send_failed") && (
        <div className="desk-answer-actions">
          <Button variant="outline" disabled={busy} onClick={() => void onCheck()}>
            Check order
          </Button>
          {help && (
            <Button variant="outline" disabled={busy} onClick={() => void onHelp()}>
              Resolve this
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
