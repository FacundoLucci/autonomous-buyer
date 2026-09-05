import type { useQuery } from "convex/react";
import { ChevronRight, Filter, Search } from "lucide-react";
import { useId, useState } from "react";

import type { api } from "../../../convex/_generated/api";
import { getOpenBuys } from "./open-buys";

export type Dashboard = NonNullable<
  ReturnType<typeof useQuery<typeof api.purchasing.getDashboard>>
>;

type InventoryItem = Dashboard["inventory"][number];
type ListView = "open" | "buys" | "inventory";

const viewLabels: Record<ListView, string> = {
  open: "Open buys",
  buys: "Recent buys",
  inventory: "Inventory",
};

type LiveBuyListProps = {
  dashboard: Dashboard;
  selectedId?: string;
  onSelect: (id: string) => void;
};

const statusLabels: Record<string, string> = {
  healthy: "Healthy",
  watch: "Watch",
  action_required: "Needs action",
  detected: "Risk detected",
  analyzing: "Analyzing inventory",
  sourcing: "Finding suppliers",
  rfq_ready: "Preparing requests",
  rfq_sent: "Requests sent",
  awaiting_quotes: "Awaiting quotes",
  evaluating: "Comparing replies",
  approval_required: "Approval required",
  approved: "Approved",
  ordered: "Ordered",
  po_sent: "Purchase order sent",
  confirmation_pending: "Awaiting confirmation",
  covered: "Covered",
  confirmed: "Confirmed",
  closed: "Closed",
  no_viable_supplier: "No viable supplier",
  rejected: "Rejected",
  exception: "Exception",
  cancelled: "Cancelled",
};

function statusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

function quantity(value: number) {
  return value.toLocaleString("en-US");
}

function InventoryContent({ item }: { item: InventoryItem }) {
  return (
    <>
      <span className="buy-desk-list-identity">
        <span className="buy-desk-list-code">{item.sku}</span>
        <span className="buy-desk-list-name">{item.name}</span>
        <span className="buy-desk-list-schedule text-muted-foreground">
          {item.procurement ? `View ${item.procurement.code}` : "Monitoring inventory"}
        </span>
      </span>
      <span className="buy-desk-list-inventory-facts">
        <span className="buy-desk-list-fact">
          <span className="text-muted-foreground">On hand</span>
          <span>{quantity(Math.round(item.quantityOnHand))}</span>
        </span>
        <span className="buy-desk-list-fact" data-incoming={item.confirmedIncoming > 0}>
          <span className="text-muted-foreground">Incoming · confirmed</span>
          <span>{quantity(item.confirmedIncoming)}</span>
        </span>
        <span className="buy-desk-list-fact">
          <span className="text-muted-foreground">Daily use</span>
          <span>{quantity(Math.round(item.averageDailyUsage))}</span>
        </span>
        <span className="buy-desk-list-fact">
          <span className="text-muted-foreground">Days left</span>
          <span>{item.daysRemaining?.toFixed(1) ?? "—"}</span>
        </span>
      </span>
      <span className="buy-desk-list-status" data-status={item.status}>
        {statusLabel(item.status)}
      </span>
      {item.procurement ? (
        <ChevronRight className="buy-desk-list-chevron" aria-hidden="true" />
      ) : null}
    </>
  );
}

