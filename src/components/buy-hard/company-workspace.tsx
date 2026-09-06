import { useAuthActions } from "@/lib/buyer-auth";
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
                <h2>Your first essential. Taking shape.</h2>
                <p>Your sources supply the buying details. Your team fills the gaps.</p>
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
        <section className="company-agent-support" aria-label="Support your buyer">
          <div className="bh-face-label screen-print">
            <h2>NEEDS YOUR INPUT</h2>
            <span>HELP YOUR BUYER FILL THE GAPS</span>
          </div>
          <div className="bh-eink bh-cutout company-inventory">
            <div className="company-inventory-intro">
              <h2>A little help goes a long way.</h2>
              <p>Only the details your buyer couldn’t confirm. Your answers stay with the item.</p>
            </div>
            {workspace.items.map((item) => (
              <AgentSupport key={item.id} item={item} />
            ))}
          </div>
        </section>
        <div className="bh-eink bh-cutout company-next-step">
          <ShieldCheck />
          <div>
            <h2>You keep the final say.</h2>
            <p>
              Your product sources and inventory are saved. Automated supplier outreach and
              purchasing for company workspaces are not connected yet.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function focusEditor(node: HTMLInputElement | null) {
  node?.focus({ preventScroll: true });
}

function InventoryItem({ item }: { item: Workspace["items"][number] }) {
  const updateStock = useMutation(api.onboarding.updateStock);
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity === null ? "" : String(item.quantity));
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
          {outlook.needsAction
            ? "Reorder point reached"
            : item.quantity === null
              ? "Stock not counted"
              : "Stock recorded"}
        </span>
      </div>
      <div className="company-stock-grid">
        <div>
          <span>ON HAND</span>
          <strong>
            {item.quantity?.toLocaleString() ?? "—"} <small>{item.unit}</small>
          </strong>
        </div>
        <div>
          <span>DAILY USE / EST.</span>
          <strong>
            {item.dailyUsage?.toLocaleString() ?? "—"} <small>{item.unit}</small>
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
        {item.dailyUsage === 0
          ? "Daily usage is zero. Update the estimate below when this item is in use."
          : outlook.reorderAt === null
            ? "Fill the remaining gaps below to calculate a reorder point."
            : `Reorder at ${Math.ceil(outlook.reorderAt).toLocaleString()} ${item.unit} · ${item.leadTimeDays} days to deliver + ${item.safetyStockDays} days in reserve.`}
      </p>
      {editing ? (
        <form onSubmit={save} className="company-stock-form">
          <label htmlFor={`stock-${item.id}`}>Current stock</label>
          <input
            id={`stock-${item.id}`}
            ref={focusEditor}
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
            setQuantity(item.quantity === null ? "" : String(item.quantity));
            setEditing(true);
          }}
        >
          <Pencil /> Update stock count
        </button>
      )}
    </article>
  );
}

