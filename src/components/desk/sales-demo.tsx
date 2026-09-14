import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  Package,
  Play,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Square,
  Zap,
} from "lucide-react";
import { salesScenarios, salesDemoPlan } from "@/lib/sales-demo";
import type { SalesProvider } from "@/lib/sales-planning";
import "./sales.css";

export function SalesDemo() {
  const [provider, setProvider] = useState<SalesProvider>("square");
  return (
    <section className="sales-demo">
      <div className="sales-overline">
        <span className="sales-dot" /> Interactive sample · no store connected
      </div>
      <h1>
        Your business moves.
        <br />
        Your buyer keeps up.
      </h1>
      <p className="sales-intro">Sales change. Your next order changes with them.</p>
      <div className="sales-tabs" role="tablist" aria-label="Sample sales source">
        {(["square", "shopify"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === provider}
            aria-controls="sales-scenario"
            id={"sales-tab-" + p}
            onClick={() => setProvider(p)}
          >
            {p === "square" ? <Square size={17} /> : <ShoppingBag size={17} />}
            {salesScenarios[p].provider}
            <span>{p === "square" ? "At the counter" : "On your store"}</span>
          </button>
        ))}
      </div>
      <Scenario key={provider} provider={provider} />
    </section>
  );
}

function Scenario({ provider }: { provider: SalesProvider }) {
  const s = salesScenarios[provider];
  const [sold, setSold] = useState(0),
    [received, setReceived] = useState(0),
    [replayed, setReplayed] = useState(false),
    [details, setDetails] = useState(false);
  const before = salesDemoPlan(provider),
    current = salesDemoPlan(provider, sold, received);
  const ran = sold > 0,
    buying = current.plan.state === "buying";
  const purchase = salesDemoPlan(provider, s.saleQuantity);
  const run = () => {
    setSold(s.saleQuantity);
    setReceived(0);
    setReplayed(false);
  };
  const reset = () => {
    setSold(0);
    setReceived(0);
    setReplayed(false);
    setDetails(false);
  };
  return (
    <div id="sales-scenario" role="tabpanel" aria-labelledby={"sales-tab-" + provider}>
      <div className="sales-scene">
        <div className="sales-source">
          <div className="sales-window-top">
            <span className="sales-window-dots">● ● ●</span>
            <span>{s.provider} / sample store</span>
            <span>10:42</span>
          </div>
          <div className="sales-source-body">
            <div className="sales-source-name">
              {provider === "square" ? <Square /> : <ShoppingBag />} {s.business}
            </div>
            <p className="sales-overline">{s.event}</p>
            <div className="sales-sale-number">
              {ran ? s.saleQuantity : "—"}
              <span>{provider === "square" ? "coffees sold" : "paid orders"}</span>
            </div>
            <div className="sales-line-item">
              <span>{s.product}</span>
              <strong>{ran ? s.saleQuantity : 0}</strong>
            </div>
            <div className="sales-mapping">
              <Package size={18} />
              <span>
                Every {provider === "square" ? "takeaway coffee" : "gift set"} uses{" "}
                <strong>1 {provider === "square" ? "cup" : "box"}.</strong>
              </span>
              <Check size={16} />
            </div>
            <button className="sales-primary" onClick={run} disabled={ran}>
              <Zap size={18} />
              {ran ? "Sample sales received" : "Run sample sales"}
            </button>
            <p className="sales-source-note">
              {ran
                ? "The event starts the buyer’s work."
                : "See what happens while you’re away from BUY HARD."}
            </p>
          </div>
        </div>
        <div className="sales-connector" aria-hidden="true">
          <ArrowRight size={25} />
          <span>Sales → supplies</span>
        </div>
        <div className="sales-buyer" aria-live="polite">
          <div className="sales-buyer-top">
            <strong>BUY HARD</strong>
            <span>
              <i className="sales-dot" />
              {buying ? "Purchase prepared" : "Watching your stock"}
            </span>
          </div>
          <p className="sales-overline">{s.item}</p>
          <div className="sales-stock-number">
            {current.stock.toLocaleString()}
            <span>{s.unit} left</span>
          </div>
          <div className="sales-stock-track">
            <div style={{ width: Math.min(100, (current.stock / s.stock) * 100) + "%" }} />
          </div>
          <div className="sales-stock-caption">
            <span>{current.daysLeft.toFixed(0)} days of cover</span>
            <span>{s.leadTimeDays}-day delivery</span>
          </div>
          <div
            className="sales-buyer-message"
            key={received ? "receipt" : ran ? "sale" : "watching"}
          >
            <span className="sales-message-author">
              <CircleCheck size={15} /> Your buyer · sample
            </span>
            <p>
              {received
                ? "Delivery received. You’re covered again."
                : ran
                  ? "Sales picked up. I’ve brought your next order forward."
                  : "You’re stocked for now. I’ll start the next buy in " +
                    before.reorderInDays +
                    " days."}
            </p>
            {buying && (
              <div className="sales-purchase">
                <div>
                  <strong>
                    {current.plan.quantity} {s.unit}
                  </strong>
                  <span>
                    {current.orderPacks} packs of {s.pack} · {s.supplier}
                  </span>
                </div>
                <span className="sales-pill">For review</span>
              </div>
            )}
          </div>
          <button
            className="sales-why"
            aria-expanded={details}
            aria-controls="sales-why-details"
            onClick={() => setDetails(!details)}
          >
            Why {buying ? "now" : "this plan"}? <ChevronDown size={16} />
          </button>
        </div>
      </div>
      <div className="sales-proof-strip">
        <span>
          <CircleCheck size={16} /> {ran ? "Event received" : "Ready for a sale"}
        </span>
        <ArrowRight size={14} />
        <span>
          <CircleCheck size={16} /> {ran ? "Forecast recalculated" : "Supply rule confirmed"}
        </span>
        <ArrowRight size={14} />
        <span>
          <CircleCheck size={16} />{" "}
          {buying
            ? "One purchase prepared"
            : received
              ? "Stock replenished"
              : "Next check scheduled"}
        </span>
      </div>
      {details && (
        <div className="sales-evidence" id="sales-why-details">
          <div>
            <span>Source</span>
            <strong>
              {s.provider} · {s.sourceId}
            </strong>
            <small>{s.location} · sample event</small>
          </div>
          <div>
            <span>Confirmed use</span>
            <strong>
              {sold} sales × 1 {provider === "square" ? "cup" : "box"}
            </strong>
            <small>{received ? "+ " + received + " received" : "Each sale counted once"}</small>
          </div>
          <div>
            <span>Stock outlook</span>
            <strong>
              {s.stock} → {current.stock} {s.unit}
            </strong>
            <small>{s.dailyUsage} used per day</small>
          </div>
          <div>
            <span>Time to act</span>
            <strong>{s.leadTimeDays} delivery + 1 preparation + 1 reserve day</strong>
            <small>
              {buying
                ? "Start the purchase today"
                : "Next check in " + current.reorderInDays + " days"}
            </small>
          </div>
        </div>
      )}
      <div className="sales-demo-tools">
        <button onClick={() => setReplayed(true)} disabled={!ran}>
          <RefreshCw size={15} /> Replay the same event
        </button>
        <button
          onClick={() => {
            setReceived(purchase.plan.quantity);
            setReplayed(false);
          }}
          disabled={!ran || !!received}
        >
          <Package size={15} /> Receive sample delivery
        </button>
        <button onClick={reset}>
          <RotateCcw size={15} /> Start again
        </button>
      </div>
      <output className="sales-demo-feedback">
        {replayed
          ? "Already processed. Stock stayed the same. No second buy."
          : received
            ? "The same plan has adjusted to the delivery. No extra purchase needed."
            : "This sample uses the app’s buying calculator. Supplier details and events are illustrative."}
      </output>
      <div className="sales-next">
        <ArrowDown size={18} />
        <p>
          <strong>It starts with a connection.</strong> In your workspace, connect a store, match a
          product to a supply, and confirm the conversion.
        </p>
        <a href="/?demo=true&page=settings">
          See sample settings <ArrowRight size={16} />
        </a>
      </div>
      <details className="sales-film">
        <summary>
          <Play size={17} /> Animated walkthrough
        </summary>
        <p>The HyperFrames preview follows these same sample numbers.</p>
        <a href="/sales-story/index.html" target="_blank" rel="noreferrer">
          Open animation <ArrowRight size={15} />
        </a>
      </details>
    </div>
  );
}
