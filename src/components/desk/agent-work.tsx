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
            Buy more
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
        {!buy.order && isOpen(buy) && (
          <Button disabled={disabled} onClick={() => beginTask({ task: "buy", contextId: buy.id })}>
            Find buying options
          </Button>
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
        {buy.order?.reviewRequired && (
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
        {buy.order?.status === "approved" && (
          <>
            <Sentence>
              You approved <Fact>{money(buy.order.totalCents, buy.order.currency)}</Fact>.
            </Sentence>
            <div className="desk-answer-actions">
              {buy.order.buyUrl && <OutLink href={buy.order.buyUrl}>Order from supplier</OutLink>}
              {buy.order.supplierEmail && (
                <Button disabled={disabled} onClick={() => void run(() => action("send", buy))}>
                  Send purchase order
                </Button>
              )}
            </div>
          </>
        )}
        {(buy.order?.status === "approved" || buy.order?.status === "sent") && (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => beginTask({ task: "confirm", contextId: buy.id })}
          >
            Add supplier confirmation
          </Button>
        )}
        {buy.order?.status === "sending" && <Sentence>Your purchase order is being sent.</Sentence>}
        {buy.order?.status === "send_failed" && (
          <Button disabled={disabled} onClick={() => void run(() => action("check_delivery", buy))}>
            Check email delivery
          </Button>
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
        {isOpen(buy) && !buy.order && (
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
        {buy.order && (
          <details className="desk-disclosure">
            <summary>Purchase details</summary>
            <Sentence>
              {buy.order.number}: <Fact>{money(buy.order.totalCents, buy.order.currency)}</Fact>,
              including <Fact>{money(buy.order.freightCents, buy.order.currency)}</Fact> shipping
              and <Fact>{money(buy.order.taxCents, buy.order.currency)}</Fact> tax.
            </Sentence>
            {buy.order.notes && <Sentence>{buy.order.notes}</Sentence>}
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
