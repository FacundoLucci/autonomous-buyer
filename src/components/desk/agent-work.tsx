import { useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SponsorCredit } from "@/components/buy-hard/sponsor-credit";
import { approvalKey } from "@/lib/buy-review";
import { DraftPreview, saveLabels } from "./chat";
import { ApprovalPrompt, BuySentence, Decision, Fact, Sentence, units } from "./sentences";
import { BuyingRules, StockCount, type UpdateCount, type UpdateRules } from "./inventory";
import { OutLink } from "./primitives";
import {
  buyStatus,
  draftReady,
  errorText,
  isOpen,
  money,
  type Buy,
  type ChatRequest,
  type Item,
  type Snapshot,
  type Workspace,
} from "./model";
import type { AgentDraft, AgentFocus } from "./agent";
import { ReplenishmentControl, PurchasingProgress, OrderProgress } from "./automation";

export function AgentWork({
  focus,
  workspace,
  snapshot,
  task,
  comparison,
  save,
  begin,
  show,
  action,
  updateCount,
  updateRules,
  settings,
  audit,
  busy = false,
}: {
  focus: AgentFocus;
  workspace: Workspace;
  snapshot?: Snapshot;
  task?: AgentDraft;
  comparison?: ReactNode;
  save?: () => Promise<void>;
  begin: (request: ChatRequest) => void;
  show: (focus: AgentFocus) => void;
  action: (kind: string, buy?: Buy, item?: Item, reviewedKey?: string) => Promise<void>;
  updateCount: UpdateCount;
  updateRules: UpdateRules;
  settings?: ReactNode;
  audit?: ReactNode;
  busy?: boolean;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string>();
  const item = workspace.items.find((i) => i.id === focus.item);
  const buy = snapshot?.buys.find((b) => b.id === focus.buy || b.order?._id === focus.buy);
  const disabled = busy || pending;
  async function run(fn: () => Promise<void>) {
    setPending(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }
  const beginTask = (request: ChatRequest) => begin(request);
  const errorView = error && (
    <p className="desk-agent-error" role="alert">
      {error}
    </p>
  );
  if (task)
    return (
      <>
        {comparison}
        <DraftPreview draft={task.draft} task={task.task} />
        {!!task.credits?.length && (
          <div className="desk-agent-work-credits">
            {task.credits.map((sponsor) => (
              <SponsorCredit
                key={sponsor}
                sponsor={sponsor}
                prefix={sponsor === "firecrawl" ? "Sources via" : "Details prepared by"}
              />
            ))}
          </div>
        )}
        {save &&
          draftReady(task.task, task.draft) &&
          (!task.revision || !!task.reviewedDraftKey) && (
            <Button disabled={disabled} onClick={() => void run(save)}>
              {saveLabels[task.task]}
            </Button>
          )}
        {task.task === "new_buy" && !task.draft.itemId && (
          <div className="desk-agent-list">
            {workspace.items.map((i) => (
              <button
                key={i.id}
                type="button"
                disabled={disabled}
                onClick={() => beginTask({ task: "new_buy", contextId: i.id })}
              >
                {i.name}
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        )}
        {errorView}
      </>
    );
  if (focus.page === "settings")
    return (
      <>
        <Sentence>
          You’re buying for <Fact>{workspace.companyName}</Fact>.
        </Sentence>
        <Sentence>
          Deliver to <Fact>{workspace.shippingAddress}</Fact>.
        </Sentence>
        <Button disabled={disabled} onClick={() => beginTask({ task: "settings" })}>
          Edit company details
        </Button>
        {settings}
        {errorView}
      </>
    );
  if (focus.page === "audit") return <>{audit}</>;
  if (item)
    return (
      <>
        <Sentence>
          <Fact>{item.name}</Fact>
        </Sentence>
        <StockCount item={item} onSave={updateCount} />
        <ReplenishmentControl
          item={item}
          busy={disabled}
          onChange={(enabled) =>
            run(() =>
              action(enabled ? "enable_replenishment" : "pause_replenishment", undefined, item),
            )
          }
        />
        <div className="desk-answer-actions">
          <Button
            disabled={disabled}
            onClick={() => beginTask({ task: "edit_item", contextId: item.id })}
          >
            Update details
          </Button>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => beginTask({ task: "new_buy", contextId: item.id })}
          >
            Start a one-off buy
          </Button>
        </div>
        <BuyingRules
          item={item}
          onSave={updateRules}
          onChat={() => beginTask({ task: "edit_item", contextId: item.id })}
        />
        {item.buyUrl && <OutLink href={item.buyUrl}>Supplier page</OutLink>}
        <Decision
          question="Archive this item?"
          yes="Archive item"
          busy={disabled}
          confirm={{
            question: (
              <>
                Archive <Fact>{item.name}</Fact>?
              </>
            ),
            label: "Archive item",
          }}
          onYes={() =>
            run(async () => {
              await action("archive", undefined, item);
              show({ page: "inventory" });
            })
          }
        />
        {errorView}
      </>
    );
  if (buy)
    return (
      <>
        <BuySentence buy={buy} />
        {buy.order && (
          <Sentence>
            Deliver to <Fact>{buy.order.shipTo}</Fact>.
          </Sentence>
        )}
        {!buy.order && isOpen(buy) && !buy.automatic && !buy.purchasingState && (
          <Button disabled={disabled} onClick={() => beginTask({ task: "buy", contextId: buy.id })}>
            Find buying options
          </Button>
        )}
        {(!buy.order || (buy.order.reviewRequired && buy.order.orderingMethod !== "website")) &&
          isOpen(buy) && (
            <PurchasingProgress
              buy={buy}
              busy={disabled}
              onRetry={() => run(() => action("retry_research", buy))}
              onHelp={() => beginTask({ task: "buy", contextId: buy.id })}
            />
          )}
        {buy.order?.status === "draft" && !buy.order.reviewRequired && (
          <ApprovalPrompt
            key={approvalKey(buy.order)}
            buy={buy}
            busy={disabled}
            onYes={() => run(() => action("approve", buy, undefined, approvalKey(buy.order!)))}
            onNo={() => beginTask({ task: "buy", contextId: buy.id, revision: true })}
          />
        )}
        {buy.order?.reviewRequired &&
          !buy.automatic &&
          !buy.purchasingState &&
          buy.order.orderingMethod !== "website" && (
            <>
              <Sentence>Price and delivery need to be checked again.</Sentence>
              <Button
                disabled={disabled}
                onClick={() => beginTask({ task: "buy", contextId: buy.id })}
              >
                Continue checking
              </Button>
            </>
          )}
        <OrderProgress
          buy={buy}
          busy={disabled}
          onCheck={() => run(() => action("check_order", buy))}
          onHelp={() => run(() => action("resolve_order", buy))}
        />
        {(buy.order?.status === "approved" || buy.order?.status === "sent") && (
          <details className="desk-disclosure">
            <summary>Have a confirmation from elsewhere?</summary>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => beginTask({ task: "confirm", contextId: buy.id })}
            >
              Add supplier confirmation
            </Button>
          </details>
        )}
        {(buy.order?.status === "placed" || buy.order?.status === "part_received") && (
          <Decision
            question={
              <>
                Did all{" "}
                <Fact>{units(buy.order.quantity - buy.order.receivedQuantity, buy.unit)}</Fact>{" "}
                arrive?
              </>
            }
            yes="Received all"
            busy={disabled}
            onYes={() => run(() => action("receive", buy))}
            onNo={() => beginTask({ task: "receive", contextId: buy.id })}
          />
        )}
        {isOpen(buy) && (!buy.order || buy.order.status === "draft") && (
          <Decision
            question="Cancel this buy?"
            yes="Cancel buy"
            busy={disabled}
            confirm={{
              question: (
                <>
                  Cancel the buy for <Fact>{buy.name}</Fact>?
                </>
              ),
              label: "Cancel buy",
            }}
            onYes={() => run(() => action("cancel", buy))}
          />
        )}
        {buy.order &&
          ["sent", "placed", "part_received"].includes(buy.order.status) &&
          !buy.order.cancellationRequestedAt && (
            <Decision
              question="Need to stop this order?"
              yes="Request cancellation"
              busy={disabled}
              confirm={{
                question: "Ask the supplier to cancel the remaining delivery?",
                label: "Send cancellation request",
              }}
              onYes={() => run(() => action("request_cancellation", buy))}
            />
          )}
        {buy.order?.cancellationRequestedAt && (
          <Sentence>Cancellation requested. Waiting for the supplier’s confirmation.</Sentence>
        )}
        {buy.order && (
          <details className="desk-disclosure">
            <summary>Purchase details</summary>
            {buy.order.reviewRequired ? (
              <Sentence>Final price and delivery are being checked.</Sentence>
            ) : (
              <Sentence>
                {buy.order.number}: <Fact>{money(buy.order.totalCents, buy.order.currency)}</Fact>,
                including <Fact>{money(buy.order.freightCents, buy.order.currency)}</Fact> shipping
                and <Fact>{money(buy.order.taxCents, buy.order.currency)}</Fact> tax.
              </Sentence>
            )}
            {buy.order.notes && <Sentence>{buy.order.notes}</Sentence>}
            {buy.order.supplierSku && (
              <Sentence>
                Supplier product code: <Fact>{buy.order.supplierSku}</Fact>.
              </Sentence>
            )}
            {buy.order.sourceUrl && <OutLink href={buy.order.sourceUrl}>Supplier source</OutLink>}
            {["sent", "placed", "part_received"].includes(buy.order.status) && (
              <Decision
                question="Has the supplier already cancelled the remaining delivery?"
                yes="Record supplier cancellation"
                busy={disabled}
                confirm={{
                  question:
                    "Confirm the supplier has cancelled the remaining delivery. This updates your records; it does not ask the supplier to cancel.",
                  label: "Record confirmed cancellation",
                }}
                onYes={() => run(() => action("record_cancellation", buy))}
              />
            )}
          </details>
        )}
        {errorView}
      </>
    );
  if (focus.page === "inventory")
    return (
      <div className="desk-agent-list">
        {workspace.items.map((i) => (
          <button type="button" key={i.id} onClick={() => show({ page: "inventory", item: i.id })}>
            <span>
              {i.name}
              <small>
                {i.quantity === null ? "Count not yet known" : `${i.quantity} ${i.unit} on hand`}
              </small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
        {!workspace.items.length && <Sentence>Add your first item to get started.</Sentence>}
      </div>
    );
  return (
    <div className="desk-agent-list">
      {snapshot?.buys.filter(isOpen).map((b) => (
        <button type="button" key={b.id} onClick={() => show({ page: "buys", buy: b.id })}>
          <span>
            {b.name}
            <small>{buyStatus(b)}</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
      ))}
      {snapshot && !snapshot.buys.some(isOpen) && (
        <Sentence>No open buys. Tell me what you need.</Sentence>
      )}
      {!snapshot && <Sentence>Loading buys…</Sentence>}
    </div>
  );
}
