import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Mail, Package, Pencil, ShieldCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { HardwareMetric, HardwareMetricRack } from "./hardware-metric";
import { stockOutlook } from "@/lib/setup-fields";
import { setupError } from "./setup";
import "./company-workspace.css";

type Workspace = NonNullable<ReturnType<typeof useQuery<typeof api.onboarding.getWorkspace>>>;

export function CompanyWorkspace({ workspace }: { workspace: Workspace }) {
  const { signOut } = useAuthActions();
  const needsAction = workspace.items.filter(
    (item) =>
      stockOutlook(item.quantity, item.dailyUsage, item.leadTimeDays, item.safetyStockDays)
        .needsAction,
  ).length;
  return (
    <main className="bh-app powder-coat">
      <header className="bh-app-bar buy-desk-app-bar">
        <a className="buy-desk-brand" href="/" aria-label="BUY HARD home">
          <span className="bh-stamped">BUY HARD</span>
        </a>
        <div className="buy-desk-account-actions">
          <span className="bh-face-caption">YOUR WORKSPACE</span>
          <button className="company-sign-out" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <div className="buy-desk-body">
        <div className="buy-desk-company-row">
          <h1 className="bh-face-title screen-print">{workspace.companyName}</h1>
          <p className="bh-face-caption screen-print">YOUR BUY DESK · PRIVATE</p>
        </div>
        <HardwareMetricRack>
          <HardwareMetric label="Needs action" value={needsAction} />
          <HardwareMetric label="Inventory items" value={workspace.items.length} />
          <HardwareMetric label="Open buys" value={0} />
          <HardwareMetric label="Purchasing inbox" value={workspace.inbox ? 1 : 0} />
        </HardwareMetricRack>
        <div className="company-desk-grid">
          <section>
            <div className="bh-face-label screen-print">
              <h2>
                <Package /> INVENTORY
              </h2>
              <span>
                {workspace.items.length} ITEM{workspace.items.length === 1 ? "" : "S"}
              </span>
            </div>
            <div className="bh-eink bh-cutout company-inventory">
              <div className="company-inventory-intro">
                <h2>Your first essential. Accounted for.</h2>
                <p>Coverage and reorder points use the estimates you entered.</p>
              </div>
              {workspace.items.map((item) => (
                <InventoryItem key={item.id} item={item} />
              ))}
            </div>
          </section>
          <aside className="company-desk-aside">
            <div className="bh-face-label screen-print">
              <h2>
                <Mail /> PURCHASING EMAIL
              </h2>
            </div>
            <div className="bh-eink bh-cutout company-inbox">
              <Mail strokeWidth={1} />
              <h2>{workspace.inbox ? "An address of your own." : "One last connection."}</h2>
              {workspace.inbox ? (
                <p className="company-inbox-address">{workspace.inbox.email}</p>
              ) : (
                <>
                  <p>Create your dedicated address for supplier quotes and order confirmations.</p>
                  <a href="/setup">
                    Connect purchasing inbox <ArrowRight />
                  </a>
                </>
              )}
              <p className="company-inbox-note">
                {workspace.inbox
                  ? "Your company’s dedicated purchasing address."
                  : "Your company and inventory are already saved."}
              </p>
            </div>
            <div className="company-delivery screen-print">
              <span className="bh-face-caption">DELIVER TO</span>
              <p>{workspace.shippingAddress}</p>
            </div>
          </aside>
        </div>
        <div className="bh-eink bh-cutout company-next-step">
          <ShieldCheck />
          <div>
            <h2>You keep the final say.</h2>
            <p>
              Your inventory setup is ready. Supplier sourcing and automated purchasing for company
              workspaces are not connected yet.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function InventoryItem({ item }: { item: Workspace["items"][number] }) {
  const updateStock = useMutation(api.onboarding.updateStock);
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outlook = stockOutlook(
    item.quantity,
    item.dailyUsage,
    item.leadTimeDays,
    item.safetyStockDays,
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!quantity.trim() || !Number.isFinite(Number(quantity)) || Number(quantity) < 0) {
      setError("Enter a valid stock count.");
      return;
    }
    setBusy(true);
    try {
      await updateStock({ itemId: item.id, quantity: Number(quantity) });
      setEditing(false);
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="company-item">
      <div className="company-item-heading">
        <div>
          <p>{item.sku}</p>
          <h3>{item.name}</h3>
        </div>
        <span className="company-stock-status" data-action={outlook.needsAction}>
          {outlook.needsAction ? "Reorder point reached" : "Stock recorded"}
        </span>
      </div>
      <div className="company-stock-grid">
        <div>
          <span>ON HAND</span>
          <strong>
            {item.quantity.toLocaleString()} <small>{item.unit}</small>
          </strong>
        </div>
        <div>
          <span>DAILY USE / EST.</span>
          <strong>
            {item.dailyUsage.toLocaleString()} <small>{item.unit}</small>
          </strong>
        </div>
        <div>
          <span>COVERAGE / EST.</span>
          <strong>
            {outlook.daysLeft === null ? "—" : Math.round(outlook.daysLeft * 10) / 10}{" "}
            <small>days</small>
          </strong>
        </div>
      </div>
      <p className="company-reorder-note">
        {outlook.daysLeft === null
          ? "Add a daily usage estimate to calculate a reorder point."
          : `Reorder at ${Math.ceil(outlook.reorderAt).toLocaleString()} ${item.unit} · ${item.leadTimeDays} days to deliver + ${item.safetyStockDays} days in reserve.`}
      </p>
      {editing ? (
        <form onSubmit={save} className="company-stock-form">
          <label htmlFor={`stock-${item.id}`}>Current stock</label>
          <input
            id={`stock-${item.id}`}
            type="number"
            min={0}
            max={1_000_000_000}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={busy}
            required
          />
          <button disabled={busy}>
            <Check />
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </button>
          <p role="alert">{error}</p>
        </form>
      ) : (
        <button
          className="company-edit-stock"
          onClick={() => {
            setQuantity(String(item.quantity));
            setEditing(true);
          }}
        >
          <Pencil /> Update stock count
        </button>
      )}
    </article>
  );
}
