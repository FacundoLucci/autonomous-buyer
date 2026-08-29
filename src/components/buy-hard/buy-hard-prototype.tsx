import { Activity, ArrowLeft, ChevronRight, Filter, Search, Signal } from "lucide-react";
import { useState } from "react";

import "./buy-hard-prototype.css";
import { DotMatrixDisplay } from "./dot-matrix-display";

type BuyStatus = "awaiting_quotes" | "confirmed" | "covered" | "delivered" | "monitoring";

type ProgressStep = {
  label: string;
  description: string;
};

type ActivityEntry = {
  at: string;
  label: string;
};

type Buy = {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: string;
  dueDate: string;
  status: BuyStatus;
  supplier: string;
  estimatedArrival: string;
  progressIndex: number;
  activity: ActivityEntry[];
};

const statusLabels: Record<BuyStatus, string> = {
  awaiting_quotes: "Awaiting quotes",
  confirmed: "Confirmed",
  covered: "Covered",
  delivered: "Delivered",
  monitoring: "Monitoring",
};

const progressSteps: ProgressStep[] = [
  { label: "Need identified", description: "Monitoring inventory levels" },
  { label: "Supplier search", description: "Identified and evaluated suppliers" },
  { label: "Supplier confirmed", description: "Supplier confirmation received" },
  { label: "PO issued", description: "Purchase order sent" },
  { label: "In transit", description: "Awaiting shipment" },
  { label: "Receipt", description: "Awaiting delivery" },
];

const buys: Buy[] = [
  {
    id: "PC-9258",
    itemCode: "LID-16-TE",
    itemName: "Tamper-Evident 16 oz Deli Lid",
    quantity: "15,000 units",
    dueDate: "2026-09-03",
    status: "covered",
    supplier: "Tractor Feed Packaging",
    estimatedArrival: "2026-09-03",
    progressIndex: 3,
    activity: [
      { at: "17:53", label: "PO-PC-9258-8DAPKN sent" },
      { at: "17:53", label: "A supplier confirmation arrived" },
      { at: "17:52", label: "Supplier terms matched the approved quote" },
      { at: "17:43", label: "Supplier search completed" },
      { at: "17:42", label: "Need identified at 5.3 days remaining" },
    ],
  },
  {
    id: "PC-9333",
    itemCode: "CONTAINER-24",
    itemName: "24 oz Deli Container",
    quantity: "8,200 units",
    dueDate: "2026-09-07",
    status: "awaiting_quotes",
    supplier: "Pending selection",
    estimatedArrival: "Pending",
    progressIndex: 1,
    activity: [
      { at: "16:18", label: "Three supplier requests sent" },
      { at: "16:11", label: "Supplier search completed" },
      { at: "16:08", label: "Need identified at 8.1 days remaining" },
    ],
  },
  {
    id: "PC-9410",
    itemCode: "CASE-SHIP-08",
    itemName: "8 × 8 Shipping Case",
    quantity: "540 units",
    dueDate: "2026-09-10",
    status: "monitoring",
    supplier: "Not selected",
    estimatedArrival: "Not scheduled",
    progressIndex: 0,
    activity: [
      { at: "15:40", label: "Usage rate moved above the 30-day average" },
      { at: "15:32", label: "Inventory monitor refreshed" },
    ],
  },
  {
    id: "PC-9475",
    itemCode: "LID-HINGE-CLR",
    itemName: "Clear Hinged Deli Lid",
    quantity: "20,000 units",
    dueDate: "2026-09-12",
    status: "confirmed",
    supplier: "Apex Packaging",
    estimatedArrival: "2026-09-11",
    progressIndex: 4,
    activity: [
      { at: "14:55", label: "Shipment pickup confirmed" },
      { at: "10:24", label: "Purchase order acknowledged" },
      { at: "09:47", label: "Supplier terms confirmed" },
    ],
  },
  {
    id: "PC-9521",
    itemCode: "CASE-SHIP-24",
    itemName: "24 × 24 Shipping Case",
    quantity: "430 units",
    dueDate: "2026-09-15",
    status: "awaiting_quotes",
    supplier: "Pending selection",
    estimatedArrival: "Pending",
    progressIndex: 1,
    activity: [
      { at: "13:02", label: "One supplier response received" },
      { at: "12:41", label: "Four supplier requests sent" },
    ],
  },
  {
    id: "PC-9603",
    itemCode: "CONTAINER-32",
    itemName: "32 oz Deli Container",
    quantity: "6,600 units",
    dueDate: "2026-09-18",
    status: "monitoring",
    supplier: "Not selected",
    estimatedArrival: "Not scheduled",
    progressIndex: 0,
    activity: [
      { at: "11:38", label: "Inventory remains above safety stock" },
      { at: "11:31", label: "Inventory monitor refreshed" },
    ],
  },
  {
    id: "PC-9151",
    itemCode: "CONTAINER-16",
    itemName: "16 oz Deli Container",
    quantity: "12,480 units",
    dueDate: "2026-09-05",
    status: "delivered",
    supplier: "Apex Packaging",
    estimatedArrival: "Delivered 2026-09-04",
    progressIndex: 5,
    activity: [
      { at: "10:12", label: "Receipt matched the purchase order" },
      { at: "09:58", label: "Delivery recorded at Acme Foods" },
    ],
  },
];

