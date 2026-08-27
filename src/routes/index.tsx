import { createFileRoute } from "@tanstack/react-router";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Circle,
  MessageCircle,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type FocusView = "procurement" | "recommendation" | "approval" | "order";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    demo: search.demo === "1" || search.demo === 1 || search.demo === true,
    procurement: typeof search.procurement === "string" ? search.procurement : undefined,
    view:
      search.view === "recommendation" || search.view === "approval" || search.view === "order"
        ? search.view
        : ("procurement" as FocusView),
  }),
  component: Home,
});

const statusLabels: Record<string, string> = {
  healthy: "Healthy",
  watch: "Watch",
  action_required: "Action Required",
  sourcing: "Sourcing",
  awaiting_quotes: "Awaiting Quotes",
  evaluating: "Evaluating",
  approval_required: "Approval Required",
  ordered: "Ordered",
  covered: "Covered",
  confirmed: "Confirmed",
  exception: "Exception",
};

const procurementLabels: Record<string, string> = {
  detected: "Risk detected",
  analyzing: "Analyzing inventory",
  sourcing: "Finding suppliers",
  rfq_ready: "Preparing requests",
  rfq_sent: "Requests sent",
  awaiting_quotes: "Awaiting quotes",
  evaluating: "Comparing replies",
  approval_required: "Approval required",
  approved: "Approved",
  po_sent: "Purchase order sent",
  confirmation_pending: "Waiting for confirmation",
  confirmed: "Confirmed",
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function shortTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function Home() {
  const dashboard = useQuery(api.purchasing.getDashboard);
  const integrations = useQuery(api.integrations.getStatus);
  const scenario = useQuery(api.demo.getCurrentScenario);
  const resetScenario = useMutation(api.demo.resetScenario);
  const startScenario = useMutation(api.demo.startScenario);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [controlState, setControlState] = useState<"idle" | "resetting" | "starting">("idle");
  const [controlError, setControlError] = useState<string | null>(null);

  async function reset() {
    setControlError(null);
    setControlState("resetting");
    try {
      await resetScenario({});
      await navigate({
        search: (current) => ({ ...current, procurement: undefined, view: "procurement" }),
      });
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "The scenario could not be reset.");
    } finally {
      setControlState("idle");
    }
  }

  async function start() {
    if (!scenario) return;
    setControlError(null);
    setControlState("starting");
    try {
      await startScenario({ demoRunId: scenario.demoRunId });
    } catch (error) {
      setControlError(
        error instanceof Error ? error.message : "The scenario could not be started.",
      );
    } finally {
      setControlState("idle");
    }
  }

  if (search.procurement) {
    return (
      <FocusedProcurement
        procurementId={search.procurement as Id<"procurements">}
        view={search.view}
        demo={search.demo}
        onBack={() =>
          navigate({
            search: (current) => ({
              ...current,
              procurement: undefined,
              view: "procurement",
            }),
          })
        }
      />
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f4ed_0%,#eeeadf_100%)] px-4 py-5 text-stone-950 sm:px-7 sm:py-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-stone-300 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
              {dashboard?.organizationName ?? "Acme Foods"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">Purchasing overview</h1>
            <p className="mt-1 text-sm text-stone-600">
              Inventory risk, open buys, and decisions in one live workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="h-8 w-fit gap-2 border-stone-400 bg-white/60 px-3 capitalize"
            >
              <Bot className="size-4" aria-hidden="true" />
              Agent · {dashboard?.agent.state.replace("_", " ") ?? "watching"}
            </Badge>
            <JudgeModeButton />
            {search.demo ? <ConfiguredBuyerButton /> : null}
          </div>
        </header>

        {search.demo && integrations ? (
          <div className="flex flex-wrap items-center gap-2" aria-label="Provider readiness">
            {integrations.map((integration) => (
              <Badge
                key={integration.name}
                variant="outline"
                className={
                  integration.status === "configured" ? "bg-white/70" : "border-red-300 bg-red-50"
                }
              >
                {integration.name} · {integration.status}
              </Badge>
            ))}
            {integrations.some((integration) => integration.status === "missing") ? (
              <span className="text-xs text-red-700">
                Add the missing development environment value before running that provider step.
              </span>
            ) : null}
          </div>
        ) : null}

        {dashboard === undefined ? (
          <DashboardSkeleton />
        ) : dashboard === null ? (
          <EmptyDashboard demo={search.demo} onReset={reset} busy={controlState !== "idle"} />
        ) : (
          <>
            <section
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Purchasing summary"
            >
              <Metric label="Needs action" value={dashboard.needsActionCount.toString()} />
              <Metric label="Open buys" value={dashboard.openBuyCount.toString()} />
              <Metric
                label="Annual spend"
                value={money(dashboard.annualSpendCents)}
                source="Demo history"
              />
              <Metric
                label="Savings identified"
                value={money(dashboard.savingsIdentifiedCents)}
                source="Demo history"
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]">
              <Card className="border-stone-300 bg-white/75 shadow-none">
                <CardHeader className="flex-row items-end justify-between gap-4">
                  <div>
                    <CardDescription>Live inventory</CardDescription>
                    <CardTitle>Packaging items</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-white">
                    Convex · live
                  </Badge>
                </CardHeader>
                <CardContent className="overflow-x-auto px-0">
                  <table className="w-full min-w-180 text-left text-sm">
                    <thead className="border-y border-stone-200 text-xs text-stone-500 uppercase">
                      <tr>
                        <th className="px-6 py-3 font-medium">Item</th>
                        <th className="px-3 py-3 font-medium">On hand</th>
                        <th className="px-3 py-3 font-medium">Daily use</th>
                        <th className="px-3 py-3 font-medium">Days left</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Agent action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {dashboard.inventory.map((item) => (
                        <tr key={item.inventoryItemId} data-testid={`inventory-${item.sku}`}>
                          <td className="px-6 py-4">
                            <p className="font-medium">{item.name}</p>
                            <p className="mt-0.5 font-mono text-xs text-stone-500">{item.sku}</p>
                          </td>
                          <td className="px-3 py-4 tabular-nums">
                            <span>{Math.round(item.quantityOnHand).toLocaleString()}</span>
                            {item.confirmedIncoming > 0 ? (
                              <span className="mt-1 block text-xs font-medium text-emerald-700">
                                +{item.confirmedIncoming.toLocaleString()} confirmed
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-4 tabular-nums">
                            {Math.round(item.averageDailyUsage).toLocaleString()}
                          </td>
                          <td className="px-3 py-4 tabular-nums">
                            {item.daysRemaining?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-3 py-4">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-6 py-4">
                            {item.procurement ? (
                              <Button
                                variant="ghost"
                                className="-ml-3"
                                onClick={() =>
                                  navigate({
                                    search: (current) => ({
                                      ...current,
                                      procurement: item.procurement!.procurementId,
                                      view: "procurement",
                                    }),
                                  })
                                }
                              >
                                {procurementLabels[item.procurement.status] ?? "View buy"}
                                <ArrowRight />
                              </Button>
                            ) : (
                              <span className="text-stone-500">Monitoring</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="border-t border-stone-200 px-6 py-3 text-xs text-stone-500">
                    On hand · historical records · Days left · calculated · Incoming ·
                    supplier-confirmed
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-5">
                <AgentCard
                  state={dashboard.agent.state}
                  message={dashboard.agent.message}
                  unread={dashboard.agent.unreadThreadCount}
                />
                <Card className="border-stone-300 bg-white/75 shadow-none">
                  <CardHeader>
                    <CardDescription>Open buys</CardDescription>
                    <CardTitle className="text-lg">Procurement progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dashboard.inventory.flatMap((item) =>
                      item.procurement
                        ? [
                            <button
                              key={item.procurement.procurementId}
                              className="flex min-h-20 w-full items-center justify-between rounded-lg border border-stone-200 bg-white p-4 text-left hover:border-stone-400"
                              onClick={() =>
                                navigate({
                                  search: (current) => ({
                                    ...current,
                                    procurement: item.procurement!.procurementId,
                                    view: "procurement",
                                  }),
                                })
                              }
                            >
                              <span>
                                <span className="font-mono text-xs text-stone-500">
                                  {item.procurement.code}
                                </span>
                                <span className="mt-1 block font-medium">{item.name}</span>
                                <span className="mt-1 block text-xs text-stone-500">
                                  {item.procurement.quantityRequired.toLocaleString()} units · due{" "}
                                  {item.procurement.requiredBy}
                                </span>
                              </span>
                              <ArrowRight className="size-4" />
                            </button>,
                          ]
                        : [],
                    )}
                    {dashboard.openBuyCount === 0 ? (
                      <p className="text-sm leading-6 text-stone-600">
                        No open buys. Your agent is watching inventory.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
                <Card className="border-stone-300 bg-white/75 shadow-none">
                  <CardHeader>
                    <CardDescription>Live activity</CardDescription>
                    <CardTitle className="text-lg">Latest updates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dashboard.activity.length === 0 ? (
                      <p className="text-sm text-stone-500">No activity yet.</p>
                    ) : (
                      dashboard.activity.map((event) => (
                        <button
                          key={event.eventId}
                          className="grid w-full grid-cols-[3rem_1fr] gap-3 text-left text-sm"
                          onClick={() =>
                            navigate({
                              search: (current) => ({
                                ...current,
                                procurement: event.procurementId,
                                view: "procurement",
                              }),
                            })
                          }
                        >
                          <span className="font-mono text-xs text-stone-400">
                            {shortTime(event.createdAt)}
                          </span>
                          <span>
                            <span className="font-medium">{event.summary}</span>
                            <span className="mt-0.5 block font-mono text-xs text-stone-500">
                              {event.code}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}

        {search.demo ? (
          <DemoControls
            scenario={scenario}
            state={controlState}
            error={controlError}
            onReset={reset}
            onStart={start}
          />
        ) : null}
      </div>
    </main>
  );
}

function FocusedProcurement({
  procurementId,
  view,
  demo,
  onBack,
}: {
  procurementId: Id<"procurements">;
  view: FocusView;
  demo: boolean;
  onBack: () => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  const procurement = useQuery(api.purchasing.getProcurement, { procurementId });
  const sourcing = useQuery(api.sourcing.getLatest, { procurementId });
  const rfqs = useQuery(api.rfqs.listForProcurement, { procurementId });
  const purchasingInbox = useQuery(api.mail.getInboxForProcurement, { procurementId });
  const delivery = useQuery(api.mail.getDelivery, { procurementId });
  const quotes = useQuery(api.inbound.listQuotes, { procurementId });
  const followUps = useQuery(api.mail.listFollowUps, { procurementId });
  const comparison = useQuery(api.recommendations.getLatestComparison, { procurementId });
  const navigate = Route.useNavigate();
  const startSourcing = useAction(api.sourcing.start);
  const ensurePurchasingInbox = useAction(api.mail.ensurePurchasingInbox);
  const prepareRfqs = useMutation(api.rfqs.prepare);
  const approveRecipients = useMutation(api.mail.approveRecipients);
  const sendApprovedRfqs = useMutation(api.mail.sendApproved);
  const startStructuredTask = useMutation(api.ai.startStructuredTask);
  const markThreadRead = useMutation(api.ai.markThreadRead);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [aiRunId, setAiRunId] = useState<Id<"aiRuns"> | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [sourcingState, setSourcingState] = useState<"idle" | "working">("idle");
  const [sourcingError, setSourcingError] = useState<string | null>(null);
  const [rfqState, setRfqState] = useState<"idle" | "working">("idle");
  const [rfqError, setRfqError] = useState<string | null>(null);
  const [recipientDrafts, setRecipientDrafts] = useState<Record<string, string>>({});
  const [approvalConfirmation, setApprovalConfirmation] = useState("");
  const [mailState, setMailState] = useState<"idle" | "inbox" | "approving" | "sending">("idle");
  const [mailError, setMailError] = useState<string | null>(null);
  const aiRun = useQuery(api.ai.getRun, aiRunId === null ? "skip" : { aiRunId });
  const threadMessages = useQuery(
    api.ai.listThreadMessages,
    openThread === null
      ? "skip"
      : { threadId: openThread, paginationOpts: { cursor: null, numItems: 50 } },
  );

  async function openContextualThread(threadId: string) {
    setOpenThread(threadId);
    try {
      await markThreadRead({ threadId });
    } catch {
      // The live query still gives the buyer a readable thread if the read receipt races creation.
    }
  }

  async function runDiagnostic() {
    setDiagnosticError(null);
    try {
      const started = await startStructuredTask({
        procurementId,
        task: "supplier_search_queries",
        anchorKey: "procurement:procurement",
      });
      setAiRunId(started.aiRunId);
      setOpenThread(started.componentThreadId);
    } catch (error) {
      setDiagnosticError(
        error instanceof Error ? error.message : "The AI diagnostic could not start.",
      );
    }
  }

  async function sourceSuppliers() {
    setSourcingError(null);
    setSourcingState("working");
    try {
      await startSourcing({ procurementId });
    } catch (error) {
      setSourcingError(error instanceof Error ? error.message : "Supplier discovery failed.");
    } finally {
      setSourcingState("idle");
    }
  }

  async function prepareControlledRfqs() {
    setRfqError(null);
    setRfqState("working");
    try {
      await prepareRfqs({ procurementId });
    } catch (error) {
      setRfqError(error instanceof Error ? error.message : "RFQ preparation failed.");
    } finally {
      setRfqState("idle");
    }
  }

  async function selectPurchasingInbox() {
    setMailError(null);
    setMailState("inbox");
    try {
      await ensurePurchasingInbox({ procurementId, createIfMissing: true });
    } catch (error) {
      setMailError(
        error instanceof Error ? error.message : "The purchasing inbox could not be selected.",
      );
    } finally {
      setMailState("idle");
    }
  }

  async function approveExactRecipients() {
    if (!rfqs) return;
    setMailError(null);
    setMailState("approving");
    try {
      await approveRecipients({
        procurementId,
        recipients: rfqs.map((rfq) => ({
          rfqId: rfq.rfqId,
          email: recipientDrafts[rfq.rfqId] ?? rfq.recipientEmail,
        })),
        confirmation: approvalConfirmation,
      });
    } catch (error) {
      setMailError(error instanceof Error ? error.message : "Recipient approval failed.");
    } finally {
      setMailState("idle");
    }
  }

  async function sendRfqs() {
    setMailError(null);
    setMailState("sending");
    try {
      await sendApprovedRfqs({ procurementId });
    } catch (error) {
      setMailError(error instanceof Error ? error.message : "The RFQs could not be queued.");
    } finally {
      setMailState("idle");
    }
  }

  if (procurement === undefined) {
    return (
      <main className="min-h-screen bg-stone-100 p-6">
        <div className="mx-auto max-w-3xl animate-pulse rounded-xl bg-white p-10">
          Loading procurement…
        </div>
      </main>
    );
  }
  if (procurement === null) {
    return (
      <main className="min-h-screen bg-stone-100 p-6">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-10">
          <h1 className="text-xl font-semibold">Procurement not found</h1>
          <Button className="mt-5" onClick={onBack}>
            Dashboard
          </Button>
        </div>
      </main>
    );
  }

  const canOperateDemo = currentUser?.canApproveDemo === true;
  const canSendExternal =
    currentUser !== null &&
    currentUser !== undefined &&
    !currentUser.isJudgeDemo &&
    (currentUser.role === "buyer" || currentUser.role === "admin");

  const thread = procurement.threadLinks.find((link) => link.anchorKey === `procurement:${view}`);
  const viewAvailable =
    view === "procurement" ||
    ((view === "recommendation" || view === "approval") && procurement.recommendation !== null) ||
    (view === "order" && procurement.purchaseOrder !== null);
  const viewTitle =
    view === "procurement"
      ? (procurementLabels[procurement.status] ?? "Procurement progress")
      : view === "recommendation"
        ? "Review the recommended purchase"
        : view === "approval"
          ? "Approve exact purchase terms"
          : procurement.purchaseOrder?.status === "confirmed"
            ? "Purchase order confirmed"
            : "Purchase order status";

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f4ed_0%,#eeeadf_100%)] px-4 py-6 sm:px-7">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between border-b border-stone-300 pb-4">
          <Button variant="ghost" className="-ml-3" onClick={onBack}>
            <ArrowLeft />
            Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-stone-500">{procurement.code}</span>
            <StatusBadge status={procurement.status} />
          </div>
        </header>
        <Card className="border-stone-300 bg-white/80 shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>
                  {procurement.itemName} · {procurement.sku}
                </CardDescription>
                <CardTitle className="mt-2 text-2xl">
                  {viewAvailable
                    ? viewTitle
                    : `${view[0].toUpperCase()}${view.slice(1)} is not ready`}
                </CardTitle>
              </div>
              {thread ? (
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`Open ${thread.status} thread`}
                  onClick={() => void openContextualThread(thread.componentThreadId)}
                >
                  <MessageCircle />
                  <span className="sr-only">{thread.unreadCount} unread</span>
                </Button>
              ) : null}
            </div>
            <CardDescription className="text-sm leading-6">
              {viewAvailable
                ? view === "procurement"
                  ? procurement.triggerReason
                  : "One focused step with exact stored terms and collapsed evidence."
                : "This focused view will appear when the procurement reaches that step."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {viewAvailable ? (
              <FocusedViewBody procurement={procurement} view={view} />
            ) : (
              <div className="rounded-lg border border-dashed border-stone-300 p-5 text-sm text-stone-600">
                There is no buyer action here yet. Return to the dashboard while the agent works.
              </div>
            )}
          </CardContent>
        </Card>
        {view === "approval" && procurement.recommendation ? (
          <ApprovalAccessCard procurement={procurement} />
        ) : null}
        {view === "order" && procurement.purchaseOrder ? (
          <PurchaseOrderDeliveryCard procurement={procurement} />
        ) : null}
        <Card className="border-stone-300 bg-white/80 shadow-none">
          <CardHeader>
            <CardDescription>Live supplier evidence · BC-08</CardDescription>
            <CardTitle className="text-base">Real supplier discovery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => void sourceSuppliers()}
              disabled={
                !canOperateDemo || sourcingState === "working" || sourcing?.run.status === "pending"
              }
            >
              <Search />
              {sourcingState === "working" || sourcing?.run.status === "pending"
                ? "Searching with Firecrawl…"
                : sourcing?.run.status === "succeeded"
                  ? "Search again"
                  : "Start sourcing"}
            </Button>
            {!canOperateDemo ? (
              <p className="text-sm text-stone-600">
                Enter judge mode to run provider-backed demo steps. Public observation stays open.
              </p>
            ) : null}
            {sourcing?.candidates.map((candidate) => (
              <div
                key={candidate.resultId}
                className="rounded-lg border border-stone-200 bg-white p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{candidate.supplierName}</p>
                  <Badge variant="outline">Website · Firecrawl</Badge>
                </div>
                <p className="mt-1 text-stone-600">{candidate.title}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                  <a
                    className="font-medium text-amber-800 underline"
                    href={candidate.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open source
                  </a>
                  <span>{candidate.matchStatus.replaceAll("_", " ")}</span>
                  {candidate.matchConfidence > 0 ? (
                    <span>{Math.round(candidate.matchConfidence * 100)}% confidence</span>
                  ) : (
                    <span>OpenAI assessment pending</span>
                  )}
                </div>
              </div>
            ))}
            {sourcing?.run.status === "failed" ? (
              <p className="text-sm text-red-700">{sourcing.run.errorMessage}</p>
            ) : null}
            {sourcingError ? <p className="text-sm text-red-700">{sourcingError}</p> : null}
          </CardContent>
        </Card>
        <Card className="border-stone-300 bg-white/80 shadow-none">
          <CardHeader>
            <CardDescription>Controlled previews · BC-09</CardDescription>
            <CardTitle className="text-base">Requests for quote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rfqs?.length === 0 ? (
              <Button
                variant="outline"
                onClick={() => void prepareControlledRfqs()}
                disabled={
                  !canOperateDemo || rfqState === "working" || sourcing?.run.status !== "succeeded"
                }
              >
                <Sparkles />
                {rfqState === "working" ? "Writing previews…" : "Prepare three RFQs"}
              </Button>
            ) : null}
            {rfqs?.map((rfq) => (
              <div
                key={rfq.rfqId}
                className="rounded-lg border border-stone-200 bg-white p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{rfq.supplierName}</p>
                  <Badge variant="outline">Controlled demo recipient</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-stone-500">{rfq.recipientEmail}</p>
                {rfq.recipientApprovedAt === null && canSendExternal ? (
                  <Input
                    className="mt-3"
                    type="email"
                    aria-label={`${rfq.supplierName} controlled recipient email`}
                    value={recipientDrafts[rfq.rfqId] ?? rfq.recipientEmail}
                    onChange={(event) =>
                      setRecipientDrafts((current) => ({
                        ...current,
                        [rfq.rfqId]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <p className="mt-2 text-xs text-stone-600">
                    {rfq.recipientApprovedAt === null
                      ? "Exact recipient is visible only to the configured buyer"
                      : "Exact recipient approved"}
                  </p>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Fact
                    label="Quantity"
                    value={`${rfq.requestedQuantity.toLocaleString()} units`}
                  />
                  <Fact label="Required by" value={rfq.requiredBy} />
                  <Fact label="Ship to" value={rfq.destination} />
                </div>
                {rfq.subject && rfq.body ? (
                  <div className="mt-4 rounded-md bg-stone-50 p-3">
                    <p className="font-medium">{rfq.subject}</p>
                    <p className="mt-2 leading-6 whitespace-pre-wrap text-stone-600">{rfq.body}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-stone-500">
                    OpenAI is writing wording from the fixed fields…
                  </p>
                )}
              </div>
            ))}
            {rfqs && rfqs.length > 0 ? (
              <div className="space-y-3 border-t border-stone-200 pt-4">
                <p className="text-xs leading-5 text-stone-500">
                  These identities are controlled test recipients, not claims about the legal
                  entities found online. No email can be sent until the exact addresses are reviewed
                  and explicitly approved.
                </p>
                {!canSendExternal ? (
                  <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
                    External email controls require the configured buyer. Judge mode cannot reveal
                    recipients, create inboxes, or send messages.
                  </p>
                ) : rfqs.every((rfq) => rfq.recipientApprovedAt !== null) ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {purchasingInbox ? (
                      <Badge variant="outline">From {purchasingInbox.email}</Badge>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => void selectPurchasingInbox()}
                        disabled={mailState !== "idle"}
                      >
                        {mailState === "inbox" ? "Selecting inbox…" : "Create or select Acme inbox"}
                      </Button>
                    )}
                    <Button
                      onClick={() => void sendRfqs()}
                      disabled={mailState !== "idle" || purchasingInbox === null}
                    >
                      {mailState === "sending" ? "Queueing…" : "Send approved RFQs"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={approvalConfirmation}
                      onChange={(event) => setApprovalConfirmation(event.target.value)}
                      placeholder="Type APPROVE CONTROLLED RFQ RECIPIENTS"
                      aria-label="Recipient approval confirmation"
                    />
                    <Button
                      variant="outline"
                      onClick={() => void approveExactRecipients()}
                      disabled={mailState !== "idle"}
                    >
                      {mailState === "approving" ? "Approving…" : "Approve exact recipients"}
                    </Button>
                  </div>
                )}
                {delivery && delivery.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {delivery.map((item) => (
                      <Badge key={item.rfqId} variant="outline">
                        {item.status ?? "queued"}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {rfqError ? <p className="text-sm text-red-700">{rfqError}</p> : null}
            {mailError ? <p className="text-sm text-red-700">{mailError}</p> : null}
          </CardContent>
        </Card>
        {quotes && quotes.length > 0 ? (
          <Card className="border-stone-300 bg-white/80 shadow-none">
            <CardHeader>
              <CardDescription>Live inbound evidence · BC-11</CardDescription>
              <CardTitle className="text-base">Supplier quotes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quotes.map((quote) => (
                <div
                  key={quote.quoteId}
                  className="rounded-lg border border-stone-200 bg-white p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {quote.supplierName} · revision {quote.revision}
                    </p>
                    <Badge variant="outline">{quote.qualification.replaceAll("_", " ")}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Fact
                      label="Available"
                      value={
                        quote.quantityAvailable === null
                          ? "Missing"
                          : `${quote.quantityAvailable.toLocaleString()} units`
                      }
                    />
                    <Fact
                      label="Landed cost"
                      value={
                        quote.landedCostCents === null ? "Incomplete" : money(quote.landedCostCents)
                      }
                    />
                    <Fact label="Arrival" value={quote.estimatedArrivalDate ?? "Missing"} />
                  </div>
                  <p className="mt-3 text-xs text-stone-500">
                    {Math.round(quote.responseConfidence * 100)}% extraction confidence · raw
                    {quote.evidenceLabel}
                  </p>
                  {quote.missingInformation.length > 0 ? (
                    <p className="mt-2 text-xs text-amber-800">
                      Missing: {quote.missingInformation.join(", ").replaceAll("_", " ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
        {followUps && followUps.length > 0 ? (
          <Card className="border-stone-300 bg-white/80 shadow-none">
            <CardHeader>
              <CardDescription>Threaded supplier outreach · BC-12</CardDescription>
              <CardTitle className="text-base">Automatic follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {followUps.map((followUp) => (
                <div
                  key={followUp.followUpId}
                  className="rounded-lg border border-stone-200 bg-white p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {followUp.supplierName} · attempt {followUp.attempt} of 2
                    </p>
                    <Badge variant="outline">{followUp.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    Requested: {followUp.requestedFields.join(", ").replaceAll("_", " ")}
                  </p>
                  <div className="mt-3 rounded-md bg-stone-50 p-3">
                    <p className="font-medium">{followUp.subject}</p>
                    <p className="mt-2 leading-6 whitespace-pre-wrap text-stone-600">
                      {followUp.body}
                    </p>
                  </div>
                  {followUp.errorMessage ? (
                    <p className="mt-2 text-xs text-red-700">{followUp.errorMessage}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
        {comparison ? (
          <Card className="border-stone-300 bg-white/80 shadow-none">
            <CardHeader>
              <CardDescription>Deterministic decision · BC-13</CardDescription>
              <CardTitle className="text-base">Quote comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-stone-700">{comparison.explanation}</p>
              <div className="space-y-3">
                {comparison.entries.map((entry) => (
                  <div
                    key={entry.quoteId}
                    className="rounded-lg border border-stone-200 bg-white p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {entry.rank === null ? "—" : `#${entry.rank}`} {entry.supplierName}
                      </p>
                      <Badge variant="outline">
                        {entry.selected ? "recommended" : entry.qualification.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Fact
                        label="Landed cost · supplier"
                        value={
                          entry.landedCostCents === null
                            ? "Incomplete"
                            : money(entry.landedCostCents)
                        }
                      />
                      <Fact
                        label="Arrival · supplier"
                        value={entry.estimatedArrivalDate ?? "Missing"}
                      />
                      <Fact
                        label="Match · calculated"
                        value={`${Math.round(entry.productMatchConfidence * 100)}%`}
                      />
                      <Fact
                        label="Stockout delay · calculated"
                        value={`${entry.projectedStockoutDays} days`}
                      />
                      <Fact
                        label="Excess · calculated"
                        value={`${entry.excessInventory.toLocaleString()} units`}
                      />
                      <Fact
                        label="Reliability · historical"
                        value={`${Math.round(entry.supplierReliability * 100)}%`}
                      />
                    </div>
                    {entry.reasons.length > 0 ? (
                      <p className="mt-3 text-xs text-amber-800">
                        Lost because: {entry.reasons.join(", ").replaceAll("_", " ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() =>
                    navigate({
                      search: (current) => ({ ...current, view: "recommendation" }),
                    })
                  }
                >
                  Review recommendation
                  <ArrowRight />
                </Button>
                {view === "recommendation" ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate({
                        search: (current) => ({ ...current, view: "approval" }),
                      })
                    }
                  >
                    Continue to buyer decision
                    <ArrowRight />
                  </Button>
                ) : null}
                <span className="font-mono text-xs text-stone-500">
                  {comparison.rankingVersion} · explanation {comparison.explanationStatus}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {demo ? (
          <Card className="border-dashed border-stone-400 bg-white/60 shadow-none">
            <CardHeader>
              <CardDescription>Demo diagnostic · BC-07</CardDescription>
              <CardTitle className="text-base">Structured supplier-search task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                onClick={() => void runDiagnostic()}
                disabled={aiRun?.status === "pending"}
              >
                <Sparkles />
                {aiRun?.status === "pending" ? "OpenAI is working…" : "Run AI diagnostic"}
              </Button>
              {aiRun ? (
                <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={aiRun.status} />
                    <span className="font-mono text-xs text-stone-500">
                      {aiRun.transport} · {aiRun.model}
                    </span>
                  </div>
                  {aiRun.result ? (
                    <div className="mt-3 space-y-2">
                      <p>{aiRun.result.summary}</p>
                      {aiRun.result.output.task === "supplier_search_queries" ? (
                        <ul className="list-disc space-y-1 pl-5 text-stone-600">
                          {aiRun.result.output.queries.map((query) => (
                            <li key={query}>{query}</li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="text-xs text-stone-500">
                        {aiRun.evidenceRefs.length} stored evidence references · confidence{" "}
                        {Math.round(aiRun.result.confidence * 100)}%
                      </p>
                    </div>
                  ) : aiRun.errorMessage ? (
                    <p className="mt-3 text-red-700">{aiRun.errorMessage}</p>
                  ) : null}
                </div>
              ) : null}
              {diagnosticError ? <p className="text-sm text-red-700">{diagnosticError}</p> : null}
            </CardContent>
          </Card>
        ) : null}
        <AgentCard
          state="working"
          message="I’m checking suppliers against the required date and product specification."
          unread={procurement.threadLinks.reduce((total, link) => total + link.unreadCount, 0)}
        />
      </div>
      <Sheet open={openThread !== null} onOpenChange={(open) => !open && setOpenThread(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Contextual thread</SheetTitle>
            <SheetDescription>
              This conversation stays attached to this procurement detail.
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 text-sm text-stone-600">
            {threadMessages === undefined ? (
              <p>Loading thread…</p>
            ) : threadMessages.page.length === 0 ? (
              <p>The agent is preparing this thread.</p>
            ) : (
              <div className="space-y-3">
                {threadMessages.page.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.role === "assistant"
                        ? "rounded-lg bg-amber-50 p-3 text-stone-800"
                        : "rounded-lg bg-stone-100 p-3"
                    }
                  >
                    <p className="mb-1 text-xs font-semibold text-stone-500 uppercase">
                      {message.role === "assistant" ? "Autonomous Buyer" : message.role}
                    </p>
                    <p className="leading-6">{message.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

type ProcurementDetail = NonNullable<
  ReturnType<typeof useQuery<typeof api.purchasing.getProcurement>>
>;

function ApprovalAccessCard({ procurement }: { procurement: ProcurementDetail }) {
  const navigate = Route.useNavigate();
  const recommendation = procurement.recommendation;
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const currentUser = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  const claimConfiguredBuyer = useMutation(api.authData.claimConfiguredBuyer);
  const decideRecommendation = useMutation(api.approvals.decideRecommendation);
  const [authState, setAuthState] = useState<"idle" | "judge" | "password" | "decision">("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [showModified, setShowModified] = useState(false);
  const [quantity, setQuantity] = useState(procurement.quantityRequired.toString());
  const [unitPrice, setUnitPrice] = useState(
    recommendation?.unitPriceMicrodollars === null ||
      recommendation?.unitPriceMicrodollars === undefined
      ? ""
      : (recommendation.unitPriceMicrodollars / 1_000_000).toFixed(4),
  );
  const [freight, setFreight] = useState(
    recommendation?.freightCents === null || recommendation?.freightCents === undefined
      ? ""
      : (recommendation.freightCents / 100).toFixed(2),
  );

  if (recommendation === null) return null;
  const recommendationId = recommendation.recommendationId;

  async function claimAfterHandshake() {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        return await claimConfiguredBuyer({});
      } catch (claimError) {
        lastError = claimError;
        if (claimError instanceof Error && !claimError.message.includes("Sign in first")) {
          throw claimError;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Buyer access did not activate.");
  }

  async function enterJudgeMode() {
    setError(null);
    setAuthState("judge");
    try {
      await signIn("anonymous");
      await claimAfterHandshake();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Judge access could not start.");
    } finally {
      setAuthState("idle");
    }
  }

  async function submitPassword(flow: "signIn" | "signUp") {
    setError(null);
    setAuthState("password");
    try {
      await signIn("password", { email, password, name, flow });
      await claimAfterHandshake();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Sign-in failed.");
    } finally {
      setAuthState("idle");
    }
  }

  async function decide(decision: "approved" | "modified" | "rejected") {
    setError(null);
    setAuthState("decision");
    try {
      await decideRecommendation({
        procurementId: procurement.procurementId,
        recommendationId,
        decision,
        decisionNote: decisionNote || undefined,
        modifiedTerms:
          decision === "modified"
            ? {
                quantity: Number(quantity),
                unitPriceMicrodollars: Math.round(Number(unitPrice) * 1_000_000),
                freightCents: Math.round(Number(freight) * 100),
              }
            : undefined,
      });
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Decision failed.");
    } finally {
      setAuthState("idle");
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50/80 shadow-none">
      <CardHeader>
        <CardDescription>Human approval · stable Convex Auth</CardDescription>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-5" />
          Judge decision checkpoint
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {procurement.approval ? (
          <div className="rounded-lg border border-emerald-200 bg-white p-4 text-sm">
            <p className="font-medium capitalize">{procurement.approval.status}</p>
            <p className="mt-1 text-stone-600">
              {procurement.approval.decidedBy}
              {procurement.approval.isJudgeDemo ? " · judge demo identity" : " · configured buyer"}
            </p>
            {procurement.purchaseOrder ? (
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => navigate({ search: (current) => ({ ...current, view: "order" }) })}
              >
                Inspect {procurement.purchaseOrder.poNumber}
                <ArrowRight />
              </Button>
            ) : null}
          </div>
        ) : !isAuthenticated ? (
          <>
            <p className="text-sm leading-6 text-stone-700">
              The dashboard stays public. This one-click identity unlocks only the demo purchase
              decision and is written into the audit trail.
            </p>
            <Button
              onClick={() => void enterJudgeMode()}
              disabled={isLoading || authState !== "idle"}
            >
              <ShieldCheck />
              {authState === "judge" ? "Entering judge mode…" : "Enter judge approval mode"}
            </Button>
            <Collapsible>
              <CollapsibleTrigger className="text-sm font-medium text-stone-600 underline">
                Sign in as the configured buyer
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3 rounded-lg border bg-white p-4">
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Buyer email"
                  aria-label="Buyer email"
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  aria-label="Buyer password"
                />
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name for a new account"
                  aria-label="Buyer name"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void submitPassword("signIn")}
                    disabled={authState !== "idle"}
                  >
                    Sign in
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void submitPassword("signUp")}
                    disabled={authState !== "idle"}
                  >
                    Create account
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        ) : currentUser === undefined ? (
          <p className="text-sm text-stone-600">Confirming the signed-in buyer…</p>
        ) : currentUser === null || !currentUser.canApproveDemo ? (
          <div className="space-y-3">
            <p className="text-sm text-red-700">This identity cannot approve the demo purchase.</p>
            <Button variant="outline" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-4 text-sm">
              <span>
                Signed in as <strong>{currentUser.name}</strong>
              </span>
              <Badge variant="outline">
                {currentUser.isJudgeDemo ? "Judge demo" : currentUser.role}
              </Badge>
            </div>
            <Textarea
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              placeholder="Optional decision note"
              aria-label="Decision note"
            />
            <Collapsible open={showModified} onOpenChange={setShowModified}>
              <CollapsibleTrigger className="text-sm font-medium text-stone-600 underline">
                Modify exact terms
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-3">
                <Input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  aria-label="Modified quantity"
                />
                <Input
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  aria-label="Modified unit price in dollars"
                />
                <Input
                  value={freight}
                  onChange={(event) => setFreight(event.target.value)}
                  aria-label="Modified freight in dollars"
                />
              </CollapsibleContent>
            </Collapsible>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void decide("approved")} disabled={authState !== "idle"}>
                Approve exact terms
              </Button>
              <Button
                variant="outline"
                onClick={() => void decide("modified")}
                disabled={authState !== "idle" || !showModified}
              >
                Approve modified terms
              </Button>
              <Button
                variant="outline"
                onClick={() => void decide("rejected")}
                disabled={authState !== "idle"}
              >
                Reject
              </Button>
            </div>
          </>
        )}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function PurchaseOrderDeliveryCard({ procurement }: { procurement: ProcurementDetail }) {
  const order = procurement.purchaseOrder;
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  const approveRecipient = useMutation(api.purchaseOrders.approveRecipient);
  const sendApprovedOrder = useMutation(api.purchaseOrders.sendApproved);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<"idle" | "approving" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  if (order === null) return null;
  const purchaseOrderId = order.purchaseOrderId;

  async function approveExactRecipient() {
    setError(null);
    setState("approving");
    try {
      await approveRecipient({
        purchaseOrderId,
        recipientEmail,
        confirmation,
      });
    } catch (approvalError) {
      setError(
        approvalError instanceof Error ? approvalError.message : "PO recipient approval failed.",
      );
    } finally {
      setState("idle");
    }
  }

  async function sendOrder() {
    setError(null);
    setState("sending");
    try {
      await sendApprovedOrder({ purchaseOrderId });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The purchase order was not sent.");
    } finally {
      setState("idle");
    }
  }

  const configuredBuyer =
    currentUser !== null &&
    currentUser !== undefined &&
    !currentUser.isJudgeDemo &&
    (currentUser.role === "buyer" || currentUser.role === "admin");

  return (
    <Card className="border-amber-300 bg-amber-50/80 shadow-none">
      <CardHeader>
        <CardDescription>External-send gate · AgentMail</CardDescription>
        <CardTitle className="text-lg">Approve the exact PO recipient</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.status === "sent" || order.status === "confirmed" ? (
          <p className="text-sm text-emerald-800">
            {order.poNumber} was delivered once and is waiting for supplier confirmation.
          </p>
        ) : !configuredBuyer ? (
          <p className="text-sm leading-6 text-stone-700">
            Judge mode can approve the demo purchase, but it can never send external email. Sign in
            as the configured buyer to approve a real recipient.
          </p>
        ) : order.recipientApprovedAt === null ? (
          <>
            <p className="text-sm leading-6 text-stone-700">
              Enter the exact controlled supplier inbox shown in your test setup. It is stored only
              after this explicit confirmation.
            </p>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              placeholder="Controlled supplier email"
              aria-label="Purchase order recipient email"
            />
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Type APPROVE PO RECIPIENT"
              aria-label="Purchase order recipient approval confirmation"
            />
            <Button onClick={() => void approveExactRecipient()} disabled={state !== "idle"}>
              {state === "approving" ? "Approving recipient…" : "Approve exact recipient"}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <Badge variant="outline">Exact recipient approved</Badge>
            <p className="text-sm text-stone-700">
              Sending is idempotent: retries reuse the same delivery record and cannot create a
              second purchase order.
            </p>
            <Button onClick={() => void sendOrder()} disabled={state !== "idle"}>
              {state === "sending"
                ? "Checking delivery…"
                : order.status === "queued" || order.errorMessage
                  ? "Resume existing delivery check"
                  : `Send ${order.poNumber} once`}
            </Button>
          </div>
        )}
        {order.errorMessage ? <p className="text-sm text-red-700">{order.errorMessage}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function FocusedViewBody({
  procurement,
  view,
}: {
  procurement: ProcurementDetail;
  view: FocusView;
}) {
  if (view === "recommendation" && procurement.recommendation) {
    const recommendation = procurement.recommendation;
    return (
      <>
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-5">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Recommended
          </p>
          <h2 className="mt-1 text-xl font-semibold">{recommendation.supplierName}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Fact
              label="Quantity"
              value={`${(recommendation.quantityAvailable ?? procurement.quantityRequired).toLocaleString()} units`}
            />
            <Fact
              label="Total"
              value={
                recommendation.landedCostCents === null
                  ? "Pending"
                  : money(recommendation.landedCostCents)
              }
            />
            <Fact label="Arrival" value={recommendation.estimatedArrivalDate ?? "Pending"} />
          </div>
          <p className="mt-5 text-sm leading-6">{recommendation.explanation}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">Confirmed · supplier quote</Badge>
            <Badge variant="outline">
              Match · {Math.round(recommendation.matchConfidence * 100)}%
            </Badge>
          </div>
        </div>
        {recommendation.alternatives.length > 0 ? (
          <Collapsible>
            <CollapsibleTrigger className="inline-flex h-9 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-medium">
              See {recommendation.alternatives.length} alternatives
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {recommendation.alternatives.map((alternative) => (
                <div key={alternative.supplierName} className="rounded-lg border p-4 text-sm">
                  <p className="font-medium">{alternative.supplierName}</p>
                  <p className="mt-1 text-stone-500">
                    {alternative.landedCostCents === null
                      ? "Price incomplete"
                      : money(alternative.landedCostCents)}{" "}
                    · {alternative.estimatedArrivalDate ?? "Arrival unknown"} ·{" "}
                    {alternative.qualification.replace("_", " ")}
                  </p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </>
    );
  }

  if (view === "approval" && procurement.recommendation) {
    const recommendation = procurement.recommendation;
    return (
      <>
        <div className="grid gap-5 rounded-lg border border-stone-200 bg-stone-50 p-5 sm:grid-cols-2">
          <Fact label="Supplier" value={recommendation.supplierName} />
          <Fact
            label="Purchase total"
            value={
              recommendation.landedCostCents === null
                ? "Pending"
                : money(recommendation.landedCostCents)
            }
          />
          <Fact label="Quantity" value={`${procurement.quantityRequired.toLocaleString()} units`} />
          <Fact label="Required by" value={procurement.requiredBy} />
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6">
          Product match confidence is {Math.round(recommendation.matchConfidence * 100)}%. Review
          the evidence before deciding.
        </div>
        {procurement.approval ? (
          <Badge variant="outline" className="capitalize">
            Decision recorded · {procurement.approval.status}
          </Badge>
        ) : (
          <p className="text-sm text-stone-500">
            No decision is recorded. Approval controls activate with buyer identity in BC-09.
          </p>
        )}
      </>
    );
  }

  if (view === "order" && procurement.purchaseOrder) {
    const order = procurement.purchaseOrder;
    return (
      <>
        <div className="grid gap-5 rounded-lg border border-stone-200 bg-stone-50 p-5 sm:grid-cols-2">
          <Fact label="Purchase order" value={order.poNumber} />
          <Fact label="Supplier" value={order.supplierName} />
          <Fact label="Quantity" value={`${order.quantity.toLocaleString()} units`} />
          <Fact
            label="Unit price"
            value={money(Math.round(order.unitPriceMicrodollars / 10_000))}
          />
          <Fact label="Extended" value={money(order.extendedPriceCents)} />
          <Fact label="Freight" value={money(order.freightCents)} />
          <Fact label="Total" value={money(order.totalCents)} />
          <Fact label="Required by" value={order.requiredBy} />
          <Fact label="Payment terms" value={order.paymentTerms} />
          <Fact label="Approved quote" value={`Revision ${order.quoteRevision}`} />
          <Fact label="Status" value={order.status.replace("_", " ")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Calculated · price totals</Badge>
          <Badge variant="outline">Approved · quote revision {order.quoteRevision}</Badge>
          {procurement.confirmation ? (
            <Badge variant="outline">Supplier-confirmed · email reply</Badge>
          ) : null}
        </div>
        <div className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Ship to</p>
            <p className="mt-2 text-sm whitespace-pre-line">{order.shipTo}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Bill to</p>
            <p className="mt-2 text-sm whitespace-pre-line">{order.billTo}</p>
          </div>
        </div>
        <iframe
          title={`${order.poNumber} accessible HTML preview`}
          srcDoc={order.htmlBody}
          sandbox=""
          className="h-[34rem] w-full rounded-lg border border-stone-300 bg-white"
        />
        <p className="text-sm text-stone-600">
          {order.sentAt === null
            ? "This order has not been marked sent."
            : `Sent ${new Date(order.sentAt).toLocaleString()}. Confirmation appears only after matching provider evidence.`}
        </p>
        {procurement.confirmation ? (
          <div
            className={`rounded-lg border p-5 ${
              procurement.confirmation.matchesApprovedTerms
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <p className="font-medium">
              {procurement.confirmation.matchesApprovedTerms
                ? "Supplier terms match · inventory covered"
                : "Supplier terms changed · buyer review required"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Confirmation {procurement.confirmation.supplierConfirmationNumber ?? "number pending"}
              {procurement.confirmation.confirmedArrivalDate
                ? ` · arriving ${procurement.confirmation.confirmedArrivalDate}`
                : ""}
              {` · ${Math.round(procurement.confirmation.extractionConfidence * 100)}% extraction confidence`}
            </p>
            {procurement.confirmation.differences.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {procurement.confirmation.differences.map((difference) => (
                  <li key={difference.field}>
                    {difference.field}: approved {difference.approved}, confirmed{" "}
                    {difference.confirmed}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <ol className="space-y-3" aria-label="Procurement milestones">
        <Milestone done label="Risk detected" />
        <Milestone done label="Inventory analyzed" />
        <Milestone current label="Finding qualified suppliers" />
        <Milestone label="Compare quotes" />
        <Milestone label="Buyer review" />
        <Milestone label="Purchase order" />
      </ol>
      <Separator />
      <div className="grid gap-4 sm:grid-cols-3">
        <Fact
          label="Target quantity"
          value={`${procurement.quantityRequired.toLocaleString()} units`}
        />
        <Fact label="Required by" value={procurement.requiredBy} />
        <Fact label="Projected stockout" value={procurement.projectedStockoutDate} />
      </div>
      <Collapsible>
        <CollapsibleTrigger className="inline-flex h-9 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-medium">
          View activity and evidence
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
          {procurement.events.map((event) => (
            <div key={event.eventId} className="grid grid-cols-[4rem_1fr] gap-3 text-sm">
              <span className="font-mono text-xs text-stone-400">{shortTime(event.createdAt)}</span>
              <p>{event.summary}</p>
            </div>
          ))}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Confirmed · inventory history</Badge>
            <Badge variant="outline">Version · {procurement.calculationVersion}</Badge>
          </div>
          {procurement.calculationInputs ? (
            <p className="text-xs leading-5 text-stone-500">
              Calculated from {procurement.calculationInputs.quantityOnHand.toLocaleString()} on
              hand, a {procurement.calculationInputs.trailingUsageDays}-day usage window,{" "}
              {procurement.calculationInputs.safetyStockDays} safety-stock days, and a{" "}
              {procurement.calculationInputs.casePack}-unit pack.
            </p>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

function Metric({ label, value, source }: { label: string; value: string; source?: string }) {
  return (
    <Card className="border-stone-300 bg-white/70 shadow-none">
      <CardContent className="p-5">
        <p className="text-xs font-medium text-stone-500 uppercase">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
        {source ? <p className="mt-2 text-xs text-stone-400">{source}</p> : null}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500 uppercase">{label}</p>
      <p className="mt-1 font-medium tabular-nums">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const urgent =
    status === "action_required" || status === "approval_required" || status === "exception";
  return (
    <Badge variant={urgent ? "destructive" : "secondary"} className="whitespace-nowrap">
      {statusLabels[status] ?? procurementLabels[status] ?? status.replaceAll("_", " ")}
    </Badge>
  );
}

function Milestone({ label, done, current }: { label: string; done?: boolean; current?: boolean }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      {done ? (
        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-700 text-white">
          <Check className="size-3.5" />
        </span>
      ) : current ? (
        <span className="flex size-6 items-center justify-center rounded-full bg-amber-500 text-white">
          <Search className="size-3.5" />
        </span>
      ) : (
        <span className="flex size-6 items-center justify-center rounded-full border border-stone-300">
          <Circle className="size-2 text-stone-300" />
        </span>
      )}
      <span className={current ? "font-semibold" : done ? "text-stone-700" : "text-stone-400"}>
        {label}
      </span>
    </li>
  );
}

function AgentCard({ state, message, unread }: { state: string; message: string; unread: number }) {
  return (
    <Card className="border-amber-300 bg-amber-50 shadow-none">
      <CardHeader>
        <CardDescription className="flex items-center gap-2 font-semibold text-amber-900 uppercase">
          <Sparkles className="size-4" />
          Agent · {state.replace("_", " ")}
        </CardDescription>
        <CardTitle className="text-base leading-6">{message}</CardTitle>
      </CardHeader>
      {unread > 0 ? (
        <CardContent>
          <p className="text-sm text-amber-900">
            {unread} unread contextual {unread === 1 ? "thread" : "threads"}
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}

function JudgeModeButton() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const currentUser = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  const claimConfiguredBuyer = useMutation(api.authData.claimConfiguredBuyer);
  const [state, setState] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setState("working");
    setError(null);
    try {
      if (!isAuthenticated) await signIn("anonymous");
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          await claimConfiguredBuyer({});
          return;
        } catch (claimError) {
          lastError = claimError;
          if (claimError instanceof Error && !claimError.message.includes("Sign in first")) {
            throw claimError;
          }
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
      throw lastError instanceof Error ? lastError : new Error("Judge mode did not activate.");
    } catch (judgeError) {
      setError(judgeError instanceof Error ? judgeError.message : "Judge mode could not start.");
    } finally {
      setState("idle");
    }
  }

  if (currentUser?.isJudgeDemo && currentUser.canApproveDemo) {
    return (
      <Button variant="outline" className="bg-white/70" onClick={() => void signOut()}>
        <ShieldCheck />
        Judge mode active
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="bg-white/70"
        onClick={() => void enter()}
        disabled={isLoading || state === "working"}
      >
        <ShieldCheck />
        {state === "working" ? "Opening judge mode…" : "Enter judge mode"}
      </Button>
      {error ? <span className="max-w-48 text-xs text-red-700">{error}</span> : null}
    </div>
  );
}

function ConfiguredBuyerButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const currentUser = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  const claimConfiguredBuyer = useMutation(api.authData.claimConfiguredBuyer);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  async function claimAfterHandshake() {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        return await claimConfiguredBuyer({});
      } catch (claimError) {
        lastError = claimError;
        if (claimError instanceof Error && !claimError.message.includes("Sign in first")) {
          throw claimError;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Buyer access did not activate.");
  }

  async function submit(flow: "signIn" | "signUp") {
    setError(null);
    setState("working");
    try {
      await signIn("password", { email, password, name, flow });
      await claimAfterHandshake();
      setPassword("");
      setOpen(false);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Buyer sign-in failed.");
    } finally {
      setState("idle");
    }
  }

  const configuredBuyer =
    currentUser !== null &&
    currentUser !== undefined &&
    !currentUser.isJudgeDemo &&
    (currentUser.role === "buyer" || currentUser.role === "admin");

  return (
    <>
      {configuredBuyer ? (
        <Button variant="outline" className="bg-white/70" onClick={() => void signOut()}>
          <ShieldCheck />
          Buyer active
        </Button>
      ) : (
        <Button
          variant="outline"
          className="bg-white/70"
          onClick={() => setOpen(true)}
          disabled={currentUser?.isJudgeDemo === true}
          title={currentUser?.isJudgeDemo ? "Leave judge mode first" : undefined}
        >
          Buyer sign in
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Configured buyer</SheetTitle>
            <SheetDescription>
              This account can approve real recipients and external email. Passwords stay in the
              auth form and are never shown in the public dashboard.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Buyer email"
              aria-label="Configured buyer email"
              autoComplete="email"
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              aria-label="Configured buyer password"
              autoComplete="current-password"
            />
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name for first-time setup"
              aria-label="Configured buyer name"
              autoComplete="name"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void submit("signIn")} disabled={state !== "idle"}>
                Sign in
              </Button>
              <Button
                variant="outline"
                onClick={() => void submit("signUp")}
                disabled={state !== "idle"}
              >
                Create buyer account
              </Button>
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((number) => (
        <div key={number} className="h-28 rounded-xl bg-white/70" />
      ))}
    </div>
  );
}

function EmptyDashboard({
  demo,
  onReset,
  busy,
}: {
  demo: boolean;
  onReset: () => void;
  busy: boolean;
}) {
  return (
    <Card className="border-dashed bg-white/70">
      <CardHeader>
        <CardTitle>No demo scenario</CardTitle>
        <CardDescription>
          Reset the Acme Foods scenario to load real purchasing data.
        </CardDescription>
      </CardHeader>
      {demo ? (
        <CardContent>
          <Button onClick={onReset} disabled={busy}>
            <RotateCcw />
            Reset scenario
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

type Scenario = ReturnType<typeof useQuery<typeof api.demo.getCurrentScenario>>;

function DemoControls({
  scenario,
  state,
  error,
  onReset,
  onStart,
}: {
  scenario: Scenario;
  state: "idle" | "resetting" | "starting";
  error: string | null;
  onReset: () => void;
  onStart: () => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  const configuredBuyer =
    currentUser !== null &&
    currentUser !== undefined &&
    !currentUser.isJudgeDemo &&
    (currentUser.role === "buyer" || currentUser.role === "admin");
  return (
    <Card className="border-dashed border-stone-400 bg-white/55" data-testid="demo-controls">
      <CardHeader>
        <CardDescription>Hidden rehearsal controls · local demo data only</CardDescription>
        <CardTitle className="flex items-center justify-between text-lg">
          Demo run
          <Badge variant="outline">{scenario?.status ?? "not seeded"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onReset}
            disabled={state !== "idle" || !configuredBuyer}
            variant="outline"
          >
            <RotateCcw />
            {state === "resetting" ? "Resetting…" : "Reset scenario"}
          </Button>
          <Button
            onClick={onStart}
            disabled={
              state !== "idle" || !configuredBuyer || !scenario || scenario.status !== "ready"
            }
          >
            <Play />
            {state === "starting" ? "Starting…" : "Start demo"}
          </Button>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <p className="text-xs text-stone-500">
          Reset creates a fresh run. Start demo performs deterministic inventory analysis; it does
          not fake supplier replies.
        </p>
        {!configuredBuyer ? (
          <p className="text-xs text-amber-800">
            Shared reset and start controls require the configured buyer. Judge mode cannot reset
            shared data or send external email.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