export function LiveBuyList({ dashboard, selectedId, onSelect }: LiveBuyListProps) {
  const headingId = useId();
  const [view, setView] = useState<ListView>("open");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<ListView, string>>({
    open: "all",
    buys: "all",
    inventory: "all",
  });

  const recentItems = dashboard.inventory.filter((item) => item.procurement !== null);
  const openItems = getOpenBuys(dashboard.inventory);
  const items = view === "open" ? openItems : view === "buys" ? recentItems : dashboard.inventory;
  const viewLabel = viewLabels[view];
  const activeStatus = filters[view];
  const normalizedQuery = query.trim().toLowerCase();
  const itemStatus = (item: InventoryItem) =>
    view !== "inventory" ? (item.procurement?.status ?? item.status) : item.status;
  const statuses = Array.from(
    new Set([...items.map(itemStatus), ...(activeStatus === "all" ? [] : [activeStatus])]),
  ).sort((first, second) => statusLabel(first).localeCompare(statusLabel(second)));
  const visibleItems = items.filter((item) => {
    const matchesQuery = `${item.sku} ${item.name} ${item.procurement?.code ?? ""}`
      .toLowerCase()
      .includes(normalizedQuery);
    return matchesQuery && (activeStatus === "all" || itemStatus(item) === activeStatus);
  });
  const hasFilters = normalizedQuery.length > 0 || activeStatus !== "all";

  function clearFilters() {
    setQuery("");
    setFilters((current) => ({ ...current, [view]: "all" }));
  }

  return (
    <div className="buy-desk-list" data-view={view}>
      <header className="buy-desk-list-header">
        <div className="buy-desk-list-heading">
          <h2 id={headingId}>{viewLabel}</h2>
        </div>
        <fieldset className="buy-desk-list-tabs min-w-0 border-0 p-0" aria-label="Buy desk view">
          <button
            type="button"
            className="buy-desk-list-tab"
            aria-pressed={view === "open"}
            onClick={() => setView("open")}
          >
            Open buys <span className="tabular-nums">{openItems.length}</span>
          </button>
          <button
            type="button"
            className="buy-desk-list-tab"
            aria-pressed={view === "buys"}
            onClick={() => setView("buys")}
          >
            Recent buys <span className="tabular-nums">{recentItems.length}</span>
          </button>
          <button
            type="button"
            className="buy-desk-list-tab"
            aria-pressed={view === "inventory"}
            onClick={() => setView("inventory")}
          >
            Inventory <span className="tabular-nums">{dashboard.inventory.length}</span>
          </button>
        </fieldset>
      </header>

      <div className="buy-desk-list-tools">
        <label className="buy-desk-list-search">
          <span className="sr-only">Search {viewLabel.toLowerCase()}</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="buy-desk-list-filter">
          <span className="sr-only">Filter {viewLabel.toLowerCase()} by status</span>
          <Filter aria-hidden="true" />
          <select
            value={activeStatus}
            onChange={(event) =>
              setFilters((current) => ({ ...current, [view]: event.target.value }))
            }
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visibleItems.length > 0 ? (
        <ul className="buy-desk-list-rows" aria-labelledby={headingId}>
          {visibleItems.map((item) => {
            const procurement = item.procurement;
            const selected = procurement?.procurementId === selectedId;

            return (
              <li key={item.inventoryItemId}>
                {view !== "inventory" && procurement ? (
                  <button
                    type="button"
                    className="buy-desk-list-row"
                    data-selected={selected}
                    data-status={procurement.status}
                    data-buy-id={procurement.procurementId}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect(procurement.procurementId)}
                  >
                    <span className="buy-desk-list-identity">
                      <span className="buy-desk-list-code">{procurement.code}</span>
                      <span className="buy-desk-list-name">{item.name}</span>
                      <span className="text-muted-foreground">{item.sku}</span>
                    </span>
                    <span className="buy-desk-list-schedule text-muted-foreground">
                      <span>{quantity(procurement.quantityRequired)} units</span>
                      <span>Due {procurement.requiredBy}</span>
                    </span>
                    <span className="buy-desk-list-status" data-status={procurement.status}>
                      {statusLabel(procurement.status)}
                    </span>
                    <ChevronRight className="buy-desk-list-chevron" aria-hidden="true" />
                  </button>
                ) : procurement ? (
                  <button
                    type="button"
                    className="buy-desk-list-row"
                    data-selected={selected}
                    data-status={item.status}
                    data-buy-id={procurement.procurementId}
                    data-testid={`inventory-${item.sku}`}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect(procurement.procurementId)}
                  >
                    <InventoryContent item={item} />
                  </button>
                ) : (
                  <div
                    className="buy-desk-list-row"
                    data-status={item.status}
                    data-testid={`inventory-${item.sku}`}
                  >
                    <InventoryContent item={item} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="buy-desk-list-empty">
          <p>
            {hasFilters
              ? `No ${view === "inventory" ? "inventory items" : viewLabel.toLowerCase()} match your filters.`
              : view === "open"
                ? "No open buys. Inventory monitoring continues."
                : view === "buys"
                  ? "No recent buys are linked to this inventory."
                  : "No inventory items are available."}
          </p>
          {hasFilters ? (
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          ) : view === "open" && recentItems.length > 0 ? (
            <button type="button" onClick={() => setView("buys")}>
              View recent buys
            </button>
          ) : view !== "inventory" && dashboard.inventory.length > 0 ? (
            <button type="button" onClick={() => setView("inventory")}>
              View inventory
            </button>
          ) : null}
        </div>
      )}

      <footer className="buy-desk-list-footer text-muted-foreground">
        <output aria-live="polite" aria-atomic="true">
          {visibleItems.length} of {items.length}{" "}
          {view === "inventory" ? "items" : viewLabel.toLowerCase()}
        </output>
        <span>
          {view === "open"
            ? "Buyer review first · then required date · live"
            : view === "buys"
              ? "Latest linked buy per inventory item · live"
              : "On hand · recorded / Days left · calculated / Incoming · supplier-confirmed"}
        </span>
      </footer>
    </div>
  );
}