const metricData = [
  { label: "Needs action", value: "0" },
  { label: "Open buys", value: "1" },
  { label: "Annual spend", value: "$284,320" },
  { label: "Savings", value: "$17,430" },
];

function formatStatus(status: BuyStatus) {
  return statusLabels[status];
}

function MetricDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div className="bh-metric">
      <div className="bh-metric__screen">
        <span className="bh-metric__label">{label}</span>
        <output className="bh-metric__value" aria-label={`${label}: ${value}`}>
          <DotMatrixDisplay value={value} />
        </output>
      </div>
    </div>
  );
}

function MetricRack() {
  return (
    <section className="bh-metric-rack" aria-label="Purchasing summary">
      <div className="bh-metric-grid">
        {metricData.map((metric) => (
          <MetricDisplay key={metric.label} {...metric} />
        ))}
      </div>
    </section>
  );
}

function StatusText({ status }: { status: BuyStatus }) {
  return (
    <span className="bh-status" data-status={status}>
      {formatStatus(status)}
    </span>
  );
}

function BuyList({
  selectedBuyId,
  onBuySelect,
}: {
  selectedBuyId: string;
  onBuySelect: (buyId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BuyStatus | "all">("all");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleBuys = buys.filter((buy) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      `${buy.id} ${buy.itemCode} ${buy.itemName}`.toLowerCase().includes(normalizedQuery);
    return matchesQuery && (status === "all" || buy.status === status);
  });

  return (
    <section className="bh-panel bh-buy-list" id="all-buys" aria-labelledby="all-buys-title">
      <div className="bh-panel__header bh-list-header">
        <div>
          <p className="bh-kicker">Buy desk / mock data</p>
          <h2 id="all-buys-title">All buys</h2>
        </div>
        <div className="bh-list-tools">
          <label className="bh-search">
            <span className="sr-only">Search buys</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search buys"
            />
          </label>
          <label className="bh-filter">
            <span className="sr-only">Filter buys by status</span>
            <Filter aria-hidden="true" />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as BuyStatus | "all")}
            >
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ul className="bh-buy-rows" aria-label="Buy records">
        {visibleBuys.map((buy) => {
          const selected = buy.id === selectedBuyId;
          return (
            <li key={buy.id}>
              <button
                type="button"
                className="bh-buy-row"
                data-selected={selected ? "true" : "false"}
                data-status={buy.status}
                aria-pressed={selected}
                aria-controls="buy-detail"
                onClick={() => onBuySelect(buy.id)}
              >
                <span className="bh-buy-row__identity">
                  <span className="bh-buy-row__id">{buy.id}</span>
                  <span className="bh-buy-row__name">{buy.itemName}</span>
                </span>
                <span className="bh-buy-row__schedule">
                  <span>{buy.quantity}</span>
                  <span>Due {buy.dueDate}</span>
                </span>
                <StatusText status={buy.status} />
                <ChevronRight className="bh-buy-row__chevron" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {visibleBuys.length === 0 ? (
        <div className="bh-empty">
          <p>No buys match this view.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : null}

      <div className="bh-pagination" aria-label="Pagination preview">
        <span>
          1–{visibleBuys.length} of {buys.length} buys
        </span>
        <span aria-hidden="true">01 / 01</span>
      </div>
    </section>
  );
}

function ProgressTimeline({ activeIndex }: { activeIndex: number }) {
  return (
    <ol className="bh-progress" aria-label="Procurement progress">
      {progressSteps.map((step, index) => {
        const state =
          index < activeIndex ? "complete" : index === activeIndex ? "current" : "pending";
        return (
          <li key={step.label} className="bh-progress-step" data-state={state}>
            <span className="bh-progress-step__number">{String(index + 1).padStart(2, "0")}</span>
            <span className="bh-progress-step__line" aria-hidden="true">
              <span className="bh-progress-step__node" />
            </span>
            <span className="bh-progress-step__copy">
              <span className="bh-progress-step__label">{step.label}</span>
              <span>{step.description}</span>
            </span>
            <time
              dateTime={index <= activeIndex ? `2026-05-20T17:${42 + index * 3}:00` : undefined}
            >
              {index <= activeIndex ? `17:${String(42 + index * 3).padStart(2, "0")}` : "--:--"}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <section className="bh-feed" id="activity-feed" aria-labelledby="activity-feed-title">
      <div className="bh-feed__header">
        <Activity aria-hidden="true" />
        <h3 id="activity-feed-title">Activity feed</h3>
        <span>Read only</span>
      </div>
      <div className="bh-paper">
        <ol>
          {entries.map((entry, index) => (
            <li key={`${entry.at}-${entry.label}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <time dateTime={`2026-05-20T${entry.at}:00`}>{entry.at}</time>
              <span>{entry.label}</span>
            </li>
          ))}
        </ol>
        <p className="bh-paper__end" aria-hidden="true">
          End of feed
        </p>
      </div>
    </section>
  );
}

function BuyDetail({ buy, onBack }: { buy: Buy; onBack: () => void }) {
  return (
    <div className="bh-detail-column" id="buy-detail">
      <section className="bh-panel bh-buy-detail" aria-labelledby="buy-detail-title">
        <button className="bh-mobile-back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          All buys
        </button>

        <div className="bh-detail-heading">
          <div>
            <p className="bh-kicker">Procurement progress</p>
            <h2 id="buy-detail-title">
              <DotMatrixDisplay value={buy.id} className="bh-detail-id-display" />
            </h2>
            <p>
              {buy.itemCode} · {buy.itemName}
            </p>
          </div>
          <StatusText status={buy.status} />
        </div>

        <dl className="bh-detail-facts">
          <div>
            <dt>Quantity</dt>
            <dd>{buy.quantity}</dd>
          </div>
          <div>
            <dt>Supplier</dt>
            <dd>{buy.supplier}</dd>
          </div>
          <div>
            <dt>Due date</dt>
            <dd>{buy.dueDate}</dd>
          </div>
          <div>
            <dt>Estimated arrival</dt>
            <dd>{buy.estimatedArrival}</dd>
          </div>
        </dl>

        <div className="bh-detail-section-heading">
          <h3>Procurement progress</h3>
          <span>{String(buy.progressIndex + 1).padStart(2, "0")} / 06</span>
        </div>
        <ProgressTimeline activeIndex={buy.progressIndex} />
      </section>

      <ActivityFeed entries={buy.activity} />
    </div>
  );
}

export function BuyHardPrototype() {
  const [selectedBuyId, setSelectedBuyId] = useState(buys[0].id);
  const [mobileView, setMobileView] = useState<"detail" | "list">("list");
  const selectedBuy = buys.find((buy) => buy.id === selectedBuyId) ?? buys[0];

  function selectBuy(buyId: string) {
    setSelectedBuyId(buyId);
    setMobileView("detail");
  }

  return (
    <main className="bh-shell" data-mobile-view={mobileView} id="buy-desk">
      <a className="bh-skip-link" href="#all-buys">
        Skip to buys
      </a>

      <header className="bh-app-bar">
        <a className="bh-brand" href="#buy-desk" aria-label="BUY HARD prototype home">
          <DotMatrixDisplay value="BUY HARD" />
        </a>
        <nav aria-label="Prototype sections">
          <a href="#all-buys" aria-current="page">
            Buy desk
          </a>
          <a href="#activity-feed">Activity</a>
        </nav>
        <div className="bh-agent-status">
          <Signal aria-hidden="true" />
          <span>Agent: working</span>
          <span className="bh-agent-status__light" aria-hidden="true" />
        </div>
      </header>

      <div className="bh-chassis">
        <div className="bh-company-row">
          <p className="bh-company">Acme Foods</p>
          <p className="bh-prototype-label">Component prototype · mock data</p>
        </div>

        <MetricRack />

        <div className="bh-workspace">
          <BuyList selectedBuyId={selectedBuy.id} onBuySelect={selectBuy} />
          <BuyDetail buy={selectedBuy} onBack={() => setMobileView("list")} />
        </div>
      </div>
    </main>
  );
}
