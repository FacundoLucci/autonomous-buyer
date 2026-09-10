import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { dateLabel, money, type Buy } from "./model";
export function Fact({ children }: { children: ReactNode }) {
  return <strong className="desk-fact">{children}</strong>;
}
export function Sentence({ children, large = false }: { children: ReactNode; large?: boolean }) {
  return <p className={`desk-sentence${large ? " desk-sentence-large" : ""}`}>{children}</p>;
}
export function units(count: number, unit: string) {
  return `${count} ${count === 1 && /^(cases|rolls|units)$/.test(unit) ? unit.slice(0, -1) : unit}`;
}
export function BuySentence({ buy, large = false }: { buy: Buy; large?: boolean }) {
  const order = buy.order,
    count = order?.requestedQuantity ?? order?.quantity ?? buy.quantity;
  const arrival = order?.expectedOn ?? (!order?.reviewRequired ? order?.quotedArrival : undefined);
  return (
    <Sentence large={large}>
      {count !== null ? (
        <>
          <Fact>{units(count, buy.unit)}</Fact> of{" "}
        </>
      ) : (
        "You’re buying "
      )}
      <Fact>{buy.name}</Fact>
      {order?.supplier && (
        <>
          {" "}
          from <Fact>{order.supplier}</Fact>
        </>
      )}
      {order?.status === "received" ? (
        " have arrived."
      ) : order?.status === "cancelled" || buy.closed ? (
        ". This buy was cancelled."
      ) : arrival ? (
        <>
          {" "}
          are expected by <Fact>{dateLabel(arrival)}</Fact>.
        </>
      ) : buy.requiredBy || order?.requiredBy ? (
        <>
          , needed by <Fact>{dateLabel(order?.requiredBy ?? buy.requiredBy)}</Fact>.
        </>
      ) : (
        "."
      )}
    </Sentence>
  );
}
export function Decision({
  question,
  yes = "Yes",
  onYes,
  onNo,
  busy = false,
  confirm,
}: {
  question: ReactNode;
  yes?: string;
  onYes: () => void | Promise<void>;
  onNo?: () => void;
  busy?: boolean;
  confirm?: { question: ReactNode; label: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="desk-decision">
      <Sentence>{question}</Sentence>
      <div className="desk-answer-actions">
        <Button disabled={busy} onClick={() => (confirm ? setOpen(true) : void onYes())}>
          {yes}
        </Button>
        {onNo && (
          <Button variant="outline" disabled={busy} onClick={onNo}>
            No, because…
          </Button>
        )}
      </div>
      {confirm && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent className="desk-confirm">
            <AlertDialogTitle>Confirm approval</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              <Sentence>{confirm.question}</Sentence>
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
              <Button
                disabled={busy}
                onClick={async () => {
                  await onYes();
                  setOpen(false);
                }}
              >
                {confirm.label}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}
export function ApprovalPrompt({
  buy,
  busy,
  onYes,
  onNo,
}: {
  buy: Buy;
  busy: boolean;
  onYes: () => void | Promise<void>;
  onNo: () => void;
}) {
  const order = buy.order!;
  return (
    <Decision
      busy={busy}
      question={
        <>
          Do you approve buying for <Fact>{money(order.totalCents, order.currency)}</Fact>?
        </>
      }
      onYes={onYes}
      onNo={onNo}
      yes="Approve and order"
      confirm={{
        question: (
          <>
            Approve <Fact>{units(order.quantity, buy.unit)}</Fact> from{" "}
            <Fact>{order.supplier}</Fact> for <Fact>{money(order.totalCents, order.currency)}</Fact>
            , including shipping and tax
            {order.quotedArrival && (
              <>
                , expected by <Fact>{dateLabel(order.quotedArrival)}</Fact>
              </>
            )}
            ?
          </>
        ),
        label: `Approve and order for ${money(order.totalCents, order.currency)}`,
      }}
    />
  );
}
