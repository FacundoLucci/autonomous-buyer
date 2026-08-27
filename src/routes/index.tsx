import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  PlugZap,
  Radar,
  Send,
  ShieldCheck,
  RotateCcw,
  Play,
} from "lucide-react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const buildLanes = [
  {
    title: "Detect the risk",
    detail: "Watch inventory and open one procurement before stockout.",
    icon: Radar,
  },
  {
    title: "Source and negotiate",
    detail: "Find suppliers, send RFQs, and turn replies into comparable quotes.",
    icon: Send,
  },
  {
    title: "Approve and replenish",
    detail: "Require buyer approval, issue the PO, and update the projection.",
    icon: ShieldCheck,
  },
];

const integrationNames = ["openai", "openrouter", "firecrawl", "agentmail"] as const;

const integrationLabels: Record<(typeof integrationNames)[number], string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  firecrawl: "Firecrawl",
  agentmail: "AgentMail",
} as const;

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    demo: search.demo === "1" || search.demo === 1 || search.demo === true,
  }),
  component: Home,
});

function Home() {
  const integrations = useQuery(api.integrations.getStatus);
  const scenario = useQuery(api.demo.getCurrentScenario);
  const resetScenario = useMutation(api.demo.resetScenario);
  const startScenario = useMutation(api.demo.startScenario);
  const { demo } = Route.useSearch();
  const [controlState, setControlState] = useState<"idle" | "resetting" | "starting">("idle");
  const [controlError, setControlError] = useState<string | null>(null);

  async function reset() {
    setControlError(null);
    setControlState("resetting");
    try {
      await resetScenario({});
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "The scenario could not be reset.");
    } finally {
      setControlState("idle");
    }
  }

  async function start() {
    if (scenario === undefined || scenario === null) return;
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.96_0.04_70),transparent_38%),linear-gradient(to_bottom,oklch(0.995_0.003_75),oklch(0.97_0.01_70))] px-5 py-8 sm:px-8 sm:py-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="grid gap-8 border-b border-border/70 pb-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div className="space-y-5">
            <Badge variant="secondary" className="gap-1.5">
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              Scaffold ready for review
            </Badge>
            <div className="space-y-3">
              <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Convex All Gas Hackathon
              </p>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
                Autonomous Buyer
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                A purchasing agent that detects stockout risk, researches suppliers, gathers quotes,
                asks for approval, and closes the replenishment loop in real time.
              </p>
            </div>
          </div>

          <Card className="border-primary/15 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader>
              <CardDescription>Development systems</CardDescription>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlugZap aria-hidden="true" className="size-5" />
                Integration status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid min-h-39 content-start gap-3" aria-live="polite">
                {(integrations ?? integrationNames.map((name) => ({ name }))).map((integration) => {
                  const status = "status" in integration ? integration.status : "loading";

                  return (
                    <div
                      key={integration.name}
                      className="flex min-h-7 items-center justify-between gap-4 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {integrationLabels[integration.name]}
                      </span>
                      <Badge
                        variant={status === "configured" ? "default" : "outline"}
                        className="min-w-21 justify-center tabular-nums"
                      >
                        {status === "configured" ? (
                          <CheckCircle2 aria-hidden="true" className="size-3.5" />
                        ) : (
                          <CircleDashed aria-hidden="true" className="size-3.5" />
                        )}
                        {status === "loading"
                          ? "Checking"
                          : status === "configured"
                            ? "Ready"
                            : "Missing"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              <Separator className="my-4" />
              <p className="text-xs leading-5 text-muted-foreground">
                Credentials stay in the Convex development environment and are never shown here.
              </p>
            </CardContent>
          </Card>
        </header>

        <section aria-labelledby="build-order" className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">Core loop</p>
              <h2 id="build-order" className="mt-1 text-2xl font-semibold">
                The product will arrive in three visible stages
              </h2>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="hidden size-5 text-muted-foreground sm:block"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {buildLanes.map(({ title, detail, icon: Icon }, index) => (
              <Card key={title} className="bg-card/75 shadow-none">
                <CardHeader>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="leading-6">{detail}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {demo ? (
          <Card className="border-dashed bg-card/75" data-testid="demo-controls">
            <CardHeader>
              <CardDescription>
                Hidden rehearsal controls · local scenario data only
              </CardDescription>
              <CardTitle className="flex items-center justify-between gap-4 text-lg">
                Demo run
                <Badge variant="outline">{scenario?.status ?? "not seeded"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {scenario ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Critical inventory</p>
                    <p className="font-medium tabular-nums">
                      {scenario.inventory
                        .find((item) => item.sku === "LID-16-TE")
                        ?.quantityOnHand.toLocaleString() ?? "—"}{" "}
                      lids
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recent use</p>
                    <p className="font-medium tabular-nums">
                      {scenario.inventory
                        .find((item) => item.sku === "LID-16-TE")
                        ?.averageDailyUsage.toLocaleString() ?? "—"}
                      /day
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Seeded history</p>
                    <p className="font-medium tabular-nums">
                      {scenario.usageRecordCount} usage · {scenario.purchaseHistoryCount} Apex
                      orders
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Controlled identities</p>
                    <p className="font-medium tabular-nums">
                      {scenario.controlledIdentityCount} demo only
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Create the repeatable Acme Foods starting state before rehearsal.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={reset} disabled={controlState !== "idle"} variant="outline">
                  <RotateCcw aria-hidden="true" />
                  {controlState === "resetting" ? "Resetting…" : "Reset scenario"}
                </Button>
                <Button
                  onClick={start}
                  disabled={controlState !== "idle" || !scenario || scenario.status !== "ready"}
                >
                  <Play aria-hidden="true" />
                  {controlState === "starting" ? "Starting…" : "Start run"}
                </Button>
              </div>
              {controlError ? <p className="text-sm text-destructive">{controlError}</p> : null}
              <p className="text-xs leading-5 text-muted-foreground">
                Every value above is seeded demo data. Reset creates a new run ID and never deletes
                AgentMail provider history.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <footer className="rounded-lg border border-dashed border-border bg-background/55 px-4 py-3 text-sm text-muted-foreground">
          This is the app foundation only. Product workflows, external sends, and production
          deployment are intentionally waiting for review.
        </footer>
      </section>
    </main>
  );
}
