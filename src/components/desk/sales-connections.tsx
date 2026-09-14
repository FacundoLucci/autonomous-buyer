import { useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowRight, Link2, ShoppingBag, Square } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import type { Item } from "./model";
import { errorText } from "./model";
import "./sales.css";
type Catalog = FunctionReturnType<typeof api.salesProvider.catalog>;

export function SalesConnections({
  items,
  result,
}: {
  items: Item[];
  result?: "connected" | "retry";
}) {
  const data = useQuery(api.sales.list, {}),
    ready = useQuery(api.salesAuth.readiness, {});
  const begin = useAction(api.salesAuth.begin),
    sync = useAction(api.salesProvider.requestSync),
    catalog = useAction(api.salesProvider.catalog);
  const pause = useMutation(api.sales.pause),
    remove = useMutation(api.sales.removeMapping);
  const [shop, setShop] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<{
    connectionId: Id<"salesConnections">;
    provider: "square" | "shopify";
    catalog: Catalog;
  } | null>(null);
  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  const connect = (provider: "square" | "shopify") =>
    run(provider, async () => {
      const url = await begin({ provider, shop: provider === "shopify" ? shop : undefined });
      window.location.assign(url);
    });
  return (
    <section className="sales-connections">
      <p className="sales-overline">
        <Link2 size={16} /> Sales & inventory
      </p>
      <h2>Let your business keep the buyer up to date.</h2>
      <p className="sales-intro">
        Connect a store. Match a product to a supply. Confirm how much it uses.
      </p>
      {result === "retry" && (
        <p className="sales-error" role="alert">
          The connection wasn’t completed. Start again below to get a fresh authorization link.
        </p>
      )}
      {result === "connected" && !!data?.connections.length && (
        <output className="sales-muted">
          Store connected. Match a product to a supply to start using its updates.
        </output>
      )}
      <div className="sales-connection-cards">
        <article className="sales-connection-card">
          <h3>
            <Square size={22} /> Square
          </h3>
          <p>
            Use completed sales to estimate supply use, or follow a stock count from one of your
            locations.
          </p>
          <button
            className="sales-primary"
            disabled={!!busy || !ready?.square}
            onClick={() => void connect("square")}
          >
            {busy === "square" ? "Opening Square…" : "Connect Square"}
          </button>
          <p className="sales-muted">
            {ready?.square
              ? ready.squareSandbox
                ? "Square sandbox · test transactions"
                : "Authorize your Square account"
              : "Square app credentials need to be configured before connecting."}
          </p>
        </article>
        <article className="sales-connection-card">
          <h3>
            <ShoppingBag size={22} /> Shopify
          </h3>
          <p>
            Use paid orders to estimate packaging needs, or follow inventory at a specific location.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void connect("shopify");
            }}
          >
            <label>
              Your Shopify domain
              <input
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                placeholder="your-store.myshopify.com"
                autoCapitalize="none"
                autoCorrect="off"
                required
                pattern="[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com"
              />
            </label>
            <button className="sales-primary" disabled={!!busy || !ready?.shopify} type="submit">
              {busy === "shopify" ? "Opening Shopify…" : "Connect Shopify"}
            </button>
          </form>
          {!ready?.shopify && (
            <p className="sales-muted">
              Shopify app credentials need to be configured before connecting.
            </p>
          )}
        </article>
      </div>
      {error && (
        <p role="alert" className="sales-error">
          {error}
        </p>
      )}
      {data === undefined && <output className="sales-muted">Loading your connections…</output>}
      <div className="sales-connected-list">
        {data?.connections.map((c) => (
          <article key={c._id}>
            <h3>{c.name}</h3>
            <p>
              {c.status === "connected"
                ? "Authorized"
                : c.status === "paused"
                  ? "Paused"
                  : "Needs attention"}
              {c.sandbox ? " · test account" : ""}
            </p>
            <p>
              {c.lastSyncAt
                ? "Last checked " + new Date(c.lastSyncAt).toLocaleString()
                : "Waiting for the first sync."}
              {c.lastEventAt
                ? " · Last update checked " + new Date(c.lastEventAt).toLocaleString()
                : ""}
            </p>
            {c.message && <p className="sales-error">{c.message}</p>}
            <button
              className="sales-link-button"
              disabled={!!busy || c.status !== "connected"}
              onClick={() =>
                void run("map", async () =>
                  setMapping({
                    connectionId: c._id,
                    provider: c.provider,
                    catalog: await catalog({ connectionId: c._id }),
                  }),
                )
              }
            >
              Match a product to a supply <ArrowRight size={15} />
            </button>
            <button
              className="sales-link-button"
              disabled={!!busy || c.status === "paused"}
              onClick={() => void run("sync", () => sync({ connectionId: c._id }))}
            >
              Check for updates
            </button>
            <button
              className="sales-link-button"
              disabled={!!busy}
              onClick={() =>
                void run("pause", () =>
                  pause({ connectionId: c._id, paused: c.status !== "paused" }),
                )
              }
            >
              {c.status === "paused" ? "Resume updates" : "Pause updates"}
            </button>
            {data.mappings
              .filter((m) => m.connectionId === c._id)
              .map((m) => (
                <p key={m._id}>
                  {m.externalName} → {items.find((i) => i.id === m.itemId)?.name ?? "Supply"} ·{" "}
                  {m.mode === "sales" ? m.unitsPerSale + " used per sale; " : "Stock count; "}
                  {m.unitsPerStockUnit} per stock unit.{" "}
                  <button
                    className="sales-link-button"
                    disabled={!!busy}
                    onClick={() => void run("remove", () => remove({ mappingId: m._id }))}
                  >
                    Remove mapping
                  </button>
                </p>
              ))}
          </article>
        ))}
      </div>
      {mapping && (
        <MappingForm
          key={mapping.connectionId}
          {...mapping}
          items={items.filter((i) => !data?.mappings.some((m) => m.itemId === i.id))}
          onClose={() => setMapping(null)}
        />
      )}
      {!!data?.decisions.length && (
        <div>
          <h2>Why the buyer acted</h2>
          {data.decisions.map((d) => (
            <details className="sales-decision" key={d._id}>
              <summary>{d.summary}</summary>
              <p>
                {d.beforeQuantity.toFixed(2)} → {d.afterQuantity.toFixed(2)} {d.unit} projected on
                hand.
              </p>
              <p>
                {d.orderQuantity > 0
                  ? "Buying plan: " +
                    d.orderQuantity +
                    " " +
                    d.unit +
                    ", needed by " +
                    d.requiredBy +
                    "."
                  : "The current plan does not need another purchase."}
              </p>
              <p>
                Source: {d.source} · {new Date(d.sourceAt).toLocaleString()}
              </p>
              <a href={"/?page=inventory&item=" + d.itemId}>
                Open this supply and its buying status <ArrowRight size={14} />
              </a>
            </details>
          ))}
        </div>
      )}
      <p className="sales-muted">
        One authoritative source per supply. Physical counts correct the estimate. Refunds do not
        automatically put used packaging back on the shelf. Your existing purchasing approval rules
        still apply.
      </p>
    </section>
  );
}
function MappingForm({
  connectionId,
  provider,
  catalog: initial,
  items,
  onClose,
}: {
  connectionId: Id<"salesConnections">;
  provider: "square" | "shopify";
  catalog: Catalog;
  items: Item[];
  onClose: () => void;
}) {
  const save = useMutation(api.sales.saveMapping),
    load = useAction(api.salesProvider.catalog);
  const [catalog, setCatalog] = useState(initial),
    [mode, setMode] = useState<"sales" | "inventory">("sales"),
    [product, setProduct] = useState(initial.products[0]?.id ?? ""),
    [itemId, setItemId] = useState(items[0]?.id ?? ""),
    [location, setLocation] = useState(initial.locations[0]?.id ?? ""),
    [use, setUse] = useState("1"),
    [pack, setPack] = useState("1"),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const chosen = catalog.products.find((p) => p.id === product);
    if (!chosen || !itemId || !confirmed) return;
    setBusy(true);
    try {
      await save({
        connectionId,
        itemId: itemId as Id<"inventoryItems">,
        externalId: mode === "inventory" ? chosen.inventoryId : chosen.id,
        externalName: chosen.name,
        locationId: location,
        mode,
        unitsPerSale: Number(use),
        unitsPerStockUnit: Number(pack),
      });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const locations = catalog.locations.filter((l) =>
    mode === "sales" && provider === "shopify" ? l.id === "all" : l.id !== "all",
  );
  return (
    <form className="sales-mapping-form" onSubmit={(e) => void submit(e)}>
      <h3>What does a sale use?</h3>
      <div className="sales-form-grid">
        <label>
          Use this source for
          <select
            value={mode}
            onChange={(e) => {
              const m = e.target.value as "sales" | "inventory";
              setMode(m);
              setLocation(
                catalog.locations.find((l) =>
                  m === "sales" && provider === "shopify" ? l.id === "all" : l.id !== "all",
                )?.id ?? "",
              );
              setConfirmed(false);
            }}
          >
            <option value="sales">Estimate supply use from sales</option>
            <option value="inventory">Use the source’s inventory count</option>
          </select>
        </label>
        <label>
          Location
          <select
            value={location}
            required
            onChange={(e) => {
              setLocation(e.target.value);
              setConfirmed(false);
            }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Product in your store
          <select
            value={product}
            required
            onChange={(e) => {
              setProduct(e.target.value);
              setConfirmed(false);
            }}
          >
            {catalog.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Supply in BUY HARD
          <select
            value={itemId}
            required
            onChange={(e) => {
              setItemId(e.target.value as Id<"inventoryItems">);
              setConfirmed(false);
            }}
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
        </label>
        {mode === "sales" && (
          <label>
            Supply pieces used per sold item
            <input
              required
              type="number"
              min="0.000001"
              max="1000000"
              step="any"
              value={use}
              onChange={(e) => {
                setUse(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
        )}
        <label>
          Pieces in one BUY HARD stock unit
          <input
            required
            type="number"
            min="0.000001"
            max="1000000"
            step="any"
            value={pack}
            onChange={(e) => {
              setPack(e.target.value);
              setConfirmed(false);
            }}
          />
          <small>For a case of 1,000 cups, enter 1,000.</small>
        </label>
      </div>
      {catalog.cursor && (
        <button
          className="sales-link-button"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const more = await load({ connectionId, cursor: catalog.cursor! });
              setCatalog({ ...more, products: [...catalog.products, ...more.products] });
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Load more products
        </button>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="checkbox"
          style={{ width: 20, minHeight: 20 }}
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          required
        />
        I’ve confirmed the product, supply, location and quantities.
      </label>
      {!items.length && (
        <p className="sales-error">
          Add a supply with a stock count, or remove its existing mapping first.
        </p>
      )}
      {error && (
        <p role="alert" className="sales-error">
          {error}
        </p>
      )}
      <div className="sales-form-buttons">
        <button
          className="sales-primary"
          disabled={busy || !items.length || !confirmed}
          type="submit"
        >
          {busy ? "Saving…" : "Use this source"}
        </button>
        <button className="sales-link-button" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function SampleSalesConnections() {
  return (
    <section className="sales-connections">
      <h2>Sales & inventory</h2>
      <p>See how your buyer could use activity from a connected store.</p>
      <div className="sales-connection-cards">
        {(["Square", "Shopify"] as const).map((name) => (
          <article className="sales-connection-card" key={name}>
            <h3>
              {name === "Square" ? <Square /> : <ShoppingBag />}
              {name}
            </h3>
            <p>
              {name === "Square"
                ? "Takeaway coffees → paper cups"
                : "Paid gift-set orders → shipping boxes"}
            </p>
            <p className="sales-muted">Sample connection · no account authorized</p>
            <a href="/?demo=true&page=connections" className="sales-link-button">
              Try the sample <ArrowRight size={15} />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
