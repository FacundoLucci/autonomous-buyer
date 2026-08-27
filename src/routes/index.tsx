import { createFileRoute } from "@tanstack/react-router";
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
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
          <Badge
            variant="outline"
            className="h-8 w-fit gap-2 border-stone-400 bg-white/60 px-3 capitalize"
          >
            <Bot className="size-4" aria-hidden="true" />
            Agent · {dashboard?.agent.state.replace("_", " ") ?? "watching"}
          </Badge>
        </header>

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
                            {Math.round(item.quantityOnHand).toLocaleString()}
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
  const procurement = useQuery(api.purchasing.getProcurement, { procurementId });
  const sourcing = useQuery(api.sourcing.getLatest, { procurementId });
  const rfqs = useQuery(api.rfqs.listForProcurement, { procurementId });
  const startSourcing = useAction(api.sourcing.start);
  const prepareRfqs = useMutation(api.rfqs.prepare);
  const startStructuredTask = useMutation(api.ai.startStructuredTask);
  const markThreadRead = useMutation(api.ai.markThreadRead);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [aiRunId, setAiRunId] = useState<Id<"aiRuns"> | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [sourcingState, setSourcingState] = useState<"idle" | "working">("idle");
  const [sourcingError, setSourcingError] = useState<string | null>(null);
  const [rfqState, setRfqState] = useState<"idle" | "working">("idle");
  const [rfqError, setRfqError] = useState<string | null>(null);
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
        <Card className="border-stone-300 bg-white/80 shadow-none">
          <CardHeader>
            <CardDescription>Live supplier evidence · BC-08</CardDescription>
            <CardTitle className="text-base">Real supplier discovery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => void sourceSuppliers()}
              disabled={sourcingState === "working" || sourcing?.run.status === "pending"}
            >
              <Search />
              {sourcingState === "working" || sourcing?.run.status === "pending"
                ? "Searching with Firecrawl…"
                : sourcing?.run.status === "succeeded"
                  ? "Search again"
                  : "Start sourcing"}
            </Button>
            {sourcing?.candidates.map((candidate) => (
              <div
                key={candidate.resultId}
                className="rounded-lg border border-stone-200 bg-white p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{candidate.supplierName}</p>
                  <Badge variant="outline">Real discovered supplier</Badge>
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
                disabled={rfqState === "working" || sourcing?.run.status !== "succeeded"}
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
              <p className="text-xs leading-5 text-stone-500">
                These identities are controlled test recipients, not claims about the legal entities
                found online. No email can be sent until the exact addresses are reviewed and
                explicitly approved.
              </p>
            ) : null}
            {rfqError ? <p className="text-sm text-red-700">{rfqError}</p> : null}
          </CardContent>
        </Card>
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
          <Fact label="Total" value={money(order.totalCents)} />
          <Fact label="Required by" value={order.requiredBy} />
          <Fact label="Status" value={order.status.replace("_", " ")} />
        </div>
        <p className="text-sm text-stone-600">
          {order.sentAt === null
            ? "This order has not been marked sent."
            : `Sent ${new Date(order.sentAt).toLocaleString()}. Confirmation appears only after matching provider evidence.`}
        </p>
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
          <Button onClick={onReset} disabled={state !== "idle"} variant="outline">
            <RotateCcw />
            {state === "resetting" ? "Resetting…" : "Reset scenario"}
          </Button>
          <Button
            onClick={onStart}
            disabled={state !== "idle" || !scenario || scenario.status !== "ready"}
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
      </CardContent>
    </Card>
  );
}
