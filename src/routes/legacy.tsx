import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { useAuthActions, useConvexAuth } from "@/lib/buyer-auth";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  ScanLine,
  Check,
  MessageCircle,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";

import { HardwareMetric, HardwareMetricRack } from "@/components/buy-hard/hardware-metric";
import { CompanyWorkspace } from "@/components/buy-hard/company-workspace";
import { Setup } from "@/components/buy-hard/setup";
import { AutonomousLanding } from "@/components/landing/autonomous-landing";
import { landingHead } from "@/components/landing/landing-head";
import { LiveBuyList } from "@/components/buy-hard/live-buy-list";
import { getOpenBuys } from "@/components/buy-hard/open-buys";
import { SponsorCredit } from "@/components/buy-hard/sponsor-credit";
import { DemoWalkthrough, type DemoWalkthroughStep } from "@/components/buy-hard/demo-walkthrough";
import { QuoteComparison, QuoteHistory } from "@/components/buy-hard/purchase-evidence";
import "@/styles/buy-desk.css";

import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/legacy-ui/collapsible";
import { Input } from "@/components/legacy-ui/input";
import { Textarea } from "@/components/legacy-ui/textarea";
import { Separator } from "@/components/legacy-ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/legacy-ui/sheet";

type FocusView = "procurement" | "recommendation" | "approval" | "order";

function isDemoDestination(search: {
  demo: boolean;
  tour?: number;
  procurement?: string;
  view: FocusView;
}) {
  return (
    search.demo ||
    search.tour !== undefined ||
    Boolean(search.procurement) ||
    search.view !== "procurement"
  );
}

export const Route = createFileRoute("/legacy")({
  validateSearch: (search: Record<string, unknown>) => ({
    companyOrder:
      typeof search.companyOrder === "string" && search.companyOrder.length < 100
        ? search.companyOrder
        : undefined,
    demo:
      search.demo === "1" || search.demo === 1 || search.demo === true || search.demo === "true",
    tour:
      search.tour !== undefined &&
      Number.isInteger(Number(search.tour)) &&
      Number(search.tour) >= 0 &&
      Number(search.tour) < 6
        ? Number(search.tour)
        : undefined,
    procurement: typeof search.procurement === "string" ? search.procurement : undefined,
    view:
      search.view === "recommendation" || search.view === "approval" || search.view === "order"
        ? search.view
        : ("procurement" as FocusView),
  }),
  search: {
    middlewares: [stripSearchParams({ demo: false, view: "procurement" })],
  },
  head: ({ match }) =>
    isDemoDestination(match.search) ? { meta: [{ title: "BUY HARD — Buy Desk" }] } : landingHead(),
  component: Home,
});

const demoSteps: readonly DemoWalkthroughStep[] = [
  {
    id: "risk",
    title: "Start with the shortage",
    description:
      "The original inventory calculation sets the quantity and deadline. This guide follows a recorded run; it does not place orders or send email.",
    target: '[data-demo-target="risk"]',
  },
  {
    id: "sources",
    title: "Inspect the supplier sources",
    description:
      "Firecrawl finds product pages; completed model assessments are credited below. Website discoveries and the controlled inboxes used for this run are separate evidence.",
    target: '[data-demo-target="sources"]',
  },
  {
    id: "followups",
    title: "Watch an incomplete quote become usable",
    description:
      "Follow the missing fields, the exact clarification sent through AgentMail, and the next supplier revision. The record stays visible during everyday purchasing too.",
    target: '[data-demo-target="followups"]',
  },
  {
    id: "comparison",
    title: "Compare the actual trade-offs",
    description:
      "Latest quotes sit side by side. Cost, arrival and stockout risk explain the choice; demo product-match assumptions are labeled instead of presented as measured certainty.",
    target: '[data-demo-target="comparison"]',
  },
  {
    id: "approval",
    title: "The buyer keeps control",
    description:
      "Approval applies to an exact quote revision and purchase amount. Reviewing this recorded decision does not approve or send anything.",
    target: '[data-demo-target="approval"]',
  },
  {
    id: "confirmation",
    title: "Close the loop with supplier evidence",
    description:
      "A matching supplier confirmation updates incoming inventory. The purchase order and received terms remain available for inspection.",
    target: '[data-demo-target="confirmation"]',
  },
];
const demoViews: readonly FocusView[] = [
  "procurement",
  "procurement",
  "procurement",
  "recommendation",
  "approval",
  "order",
];

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

function unitPrice(microdollars: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(microdollars / 1_000_000);
}

function shortTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

type Dashboard = NonNullable<ReturnType<typeof useQuery<typeof api.purchasing.getDashboard>>>;
type DisplayNavigate = ReturnType<typeof Route.useNavigate>;
const DisplayNavigationContext = createContext<DisplayNavigate | null>(null);

function useDisplayNavigate() {
  const navigate = Route.useNavigate();
  return useContext(DisplayNavigationContext) ?? navigate;
}

function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const workspace = useQuery(api.onboarding.getWorkspace, isAuthenticated ? {} : "skip");
  const user = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  const search = Route.useSearch();
  // Keep existing purchase and walkthrough links reachable from outside the app.
  if (isDemoDestination(search)) return <DemoHome />;
  if (isLoading || (isAuthenticated && (workspace === undefined || user === undefined)))
    return <DashboardSkeleton />;
  if (workspace)
    return (
      <CompanyWorkspace
        key={`${workspace.organizationId}:${search.companyOrder ?? ""}`}
        workspace={workspace}
        initialOrder={search.companyOrder}
      />
    );
  if (user && !user.isJudgeDemo && user.role === "viewer") return <Setup mode="signup" />;
  return user ? <DemoHome /> : <AutonomousLanding />;
}