function AgentSupport({ item }: { item: Workspace["items"][number] }) {
  const fillGap = useMutation(api.onboarding.fillGap);
  const gaps = [
    ...(!item.supplier
      ? [
          {
            field: "supplier" as const,
            label: "Where do you buy this?",
            hint: "The seller wasn’t clear in the source.",
          },
        ]
      : []),
    ...(item.leadTimeDays === null
      ? [
          {
            field: "leadTimeDays" as const,
            label: "How many days from order to delivery?",
            hint: "No clear delivery time was found. Confirm with your supplier or use your order history.",
          },
        ]
      : []),
    ...(item.dailyUsage === null
      ? [
          {
            field: "dailyUsage" as const,
            label: "How much do you use per day?",
            hint: `Your current estimate in ${item.unit}. A supplier page can’t tell us this.`,
          },
        ]
      : []),
  ];
  const [active, setActive] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(
    event: FormEvent,
    field: "supplier" | "leadTimeDays" | "dailyUsage" | "safetyStockDays",
  ) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fillGap({ itemId: item.id, field, value });
      setActive(null);
      setValue("");
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="company-item company-support-item">
      <h3>{item.name}</h3>
      <p className="company-source-note">
        {item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            View product source ↗
          </a>
        ) : item.sourceLabel ? (
          `From invoice: ${item.sourceLabel}`
        ) : (
          "Added by your team"
        )}
        {item.supplier ? ` · ${item.supplier}` : ""}
      </p>
      {item.evidence ? (
        <p className="company-source-note">
          Delivery: {item.leadTimeDays} days · {item.evidence}
        </p>
      ) : null}
      {item.quantity === null ? (
        <p className="company-source-note">
          Stock count is still unknown. Use “Update stock count” above when you know it.
        </p>
      ) : null}
      {gaps.length === 0 ? (
        <p className="company-source-note">
          Buying details are filled in. You can adjust the reserve below.
        </p>
      ) : (
        gaps.map((gap) => (
          <div className="company-gap" key={gap.field}>
            <div>
              <strong>{gap.label}</strong>
              <p>{gap.hint}</p>
            </div>
            {active === gap.field ? (
              <form className="company-stock-form" onSubmit={(e) => void save(e, gap.field)}>
                <label className="sr-only" htmlFor={`gap-${item.id}`}>
                  {gap.label}
                </label>
                <input
                  id={`gap-${item.id}`}
                  ref={focusEditor}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  type={gap.field === "supplier" ? "text" : "number"}
                  min={0}
                  max={gap.field === "leadTimeDays" ? 365 : 1_000_000_000}
                  step={gap.field === "leadTimeDays" ? 1 : "any"}
                  required
                  maxLength={120}
                  disabled={busy}
                />
                <button disabled={busy}>{busy ? "Saving…" : "Save answer"}</button>
                <button type="button" disabled={busy} onClick={() => setActive(null)}>
                  Cancel
                </button>
                <p role="alert">{error}</p>
              </form>
            ) : (
              <button
                className="company-edit-stock"
                onClick={() => {
                  setActive(gap.field);
                  setValue("");
                  setError(null);
                }}
              >
                Add answer <ArrowRight />
              </button>
            )}
          </div>
        ))
      )}
      <SavedBuyingDetails item={item} />
      <details className="company-reserve">
        <summary>Reserve: {item.safetyStockDays} days · adjust</summary>
        <form className="company-stock-form" onSubmit={(e) => void save(e, "safetyStockDays")}>
          <label htmlFor={`reserve-${item.id}`}>Extra days of stock</label>
          <input
            id={`reserve-${item.id}`}
            type="number"
            min={0}
            max={365}
            step={1}
            value={active === "safetyStockDays" ? value : String(item.safetyStockDays)}
            onChange={(e) => {
              setActive("safetyStockDays");
              setValue(e.target.value);
            }}
            required
          />
          <button disabled={busy || active !== "safetyStockDays"}>Save reserve</button>
          {active === "safetyStockDays" ? <p role="alert">{error}</p> : null}
        </form>
      </details>
    </article>
  );
}

type BuyingField = "supplier" | "leadTimeDays" | "dailyUsage";
function SavedBuyingDetails({ item }: { item: Workspace["items"][number] }) {
  const choices: { field: BuyingField; label: string; value: string }[] = [
    ...(item.supplier
      ? [{ field: "supplier" as const, label: "Supplier", value: item.supplier }]
      : []),
    ...(item.leadTimeDays !== null
      ? [
          {
            field: "leadTimeDays" as const,
            label: "Order to delivery / days",
            value: String(item.leadTimeDays),
          },
        ]
      : []),
    ...(item.dailyUsage !== null
      ? [
          {
            field: "dailyUsage" as const,
            label: `Daily use / ${item.unit}`,
            value: String(item.dailyUsage),
          },
        ]
      : []),
  ];
  return choices.length ? <BuyingDetailEditor itemId={item.id} choices={choices} /> : null;
}
function BuyingDetailEditor({
  itemId,
  choices,
}: {
  itemId: Workspace["items"][number]["id"];
  choices: { field: BuyingField; label: string; value: string }[];
}) {
  const saveAnswer = useMutation(api.onboarding.fillGap);
  const [field, setField] = useState(choices[0].field);
  const [value, setValue] = useState(choices[0].value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveAnswer({ itemId, field, value });
      setSaved(true);
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="company-reserve">
      <summary>Adjust saved buying details</summary>
      <form className="company-stock-form" onSubmit={save}>
        <label htmlFor={`buying-field-${itemId}`}>Detail</label>
        <select
          id={`buying-field-${itemId}`}
          value={field}
          onChange={(e) => {
            const choice = choices.find((c) => c.field === e.target.value)!;
            setField(choice.field);
            setValue(choice.value);
            setError(null);
            setSaved(false);
          }}
          disabled={busy}
        >
          {choices.map((choice) => (
            <option value={choice.field} key={choice.field}>
              {choice.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`buying-value-${itemId}`}>
          {choices.find((c) => c.field === field)?.label}
        </label>
        <input
          id={`buying-value-${itemId}`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          type={field === "supplier" ? "text" : "number"}
          min={0}
          max={field === "leadTimeDays" ? 365 : 1_000_000_000}
          step={field === "leadTimeDays" ? 1 : "any"}
          maxLength={120}
          required
          disabled={busy}
        />
        <button disabled={busy}>{busy ? "Saving…" : "Save detail"}</button>
        <output>{saved ? "Saved." : error}</output>
      </form>
    </details>
  );
}
