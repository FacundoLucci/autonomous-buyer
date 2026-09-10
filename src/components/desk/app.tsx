import { useState, type ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { useAuthActions, useConvexAuth } from "@/lib/buyer-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { inventoryPlan } from "@/lib/inventory-planning";
import { useClock } from "@/lib/use-clock";
import { StockCount, BuyingRules, type UpdateCount, type UpdateRules } from "./inventory";
import { Brand, Empty, Loading, OutLink, PageHeading } from "./primitives";
import { Landing } from "./landing";
import { TaskChat } from "./chat";
import { LiveBuyer } from "./agent-live";
import { useBuyer } from "./agent";
import { DemoDesk } from "./demo";
import { PurchasingInbox } from "./mail";
import { SupplierDirectory } from "./suppliers";
import { LiveAuditLog } from "./audit";
import { Fact, Sentence, BuySentence, Decision, ApprovalPrompt, units } from "./sentences";
import { approvalKey } from "@/lib/buy-review";
import { ReplenishmentControl, PurchasingProgress, OrderProgress } from "./automation";
import {
  buyStatus,
  dateLabel,
  errorText,
  isOpen,
  money,
  type Buy,
  type ChatRequest,
  type Item,
  type Snapshot,
  type Workspace,
} from "./model";
export type SearchState = {
  demo: boolean;
  page: "dashboard" | "inventory" | "buys" | "settings" | "audit";
  item?: string;
  buy?: string;
};
export type Navigation = (next: SearchState) => void;
export function DeskHome({ search, navigate }: { search: SearchState; navigate: Navigation }) {
  return search.demo ? (
    <DemoDesk search={search} navigate={navigate} />
  ) : (
    <RealDesk search={search} navigate={navigate} />
  );
}
function RealDesk({ search, navigate }: { search: SearchState; navigate: Navigation }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const workspace = useQuery(api.onboarding.getWorkspace, isAuthenticated ? {} : "skip");
  const user = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  if (isLoading || (isAuthenticated && (workspace === undefined || user === undefined)))
    return <Loading />;
  if (!isAuthenticated) return <Landing />;
  if (!workspace)
    return <Landing resumeSetup={!!user && !user.isJudgeDemo && !user.canApproveDemo} />;
  return <LiveWorkspace workspace={workspace} search={search} navigate={navigate} />;
}
function LiveWorkspace({
  workspace,
  search,
  navigate,
}: {
  workspace: Workspace;
  search: SearchState;
  navigate: Navigation;
}) {
  const snapshot = useQuery(api.desk.snapshot, {});
  const [supplierSession, setSupplierSession] = useState<{
    url: string;
    orderId: Id<"companyOrders">;
  } | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const { signOut } = useAuthActions();
  const helpSession = useAction(api.browserCheckout.helpSession);
  const retryBrowser = useAction(api.browserCheckout.retry);
  const retryExecution = useMutation(api.companyOrders.retryExecution);
  const retryResearch = useMutation(api.companyPurchasing.retry);
  const begin = useMutation(api.buyer.begin);
  const provisionInbox = useAction(api.companyMail.provision);
  const recordCount = useMutation(api.companyInventory.recordCount),
    updateRules = useMutation(api.companyInventory.updateRules),
    setAutomation = useMutation(api.companyInventory.setAutomation);
  const approve = useMutation(api.companyOrders.approve),
    send = useMutation(api.companyOrders.send),
    checkDelivery = useMutation(api.companyOrders.checkDelivery),
    receive = useMutation(api.companyOrders.receive),
    archive = useMutation(api.companyInventory.archiveItem),
    cancel = useMutation(api.desk.cancelBuy);
  const cancelOrder = useMutation(api.companyOrders.cancel);
  const requestCancellation = useMutation(api.companyOrders.requestCancellation);
  async function action(kind: string, buy?: Buy, item?: Item, reviewedKey?: string) {
    if ((kind === "enable_replenishment" || kind === "pause_replenishment") && item) {
      await setAutomation({ itemId: item.id, enabled: kind === "enable_replenishment" });
      return;
    }
    if (kind === "archive" && item) {
      await archive({ itemId: item.id, archived: true });
      navigate({ ...search, item: undefined });
      return;
    }
    if (kind === "cancel" && buy) {
      if (buy.order)
        await cancelOrder({ orderId: buy.order._id, note: "Cancelled before submission." });
      else await cancel({ id: buy.id });
      return;
    }
    if (kind === "retry_research" && buy) {
      await retryResearch({ buyId: buy.id as Id<"companyBuys"> });
      return;
    }
    if (!buy?.order) return;
    const orderId = buy.order._id;
    if (kind === "request_cancellation") {
      await requestCancellation({ orderId });
      return;
    }
    if (kind === "record_cancellation") {
      await cancelOrder({
        orderId,
        supplierConfirmed: true,
        note: "Buyer reports the supplier confirmed cancellation of the remaining delivery.",
      });
      return;
    }
    if (kind === "check_order") {
      if (buy.order.orderingMethod === "website") await retryBrowser({ orderId });
      else if (buy.order.providerOutboundId) await checkDelivery({ orderId });
      else await retryExecution({ orderId });
      return;
    }
    if (kind === "resolve_order") {
      if (buy.order.orderingMethod === "website" && buy.order.browserJobId) {
        const url = await helpSession({ orderId });
        if (new URL(url).protocol !== "https:") throw new Error("Invalid supplier session.");
        setSessionError(null);
        setSupplierSession({ url, orderId });
      } else {
        await begin({ task: "buy", contextId: buy.id });
      }
      return;
    }
    if (kind === "approve") await approve({ orderId, reviewedKey });
    if (kind === "send") {
      if (!workspace.inbox) await provisionInbox({});
      await send({ orderId });
    }
    if (kind === "check_delivery") await checkDelivery({ orderId });
    if (kind === "receive")
      await receive({
        orderId,
        quantity: buy.order.quantity - buy.order.receivedQuantity,
        requestKey: `full-receipt:${orderId}:${buy.order.receivedQuantity}`,
      });
  }
  const updateCount: UpdateCount = async (item, quantity) => {
    await recordCount({ itemId: item.id, quantity });
  };
  const saveRules: UpdateRules = async (item, rules) => {
    await updateRules({ itemId: item.id, ...rules });
  };
  const settings = (
    <>
      <SupplierDirectory />
      <PurchasingInbox email={workspace.inbox?.email} />
      <Alerts />
    </>
  );
  return (
    <LiveBuyer
      workspace={workspace}
      snapshot={snapshot}
      search={search}
      action={action}
      updateCount={updateCount}
      updateRules={saveRules}
      settings={settings}
    >
      <WorkspaceScreen
        workspace={workspace}
        snapshot={snapshot}
        search={search}
        navigate={navigate}
        signOut={() => void signOut()}
        action={action}
        updateCount={async (item, quantity) => {
          await recordCount({ itemId: item.id, quantity });
        }}
        updateRules={async (item, rules) => {
          await updateRules({ itemId: item.id, ...rules });
        }}
        renderChat={(request, onClose, onSaved) => (
          <TaskChat
            key={`${request.task}:${request.contextId ?? ""}`}
            request={request}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
        audit={search.page === "audit" ? <LiveAuditLog /> : null}
        settings={settings}
      />
      <Dialog
        open={!!supplierSession}
        onOpenChange={(open) => {
          if (!open) setSupplierSession(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Help with supplier checkout</DialogTitle>
          <DialogDescription>
            Open the supplier session to complete the requested login or account step. The agent
            will check the purchase terms again before ordering.
          </DialogDescription>
          {supplierSession && <OutLink href={supplierSession.url}>Open supplier session</OutLink>}
          <Button
            disabled={sessionBusy}
            onClick={async () => {
              if (!supplierSession) return;
              setSessionBusy(true);
              setSessionError(null);
              try {
                await retryBrowser({ orderId: supplierSession.orderId });
                setSupplierSession(null);
              } catch (error) {
                setSessionError(errorText(error));
              } finally {
                setSessionBusy(false);
              }
            }}
          >
            I’ve finished — continue
          </Button>
          {sessionError && (
            <p role="alert" className="desk-error">
              {sessionError}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </LiveBuyer>
  );
}
export type WorkspaceScreenProps = {
  workspace: Workspace;
  snapshot: Snapshot | undefined;
  search: SearchState;
  navigate: Navigation;
  signOut: () => void;
  action: (kind: string, buy?: Buy, item?: Item, reviewedKey?: string) => Promise<void>;
  updateCount: UpdateCount;
  updateRules: UpdateRules;
  renderChat: (
    request: ChatRequest,
    onClose: () => void,
    onSaved: (id: string) => void,
  ) => ReactNode;
  settings?: ReactNode;
  audit?: ReactNode;
};
export function WorkspaceScreen({
  workspace,
  snapshot,
  search,
  navigate,
  signOut,
  action,
  updateCount,
  updateRules,
  renderChat,
  settings,
  audit,
}: WorkspaceScreenProps) {
  const now = useClock();
  const buyer = useBuyer();
  const [chat, setChat] = useState<ChatRequest | null>(null),
    [filter, setFilter] = useState(""),
    [onlyLow, setOnlyLow] = useState(false),
    [completed, setCompleted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [confirm, setConfirm] = useState<string | null>(null);
  const item = workspace.items.find((i) => i.id === search.item);
  const buy = snapshot?.buys.find((b) => b.id === search.buy || b.order?._id === search.buy);
  const openBuys = snapshot?.buys.filter(isOpen) ?? [];
  const plans = new Map(
    workspace.items.map((i) => [i.id, inventoryPlan(i, confirmedDeliveries(i.id, openBuys), now)]),
  );
  const low = workspace.items.filter((i) => plans.get(i.id)!.low);
  const sortedItems = [...workspace.items].sort(
    (a, b) =>
      Number(plans.get(b.id)!.attention) - Number(plans.get(a.id)!.attention) ||
      Number(b.buyingPriority === "availability") - Number(a.buyingPriority === "availability") ||
      (b.dailyLossCents ?? 0) - (a.dailyLossCents ?? 0),
  );
  const attentionItems = sortedItems.filter(
    (i) =>
      plans.get(i.id)!.attention ||
      openBuys.some(
        (b) =>
          b.itemId === i.id && (b.order?.status === "draft" || b.order?.status === "send_failed"),
      ),
  );
  const view = (page: SearchState["page"], detail?: { item?: string; buy?: string }) => {
    setChat(null);
    setError(null);
    setConfirm(null);
    setFilter("");
    setOnlyLow(false);
    navigate({ demo: search.demo, page, ...detail });
  };
  async function run(kind: string, reviewedKey?: string) {
    setBusy(true);
    setError(null);
    try {
      await action(kind, buy, item, reviewedKey);
      setConfirm(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const openChat = (request: ChatRequest) => {
    if (buyer) {
      buyer(request);
      return;
    }
    setChat(request);
    setError(null);
  };
  const onSaved = (id: string) => {
    const task = chat?.task;
    setChat(null);
    if (task === "add_item") view("inventory", { item: id });
    else if (task === "new_buy" || task === "buy") view("buys", { buy: id });
  };
  const chatView = chat ? renderChat(chat, () => setChat(null), onSaved) : null;
  const rowItem = (i: Item) => (
    <div className="desk-inventory-line" key={i.id}>
      <div>
        <div className="desk-sentence">
          {i.quantity !== null ? (
            <>
              <StockCount item={i} onSave={updateCount} inline /> of{" "}
            </>
          ) : (
            "For "
          )}
          <button className="desk-inline-link" onClick={() => view("inventory", { item: i.id })}>
            <Fact>{i.name}</Fact>
          </button>
          {i.quantity === null && (
            <>
              , <StockCount item={i} onSave={updateCount} inline />
            </>
          )}
          .
        </div>
        <StockLabel item={i} buys={openBuys} />
      </div>
    </div>
  );
  const rowBuy = (b: Buy) => {
    const approvalAlert =
      search.page === "dashboard" && b.order?.status === "draft" && !b.order.reviewRequired;
    const AlertIcon = b.order?.reviewRequired
      ? RefreshCw
      : b.order?.status === "send_failed"
        ? TriangleAlert
        : ClipboardCheck;
    return (
      <button
        key={b.id}
        className={`desk-buy-line${search.page === "dashboard" ? " desk-buy-alert" : ""}`}
        onClick={() => view("buys", { buy: b.id })}
      >
        {search.page === "dashboard" && (
          <AlertIcon className="desk-alert-icon" aria-hidden="true" />
        )}
        <span>
          <span className="desk-sentence">
            {approvalAlert && "Approve "}
            <Fact>
              {b.order?.requestedQuantity ?? b.quantity ?? "More"} {b.unit}
            </Fact>{" "}
            of <Fact>{b.name}</Fact>
            {b.order?.supplier && (
              <>
                {" "}
                from <Fact>{b.order.supplier}</Fact>
              </>
            )}
            {approvalAlert && b.order && (
              <>
                {" "}
                for <Fact>{money(b.order.totalCents, b.order.currency)}</Fact>
              </>
            )}
            .
          </span>
          {!approvalAlert && (
            <small>
              {b.order?.reviewRequired
                ? "Price and delivery are being checked."
                : b.order?.status === "draft"
                  ? `Ready for you to approve ${money(b.order.totalCents, b.order.currency)}.`
                  : b.order?.expectedOn && isOpen(b)
                    ? `Expected by ${dateLabel(b.order.expectedOn)}.`
                    : (b.purchasingNote ?? buyStatus(b) + ".")}
            </small>
          )}
        </span>
        <ArrowUpRight size={17} />
      </button>
    );
  };
  return (
    <div className="desk-app">
      <a className="desk-skip" href="#main">
        Skip to content
      </a>
      <header className="desk-header">
        <Brand />
        {search.item || search.buy ? (
          <button className="desk-back" onClick={() => view(search.item ? "inventory" : "buys")}>
            <ArrowLeft size={24} />
            {search.item ? "Inventory" : "Buys"}
          </button>
        ) : (
          <nav aria-label="Main navigation">
            {(["dashboard", "inventory", "buys"] as const).map((page) => (
              <button
                key={page}
                aria-current={search.page === page ? "page" : undefined}
                onClick={() => view(page)}
              >
                {page[0].toUpperCase() + page.slice(1)}
              </button>
            ))}
          </nav>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="desk-company-menu" />}>
            {search.demo ? "Demo workspace" : workspace.companyName}
            <ChevronDown size={15} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => view("settings")}>Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => view("audit")}>Audit log</DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>
              {search.demo ? "Exit demo" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <main id="main" className="desk-main">
        {search.item ? (
          item ? (
            <>
              <h1 className="sr-only">{item.name}</h1>
              <Sentence large>
                {item.quantity === null ? (
                  <>
                    The count for <Fact>{item.name}</Fact> is{" "}
                    <StockCount item={item} onSave={updateCount} inline />.
                  </>
                ) : (
                  <>
                    About <StockCount item={item} onSave={updateCount} inline /> of{" "}
                    <Fact>{item.name}</Fact> remain at your current usage.
                  </>
                )}
              </Sentence>
              {item.quantity !== null && item.stockCountedAt && (
                <p className="desk-muted">
                  Last counted {units(item.quantity, item.unit)} on{" "}
                  {new Date(item.stockCountedAt).toLocaleDateString()}. Receipts and usage update
                  the estimate.
                </p>
              )}
              <Sentence>
                {item.dailyUsage !== null && (
                  <>
                    You use about <Fact>{units(item.dailyUsage, item.unit)}</Fact> a day.{" "}
                  </>
                )}
                {item.leadTimeDays !== null && (
                  <>
                    Replacements usually take <Fact>{item.leadTimeDays} days</Fact>
                    {item.supplier && (
                      <>
                        {" "}
                        from <Fact>{item.supplier}</Fact>
                      </>
                    )}
                    .
                  </>
                )}
              </Sentence>
              {incoming(item.id, openBuys) > 0 && (
                <Sentence>
                  <Fact>{units(incoming(item.id, openBuys), item.unit)}</Fact> are on the way
                  {plans.get(item.id)!.arriving && (
                    <>
                      , expected by <Fact>{dateLabel(plans.get(item.id)!.arriving)}</Fact>
                    </>
                  )}
                  .
                </Sentence>
              )}
              <StockLabel item={item} buys={openBuys} detail />
              <ReplenishmentControl
                item={item}
                busy={busy}
                onChange={(enabled) =>
                  run(enabled ? "enable_replenishment" : "pause_replenishment")
                }
              />
              <div className="desk-answer-actions">
                <Button
                  variant="outline"
                  onClick={() =>
                    openChat({
                      task: "edit_item",
                      contextId: item.id,
                      name: item.name,
                      prompt: "What changed?",
                    })
                  }
                >
                  Something changed…
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    openChat({
                      task: "new_buy",
                      contextId: item.id,
                      name: item.name,
                      prompt: `How much ${item.name.toLowerCase()} do you need, and when?`,
                    })
                  }
                >
                  Start a one-off buy
                </Button>
              </div>
              {chatView}
              {item.buyUrl && <OutLink href={item.buyUrl}>View the supplier’s page</OutLink>}
              <BuyingRules
                key={item.id}
                item={item}
                onSave={updateRules}
                onChat={() =>
                  openChat({
                    task: "edit_item",
                    contextId: item.id,
                    name: item.name,
                    prompt:
                      "What matters most when buying this, and what does a day without it cost?",
                  })
                }
              />
              <details className="desk-disclosure">
                <summary>Buy history</summary>
                {snapshot?.buys.filter((b) => b.itemId === item.id).map(rowBuy)}
                {!snapshot?.buys.some((b) => b.itemId === item.id) && <Empty>No buys yet.</Empty>}
              </details>
              <div className="desk-secondary-actions">
                {confirm === "archive" ? (
                  <>
                    <span>Archive this item?</span>
                    <Button variant="outline" disabled={busy} onClick={() => void run("archive")}>
                      Archive
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirm(null)}>
                      Keep item
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirm("archive")}>
                    Archive item
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Empty>Item not found.</Empty>
          )
        ) : search.buy ? (
          !snapshot ? (
            <Empty>Loading buy…</Empty>
          ) : buy ? (
            <>
              <h1 className="sr-only">{buy.name}</h1>
              <BuySentence buy={buy} large />
              {buy.order?.quotedArrival &&
                buy.order.quotedArrival > buy.order.requiredBy &&
                !buy.order.reviewRequired && (
                  <Sentence>
                    That’s after your <Fact>{dateLabel(buy.order.requiredBy)}</Fact> deadline.
                  </Sentence>
                )}
              {buy.order && (
                <Sentence>
                  Deliver to <Fact>{buy.order.shipTo}</Fact>.
                </Sentence>
              )}
              {!buy.order && isOpen(buy) && !buy.automatic && !buy.purchasingState && (
                <Decision
                  question="Shall I find buying options?"
                  yes="Find options"
                  onYes={() => openChat({ task: "buy", contextId: buy.id, name: buy.name })}
                />
              )}
              {(!buy.order ||
                (buy.order.reviewRequired && buy.order.orderingMethod !== "website")) &&
                isOpen(buy) && (
                  <PurchasingProgress
                    buy={buy}
                    busy={busy}
                    onRetry={() => run("retry_research")}
                    onHelp={() => openChat({ task: "buy", contextId: buy.id, name: buy.name })}
                  />
                )}
              {buy.order?.status === "draft" &&
                !buy.order.reviewRequired &&
                chat?.task !== "buy" && (
                  <ApprovalPrompt
                    key={approvalKey(buy.order)}
                    buy={buy}
                    busy={busy}
                    onYes={() => run("approve", approvalKey(buy.order!))}
                    onNo={() =>
                      openChat({
                        task: "buy",
                        contextId: buy.id,
                        name: buy.name,
                        revision: true,
                        prompt:
                          "What needs to change? I’ll check how it affects the price and delivery.",
                      })
                    }
                  />
                )}
              {buy.order?.reviewRequired &&
                !buy.automatic &&
                !buy.purchasingState &&
                buy.order.orderingMethod !== "website" &&
                !chat && (
                  <Decision
                    question="The change needs a fresh price, shipping cost, and arrival date. Shall we continue?"
                    yes="Continue"
                    onYes={() =>
                      openChat({
                        task: "buy",
                        contextId: buy.id,
                        name: buy.name,
                        prompt: "What do you have from the supplier?",
                      })
                    }
                  />
                )}
              <OrderProgress
                buy={buy}
                busy={busy}
                onCheck={() => run("check_order")}
                onHelp={() => run("resolve_order")}
              />
              {buy.order?.cancellationRequestedAt && (
                <Sentence>
                  I’ve requested cancellation. The order remains open until the supplier confirms.
                </Sentence>
              )}
              {(buy.order?.status === "approved" || buy.order?.status === "sent") && (
                <details className="desk-disclosure">
                  <summary>Have a confirmation from elsewhere?</summary>
                  <Button
                    variant="outline"
                    onClick={() => openChat({ task: "confirm", contextId: buy.id })}
                  >
                    Add confirmation
                  </Button>
                </details>
              )}
              {(buy.order?.status === "placed" || buy.order?.status === "part_received") && (
                <Decision
                  question={
                    <>
                      Did all{" "}
                      <Fact>
                        {units(buy.order.quantity - buy.order.receivedQuantity, buy.unit)}
                      </Fact>{" "}
                      arrive?
                    </>
                  }
                  onYes={() => run("receive")}
                  onNo={() =>
                    openChat({
                      task: "receive",
                      contextId: buy.id,
                      prompt: "How many arrived? Tell me what was missing or damaged.",
                    })
                  }
                  busy={busy}
                />
              )}
              {chatView}
              {buy.order && (
                <details className="desk-disclosure">
                  <summary>Purchase details</summary>
                  <Sentence>
                    This is order <Fact>{buy.order.number}</Fact>.{" "}
                    {buy.order.reviewRequired ? (
                      "Its earlier price and delivery terms are being checked."
                    ) : (
                      <>
                        Each {buy.unit === "cases" ? "case" : "unit"} costs{" "}
                        <Fact>{money(buy.order.unitPriceCents, buy.order.currency)}</Fact>, with{" "}
                        <Fact>{money(buy.order.freightCents, buy.order.currency)}</Fact> shipping
                        and <Fact>{money(buy.order.taxCents, buy.order.currency)}</Fact> tax.
                      </>
                    )}
                  </Sentence>
                  {!!buy.order.receivedQuantity && (
                    <Sentence>
                      You’ve received <Fact>{units(buy.order.receivedQuantity, buy.unit)}</Fact> so
                      far.
                    </Sentence>
                  )}
                  {buy.order.notes && <Sentence>{buy.order.notes}</Sentence>}
                  {buy.order.supplierSku && (
                    <Sentence>
                      Supplier product code: <Fact>{buy.order.supplierSku}</Fact>.
                    </Sentence>
                  )}
                  {buy.order.sourceUrl && (
                    <OutLink href={buy.order.sourceUrl}>Supplier source</OutLink>
                  )}
                  {["sent", "placed", "part_received"].includes(buy.order.status) && (
                    <Decision
                      question="Has the supplier already cancelled the remaining delivery?"
                      yes="Record supplier cancellation"
                      busy={busy}
                      confirm={{
                        question:
                          "Confirm the supplier has cancelled the remaining delivery. This updates your records; it does not ask the supplier to cancel.",
                        label: "Record confirmed cancellation",
                      }}
                      onYes={() => run("record_cancellation")}
                    />
                  )}
                </details>
              )}
              {buy.order && !search.demo && <BuyHistory orderId={buy.order._id} />}
              <div className="desk-secondary-actions">
                {isOpen(buy) &&
                  (!buy.order || buy.order.status === "draft") &&
                  (confirm === "cancel" ? (
                    <>
                      <span>Cancel this buy?</span>
                      <Button variant="outline" disabled={busy} onClick={() => void run("cancel")}>
                        Cancel buy
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirm(null)}>
                        Keep buy
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirm("cancel")}>
                      Cancel buy
                    </Button>
                  ))}
                {buy.order &&
                  ["sent", "placed", "part_received"].includes(buy.order.status) &&
                  !buy.order.cancellationRequestedAt && (
                    <Decision
                      question="Need to stop this order?"
                      yes="Request cancellation"
                      busy={busy}
                      confirm={{
                        question:
                          "Ask the supplier to cancel the remaining delivery? It may already be on its way.",
                        label: "Send cancellation request",
                      }}
                      onYes={() => run("request_cancellation")}
                    />
                  )}
              </div>
            </>
          ) : (
            <Empty>Buy not found.</Empty>
          )
        ) : search.page === "dashboard" ? (
          <>
            <PageHeading title="Dashboard" compact />
            <div className="desk-overview-sentence">
              <Sentence large>
                <button
                  className="desk-inline-link"
                  onClick={() => {
                    view("inventory");
                    setOnlyLow(true);
                  }}
                >
                  <Fact>
                    {low.length} {low.length === 1 ? "item needs" : "items need"} stock
                  </Fact>
                </button>
                , and{" "}
                <button className="desk-inline-link" onClick={() => view("buys")}>
                  <Fact>
                    {snapshot ? openBuys.length : "…"}{" "}
                    {openBuys.length === 1 ? "buy is" : "buys are"} in progress
                  </Fact>
                </button>
                .
              </Sentence>
              <Sentence>
                You’ve spent <Fact>{snapshot ? spending(snapshot.buys) : "…"}</Fact>{" "}
                {snapshot?.truncated ? "on recent buys" : "this month"}.
              </Sentence>
            </div>
            <section className="desk-section" aria-label="Actions to take">
              {attentionItems.map((i) => {
                const plan = plans.get(i.id)!;
                const b = openBuys.find((b) => b.itemId === i.id);
                if (b?.order?.status === "draft" || b?.order?.status === "send_failed")
                  return rowBuy(b);
                const countNeeded =
                  plan.label.startsWith("Count") || plan.label.startsWith("Add usage");
                if (i.replenishmentEnabled && !countNeeded) {
                  if (b) return rowBuy(b);
                  return (
                    <button
                      key={i.id}
                      className="desk-buy-line desk-buy-alert"
                      onClick={() => view("inventory", { item: i.id })}
                    >
                      <RefreshCw className="desk-alert-icon" aria-hidden="true" />
                      <span>
                        <span className="desk-sentence">
                          <Fact>{i.name}</Fact>.
                        </span>
                        <small>{i.automationNote ?? "I’m checking the next replenishment."}</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  );
                }
                const label =
                  plan.low && b && !plan.arriving
                    ? b.order?.status === "approved"
                      ? "Place order"
                      : b.order?.status === "sent"
                        ? "Check supplier"
                        : "Finish buy"
                    : plan.label;
                const AlertIcon = countNeeded
                  ? ClipboardList
                  : ["Check delivery", "Confirm arrival", "Get it sooner"].includes(label)
                    ? Truck
                    : label === "Place order" || label === "Finish buy"
                      ? ShoppingCart
                      : label === "Check supplier"
                        ? MessageCircle
                        : TriangleAlert;
                const [before, after] = (
                  {
                    "Order more": ["Order more", ""],
                    "Out of stock": ["Restock", ""],
                    "May be out": ["Check whether", "is out of stock"],
                    "Count stock": ["Count", "on hand"],
                    "Count today": ["Count", "today"],
                    "Add usage / delivery time": ["Add usage and delivery times for", ""],
                    "Check delivery": ["Check the delivery of", ""],
                    "Confirm arrival": ["Confirm when", "will arrive"],
                    "Get it sooner": ["Get", "sooner"],
                    "Place order": ["Place the order for", ""],
                    "Check supplier": ["Check with the supplier about", ""],
                    "Finish buy": ["Finish buying", ""],
                  } as Record<string, [string, string]>
                )[label] ?? ["Check stock for", ""];
                return (
                  <button
                    key={i.id}
                    className="desk-buy-line desk-buy-alert"
                    onClick={() =>
                      b && !countNeeded
                        ? view("buys", { buy: b.id })
                        : view("inventory", { item: i.id })
                    }
                  >
                    <AlertIcon className="desk-alert-icon" aria-hidden="true" />
                    <span>
                      <span className="desk-sentence">
                        {before} <Fact>{i.name}</Fact>
                        {after && ` ${after}`}.
                      </span>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                );
              })}
              {snapshot && !attentionItems.length && <Empty>You’re all caught up.</Empty>}
            </section>
          </>
        ) : search.page === "inventory" ? (
          <>
            <PageHeading title="Inventory" compact />
            <div className="desk-list-tools desk-inventory-tools">
              <div className="desk-search">
                <Search size={17} />
                <Input
                  type="search"
                  aria-label="Search inventory"
                  placeholder="Find an item"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <Button
                aria-label="Update stock"
                variant="outline"
                onClick={() => openChat({ task: "stock_update" })}
              >
                <span>
                  Update<span className="desk-desktop-word"> stock</span>
                </span>
              </Button>
              <Button aria-label="Add item" onClick={() => openChat({ task: "add_item" })}>
                <Plus size={17} />
                <span>
                  <span className="desk-desktop-word">Add </span>item
                </span>
              </Button>
            </div>
            {chatView}
            <fieldset className="desk-filters desk-stock-filter" aria-label="Inventory filter">
              <button aria-pressed={!onlyLow} onClick={() => setOnlyLow(false)}>
                All
              </button>
              <button aria-pressed={onlyLow} onClick={() => setOnlyLow(true)}>
                Running low {low.length}
              </button>
            </fieldset>

            {sortedItems
              .filter(
                (i) =>
                  (!onlyLow || plans.get(i.id)!.low) &&
                  `${i.name} ${i.sku} ${i.supplier ?? ""}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
              )
              .map(rowItem)}
            {!workspace.items.length && <Empty>Add your first item to get started.</Empty>}
            {workspace.items.length > 0 &&
              !sortedItems.some(
                (i) =>
                  (!onlyLow || plans.get(i.id)!.low) &&
                  `${i.name} ${i.sku} ${i.supplier ?? ""}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
              ) && (
                <Empty>
                  {onlyLow && !filter ? "Nothing is running low." : "No matching items."}
                </Empty>
              )}
          </>
        ) : search.page === "buys" ? (
          <>
            <PageHeading title="Buys" compact />
            <div className="desk-list-tools desk-buy-tools">
              <fieldset className="desk-filters" aria-label="Buy status">
                <button aria-pressed={!completed} onClick={() => setCompleted(false)}>
                  Open
                </button>
                <button aria-pressed={completed} onClick={() => setCompleted(true)}>
                  Completed
                </button>
              </fieldset>
              <div className="desk-search">
                <Search size={17} />
                <Input
                  type="search"
                  aria-label="Search buys"
                  placeholder="Find a buy"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => openChat({ task: "new_buy" })}>
                <Plus size={17} />
                One-off buy
              </Button>
            </div>
            {chatView}

            {snapshot?.buys
              .filter(
                (b) =>
                  isOpen(b) !== completed && b.name.toLowerCase().includes(filter.toLowerCase()),
              )
              .sort(
                (a, b) =>
                  Number(b.order?.status === "draft") - Number(a.order?.status === "draft") ||
                  b.createdAt - a.createdAt,
              )
              .map(rowBuy)}
            {snapshot &&
              !snapshot.buys.some(
                (b) =>
                  isOpen(b) !== completed && b.name.toLowerCase().includes(filter.toLowerCase()),
              ) && (
                <Empty>
                  {filter
                    ? "No matching buys."
                    : completed
                      ? "No completed buys yet."
                      : "No open buys."}
                </Empty>
              )}
          </>
        ) : search.page === "audit" ? (
          <>
            <PageHeading title="Audit log" />
            {audit}
          </>
        ) : (
          <>
            <PageHeading title="Settings" />
            <section className="desk-settings-section">
              <div className="desk-section-heading">
                <h2>Company</h2>
                <Button variant="outline" onClick={() => openChat({ task: "settings" })}>
                  Edit
                </Button>
              </div>
              {chatView}
              <Sentence large>
                You’re buying for <Fact>{workspace.companyName}</Fact>.
              </Sentence>
              <Sentence>
                Deliveries go to <Fact>{workspace.shippingAddress}</Fact>. You approve every
                purchase.
              </Sentence>
            </section>
            {settings}
          </>
        )}
        {error && (
          <p className="desk-error" role="alert">
            {error}
          </p>
        )}
      </main>
      <footer className="desk-footer">
        <span>
          {search.demo ? "Sample data. No supplier is contacted." : "Keep the line moving."}
        </span>
        {search.demo && (
          <a href="/setup">
            Make it yours <ArrowUpRight size={14} />
          </a>
        )}
      </footer>
    </div>
  );
}
function confirmedDeliveries(itemId: string, buys: Buy[]) {
  return buys
    .filter(
      (b) =>
        b.itemId === itemId &&
        (b.order?.status === "placed" || b.order?.status === "part_received"),
    )
    .map((b) => ({
      quantity: b.order!.quantity - b.order!.receivedQuantity,
      expectedOn: b.order!.expectedOn ?? null,
    }));
}
function StockLabel({ item, buys, detail = false }: { item: Item; buys: Buy[]; detail?: boolean }) {
  const now = useClock();
  const plan = inventoryPlan(item, confirmedDeliveries(item.id, buys), now);
  const activeBuy = buys.find((b) => b.itemId === item.id && isOpen(b));
  const label =
    item.replenishmentEnabled && plan.label === "Order more"
      ? activeBuy
        ? buyStatus(activeBuy)
        : "Preparing replenishment"
      : plan.label;
  const due = new Date(plan.nextCheck).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <span className="desk-stock-status">
      <span className="desk-status">
        <i data-attention={plan.attention} />
        {detail && !plan.attention && plan.daysLeft !== null && plan.daysLeft > 0
          ? `About ${Math.ceil(plan.daysLeft)} days left`
          : label}
      </span>
      {plan.arriving && !detail ? (
        <small className="desk-stock-arrival">
          {plan.label === "Check delivery" ? "Expected" : "Arrives"} {dateLabel(plan.arriving)}
        </small>
      ) : (
        !plan.attention && <small>{plan.nextCheck <= now ? "Count today" : `Count ${due}`}</small>
      )}
    </span>
  );
}
function incoming(itemId: string, buys: Buy[]) {
  return buys
    .filter(
      (b) =>
        b.itemId === itemId &&
        (b.order?.status === "placed" || b.order?.status === "part_received"),
    )
    .reduce((n, b) => n + b.order!.quantity - b.order!.receivedQuantity, 0);
}
function spending(buys: Buy[]) {
  const now = new Date(),
    start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const totals = new Map<string, number>();
  for (const b of buys) {
    const o = b.order;
    if (o?.placedAt && o.placedAt >= start && o.status !== "cancelled")
      totals.set(o.currency, (totals.get(o.currency) ?? 0) + o.totalCents);
  }
  return totals.size ? [...totals].map(([c, n]) => money(n, c)).join(" / ") : money(0);
}
function BuyHistory({ orderId }: { orderId: Id<"companyOrders"> }) {
  const events = useQuery(api.companyOrders.events, { orderId });
  return (
    <details className="desk-disclosure">
      <summary>Activity</summary>
      {events?.map((e) => (
        <p className="desk-history-line" key={e._id}>
          {e.summary}
        </p>
      ))}
    </details>
  );
}
function Alerts() {
  const settings = useQuery(api.companyAlerts.getSettings, {}),
    preferences = useMutation(api.companyAlerts.preferences);
  const requestVerification = useAction(api.companyEmail.requestVerification),
    verify = useAction(api.companyEmail.verify);
  const [editing, setEditing] = useState(false),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function saveEmail() {
    setBusy(true);
    setError(null);
    try {
      if (sent) {
        await verify({ code });
        setEditing(false);
        setSent(false);
      } else {
        await requestVerification({ email });
        setSent(true);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="desk-settings-section">
      <div className="desk-section-heading">
        <h2>Notifications</h2>
        <Button
          variant="outline"
          disabled={!settings?.configured}
          onClick={() => {
            setEditing(!editing);
            setEmail(settings?.email ?? "");
          }}
        >
          {" "}
          {settings?.email ? "Change email" : "Add email"}
        </Button>
      </div>
      {editing ? (
        <form
          className="desk-inline-question"
          onSubmit={(e) => {
            e.preventDefault();
            void saveEmail();
          }}
        >
          <label htmlFor="alert-answer">
            {sent ? "What’s the code from your email?" : "Where should updates go?"}
          </label>
          <div>
            <Input
              id="alert-answer"
              type={sent ? "text" : "email"}
              required
              value={sent ? code : email}
              onChange={(e) => (sent ? setCode(e.target.value) : setEmail(e.target.value))}
            />
            <Button disabled={busy}>{sent ? "Verify" : "Send code"}</Button>
          </div>
        </form>
      ) : (
        <p className="desk-muted">
          {settings?.configured
            ? settings.email
              ? `${settings.email}${settings.verified ? "" : " · not verified"}`
              : "Add an email for low stock and delivery updates."
            : "Email notifications aren’t connected yet."}
        </p>
      )}
      <div className="desk-toggle-rows">
        {(
          [
            ["lowStock", "Low stock"],
            ["orderUpdates", "Order updates"],
          ] as const
        ).map(([field, label]) => (
          <label key={field}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={settings?.[field] ?? true}
              disabled={busy || !settings?.email}
              onChange={async (e) => {
                if (!settings) return;
                setBusy(true);
                try {
                  await preferences({
                    lowStock: settings.lowStock,
                    orderUpdates: settings.orderUpdates,
                    [field]: e.target.checked,
                  });
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="desk-error">
          {error}
        </p>
      )}
    </section>
  );
}
