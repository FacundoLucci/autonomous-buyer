import { useState, type ReactNode } from "react";
import { reportedStock, stockItemMatch } from "@/lib/stock-message";
import { AgentSurface, type AgentDraft, type AgentFocus, type AgentMessage } from "./agent";
import { AgentWork } from "./agent-work";
import {
  buyStatus,
  money,
  type Buy,
  type ChatRequest,
  type Draft,
  type Item,
  type Snapshot,
  type Workspace,
} from "./model";
import type { SearchState } from "./app";
import type { UpdateCount, UpdateRules } from "./inventory";

export function DemoBuyer({
  children,
  workspace,
  snapshot,
  search,
  action,
  updateCount,
  updateRules,
  save,
  revise,
  audit,
}: {
  children: ReactNode;
  workspace: Workspace;
  snapshot: Snapshot;
  search: SearchState;
  action: (kind: string, buy?: Buy, item?: Item, reviewedKey?: string) => Promise<void>;
  updateCount: UpdateCount;
  updateRules: UpdateRules;
  save: (request: ChatRequest, draft: Draft) => string;
  revise: (buyId: string, quantity: number) => void;
  audit: ReactNode;
}) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [request, setRequest] = useState<ChatRequest>();
  const [task, setTask] = useState<AgentDraft>();
  const [focus, setFocus] = useState<AgentFocus>();
  function record(text: string, role: AgentMessage["role"] = "assistant") {
    setMessages((m) => [...m, { id: crypto.randomUUID(), text, role, createdAt: Date.now() }]);
  }
  async function begin(next: ChatRequest) {
    setRequest(next);
    const item = workspace.items.find((i) => i.id === next.contextId);
    const buy = snapshot.buys.find(
      (b) => b.id === next.contextId || b.order?._id === next.contextId,
    );
    const draft: Draft =
      next.task === "settings"
        ? {
            companyName: workspace.companyName,
            shippingAddress: workspace.shippingAddress ?? undefined,
          }
        : next.task === "new_buy" && item
          ? { itemId: item.id, name: item.name, unit: item.unit }
          : next.task === "buy" && buy
            ? { name: buy.name, unit: buy.unit }
            : {};
    setTask({ id: crypto.randomUUID(), task: next.task, draft });
    const prompts: Record<ChatRequest["task"], string> = {
      stock_update: "What changed? Tell me how many you have left.",
      add_item: "What’s the item called?",
      edit_item: "What would you like to change?",
      new_buy: item ? `Ready to start a buy for ${item.name}.` : "Which item do you need?",
      buy: "Tell me what you need. Supplier research uses sample data in this demo.",
      settings: "What would you like to change about your company?",
      receive: "How many arrived?",
      confirm: "What’s the supplier confirmation and arrival date?",
      onboarding: "Create your own workspace to get started.",
    };
    record(next.prompt ?? prompts[next.task]);
  }
  async function send(text: string, selected: AgentFocus) {
    record(text, "user");
    const item =
      stockItemMatch(text, workspace.items) ??
      workspace.items.find((i) => i.id === selected.item || i.id === request?.contextId);
    const count = item ? reportedStock(text, item.unit) : null;
    if (item && count !== null) {
      await updateCount(item, count, "chat");
      setTask(undefined);
      setRequest(undefined);
      setFocus({ page: "inventory", item: item.id });
      record(`${item.name}: ${count} ${item.unit} on hand.`);
      return;
    }
    if (/where|track|status|approve|place.*order|show.*buy/i.test(text)) {
      const buy = item
        ? snapshot.buys.find((b) => b.itemId === item.id)
        : snapshot.buys.find((b) => b.id === selected.buy || b.order?._id === selected.buy);
      setTask(undefined);
      setRequest(undefined);
      setFocus({ page: "buys", buy: buy?.id });
      record(
        buy
          ? `${buy.name}: ${buyStatus(buy).toLowerCase()}${buy.order?.expectedOn ? `, expected ${buy.order.expectedOn}` : ""}.`
          : "Choose a buy below to review its status and next steps.",
      );
      return;
    }
    if (/settings|notification|inbox|audit|show.*inventory/i.test(text)) {
      setTask(undefined);
      setRequest(undefined);
      setFocus({
        page: /audit/i.test(text) ? "audit" : /inventory/i.test(text) ? "inventory" : "settings",
      });
      record("Here are the current details and controls.");
      return;
    }
    let current = request;
    const selectedBuy = snapshot.buys.find(
      (b) => b.id === selected.buy || b.order?._id === selected.buy,
    );
    const quantityChange =
      /^(?:(?:make|change|update|set)\s+(?:it|that|the quantity|the order)(?:\s+to)?\s+)?\d+\s*(?:cases?|rolls?|units?)[.!]?$/i.test(
        text.trim(),
      );
    if (selectedBuy && quantityChange) {
      if (selectedBuy.order?.status !== "draft") {
        record(
          "This purchase has already moved past review. Choose a draft purchase to change its quantity.",
        );
        setFocus({ page: "buys", buy: selectedBuy.id });
        return;
      }
      current = { task: "buy", contextId: selectedBuy.id, revision: true };
    } else if (/\badd\b.*\b(item|product)|^add /i.test(text)) current = { task: "add_item" };
    else if (/\b(buy|order|restock)\b/i.test(text) && item && request?.task !== "buy")
      current = { task: "new_buy", contextId: item.id };
    if (!current) {
      record(
        "Tell me a stock count, ask about a buy, or choose an action below. This demo uses sample data.",
      );
      return;
    }
    let draft: Draft = { ...(task?.task === current.task ? task.draft : {}) };
    if (current.task === "add_item") {
      draft = { name: text.replace(/^add (?:an? (?:item|product)\s*:?\s*)?/i, "").trim() };
      record("Ready to add. Stock stays unknown until you count it.");
    } else if (current.task === "new_buy") {
      if (!item) {
        record("Which inventory item do you need?");
        return;
      }
      draft = {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: Number(text.match(/\b\d+\b/)?.[0]) || undefined,
      };
      record("Ready to start this buy.");
    } else if (current.task === "settings") {
      draft = { companyName: text, shippingAddress: workspace.shippingAddress ?? undefined };
      record("Ready to update the company name.");
    } else if (current.task === "edit_item" && item) {
      const priority = /never|can.t run out/i.test(text)
        ? "availability"
        : /can wait/i.test(text)
          ? "flexible"
          : /cost|cheap/i.test(text)
            ? "cost"
            : undefined;
      const loss = text.match(/\$\s*(\d+(?:\.\d{1,2})?)/)?.[1];
      if (!priority && !loss) {
        record("Try a buying priority or daily loss. You can also edit the item directly below.");
        setTask(undefined);
        setFocus({ page: "inventory", item: item.id });
        return;
      }
      draft = {
        buyingPriority: priority,
        dailyLossCents: loss ? Math.round(Number(loss) * 100) : undefined,
        lossCurrency: item.lossCurrency,
      };
      record("Ready to update the buying rules.");
    } else if (current.task === "buy") {
      const buy = snapshot.buys.find((b) => b.id === current.contextId);
      const quantity = Number(text.match(/\b(\d+)\s*(?:cases?|rolls?|units?)\b/i)?.[1]);
      if (!buy?.order || !quantity) {
        record(
          "For this demo, choose an existing purchase and tell me the new quantity, such as ‘24 cases.’ Live supplier research is available in your own workspace.",
        );
        return;
      }
      revise(buy.id, quantity);
      setFocus({ page: "buys", buy: buy.id });
      if (buy.order.supplierEmail && !buy.order.buyUrl) {
        record("This needs a fresh supplier quote. Share it when it’s ready.");
        setTask(undefined);
        return;
      }
      draft = {
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
        expectedOn: new Date(Date.now() + (quantity > buy.order.quantity ? 4 : 3) * 86400000)
          .toISOString()
          .slice(0, 10),
      };
      record(
        "Demo: here’s a new sample quote. Review the changed shipping and arrival before approving.",
      );
    } else if (current.task === "receive") {
      record(
        "Use Received all for this demo. Partial deliveries are available in your own workspace.",
      );
      setTask(undefined);
      setFocus({ page: "buys", buy: current.contextId });
      return;
    } else {
      record(
        current.task === "stock_update"
          ? "Which item, and how many are left?"
          : "Create your own workspace to use the live buyer for this task.",
      );
      return;
    }
    setRequest(current);
    setTask({ id: crypto.randomUUID(), task: current.task, draft });
  }
  const last = messages.filter((m) => m.role === "assistant").at(-1);
  const ready = snapshot.buys.find((b) => b.order?.status === "draft");
  const latest = last
    ? { text: last.text, createdAt: last.createdAt }
    : {
        text: ready?.order
          ? `${ready.name}: ${money(ready.order.totalCents, ready.order.currency)} purchase ready for approval.`
          : "Tell me what you need. I’m here to help.",
        focus: ready ? { page: "buys" as const, buy: ready.id } : undefined,
      };
  return (
    <AgentSurface
      demo
      search={search}
      state={{ messages, latest, busy: false, status: task ? "Needs your input" : "Ready", focus }}
      onBegin={begin}
      onSend={send}
      renderWork={(selected, openTask, show, showTask) => (
        <AgentWork
          key={`${task?.id ?? "records"}:${selected.page}:${selected.item ?? selected.buy ?? ""}`}
          focus={selected}
          workspace={workspace}
          snapshot={snapshot}
          task={showTask ? task : undefined}
          save={
            task && request
              ? async () => {
                  const result = save(request, task.draft);
                  const next: AgentFocus =
                    request.task === "new_buy" || request.task === "buy"
                      ? { page: "buys", buy: result }
                      : request.task === "settings"
                        ? { page: "settings" }
                        : { page: "inventory", item: result };
                  setTask(undefined);
                  setRequest(undefined);
                  setFocus(next);
                  record(
                    request.task === "new_buy"
                      ? "Buy started."
                      : request.task === "buy"
                        ? "Purchase ready for approval."
                        : "Changes saved.",
                  );
                }
              : undefined
          }
          begin={openTask}
          show={show}
          action={async (kind, buy, item, reviewedKey) => {
            await action(kind, buy, item, reviewedKey);
            const summaries: Record<string, string> = {
              approve: `${buy?.name}: ${buy?.order ? money(buy.order.totalCents, buy.order.currency) : "purchase"} approved.`,
              receive: `${buy?.name}: delivery recorded.`,
              archive: `${item?.name} archived.`,
              cancel: `${buy?.name}: buy cancelled.`,
              send: `${buy?.name}: demo purchase order queued.`,
              check_delivery: `${buy?.name}: checking delivery.`,
            };
            record(summaries[kind] ?? "Updated.");
          }}
          updateCount={updateCount}
          updateRules={updateRules}
          settings={
            <p className="desk-muted">Notification delivery is available in your own workspace.</p>
          }
          audit={audit}
        />
      )}
    >
      {children}
    </AgentSurface>
  );
}