function DemoHome() {
  const dashboard = useQuery(api.purchasing.getDashboard);
  const integrations = useQuery(api.integrations.getStatus);
  const scenario = useQuery(api.demo.getCurrentScenario);
  const resetScenario = useMutation(api.demo.resetScenario);
  const startScenario = useMutation(api.demo.startScenario);
  const search = Route.useSearch();
  const walkthroughReturnSearch = useRef<typeof search | null>(null);
  const routeNavigate = Route.useNavigate();
  const displayRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const navigationVersion = useRef(0);
  const lastBuyFocus = useRef<HTMLElement | null>(null);
  const setDisplayNode = useCallback((node: HTMLDivElement | null) => {
    displayRef.current = node;
    if (!node) {
      navigationVersion.current += 1;
      animationRef.current?.cancel();
    }
  }, []);
  const [controlState, setControlState] = useState<"idle" | "resetting" | "starting">("idle");
  const [controlError, setControlError] = useState<string | null>(null);
  const [displayNavigating, setDisplayNavigating] = useState(false);
  const [listResetVersion, setListResetVersion] = useState(0);

  const navigate: DisplayNavigate = async (options) => {
    const version = ++navigationVersion.current;
    setDisplayNavigating(true);
    animationRef.current?.cancel();
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.closest(".buy-desk-list")) {
      lastBuyFocus.current = focused;
    }
    const surface = displayRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (surface && !reduceMotion && typeof surface.animate === "function") {
      const fade = surface.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 110,
        easing: "ease-out",
        fill: "forwards",
      });
      animationRef.current = fade;
      await fade.finished.catch(() => {});
      if (navigationVersion.current !== version) return;
    }
    try {
      await routeNavigate({ ...options, resetScroll: false });
    } finally {
      if (navigationVersion.current === version) {
        setDisplayNavigating(false);
        animationRef.current?.cancel();
        if (surface && !reduceMotion && typeof surface.animate === "function") {
          animationRef.current = surface.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 140,
            easing: "cubic-bezier(0.215, 0.61, 0.355, 1)",
          });
        }
        window.requestAnimationFrame(() => {
          if (document.querySelector('[data-testid="demo-walkthrough"]')) return;
          const heading = displayRef.current?.querySelector<HTMLElement>("[data-display-heading]");
          if (heading) heading.focus({ preventScroll: true });
          else lastBuyFocus.current?.focus({ preventScroll: true });
          if (window.matchMedia("(max-width: 980px)").matches) {
            displayRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
          }
        });
      }
    }
  };

  function selectBuy(procurementId: string) {
    void navigate({
      search: (current) => ({
        ...current,
        demo: true,
        procurement: procurementId,
        view: "procurement",
        tour: undefined,
      }),
    });
  }

  function startWalkthrough() {
    const procurementId = dashboard?.latestConfirmedProcurementId;
    if (!procurementId) return;
    if (search.tour === undefined) walkthroughReturnSearch.current = search;
    void navigate({
      search: (current) => ({
        ...current,
        demo: true,
        procurement: procurementId,
        view: "procurement",
        tour: 0,
      }),
    });
  }

  function changeDemoStep(index: number) {
    void navigate({
      search: (current) => ({ ...current, view: demoViews[index] ?? "procurement", tour: index }),
    });
  }

  function closeWalkthrough() {
    const previousSearch = walkthroughReturnSearch.current;
    walkthroughReturnSearch.current = null;
    void navigate({
      search: (current) =>
        previousSearch ?? {
          ...current,
          demo: true,
          tour: undefined,
          procurement: undefined,
          view: "procurement",
        },
    });
  }

  async function reset() {
    setControlError(null);
    setControlState("resetting");
    try {
      await resetScenario({});
      await navigate({
        search: (current) => ({
          ...current,
          procurement: undefined,
          view: "procurement",
          tour: undefined,
        }),
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

  const modelProviderReady = integrations?.some(
    (integration) =>
      (integration.name === "openai" || integration.name === "openrouter") &&
      integration.status === "configured",
  );
  const requiredProviderMissing =
    integrations !== undefined &&
    (!modelProviderReady ||
      integrations.some(
        (integration) =>
          (integration.name === "firecrawl" || integration.name === "agentmail") &&
          integration.status === "missing",
      ));

  return (
    <DisplayNavigationContext value={navigate}>
      <main className="bh-app powder-coat">
        <a className="buy-desk-skip" href="#buy-desk-display">
          Skip to buy desk
        </a>
        <header className="bh-app-bar buy-desk-app-bar">
          <a
            className="buy-desk-brand"
            href="/legacy"
            aria-label="BUY HARD home"
            onClick={(event) => {
              event.preventDefault();
              setListResetVersion((version) => version + 1);
              walkthroughReturnSearch.current = null;
              void navigate({
                search: (current) => ({
                  ...current,
                  demo: false,
                  procurement: undefined,
                  view: "procurement",
                  tour: undefined,
                }),
              });
            }}
          >
            <span className="bh-stamped">BUY HARD</span>
          </a>
          <div className="buy-desk-account-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={startWalkthrough}
              disabled={!dashboard?.latestConfirmedProcurementId}
              title={
                !dashboard?.latestConfirmedProcurementId
                  ? "A confirmed run is needed for the walkthrough"
                  : undefined
              }
            >
              <Play aria-hidden="true" /> Demo
            </Button>
            {search.demo ? (
              <ConfiguredBuyerButton />
            ) : (
              <a href="/legacy/setup?mode=login" className="company-sign-out">
                Sign in
              </a>
            )}
            <a href="/legacy/setup?method=passkey" className="company-sign-out">
              Set up my company <ArrowRight className="inline size-3" />
            </a>
          </div>
        </header>

        <div className="buy-desk-body">
          <div className="buy-desk-company-row">
            <h1 className="bh-face-title screen-print">
              {dashboard?.organizationName ?? "Acme Foods"}
            </h1>
            <p className="bh-face-caption screen-print">Purchasing workspace · live</p>
          </div>

          <HardwareMetricRack>
            <HardwareMetric label="Needs action" value={dashboard?.needsActionCount} />
            <HardwareMetric label="Open buys" value={dashboard?.openBuyCount} />
            <HardwareMetric
              label="Annual spend"
              value={dashboard ? dashboard.annualSpendCents / 100 : undefined}
              currency="USD"
              source="Demo history"
            />
            <HardwareMetric
              label="Savings"
              value={dashboard ? dashboard.savingsIdentifiedCents / 100 : undefined}
              currency="USD"
              source="Demo history"
            />
          </HardwareMetricRack>
          <div className="buy-desk-live-credit">
            <SponsorCredit sponsor="convex" prefix="Live updates via" className="screen-print" />
          </div>

          {search.demo && search.tour === undefined ? (
            <div className="buy-desk-demo-intro bh-metal">
              <div className="screen-print">
                <p className="bh-face-caption">Demo workspace</p>
                <p>
                  Explore a recorded purchase, from inventory risk to supplier confirmation. Real
                  provider calls, controlled test inboxes.
                </p>
              </div>
              <Button
                onClick={startWalkthrough}
                disabled={!dashboard?.latestConfirmedProcurementId}
              >
                <Play aria-hidden="true" /> Start walkthrough
              </Button>
            </div>
          ) : null}

          <section
            className="buy-desk-display"
            id="buy-desk-display"
            aria-labelledby="buy-desk-label"
            data-focused={Boolean(search.procurement)}
          >
            <header className="bh-face-label">
              <h2 className="screen-print" id="buy-desk-label">
                Buy desk
              </h2>
              <span className="screen-print">Purchasing display</span>
            </header>
            <div className="buy-desk-display-surface bh-eink bh-cutout">
              <div className="buy-desk-display-content" ref={setDisplayNode}>
                <div className="buy-desk-master">
                  {dashboard === undefined ? (
                    <DashboardSkeleton />
                  ) : dashboard === null ? (
                    <EmptyDashboard
                      demo={search.demo}
                      onReset={reset}
                      busy={controlState !== "idle"}
                    />
                  ) : (
                    <LiveBuyList
                      key={`${dashboard.demoRunId}:${listResetVersion}`}
                      dashboard={dashboard}
                      selectedId={search.procurement}
                      onSelect={selectBuy}
                    />
                  )}
                </div>
                <div className="buy-desk-detail">
                  {search.procurement ? (
                    <FocusedProcurement
                      key={search.procurement}
                      procurementId={search.procurement as Id<"procurements">}
                      view={
                        search.demo && search.tour !== undefined
                          ? demoViews[search.tour]
                          : search.view
                      }
                      demo={search.demo}
                      guidedStep={search.demo ? search.tour : undefined}
                      onBack={() =>
                        void navigate({
                          search: (current) => ({
                            ...current,
                            demo: true,
                            procurement: undefined,
                            view: "procurement",
                            tour: undefined,
                          }),
                        })
                      }
                    />
                  ) : (
                    <BuyDeskSummary
                      nextOpenBuy={dashboard ? getOpenBuys(dashboard.inventory)[0] : undefined}
                      procurementId={dashboard?.latestConfirmedProcurementId}
                      onOpen={(id) =>
                        void navigate({
                          search: (current) => ({
                            ...current,
                            demo: true,
                            procurement: id,
                            view: "order",
                            tour: undefined,
                          }),
                        })
                      }
                      onOpenBuy={selectBuy}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {dashboard ? (
            <div className="buy-desk-support">
              <AgentCard
                state={dashboard.agent.state}
                message={dashboard.agent.message}
                unread={dashboard.agent.unreadThreadCount}
              />
              <ActivityReceipt dashboard={dashboard} onSelect={selectBuy} />
            </div>
          ) : null}

          {search.demo && integrations ? (
            <details className="buy-desk-service-panel bh-metal">
              <summary>
                <span className="screen-print">System connections</span>{" "}
                <span>{requiredProviderMissing ? "Configuration incomplete" : "Configured"}</span>
              </summary>
              <div className="flex flex-wrap gap-2 p-4" aria-label="Provider readiness">
                {integrations.map((integration) => (
                  <Badge
                    key={integration.name}
                    variant="outline"
                    data-tone={
                      integration.status === "configured" || integration.name === "openrouter"
                        ? "success"
                        : "danger"
                    }
                  >
                    {integration.name}
                    {integration.name === "openrouter" ? " fallback" : ""} · {integration.status}
                  </Badge>
                ))}
                {requiredProviderMissing ? (
                  <p className="text-sm text-destructive">A required provider is not configured.</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Configuration is not a live health check. Provider credits on each purchase
                  reflect its recorded work.
                </p>
              </div>
            </details>
          ) : null}
          {search.demo ? (
            <details className="buy-desk-service-panel bh-metal">
              <summary>
                <span className="screen-print">Demo operator controls</span>
              </summary>
              <div className="p-4">
                <JudgeModeButton />
                <DemoControls
                  scenario={scenario}
                  state={controlState}
                  error={controlError}
                  onReset={reset}
                  onStart={start}
                />
              </div>
            </details>
          ) : null}
        </div>
        {search.demo && search.tour !== undefined && search.procurement ? (
          <DemoWalkthrough
            steps={demoSteps}
            currentStep={search.tour}
            loading={displayNavigating}
            onStepChange={changeDemoStep}
            onClose={closeWalkthrough}
          />
        ) : null}
      </main>
    </DisplayNavigationContext>
  );
}

function BuyDeskSummary({
  nextOpenBuy,
  procurementId,
  onOpen,
  onOpenBuy,
}: {
  nextOpenBuy?: Dashboard["inventory"][number];
  procurementId?: Id<"procurements"> | null;
  onOpen: (id: string) => void;
  onOpenBuy: (id: string) => void;
}) {
  const procurement = useQuery(
    api.purchasing.getProcurement,
    procurementId && !nextOpenBuy ? { procurementId } : "skip",
  );
  return (
    <div className="buy-desk-idle buy-desk-latest">
      <ScanLine aria-hidden="true" />
      {nextOpenBuy?.procurement ? (
        <>
          <p className="bh-kicker">Open buy · {nextOpenBuy.procurement.code}</p>
          <h2>{nextOpenBuy.name}</h2>
          <p>
            {procurementLabels[nextOpenBuy.procurement.status] ?? "Purchase in progress"} · due{" "}
            {nextOpenBuy.procurement.requiredBy}
          </p>
          <Button
            variant="outline"
            onClick={() => onOpenBuy(nextOpenBuy.procurement!.procurementId)}
          >
            Open buy <ArrowRight aria-hidden="true" />
          </Button>
        </>
      ) : procurement?.confirmation ? (
        <>
          <p className="bh-kicker">Latest confirmation · {procurement.code}</p>
          <h2>{procurement.itemName}</h2>
          <PurchaseOutcome procurement={procurement} />
          <Button variant="outline" onClick={() => onOpen(procurement.procurementId)}>
            View order <ArrowRight aria-hidden="true" />
          </Button>
        </>
      ) : (
        <>
          <p className="bh-kicker">Procurement progress</p>
          <h2>
            {procurementId && procurement === undefined
              ? "Loading latest purchase…"
              : "Select a buy"}
          </h2>
          <p>Inspect progress, compare supplier quotes, and review purchase terms here.</p>
        </>
      )}
    </div>
  );
}

function PurchaseOutcome({ procurement }: { procurement: ProcurementDetail }) {
  const confirmation = procurement.confirmation;
  if (!confirmation) return null;
  return (
    <section
      className="buy-desk-outcome"
      data-demo-target="confirmation"
      aria-label="Supplier confirmation"
    >
      <div className="grid gap-1">
        <p className="bh-kicker">
          {confirmation.matchesApprovedTerms
            ? "Supplier confirmed · terms match"
            : "Terms changed · review required"}
        </p>
        <SponsorCredit sponsor="agentmail" prefix="Replied via" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Fact
          label={
            confirmation.matchesApprovedTerms ? "Confirmed incoming" : "Supplier-stated quantity"
          }
          value={
            confirmation.confirmedQuantity === null
              ? "Not supplied"
              : `${confirmation.confirmedQuantity.toLocaleString()} units`
          }
        />
        <Fact
          label="Expected arrival"
          value={confirmation.confirmedArrivalDate ?? "Not supplied"}
        />
      </div>
      <div className="grid gap-1">
        <p className="text-xs text-muted-foreground">
          Confirmation {confirmation.supplierConfirmationNumber ?? "number not supplied"}
          {procurement.purchaseOrder ? ` · ${procurement.purchaseOrder.poNumber}` : ""}
        </p>
        <AiWorkCredit
          procurement={procurement}
          task="confirmation_extraction"
          action="Details extracted"
        />
      </div>
      {confirmation.differences.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {confirmation.differences.map((difference) => (
            <li key={difference.field}>
              {difference.field}: approved {difference.approved}, confirmed {difference.confirmed}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function AiWorkCredit({
  procurement,
  task,
  action,
}: {
  procurement: ProcurementDetail;
  task: NonNullable<ProcurementDetail["providerEvidence"]>["ai"][number]["task"];
  action: string;
}) {
  const runs = procurement.providerEvidence?.ai.filter((run) => run.task === task) ?? [];
  if (runs.length === 0) return null;
  const direct = runs.some((run) => run.transport === "openai");
  const fallback = runs.some((run) => run.transport === "openrouter");
  return (
    <span className="buy-desk-provider-line">
      {direct ? <SponsorCredit sponsor="openai" prefix={`${action} by`} /> : null}
      {fallback ? (
        <span className="text-xs text-muted-foreground">
          {action} via OpenRouter{direct ? " fallback" : ""}
        </span>
      ) : null}
    </span>
  );
}

function ActivityReceipt({
  dashboard,
  onSelect,
}: {
  dashboard: Dashboard;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="buy-desk-activity" aria-labelledby="activity-title">
      <header className="bh-face-label">
        <h2 id="activity-title" className="screen-print">
          <Activity aria-hidden="true" /> Activity feed
        </h2>
        <span className="screen-print">Live record</span>
      </header>
      <div className="bh-receipt buy-desk-receipt">
        {dashboard.activity.length === 0 ? (
          <p>No activity yet. Watching inventory.</p>
        ) : (
          <ol>
            {dashboard.activity.map((event) => (
              <li key={event.eventId}>
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {shortTime(event.createdAt)}
                </time>
                <div>
                  <p>{event.summary}</p>
                  <button type="button" onClick={() => onSelect(event.procurementId)}>
                    {event.code}
                    <ArrowRight aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="buy-desk-receipt-end">End of feed</p>
      </div>
    </section>
  );
}

function FocusedProcurement({
  procurementId,
  view,
  demo,
  guidedStep,
  onBack,
}: {
  procurementId: Id<"procurements">;
  view: FocusView;
  demo: boolean;
  guidedStep?: number;
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
  const navigate = useDisplayNavigate();
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
  const focusDetailHeading = useCallback((node: HTMLHeadingElement | null) => {
    node?.focus({ preventScroll: true });
  }, []);
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
      <div className="buy-desk-empty" aria-live="polite">
        <h2 ref={focusDetailHeading} tabIndex={-1} data-display-heading>
          Loading procurement…
        </h2>
      </div>
    );
  }
  if (procurement === null) {
    return (
      <div className="buy-desk-empty" aria-live="polite">
        <div className="mx-auto max-w-3xl rounded-xl bg-card p-10">
          <h2
            ref={focusDetailHeading}
            className="text-xl font-semibold"
            tabIndex={-1}
            data-display-heading
          >
            Procurement not found
          </h2>
          <Button className="mt-5" onClick={onBack}>
            Buy desk
          </Button>
        </div>
      </div>
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
    <div className="buy-desk-focused">
      <div className="buy-desk-focused-content">
        <header className="flex items-center justify-between border-b border-border pb-4">
          <Button variant="ghost" className="buy-desk-back" onClick={onBack}>
            <ArrowLeft />
            Buy desk
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{procurement.code}</span>
            <StatusBadge status={procurement.status} />
          </div>
        </header>
        <nav className="buy-desk-view-tabs" aria-label="Purchase steps">
          {(["procurement", "recommendation", "approval", "order"] as const).map((step) => {
            const available =
              step === "procurement" ||
              (step === "order"
                ? procurement.purchaseOrder !== null
                : procurement.recommendation !== null);
            return (
              <button
                key={step}
                type="button"
                disabled={!available}
                aria-current={view === step ? "step" : undefined}
                title={!available ? "Available when the buy reaches this step" : undefined}
                onClick={() =>
                  void navigate({
                    search: (current) => ({ ...current, view: step, tour: undefined }),
                  })
                }
              >
                {step === "procurement"
                  ? "Progress"
                  : step === "recommendation"
                    ? "Recommendation"
                    : step === "approval"
                      ? "Approval"
                      : "Order"}
              </button>
            );
          })}
        </nav>
        <Card
          className="buy-desk-primary-card"
          data-demo-target={view === "approval" ? "approval" : undefined}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>
                  {procurement.itemName} · {procurement.sku}
                </CardDescription>
                <h2
                  ref={focusDetailHeading}
                  className="buy-desk-view-title"
                  tabIndex={-1}
                  data-display-heading
                >
                  {viewAvailable
                    ? viewTitle
                    : `${view[0].toUpperCase()}${view.slice(1)} is not ready`}
                </h2>
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
                  ? `Original trigger: ${procurement.triggerReason}`
                  : "Review the stored purchase terms and supporting evidence."
                : "This focused view will appear when the procurement reaches that step."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {viewAvailable ? (
              <>
                <FocusedViewBody procurement={procurement} view={view} />
                {view === "recommendation" ? (
                  <>
                    {comparison ? (
                      <QuoteComparison comparison={comparison} />
                    ) : (
                      <p>Loading quote comparison…</p>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        void navigate({
                          search: (current) => ({ ...current, view: "approval", tour: undefined }),
                        })
                      }
                    >
                      Review buyer decision <ArrowRight aria-hidden="true" />
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
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
        {view === "procurement" ? (
          <>
            {quotes && followUps ? (
              <QuoteHistory
                quotes={quotes}
                followUps={followUps}
                quoteCredit={
                  <>
                    <AiWorkCredit
                      procurement={procurement}
                      task="quote_extraction"
                      action="Quote details extracted"
                    />
                    <AiWorkCredit
                      procurement={procurement}
                      task="missing_information"
                      action="Missing terms checked"
                    />
                  </>
                }
                followUpCredit={
                  <AiWorkCredit
                    procurement={procurement}
                    task="follow_up_wording"
                    action="Follow-ups drafted"
                  />
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading quote history…</p>
            )}
          </>
        ) : null}
        <details
          className="buy-desk-evidence"
          key={guidedStep === 1 ? "guided-sources" : "manual-sources"}
          open={guidedStep === 1 ? true : undefined}
        >
          <summary>Supplier sources &amp; requests</summary>
          <div className="buy-desk-evidence-body">
            <Card className="border-border bg-card shadow-none" data-demo-target="sources">
              <CardHeader>
                <CardDescription>Supplier evidence</CardDescription>
                <CardTitle className="text-base">Supplier discovery</CardTitle>
                <div className="grid gap-1">
                  {sourcing?.run.status === "succeeded" ? (
                    <SponsorCredit sponsor="firecrawl" prefix="Sources via" />
                  ) : null}
                  <AiWorkCredit
                    procurement={procurement}
                    task="supplier_search_queries"
                    action="Search queries generated"
                  />
                  <AiWorkCredit
                    procurement={procurement}
                    task="product_equivalency"
                    action="Product matches assessed"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {procurement.status === "sourcing" ? (
                  <Button
                    onClick={() => void sourceSuppliers()}
                    disabled={
                      !canOperateDemo ||
                      procurement.status !== "sourcing" ||
                      sourcingState === "working" ||
                      sourcing?.run.status === "pending"
                    }
                  >
                    <Search />
                    {sourcingState === "working" || sourcing?.run.status === "pending"
                      ? "Searching with Firecrawl…"
                      : sourcing?.run.status === "succeeded"
                        ? "Search again"
                        : "Start sourcing"}
                  </Button>
                ) : null}
                {!canOperateDemo && procurement.status === "sourcing" ? (
                  <p className="text-sm text-muted-foreground">
                    Enter judge mode to run provider-backed demo steps. Public observation stays
                    open.
                  </p>
                ) : null}
                {sourcing?.candidates.map((candidate) => (
                  <div
                    key={candidate.resultId}
                    className="rounded-lg border border-border bg-card p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{candidate.supplierName}</p>
                      <Badge variant="outline">Website · Firecrawl</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{candidate.title}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <a
                        className="font-medium text-[var(--bh-orange)] underline"
                        href={candidate.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source
                      </a>
                      <span>{candidate.matchStatus.replaceAll("_", " ")}</span>
                      {candidate.matchConfidence > 0 ? (
                        <span>
                          {Math.round(candidate.matchConfidence * 100)}% assessment certainty
                        </span>
                      ) : (
                        <span>Product match not verified</span>
                      )}
                    </div>
                  </div>
                ))}
                {sourcing?.run.status === "failed" ? (
                  <p className="text-sm text-destructive">{sourcing.run.errorMessage}</p>
                ) : null}
                {sourcingError ? <p className="text-sm text-destructive">{sourcingError}</p> : null}
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardDescription>Supplier outreach</CardDescription>
                <CardTitle className="text-base">Requests for quote</CardTitle>
                <div className="grid gap-1">
                  {delivery?.some(
                    (item) => item.status === "sent" || item.status === "delivered",
                  ) ? (
                    <SponsorCredit sponsor="agentmail" prefix="Sent via" />
                  ) : null}
                  <AiWorkCredit
                    procurement={procurement}
                    task="rfq_wording"
                    action="Emails drafted"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {rfqs?.length === 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => void prepareControlledRfqs()}
                    disabled={
                      !canOperateDemo ||
                      procurement.status !== "sourcing" ||
                      rfqState === "working" ||
                      sourcing?.run.status !== "succeeded"
                    }
                  >
                    <Sparkles />
                    {rfqState === "working" ? "Writing previews…" : "Prepare three RFQs"}
                  </Button>
                ) : null}
                {rfqs?.map((rfq) => (
                  <div
                    key={rfq.rfqId}
                    className="rounded-lg border border-border bg-card p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{rfq.supplierName}</p>
                      <Badge variant="outline">
                        {rfq.isControlledRecipient
                          ? "Controlled demo recipient"
                          : "Supplier recipient"}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {rfq.recipientEmail}
                    </p>
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
                      <p className="mt-2 text-xs text-muted-foreground">
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
                      <div className="mt-4 rounded-md bg-muted/40 p-3">
                        <p className="font-medium">{rfq.subject}</p>
                        <p className="mt-2 leading-6 whitespace-pre-wrap text-muted-foreground">
                          {rfq.body}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-muted-foreground">
                        OpenAI is writing wording from the fixed fields…
                      </p>
                    )}
                  </div>
                ))}
                {rfqs && rfqs.length > 0 ? (
                  <div className="space-y-3 border-t border-border pt-4">
                    <p className="text-xs leading-5 text-muted-foreground">
                      These identities are controlled test recipients, not claims about the legal
                      entities found online. No email can be sent until the exact addresses are
                      reviewed and explicitly approved.
                    </p>
                    {procurement.status !== "rfq_ready" ? (
                      <p className="text-xs text-muted-foreground">
                        RFQ delivery is closed for this purchase stage. Stored requests and delivery
                        receipts remain available below.
                      </p>
                    ) : !canSendExternal ? (
                      <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                        External email controls require the configured buyer. Judge mode cannot
                        reveal recipients, create inboxes, or send messages.
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
                            {mailState === "inbox"
                              ? "Selecting inbox…"
                              : "Create or select Acme inbox"}
                          </Button>
                        )}
                        <Button
                          onClick={() => void sendRfqs()}
                          disabled={
                            mailState !== "idle" ||
                            !purchasingInbox ||
                            !rfqs.every((rfq) => rfq.status === "ready" || rfq.status === "queued")
                          }
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
                {rfqError ? <p className="text-sm text-destructive">{rfqError}</p> : null}
                {mailError ? <p className="text-sm text-destructive">{mailError}</p> : null}
              </CardContent>
            </Card>
            {demo && guidedStep === undefined && canOperateDemo ? (
              <Card className="border-dashed border-input bg-card shadow-none">
                <CardHeader>
                  <CardDescription>Demo diagnostic</CardDescription>
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
                    <div className="rounded-lg border border-border bg-card p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={aiRun.status} />
                        <span className="font-mono text-xs text-muted-foreground">
                          {aiRun.transport} · {aiRun.model}
                        </span>
                      </div>
                      {aiRun.result ? (
                        <div className="mt-3 space-y-2">
                          <p>{aiRun.result.summary}</p>
                          {aiRun.result.output.task === "supplier_search_queries" ? (
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                              {aiRun.result.output.queries.map((query) => (
                                <li key={query}>{query}</li>
                              ))}
                            </ul>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {aiRun.evidenceRefs.length} stored evidence references · confidence{" "}
                            {Math.round(aiRun.result.confidence * 100)}%
                          </p>
                        </div>
                      ) : aiRun.errorMessage ? (
                        <p className="mt-3 text-destructive">{aiRun.errorMessage}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {diagnosticError ? (
                    <p className="text-sm text-destructive">{diagnosticError}</p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </details>
      </div>
      <Sheet open={openThread !== null} onOpenChange={(open) => !open && setOpenThread(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Contextual thread</SheetTitle>
            <SheetDescription>
              This conversation stays attached to this procurement detail.
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 text-sm text-muted-foreground">
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
                        ? "rounded-lg bg-[var(--bh-orange)]/10 p-3 text-foreground"
                        : "rounded-lg bg-muted/40 p-3"
                    }
                  >
                    <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                      {message.role === "assistant" ? "BUY HARD" : message.role}
                    </p>
                    <p className="leading-6">{message.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

type ProcurementDetail = NonNullable<
  ReturnType<typeof useQuery<typeof api.purchasing.getProcurement>>
>;

function ApprovalAccessCard({ procurement }: { procurement: ProcurementDetail }) {
  const navigate = useDisplayNavigate();
  const recommendation = procurement.recommendation;
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut, version } = useAuthActions();
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
    <Card className="buy-desk-approval">
      <CardHeader>
        <CardDescription>Buyer approval</CardDescription>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-5" />
          Review and decide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {procurement.approval ? (
          <div className="rounded-lg border border-[var(--bh-green)]/30 bg-card p-4 text-sm">
            <p className="font-medium capitalize">{procurement.approval.status}</p>
            <p className="mt-1 text-muted-foreground">
              {procurement.approval.decidedBy}
              {procurement.approval.isJudgeDemo ? " · judge demo identity" : " · configured buyer"}
            </p>
            {procurement.purchaseOrder ? (
              <Button
                className="mt-3"
                variant="outline"
                onClick={() =>
                  navigate({
                    search: (current) => ({
                      ...current,
                      view: "order",
                      tour: current.demo && current.tour === 4 ? 5 : undefined,
                    }),
                  })
                }
              >
                Inspect {procurement.purchaseOrder.poNumber}
                <ArrowRight />
              </Button>
            ) : null}
          </div>
        ) : !isAuthenticated ? (
          <>
            <p className="text-sm leading-6 text-foreground">
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
            {version === "passkey" ? (
              <a
                className="text-sm underline"
                href={`/legacy?demo=true&method=password&view=approval&procurement=${procurement.procurementId}`}
              >
                Sign in as the configured buyer
              </a>
            ) : (
              <Collapsible>
                <CollapsibleTrigger className="text-sm font-medium text-muted-foreground underline">
                  Sign in as the configured buyer
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3 rounded-lg border bg-card p-4">
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
            )}
          </>
        ) : currentUser === undefined ? (
          <p className="text-sm text-muted-foreground">Confirming the signed-in buyer…</p>
        ) : currentUser === null || !currentUser.canApproveDemo ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              This identity cannot approve the demo purchase.
            </p>
            <Button variant="outline" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4 text-sm">
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
              <CollapsibleTrigger className="text-sm font-medium text-muted-foreground underline">
                Modify exact terms
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
    <Card className="buy-desk-approval">
      <CardHeader>
        <CardDescription>Purchase order delivery</CardDescription>
        <CardTitle className="text-lg">
          {order.status === "confirmed" || order.status === "sent"
            ? "Purchase order delivered"
            : "Approve the exact PO recipient"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.status === "sent" || order.status === "confirmed" ? (
          <p className="text-sm text-[var(--bh-green)]">
            {order.status === "confirmed"
              ? `${order.poNumber} was delivered once and the supplier confirmation matches.`
              : `${order.poNumber} was delivered once and is waiting for supplier confirmation.`}
          </p>
        ) : !configuredBuyer ? (
          <p className="text-sm leading-6 text-foreground">
            Judge mode can approve the demo purchase, but it can never send external email. Sign in
            as the configured buyer to approve a real recipient.
          </p>
        ) : order.recipientApprovedAt === null ? (
          <>
            <p className="text-sm leading-6 text-foreground">
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
            <p className="text-sm text-foreground">
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
        {order.errorMessage ? (
          <p className="text-sm text-destructive">{order.errorMessage}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
  const progressStep =
    (
      {
        detected: 0,
        analyzing: 0,
        sourcing: 1,
        rfq_ready: 1,
        rfq_sent: 1,
        awaiting_quotes: 1,
        evaluating: 2,
        approval_required: 3,
        approved: 4,
        po_sent: 5,
        confirmation_pending: 5,
        confirmed: 5,
        rejected: 3,
        no_viable_supplier: 2,
        exception: 3,
      } as Record<string, number>
    )[procurement.status] ?? 0;
  if (view === "recommendation" && procurement.recommendation) {
    const recommendation = procurement.recommendation;
    return (
      <>
        <div className="rounded-lg border border-border bg-muted/40 p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
          <p className="mt-5 text-sm leading-6">
            Selected quote for {procurement.quantityRequired.toLocaleString()} units, required by{" "}
            {procurement.requiredBy}. Compare the current supplier terms below.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">Terms from supplier quote</Badge>
            <Badge variant="outline">
              {recommendation.matchConfidenceSource === "controlled_demo_assumption"
                ? `Demo product-match assumption · ${Math.round(recommendation.matchConfidence * 100)}%`
                : "Product match · unverified"}
            </Badge>
          </div>
        </div>
      </>
    );
  }

  if (view === "approval" && procurement.recommendation) {
    const recommendation = procurement.recommendation;
    return (
      <>
        <div className="grid gap-5 rounded-lg border border-border bg-muted/40 p-5 sm:grid-cols-2">
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
        <div className="rounded-lg border border-[var(--bh-orange)]/30 bg-[var(--bh-orange)]/10 p-4 text-sm leading-6">
          {recommendation.matchConfidenceSource === "controlled_demo_assumption"
            ? `The ${Math.round(recommendation.matchConfidence * 100)}% product match is a controlled-demo assumption, not a measured assessment of this quote.`
            : "Product match has not been verified for this quote."}{" "}
          Review the source evidence before deciding.
        </div>
        {procurement.approval ? (
          <Badge variant="outline" className="capitalize">
            Decision recorded · {procurement.approval.status}
          </Badge>
        ) : (
          <p className="text-sm text-muted-foreground">
            No decision is recorded. Sign in below to review and approve the purchase.
          </p>
        )}
      </>
    );
  }

  if (view === "order" && procurement.purchaseOrder) {
    const order = procurement.purchaseOrder;
    return (
      <>
        <PurchaseOutcome procurement={procurement} />
        <div className="grid gap-5 rounded-lg border border-border bg-muted/40 p-5 sm:grid-cols-2">
          <Fact label="Purchase order" value={order.poNumber} />
          <Fact label="Supplier" value={order.supplierName} />
          <Fact label="Quantity" value={`${order.quantity.toLocaleString()} units`} />
          <Fact label="Unit price" value={unitPrice(order.unitPriceMicrodollars)} />
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
        <div className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Ship to
            </p>
            <p className="mt-2 text-sm whitespace-pre-line">{order.shipTo}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Bill to
            </p>
            <p className="mt-2 text-sm whitespace-pre-line">{order.billTo}</p>
          </div>
        </div>
        <details className="buy-desk-evidence">
          <summary>Open purchase order document</summary>
          <iframe
            title={`${order.poNumber} accessible HTML preview`}
            srcDoc={order.htmlBody}
            sandbox=""
            className="buy-desk-document h-[34rem] w-full rounded-lg border border-border"
          />
        </details>
        <p className="text-sm text-muted-foreground">
          {order.sentAt === null
            ? "This order has not been marked sent."
            : `Sent ${new Date(order.sentAt).toLocaleString()}. Confirmation appears only after matching provider evidence.`}
        </p>
      </>
    );
  }

  return (
    <>
      {procurement.confirmation ? <PurchaseOutcome procurement={procurement} /> : null}
      <ol className="buy-desk-milestones" aria-label="Procurement milestones">
        {[
          "Risk detected",
          "Supplier search",
          "Compare quotes",
          "Buyer review",
          "Purchase order",
          "Supplier confirmation",
        ].map((label, index) => (
          <Milestone
            key={label}
            label={label}
            number={index + 1}
            done={index < progressStep || procurement.status === "confirmed"}
            current={index === progressStep && procurement.status !== "confirmed"}
          />
        ))}
      </ol>
      <Separator />
      <div className="grid gap-4 sm:grid-cols-3" data-demo-target="risk">
        <Fact
          label="Target quantity"
          value={`${procurement.quantityRequired.toLocaleString()} units`}
        />
        <Fact label="Required by" value={procurement.requiredBy} />
        <Fact label="Projected stockout" value={procurement.projectedStockoutDate} />
      </div>
      {procurement.calculationInputs ? (
        <p className="text-sm text-muted-foreground">
          Original stock: {procurement.calculationInputs.quantityOnHand.toLocaleString()} units ·
          average use: {Math.round(procurement.averageDailyUsage).toLocaleString()}/day. Forecast
          based on a {procurement.calculationInputs.trailingUsageDays}-day usage window.
        </p>
      ) : null}
      <Collapsible>
        <CollapsibleTrigger className="inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-medium">
          View activity and evidence
        </CollapsibleTrigger>
        <CollapsibleContent className="bh-receipt mt-4 space-y-3 p-4">
          {procurement.events.map((event) => (
            <div key={event.eventId} className="grid grid-cols-[4rem_1fr] gap-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                {shortTime(event.createdAt)}
              </span>
              <p>{event.summary}</p>
            </div>
          ))}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Confirmed · inventory history</Badge>
            <Badge variant="outline">Version · {procurement.calculationVersion}</Badge>
          </div>
          {procurement.calculationInputs ? (
            <p className="text-xs leading-5 text-muted-foreground">
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="buy-desk-fact">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
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

function Milestone({
  label,
  number,
  done,
  current,
}: {
  label: string;
  number: number;
  done?: boolean;
  current?: boolean;
}) {
  return (
    <li
      className="buy-desk-milestone"
      data-state={done ? "done" : current ? "current" : "pending"}
      aria-current={current ? "step" : undefined}
    >
      <span aria-hidden="true">
        {done ? <Check className="size-3.5" /> : String(number).padStart(2, "0")}
      </span>
      <span>
        {label}
        <span className="sr-only">
          {done ? " — complete" : current ? " — current" : " — pending"}
        </span>
      </span>
    </li>
  );
}

function AgentCard({ state, message, unread }: { state: string; message: string; unread: number }) {
  return (
    <section className="buy-desk-agent-module" aria-labelledby="agent-status-label">
      <header className="bh-face-label">
        <h2 id="agent-status-label" className="screen-print">
          <Sparkles aria-hidden="true" />
          Agent
        </h2>
      </header>
      <Card className="buy-desk-agent-card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2 font-semibold text-[var(--bh-orange)] uppercase">
            {state.replaceAll("_", " ")}
          </CardDescription>
          <CardTitle className="text-base leading-6">{message}</CardTitle>
        </CardHeader>
        {unread > 0 ? (
          <CardContent>
            <p className="text-sm text-[var(--bh-orange)]">
              {unread} unread contextual {unread === 1 ? "thread" : "threads"}
            </p>
          </CardContent>
        ) : null}
      </Card>
    </section>
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
      if (isAuthenticated && !currentUser?.isJudgeDemo) await signOut();
      if (!isAuthenticated || !currentUser?.isJudgeDemo) await signIn("anonymous");
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          await claimConfiguredBuyer({});
          return;
        } catch (claimError) {
          lastError = claimError;
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
      <Button variant="outline" className="bg-card" onClick={() => void signOut()}>
        <ShieldCheck />
        Judge mode active
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="bg-card"
        onClick={() => void enter()}
        disabled={isLoading || state === "working"}
      >
        <ShieldCheck />
        {state === "working" ? "Opening judge mode…" : "Enter judge mode"}
      </Button>
      {error ? <span className="max-w-48 text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

function ConfiguredBuyerButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signIn, signOut, version } = useAuthActions();
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

  if (version === "passkey" && !configuredBuyer)
    return (
      <a className="company-sign-out" href="/legacy?demo=true&method=password">
        Buyer sign in
      </a>
    );

  return (
    <>
      {configuredBuyer ? (
        <Button
          variant="outline"
          className="buy-desk-account-button"
          onClick={() => void signOut()}
        >
          <ShieldCheck />
          Buyer active
        </Button>
      ) : (
        <Button
          variant="outline"
          className="buy-desk-account-button"
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
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="buy-desk-skeleton" aria-busy="true" aria-label="Loading buy desk">
      {[0, 1, 2].map((number) => (
        <div key={number} />
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
    <Card className="border-dashed bg-card">
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
    <Card className="border-dashed border-input bg-card" data-testid="demo-controls">
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          Reset creates a fresh run. Start demo performs deterministic inventory analysis; it does
          not fake supplier replies.
        </p>
        {!configuredBuyer ? (
          <p className="text-xs text-[var(--bh-orange)]">
            Shared reset and start controls require the configured buyer. Judge mode cannot reset
            shared data or send external email.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
