import { DemoSupplierDirectory } from "./suppliers";
import { useState, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceScreen, type Navigation, type SearchState } from "./app";
import { CloseButton } from "./primitives";
import { AuditLog, type AuditEntry } from "./audit";
import { DraftPreview } from "./chat";
import { DemoBuyer } from "./agent-demo";
import { reportedStock, stockItemMatch } from "@/lib/stock-message";
import type { UpdateCount, UpdateRules } from "./inventory";
import type { Id, Doc } from "../../../convex/_generated/dataModel";
import type { Buy, ChatRequest, Draft, Item, Snapshot, Workspace } from "./model";
const id = (s: string) => s as Id<"inventoryItems">;
const now = Date.now();
const day = (offset: number) => new Date(now + offset * 86400000).toISOString().slice(0, 10);
const items: Item[] = [
  {
    id: id("demo-cups"),
    name: "12 oz paper cups",
    sku: "CUP-12",
    unit: "cases",
    quantity: 4,
    dailyUsage: 2,
    leadTimeDays: 3,
    supplier: "WebstaurantStore",
    estimatedQuantity: 4,
  },
  {
    id: id("demo-lids"),
    name: "Deli lids",
    sku: "LID-12",
    unit: "cases",
    quantity: 18,
    dailyUsage: 1,
    leadTimeDays: 3,
    supplier: "WebstaurantStore",
    estimatedQuantity: 18,
  },
  {
    id: id("demo-towels"),
    name: "Paper towels",
    sku: "TWL-01",
    unit: "cases",
    quantity: 32,
    dailyUsage: 2,
    leadTimeDays: 2,
    supplier: "Uline",
    estimatedQuantity: 32,
  },
  {
    id: id("demo-gloves"),
    name: "Nitrile gloves",
    sku: "GLV-M",
    unit: "cases",
    quantity: 3,
    dailyUsage: 1,
    leadTimeDays: 4,
    supplier: "Uline",
    estimatedQuantity: 3,
  },
  {
    id: id("demo-labels"),
    name: "Thermal labels",
    sku: "LBL-46",
    unit: "rolls",
    quantity: 16,
    dailyUsage: 1,
    leadTimeDays: 2,
    supplier: "Uline",
    estimatedQuantity: 16,
  },
].map((i) => ({
  ...i,
  evidence: null,
  sourceUrl: null,
  sourceLabel: null,
  sourceId: null,
  buyUrl: null,
  supplierEmail: null,
  coverageDays: 30,
  forecastQuantity: undefined,
  forecastAt: undefined,
  replenishmentEnabled: true,
  automationState: "watching",
  automationNote: "Sample: I’m watching stock and preparing replenishment when needed.",
  preparationDays: 1,
  orderMultiple: 1,
  preferredCoverageDays: 30,
  casePack: 1,
  stockCountedAt: now,
  safetyStockDays: 3,
  buyingPriority:
    i.id === "demo-lids"
      ? ("availability" as const)
      : i.id === "demo-labels"
        ? ("flexible" as const)
        : null,
  dailyLossCents: i.id === "demo-lids" ? 20000 : null,
  lossCurrency: "USD",
  stockoutImpact: i.id === "demo-lids" ? "We can’t sell soup" : null,
}));
function order(
  item: Item,
  key: string,
  status: Doc<"companyOrders">["status"],
  total: number,
): Doc<"companyOrders"> {
  return {
    _id: key as Id<"companyOrders">,
    _creationTime: now,
    organizationId: "demo-org" as Id<"organizations">,
    inventoryItemId: item.id,
    createdBy: "demo-user" as Id<"users">,
    number: `BH-${key.slice(-3).toUpperCase()}`,
    itemName: item.name,
    sku: item.sku,
    unit: item.unit,
    quantity: 20,
    receivedQuantity: status === "received" ? 20 : 0,
    unitPriceCents: Math.round(total / 20),
    freightCents: 0,
    taxCents: 0,
    totalCents: total,
    currency: "USD",
    supplier: item.supplier!,
    shipTo: "100 Market Street, Chicago, IL 60601",
    requiredBy: day(3),
    notes: "",
    orderingMethod: "purchase_order",
    supplierPoVerified: true,
    status,
    isOpen: status !== "received",
    createdAt: now - 3600000,
    updatedAt: now,
    placedAt: status === "placed" || status === "received" ? now - 86400000 : undefined,
    expectedOn: status === "placed" ? day(2) : undefined,
  };
}
const initialBuys: Buy[] = [
  {
    id: "demo-buy-cups",
    automatic: true,
    planVersion: 1,
    purchasingState: "ready",
    purchasingNote: "Sample: your usage triggered this purchase. It’s ready for approval.",
    itemId: items[0].id,
    name: items[0].name,
    unit: "cases",
    quantity: 20,
    requiredBy: day(3),
    closed: false,
    createdAt: now - 3600000,
    order: order(items[0], "demo-order-001", "draft", 40000),
  },
  {
    id: "demo-buy-lids",
    automatic: true,
    planVersion: 1,
    purchasingState: "ready",
    purchasingNote: undefined,
    itemId: items[1].id,
    name: items[1].name,
    unit: "cases",
    quantity: 20,
    requiredBy: day(2),
    closed: false,
    createdAt: now - 86400000,
    order: order(items[1], "demo-order-002", "placed", 28600),
  },
  {
    id: "demo-buy-towels",
    automatic: true,
    planVersion: 1,
    purchasingState: "ready",
    purchasingNote: undefined,
    itemId: items[2].id,
    name: items[2].name,
    unit: "cases",
    quantity: 20,
    requiredBy: day(-1),
    closed: true,
    createdAt: now - 172800000,
    order: order(items[2], "demo-order-003", "received", 96000),
  },
];
export function DemoDesk({ search, navigate }: { search: SearchState; navigate: Navigation }) {
  const [workspace, setWorkspace] = useState<Workspace>({
    organizationId: "demo-org" as Id<"organizations">,
    companyName: "Acme Foods",
    shippingAddress: "100 Market Street, Chicago, IL 60601",
    inbox: null,
    items,
  });
  const [snapshot, setSnapshot] = useState<Snapshot>({
    buys: initialBuys,
    activity: [
      {
        id: "a1",
        summary: "Paper cups are ready for your approval.",
        createdAt: now - 600000,
        target: "demo-buy-cups",
      },
      {
        id: "a2",
        summary: "Deli lids arrive in two days.",
        createdAt: now - 3600000,
        target: "demo-buy-lids",
      },
      {
        id: "a3",
        summary: "20 cases of paper towels received.",
        createdAt: now - 86400000,
        target: "demo-buy-towels",
      },
    ],
    truncated: false,
  });
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  function audit(
    name: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    via: "manual" | "chat" = "manual",
    action: AuditEntry["action"] = "updated",
  ) {
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    const text = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const changes = fields
      .filter((field) => text(before[field]) !== text(after[field]))
      .map((field) => ({ field, before: text(before[field]), after: text(after[field]) }));
    if (!changes.length) return;
    setAuditEntries((entries) => [
      { _id: crypto.randomUUID(), name, action, actor: "You", via, changes, createdAt: Date.now() },
      ...entries,
    ]);
  }
  function event(summary: string) {
    setSnapshot((s) => ({
      ...s,
      activity: [
        { id: crypto.randomUUID(), summary, createdAt: Date.now(), target: null },
        ...s.activity,
      ],
    }));
  }
  const updateCount: UpdateCount = async (item, count, via = "manual") => {
    if (!Number.isFinite(count) || count < 0 || count > 1_000_000_000)
      throw new Error("Invalid stock count.");
    setWorkspace((w) => ({
      ...w,
      items: w.items.map((i) =>
        i.id === item.id
          ? { ...i, quantity: count, estimatedQuantity: count, stockCountedAt: Date.now() }
          : i,
      ),
    }));
    audit(
      item.name,
      { quantityOnHand: item.quantity, stockCountedAt: item.stockCountedAt },
      { quantityOnHand: count, stockCountedAt: Date.now() },
      via,
    );
    event(`${item.name}: ${count} ${item.unit} on hand.`);
  };
  const updateRules: UpdateRules = async (item, rules) => {
    setWorkspace((w) => ({
      ...w,
      items: w.items.map((i) =>
        i.id === item.id
          ? { ...i, ...rules, coverageDays: rules.preferredCoverageDays ?? i.coverageDays }
          : i,
      ),
    }));
    audit(
      item.name,
      Object.fromEntries(Object.keys(rules).map((key) => [key, item[key as keyof Item]])),
      rules,
    );
    event(`Buying rules updated for ${item.name}.`);
  };
  async function action(kind: string, buy?: Buy, item?: Item) {
    if ((kind === "enable_replenishment" || kind === "pause_replenishment") && item) {
      const enabled = kind === "enable_replenishment";
      setWorkspace((w) => ({
        ...w,
        items: w.items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                replenishmentEnabled: enabled,
                automationNote: enabled
                  ? "Sample: I’m watching your stock."
                  : "Replenishment is paused.",
              }
            : i,
        ),
      }));
      event(`${item.name}: sample replenishment ${enabled ? "enabled" : "paused"}.`);
      return;
    }
    if (kind === "archive" && item) {
      audit(item.name, { archived: false }, { archived: true });
      setWorkspace((w) => ({ ...w, items: w.items.filter((i) => i.id !== item.id) }));
      return;
    }
    if (!buy) return;
    if (kind === "request_cancellation" && buy.order) {
      setSnapshot((s) => ({
        ...s,
        buys: s.buys.map((b) =>
          b.id === buy.id && b.order
            ? { ...b, order: { ...b.order, cancellationRequestedAt: Date.now() } }
            : b,
        ),
      }));
      event("Sample: cancellation requested. Awaiting supplier confirmation.");
      return;
    }
    if (kind === "cancel" || kind === "record_cancellation") {
      audit(buy.name, { closed: buy.closed }, { closed: true });
      setSnapshot((s) => ({
        ...s,
        buys: s.buys.map((b) =>
          b.id === buy.id
            ? {
                ...b,
                closed: true,
                order: b.order ? { ...b.order, status: "cancelled", isOpen: false } : null,
              }
            : b,
        ),
      }));
      return;
    }
    audit(
      buy.name,
      { status: buy.order?.status },
      { status: kind === "approve" ? "placed" : kind === "receive" ? "received" : "sent" },
    );
    const status = kind === "approve" ? "placed" : kind === "receive" ? "received" : "sent";
    setSnapshot((s) => ({
      ...s,
      buys: s.buys.map((b) =>
        b.id === buy.id && b.order
          ? {
              ...b,
              order: {
                ...b.order,
                status,
                ...(kind === "approve"
                  ? {
                      executionState: "confirmed" as const,
                      confirmation: "SAMPLE-CONFIRMATION",
                      expectedOn: day(2),
                      placedAt: Date.now(),
                    }
                  : {}),
                isOpen: status !== "received",
                receivedQuantity:
                  status === "received" ? b.order.quantity : b.order.receivedQuantity,
              },
            }
          : b,
      ),
    }));
    if (kind === "receive" && buy.order) {
      const count = buy.order.quantity - buy.order.receivedQuantity;
      const item = workspace.items.find((i) => i.id === buy.itemId);
      if (item)
        audit(
          item.name,
          { quantityOnHand: item.quantity },
          { quantityOnHand: (item.quantity ?? 0) + count },
        );
      setWorkspace((w) => ({
        ...w,
        items: w.items.map((i) =>
          i.id === buy.itemId
            ? {
                ...i,
                quantity: (i.quantity ?? 0) + count,
                estimatedQuantity: (i.estimatedQuantity ?? 0) + count,
              }
            : i,
        ),
      }));
    }
    event(
      `${buy.name}: ${kind === "approve" ? "sample purchase approved and supplier confirmation received" : kind === "receive" ? "delivery received" : "sample purchase order sent"}.`,
    );
  }
  function save(request: ChatRequest, draft: Draft): string {
    if (request.task === "add_item") {
      const itemId = id(crypto.randomUUID());
      setWorkspace((w) => ({
        ...w,
        items: [
          ...w.items,
          {
            ...items[0],
            id: itemId,
            name: draft.name!,
            sku: draft.name!.toUpperCase().slice(0, 20),
            quantity: null,
            estimatedQuantity: null,
            dailyUsage: null,
            leadTimeDays: null,
            supplier: null,
            unit: "units",
            stockCountedAt: null,
            buyingPriority: null,
            dailyLossCents: null,
            stockoutImpact: null,
          },
        ],
      }));
      audit(draft.name!, {}, { name: draft.name, unit: "units" }, "chat", "created");
      event(`${draft.name} added to inventory.`);
      return itemId;
    }
    if (request.task === "new_buy") {
      const item = workspace.items.find((i) => i.id === draft.itemId) ?? workspace.items[0];
      const buyId = crypto.randomUUID();
      setSnapshot((s) => ({
        ...s,
        buys: [
          {
            id: buyId,
            automatic: false,
            planVersion: undefined,
            purchasingState: undefined,
            purchasingNote: undefined,
            itemId: item.id,
            name: item.name,
            unit: item.unit,
            quantity: draft.quantity ?? null,
            requiredBy: null,
            closed: false,
            createdAt: Date.now(),
            order: null,
          },
          ...s.buys,
        ],
      }));
      audit(item.name, {}, { quantity: draft.quantity, status: "Started" }, "chat", "created");
      event(`Buy started for ${item.name}.`);
      return buyId;
    }
    if (request.task === "edit_item") {
      const item = workspace.items.find((i) => i.id === request.contextId);
      if (item) {
        const after = {
          quantityOnHand: draft.stock ?? item.quantity,
          buyingPriority: draft.buyingPriority ?? item.buyingPriority,
          dailyLossCents: draft.dailyLossCents ?? item.dailyLossCents,
          stockoutImpact: draft.stockoutImpact ?? item.stockoutImpact,
        };
        audit(
          item.name,
          {
            quantityOnHand: item.quantity,
            buyingPriority: item.buyingPriority,
            dailyLossCents: item.dailyLossCents,
            stockoutImpact: item.stockoutImpact,
          },
          after,
          "chat",
        );
      }
      setWorkspace((w) => ({
        ...w,
        items: w.items.map((i) =>
          i.id === request.contextId
            ? {
                ...i,
                quantity: draft.stock ?? i.quantity,
                estimatedQuantity: draft.stock ?? i.estimatedQuantity,
                stockCountedAt: draft.stock === undefined ? i.stockCountedAt : Date.now(),
                buyingPriority: draft.buyingPriority ?? i.buyingPriority,
                dailyLossCents: draft.dailyLossCents ?? i.dailyLossCents,
                stockoutImpact: draft.stockoutImpact ?? i.stockoutImpact,
              }
            : i,
        ),
      }));
      event("Stock count updated.");
      return request.contextId!;
    }
    if (request.task === "buy") {
      const buy = snapshot.buys.find((b) => b.id === request.contextId);
      if (
        !buy?.order ||
        buy.order.status !== "draft" ||
        !draft.quantity ||
        !draft.expectedOn ||
        draft.unitPriceCents === undefined ||
        draft.freightCents === undefined ||
        draft.taxCents === undefined
      )
        throw new Error("Check the new terms first.");
      const updated = {
        ...buy.order,
        buyUrl: draft.buyUrl ?? buy.order.buyUrl,
        supplier: draft.supplier ?? buy.order.supplier,
        quantity: draft.quantity,
        unitPriceCents: draft.unitPriceCents,
        freightCents: draft.freightCents,
        taxCents: draft.taxCents,
        totalCents: draft.quantity * draft.unitPriceCents + draft.freightCents + draft.taxCents,
        quotedArrival: draft.expectedOn,
        reviewRequired: undefined,
        requestedQuantity: undefined,
      };
      audit(
        buy.name,
        {
          quantity: buy.order.quantity,
          totalCents: buy.order.totalCents,
          quotedArrival: buy.order.quotedArrival,
        },
        {
          quantity: updated.quantity,
          totalCents: updated.totalCents,
          quotedArrival: updated.quotedArrival,
        },
        "chat",
      );
      setSnapshot((s) => ({
        ...s,
        buys: s.buys.map((b) =>
          b.id === buy.id ? { ...b, quantity: updated.quantity, order: updated } : b,
        ),
      }));
      return buy.id;
    }
    if (request.task === "settings") {
      audit(
        workspace.companyName,
        { name: workspace.companyName, shippingAddress: workspace.shippingAddress },
        {
          name: draft.companyName ?? workspace.companyName,
          shippingAddress: draft.shippingAddress ?? workspace.shippingAddress,
        },
        "chat",
      );
      setWorkspace((w) => ({
        ...w,
        companyName: draft.companyName ?? w.companyName,
        shippingAddress: draft.shippingAddress ?? w.shippingAddress,
      }));
      return "demo-org";
    }
    return request.contextId ?? "";
  }
  const revise = (buyId: string, quantity: number) => {
    const buy = snapshot.buys.find((b) => b.id === buyId);
    if (buy?.order)
      audit(
        buy.name,
        {
          reviewRequired: buy.order.reviewRequired ?? false,
          requestedQuantity: buy.order.requestedQuantity,
        },
        { reviewRequired: true, requestedQuantity: quantity },
        "chat",
      );
    setSnapshot((s) => ({
      ...s,
      buys: s.buys.map((b) =>
        b.id === buyId && b.order
          ? { ...b, order: { ...b.order, reviewRequired: true, requestedQuantity: quantity } }
          : b,
      ),
    }));
  };
  return (
    <DemoBuyer
      workspace={workspace}
      snapshot={snapshot}
      search={search}
      action={action}
      updateCount={updateCount}
      updateRules={updateRules}
      save={save}
      revise={revise}
      audit={<AuditLog entries={auditEntries} />}
    >
      <WorkspaceScreen
        workspace={workspace}
        snapshot={snapshot}
        search={search}
        navigate={navigate}
        signOut={() => navigate({ demo: false, page: "dashboard" })}
        action={action}
        updateCount={updateCount}
        updateRules={updateRules}
        audit={<AuditLog entries={auditEntries} />}
        settings={
          <>
            <DemoSupplierDirectory />
            <p className="desk-muted">Notification delivery is available in your own workspace.</p>
          </>
        }
        renderChat={(request, onClose, onSaved) => (
          <DemoChat
            key={`${request.task}:${request.contextId ?? ""}`}
            request={request}
            buy={snapshot.buys.find((b) => b.id === request.contextId)}
            onRevise={(quantity) => {
              const buy = snapshot.buys.find((b) => b.id === request.contextId);
              if (buy?.order)
                audit(
                  buy.name,
                  {
                    reviewRequired: buy.order.reviewRequired ?? false,
                    requestedQuantity: buy.order.requestedQuantity,
                  },
                  { reviewRequired: true, requestedQuantity: quantity },
                  "chat",
                );
              setSnapshot((s) => ({
                ...s,
                buys: s.buys.map((b) =>
                  b.id === request.contextId && b.order
                    ? {
                        ...b,
                        order: { ...b.order, reviewRequired: true, requestedQuantity: quantity },
                      }
                    : b,
                ),
              }));
            }}
            items={workspace.items}
            updateCount={updateCount}
            onClose={onClose}
            onSave={(draft) => onSaved(save(request, draft))}
          />
        )}
      />
    </DemoBuyer>
  );
}
function DemoChat({
  request,
  buy,
  onRevise,
  items,
  updateCount,
  onClose,
  onSave,
}: {
  request: ChatRequest;
  buy?: Buy;
  onRevise: (quantity: number) => void;
  items: Item[];
  updateCount: UpdateCount;
  onClose: () => void;
  onSave: (d: Draft) => void;
}) {
  const [input, setInput] = useState(""),
    [draft, setDraft] = useState<Draft | null>(null),
    [reply, setReply] = useState(""),
    [userText, setUserText] = useState("");
  const prompts = {
    stock_update: "What changed? For example, ‘We only have two cases of lids left.’",
    add_item: "What’s the item called?",
    new_buy: "What do you need, and how much?",
    edit_item: "How many do you have on hand?",
    settings: "What’s the new company name?",
    buy: "Live supplier research is available in your own workspace.",
    receive: "Record a full delivery with the Received all button in this demo.",
    confirm: "Supplier confirmations are available in your own workspace.",
    onboarding: "What’s your company called?",
  };
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setUserText(input.trim());
    if (request.task === "buy") {
      if (!buy?.order || buy.order.status !== "draft") {
        setReply("Choose a purchase that still needs approval.");
        return;
      }
      const quantity = Number(input.match(/\b(\d+)\s*(?:cases?|rolls?|units?)\b/i)?.[1]);
      if (!quantity || quantity > 1000000) {
        setReply("How many do you need? For example, ‘I actually need 24 cases.’");
        return;
      }
      onRevise(quantity);
      if (buy.order.supplierEmail && !buy.order.buyUrl) {
        setReply(
          "This needs a fresh supplier quote for the new quantity, shipping, and arrival. Nothing has been approved or sent.",
        );
        setDraft(null);
        return;
      }
      setDraft({
        name: buy.name,
        unit: buy.unit,
        quantity,
        supplier: buy.order.supplier,
        buyUrl: buy.order.buyUrl ?? "https://www.webstaurantstore.com/",
        requiredBy: buy.order.requiredBy,
        unitPriceCents: buy.order.unitPriceCents,
        freightCents: quantity > buy.order.quantity ? 2000 : buy.order.freightCents,
        taxCents: buy.order.taxCents,
        currency: buy.order.currency,
        expectedOn: day(quantity > buy.order.quantity ? 4 : 3),
      });
      setReply(
        "Demo: here’s a fresh sample quote. The new quantity changes shipping and arrival, so it needs your approval again.",
      );
      setInput("");
      return;
    }
    if (request.task === "stock_update") {
      const item =
        stockItemMatch(input, items) ??
        items.find((i) => i.id === (request.contextId ?? draft?.itemId));
      if (!item) {
        setReply("Which inventory item do you mean?");
        return;
      }
      const count = reportedStock(input, item.unit);
      if (count === null) {
        setDraft({ itemId: item.id });
        setReply(`How many ${item.unit} are left?`);
        return;
      }
      void updateCount(item, count, "chat")
        .then(() => setReply(`${item.name}: ${count} ${item.unit} on hand.`))
        .catch(() => setReply("That count didn’t save. Try again."));
      setInput("");
      return;
    }
    if (request.task === "add_item") {
      setDraft({ name: input.trim() });
      setReply("Ready to add. Stock stays unknown until you count it.");
    } else if (request.task === "new_buy") {
      const item =
        items.find((i) => i.id === request.contextId) ??
        items.find(
          (i) =>
            input.toLowerCase().includes(i.name.toLowerCase()) ||
            i.name
              .toLowerCase()
              .split(" ")
              .some((w) => w.length > 3 && input.toLowerCase().includes(w)),
        );
      if (!item) {
        setReply("Which inventory item do you need?");
        return;
      }
      setDraft({
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: Number(input.match(/\b\d+\b/)?.[0]) || undefined,
      });
      setReply("Ready to start.");
    } else if (request.task === "edit_item") {
      const item = items.find((i) => i.id === request.contextId)!;
      const stock = reportedStock(input, item.unit);
      const priority = /never|cannot run out|can.t run out/i.test(input)
        ? "availability"
        : /can wait|okay.*out/i.test(input)
          ? "flexible"
          : /cost|cheap/i.test(input)
            ? "cost"
            : undefined;
      const loss = input.match(/\$\s*(\d+(?:\.\d{1,2})?)/)?.[1];
      if (stock === null && !priority && !loss) {
        setReply(
          "Try a remaining count, daily loss, or buying priority. You can also edit these directly.",
        );
        return;
      }
      setDraft({
        stock: stock ?? undefined,
        buyingPriority: priority,
        dailyLossCents: loss ? Math.round(Number(loss) * 100) : undefined,
        unit: item.unit,
        lossCurrency: item.lossCurrency,
      });
      setReply("Ready to update.");
    } else if (request.task === "settings") {
      setDraft({ companyName: input.trim() });
      setReply("Ready to update.");
    } else {
      setReply("Create your workspace to use the live buyer.");
    }
    setInput("");
  }
  return (
    <section className="desk-chat" aria-label="Demo task">
      <div className="desk-chat-top">
        <h2 className="sr-only">
          {request.name ??
            (request.task === "add_item"
              ? "Add item"
              : request.task === "new_buy"
                ? "Start a buy"
                : "Your buyer")}
        </h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="desk-chat-layout">
        <div className="desk-chat-conversation">
          <div className="desk-messages" role="log">
            {userText && <p className="desk-user">{userText}</p>}
            <p className="desk-assistant">{reply || request.prompt || prompts[request.task]}</p>
          </div>
          <form className="desk-composer" onSubmit={submit}>
            <Textarea
              aria-label="Message"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={request.revision ? "No, because…" : "Tell me what you know…"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="desk-composer-actions">
              <span className="desk-working">Demo · sample data</span>
              <Button type="submit" size="icon" aria-label="Send message" disabled={!input.trim()}>
                <ArrowUp size={18} />
              </Button>
            </div>
          </form>
        </div>
        {draft && request.task !== "stock_update" && (
          <aside className="desk-chat-preview">
            <DraftPreview draft={draft} task={request.task} />
            <Button onClick={() => onSave(draft)}>
              {request.task === "new_buy"
                ? "Start buy"
                : request.task === "add_item"
                  ? "Add item"
                  : request.task === "buy"
                    ? "Review purchase"
                    : "Save changes"}
            </Button>
          </aside>
        )}
      </div>
    </section>
  );
}
