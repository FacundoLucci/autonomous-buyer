import { useState, type FormEvent } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { setupError } from "./setup";

type Item = NonNullable<FunctionReturnType<typeof api.onboarding.getWorkspace>>["items"][number];
export const orderLabels: Record<Doc<"companyOrders">["status"], string> = {
  draft: "Needs approval",
  approved: "Ready to order",
  sending: "Sending purchase order",
  sent: "Awaiting supplier",
  placed: "On order",
  part_received: "Partly received",
  received: "Received",
  cancelled: "Cancelled",
  send_failed: "Check email delivery",
};
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
function minor(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Enter prices with up to two decimal places.");
  return Math.round(Number(text) * 100);
}
export function BuyingLinks({
  item,
  onBuy,
  hasOpenOrder,
}: {
  item: Item;
  onBuy: () => void;
  hasOpenOrder: boolean;
}) {
  const save = useMutation(api.companyInventory.updateBuying);
  const archive = useMutation(api.companyInventory.archiveItem);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await save({
        itemId: item.id,
        buyUrl: String(data.get("url")),
        supplierEmail: String(data.get("email")),
        coverageDays: Number(data.get("coverage")),
      });
      setMessage("Buying details saved.");
    } catch (cause) {
      setMessage(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function archiveItem() {
    setBusy(true);
    setMessage("");
    try {
      await archive({ itemId: item.id, archived: true });
    } catch (cause) {
      setMessage(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="company-buying-links">
      <div className="company-button-row">
        {item.buyUrl ? (
          <a href={item.buyUrl} target="_blank" rel="noreferrer">
            Buy from supplier ↗
          </a>
        ) : null}
        <button
          className="company-primary"
          disabled={!hasOpenOrder && !item.buyUrl && !item.supplierEmail}
          onClick={onBuy}
        >
          {hasOpenOrder ? "View open order" : "Prepare purchase"}
        </button>
      </div>
      <details>
        <summary>
          {item.buyUrl || item.supplierEmail
            ? "Edit buy link & supplier email"
            : "Add buy link or supplier email"}
        </summary>
        <form
          key={`${item.buyUrl}|${item.supplierEmail}|${item.coverageDays}`}
          className="company-form"
          onSubmit={update}
        >
          <label>
            Buy link
            <input
              name="url"
              type="url"
              defaultValue={item.buyUrl ?? ""}
              placeholder="https://supplier.com/product"
              maxLength={2000}
            />
          </label>
          <label>
            Supplier order email
            <input
              name="email"
              type="email"
              defaultValue={item.supplierEmail ?? ""}
              placeholder="orders@supplier.com"
              maxLength={254}
            />
          </label>
          <label>
            Days of stock to buy
            <input
              name="coverage"
              type="number"
              min={1}
              max={365}
              step={1}
              defaultValue={item.coverageDays}
              required
            />
          </label>
          <p>
            Order quantities and prices use your stock unit: <strong>{item.unit}</strong>. Confirm
            the supplier’s pack size before purchasing.
          </p>
          <button disabled={busy}>Save buying details</button>
          <button type="button" disabled={busy || hasOpenOrder} onClick={() => void archiveItem()}>
            Archive item
          </button>
          <p>Archived items keep their purchase records. Restore them from Add items & files.</p>
          <output>{message}</output>
        </form>
      </details>
    </div>
  );
}

export function PurchaseForm({
  item,
  onDone,
  onCancel,
  draft,
}: {
  item: Pick<
    Item,
    | "id"
    | "name"
    | "unit"
    | "buyUrl"
    | "dailyUsage"
    | "coverageDays"
    | "estimatedQuantity"
    | "leadTimeDays"
  >;
  onDone: (id: Id<"companyOrders">) => void;
  onCancel: () => void;
  draft?: Doc<"companyOrders">;
}) {
  const create = useMutation(api.companyOrders.create);
  const update = useMutation(api.companyOrders.updateDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const suggested = Math.max(
    1,
    Math.ceil((item.dailyUsage ?? 0) * item.coverageDays - (item.estimatedQuantity ?? 0)),
  );
  const [date] = useState(() =>
    new Date(Date.now() + Math.max(1, item.leadTimeDays ?? 7) * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const terms = {
        quantity: Number(data.get("quantity")),
        unitPriceCents: minor(data.get("price")),
        freightCents: minor(data.get("freight")),
        taxCents: minor(data.get("tax")),
        currency: String(data.get("currency")),
        requiredBy: String(data.get("requiredBy")),
        notes: String(data.get("notes")),
      };
      onDone(
        draft
          ? await update({ orderId: draft._id, ...terms })
          : await create({ itemId: item.id, ...terms }),
      );
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="company-tools bh-eink bh-cutout" aria-label="Prepare purchase">
      <div className="company-inventory-intro">
        <h2>
          {draft ? "Edit purchase" : "Prepare purchase"} · {item.name}
        </h2>
        <p>
          Enter the current supplier price, including delivery and tax. You will review the full
          order before approving it.
        </p>
        {item.buyUrl ? (
          <a href={item.buyUrl} target="_blank" rel="noreferrer">
            Check supplier price ↗
          </a>
        ) : null}
      </div>
      <form className="company-form company-tool-body" onSubmit={submit}>
        <div className="company-form-row">
          <label>
            Quantity / {item.unit}
            <input
              name="quantity"
              type="number"
              min={["kg", "liters"].includes(item.unit) ? 0.001 : 1}
              max={1_000_000_000}
              step={["kg", "liters"].includes(item.unit) ? "any" : 1}
              defaultValue={draft?.quantity ?? suggested}
              required
            />
          </label>
          <label>
            Price per {item.unit}
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={draft ? (draft.unitPriceCents / 100).toFixed(2) : undefined}
              required
            />
          </label>
        </div>
        <div className="company-form-row">
          <label>
            Delivery cost
            <input
              name="freight"
              type="number"
              min={0}
              step="0.01"
              defaultValue={((draft?.freightCents ?? 0) / 100).toFixed(2)}
              required
            />
          </label>
          <label>
            Tax
            <input
              name="tax"
              type="number"
              min={0}
              step="0.01"
              defaultValue={((draft?.taxCents ?? 0) / 100).toFixed(2)}
              required
            />
          </label>
        </div>
        <div className="company-form-row">
          <label>
            Currency
            <select name="currency" defaultValue={draft?.currency ?? "USD"}>
              {["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "MXN", "ARS"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Needed by
            <input
              name="requiredBy"
              type="date"
              defaultValue={draft?.requiredBy ?? date}
              required
            />
          </label>
        </div>
        <label>
          Order notes
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={draft?.notes}
            placeholder="Delivery instructions, product variant, agreed terms…"
          />
        </label>
        <div className="company-button-row">
          <button className="company-primary" disabled={busy}>
            {busy ? "Saving…" : draft ? "Save draft changes" : "Review purchase"}
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
        <p role="alert" className="company-error">
          {error}
        </p>
      </form>
    </section>
  );
}

export function CompanyOrderDesk({
  orders,
  selectedId,
  onSelect,
}: {
  orders: Doc<"companyOrders">[] | undefined;
  selectedId: string | null;
  onSelect: (id: Id<"companyOrders">) => void;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const history = usePaginatedQuery(api.companyOrders.history, showClosed ? {} : "skip", {
    initialNumItems: 20,
  });
  const open = orders?.filter((o) => o.isOpen) ?? [];
  const visible = showClosed ? history.results : open;
  const selected = useQuery(api.companyOrders.get, selectedId ? { orderId: selectedId } : "skip");
  return (
    <section className="company-tools bh-eink bh-cutout" aria-label="Purchases" id="company-orders">
      <div className="company-inventory-intro">
        <h2>Purchases</h2>
        <p>Review, order, and receive your company’s supplies.</p>
        <div className="company-button-row">
          <button aria-pressed={!showClosed} onClick={() => setShowClosed(false)}>
            Open ({open.length})
          </button>
          <button aria-pressed={showClosed} onClick={() => setShowClosed(true)}>
            Completed purchases
          </button>
        </div>
      </div>
      {orders === undefined || (showClosed && history.status === "LoadingFirstPage") ? (
        <p className="company-tool-body">Loading purchases…</p>
      ) : visible.length === 0 ? (
        <p className="company-tool-body">
          {showClosed
            ? "No completed purchases yet."
            : "No open purchases. Choose Prepare purchase beside an inventory item."}
        </p>
      ) : (
        <div className="company-order-list">
          {visible.map((order) => (
            <button
              key={order._id}
              aria-label={`${order.number}: ${order.itemName}`}
              aria-pressed={selectedId === order._id}
              onClick={() => onSelect(order._id)}
            >
              <span>
                <small>{order.number}</small>
                <strong>{order.itemName}</strong>
                <small>
                  {order.quantity} {order.unit} · {order.supplier}
                </small>
              </span>
              <span>
                <strong>{money(order.totalCents, order.currency)}</strong>
                <small>{orderLabels[order.status]}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      {showClosed && (history.status === "CanLoadMore" || history.status === "LoadingMore") ? (
        <button disabled={history.status === "LoadingMore"} onClick={() => history.loadMore(20)}>
          Load older purchases
        </button>
      ) : null}
      {selectedId && selected === null ? (
        <p className="company-tool-body">Purchase not found in your company.</p>
      ) : null}
      {selected ? <OrderDetail key={selected._id} order={selected} /> : null}
    </section>
  );
}

function OrderDetail({ order }: { order: Doc<"companyOrders"> }) {
  const approve = useMutation(api.companyOrders.approve),
    place = useMutation(api.companyOrders.place),
    receive = useMutation(api.companyOrders.receive),
    cancel = useMutation(api.companyOrders.cancel),
    send = useMutation(api.companyOrders.send),
    check = useMutation(api.companyOrders.checkDelivery);
  const events = useQuery(api.companyOrders.events, { orderId: order._id });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [editing, setEditing] = useState(false);
  async function run(job: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(() =>
      place({
        orderId: order._id,
        confirmation: String(data.get("confirmation")),
        expectedOn: String(data.get("expectedOn")),
      }),
    );
  }
  function receiveItems(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      await receive({ orderId: order._id, quantity: Number(data.get("quantity")), requestKey });
      setRequestKey(crypto.randomUUID());
    });
  }
  function cancelOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(() => cancel({ orderId: order._id, note: String(data.get("note")) }));
  }
  function download() {
    const text = [
      `BUY HARD · ${order.number}`,
      orderLabels[order.status],
      `${order.itemName} (${order.sku})`,
      `${order.quantity} ${order.unit} × ${money(order.unitPriceCents, order.currency)}`,
      `Delivery ${money(order.freightCents, order.currency)} · Tax ${money(order.taxCents, order.currency)}`,
      `Total ${money(order.totalCents, order.currency)}`,
      `Supplier: ${order.supplier}`,
      `Deliver to: ${order.shipTo}`,
      `Required by: ${order.requiredBy}`,
      order.notes,
      order.confirmation ? `Supplier confirmation: ${order.confirmation}` : "",
      `Received: ${order.receivedQuantity} ${order.unit}`,
      ...(events ?? [])
        .slice()
        .reverse()
        .map((e) => `${new Date(e.createdAt).toISOString()} ${e.summary}`),
    ]
      .filter(Boolean)
      .join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order.number}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (editing && order.status === "draft")
    return (
      <PurchaseForm
        item={{
          id: order.inventoryItemId,
          name: order.itemName,
          unit: order.unit,
          buyUrl: order.buyUrl ?? null,
          dailyUsage: null,
          coverageDays: 30,
          estimatedQuantity: null,
          leadTimeDays: null,
        }}
        draft={order}
        onCancel={() => setEditing(false)}
        onDone={() => setEditing(false)}
      />
    );
  return (
    <article className="company-order-detail">
      <div className="company-item-heading">
        <div>
          <p>{order.number}</p>
          <h3>{order.itemName}</h3>
        </div>
        <span className="company-stock-status">{orderLabels[order.status]}</span>
      </div>
      <dl className="company-order-terms">
        <div>
          <dt>Supplier</dt>
          <dd>
            {order.supplier}
            {order.supplierEmail ? ` · ${order.supplierEmail}` : ""}
          </dd>
        </div>
        <div>
          <dt>Quantity</dt>
          <dd>
            {order.quantity} {order.unit} at {money(order.unitPriceCents, order.currency)} each
          </dd>
        </div>
        <div>
          <dt>Delivery / tax</dt>
          <dd>
            {money(order.freightCents, order.currency)} / {money(order.taxCents, order.currency)}
          </dd>
        </div>
        <div>
          <dt>Total to approve</dt>
          <dd>
            <strong>{money(order.totalCents, order.currency)}</strong>
          </dd>
        </div>
        <div>
          <dt>Deliver to</dt>
          <dd>{order.shipTo}</dd>
        </div>
        <div>
          <dt>Needed by</dt>
          <dd>{order.requiredBy}</dd>
        </div>
      </dl>
      {order.notes ? <p className="company-preserve-lines">{order.notes}</p> : null}
      {order.status === "draft" ? (
        <>
          <p>Review the quantity, unit, total, and delivery address. Approval saves these terms.</p>
          <button disabled={busy} onClick={() => setEditing(true)}>
            Edit draft
          </button>
          <button
            className="company-primary"
            disabled={busy}
            onClick={() => void run(() => approve({ orderId: order._id }))}
          >
            Approve {money(order.totalCents, order.currency)}
          </button>
        </>
      ) : null}
      {order.status === "approved" ? (
        <div className="company-order-next">
          <h4>Place the order</h4>
          {order.buyUrl ? (
            <>
              <a className="company-primary" href={order.buyUrl} target="_blank" rel="noreferrer">
                Open supplier checkout ↗
              </a>
              <p>
                Complete payment or checkout with the supplier, then record their confirmation
                below. Opening this link does not place an order.
              </p>
            </>
          ) : null}
          {order.supplierEmail ? (
            <>
              <button disabled={busy} onClick={() => void run(() => send({ orderId: order._id }))}>
                Send approved PO to {order.supplierEmail}
              </button>
              <p>This sends the purchase order above from your company’s purchasing inbox.</p>
            </>
          ) : null}
        </div>
      ) : null}
      {order.status === "sending" ? (
        <output>
          Sending the approved purchase order. This updates when the email provider responds.
        </output>
      ) : null}
      {order.status === "send_failed" ? (
        <>
          <p role="alert">{order.error}</p>
          <button disabled={busy} onClick={() => void run(() => check({ orderId: order._id }))}>
            Check delivery again
          </button>
        </>
      ) : null}
      {order.status === "approved" || order.status === "sent" ? (
        <form className="company-form" onSubmit={record}>
          <h4>Record supplier confirmation</h4>
          <p>
            Confirm the supplier accepted the approved quantity and total. If terms changed, cancel
            this draft and prepare the corrected purchase.
          </p>
          <label>
            Supplier order number / confirmation
            <input name="confirmation" required maxLength={200} />
          </label>
          <label>
            Expected delivery
            <input name="expectedOn" type="date" required defaultValue={order.requiredBy} />
          </label>
          <button disabled={busy} className="company-primary">
            Confirm order placed
          </button>
        </form>
      ) : null}
      {order.status === "placed" || order.status === "part_received" ? (
        <form className="company-form" key={order.receivedQuantity} onSubmit={receiveItems}>
          <h4>Receive delivery</h4>
          <p>
            {order.confirmation} · expected {order.expectedOn}. Received {order.receivedQuantity} of{" "}
            {order.quantity} {order.unit}.
          </p>
          <label>
            Quantity arriving now / {order.unit}
            <input
              name="quantity"
              type="number"
              min={["kg", "liters"].includes(order.unit) ? 0.001 : 1}
              max={order.quantity - order.receivedQuantity}
              step={["kg", "liters"].includes(order.unit) ? "any" : 1}
              defaultValue={order.quantity - order.receivedQuantity}
              required
            />
          </label>
          <button disabled={busy} className="company-primary">
            Receive into stock
          </button>
        </form>
      ) : null}
      {order.isOpen && order.status !== "sending" ? (
        <details>
          <summary>Cancel remaining quantity</summary>
          <form className="company-form" onSubmit={cancelOrder}>
            <p>
              This closes the remaining quantity in BUY HARD. For orders already sent or placed,
              arrange cancellation with your supplier first.
            </p>
            <label>
              Reason / supplier cancellation confirmation
              <textarea name="note" required maxLength={500} />
            </label>
            <button disabled={busy}>Record cancellation</button>
          </form>
        </details>
      ) : null}
      <p role="alert" className="company-error">
        {error}
      </p>
      <div className="company-button-row">
        <button onClick={download}>Download order record</button>
        <a href={`/?companyOrder=${order._id}`}>Open saved order link ↗</a>
      </div>
      <details>
        <summary>Order activity ({events?.length ?? 0})</summary>
        <ol className="company-activity">
          {events?.map((event) => (
            <li key={event._id}>
              <time>{new Date(event.createdAt).toLocaleString()}</time>
              <p>{event.summary}</p>
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}
