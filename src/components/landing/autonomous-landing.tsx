import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUpRight, ChevronRight, Printer, RotateCcw, X } from "lucide-react";

import { dotMatrixDriver } from "@/components/buy-hard/dot-matrix-driver";
import "./autonomous-landing.css";

const steps = [
  {
    title: "Inventory signal",
    stamp: "Risk detected",
    tone: "rust",
    status: "Watching",
    output: "DETECTED",
    detail: "A little heads-up. A lot less downtime.",
    action:
      "Review the inventory signal for LID-16-TE. At the current daily use, stock will last 5.3 days.",
    rows: [
      ["Item", "LID-16-TE"],
      ["", "16 oz Deli Lid"],
      ["On hand", "3,240"],
      ["Daily use", "612"],
      ["Days left", "5.3"],
    ],
  },
  {
    title: "Risk confirmed",
    stamp: "Action required",
    tone: "rust",
    status: "Triggered",
    output: "FLAGGED",
    detail: "The shortage is real. The search is on.",
    action:
      "Source a replenishment order. Inventory is below the 7-day reorder point, with a high risk of a stockout.",
    rows: [
      ["Item", "LID-16-TE"],
      ["Stock lasts", "5.3 days"],
      ["Reorder at", "7.0 days"],
      ["Impact", "High"],
    ],
  },
  {
    title: "Procurement job",
    stamp: "Finding a match",
    tone: "blue",
    status: "Sourcing",
    output: "SOURCING",
    detail: "The right supplier. The right time.",
    action:
      "Review the supplier match and order terms for 15,000 lids from Best Lids Co. before approving the purchase.",
    rows: [
      ["Job", "PC-9258"],
      ["Item", "LID-16-TE"],
      ["Qty", "15,000 units"],
      ["Match", "98%"],
      ["Policy", "Review passed"],
    ],
  },
  {
    title: "Order confirmed",
    stamp: "Success",
    tone: "green",
    status: "Confirmed",
    output: "COVERED",
    detail: "Inventory risk resolved. Keep the lines moving.",
    action:
      "Track the incoming delivery of 15,000 lids, due September 10. Match the packing slip to PO-PC-9258-8DAPKN when it arrives.",
    rows: [
      ["PO", "PC-9258-8DAPKN"],
      ["Supplier", "Best Lids Co."],
      ["Qty", "15,000 units"],
      ["ETA", "2026-09-10"],
    ],
  },
] as const;

const inventory = [
  {
    name: "12 × 12 Shipping Case",
    code: "CASE-SHIP-12",
    onHand: "620",
    days: "10.2",
    daily: "61",
    status: "Watch",
    tone: "amber",
  },
  {
    name: "Tamper-Evident 16 oz Deli Lid",
    code: "LID-16-TE",
    onHand: "3,240",
    days: "5.3",
    daily: "612",
    status: "Watch",
    tone: "rust",
  },
  {
    name: "16 oz Deli Container",
    code: "CONTAINER-16",
    onHand: "12,480",
    days: "32.7",
    daily: "382",
    status: "Healthy",
    tone: "green",
  },
] as const;

const activity = [
  ["17:54:21", "Inventory signal: LID-16-TE, 5.3 days left", "RISK DETECTED", "rust"],
  ["17:54:23", "Risk confirmed: reorder recommended", "ACTION REQUIRED", "rust"],
  ["17:54:25", "Procurement job started", "PC-9258", "blue"],
  ["17:54:28", "Supplier match found: Best Lids Co.", "98% MATCH", "blue"],
  ["17:54:31", "Quote received & policy check passed", "REVIEWED", "green"],
  ["17:54:35", "Buyer approved · purchase order created", "APPROVED", "green"],
  ["17:54:41", "Order confirmed by supplier", "CONFIRMED", "green"],
  ["17:54:42", "ETA: Sep 10 · 15,000 units incoming", "COVERED", "green"],
] as const;

function PrintedDisplay({ text, className = "" }: { text: string; className?: string }) {
  const frame = dotMatrixDriver.rasterize(text);
  const inkPath = Array.from(frame.pixels, (pixel, index) =>
    pixel
      ? [0.06, 0.37, 0.68]
          .map(
            (offset) =>
              `M${(index % frame.columns) + offset} ${Math.floor(index / frame.columns) + 0.06}h.23v.87h-.23z`,
          )
          .join(" ")
      : "",
  ).join(" ");
  return (
    <span className={`lp-digital ${className}`}>
      <svg
        viewBox={`0 0 ${frame.columns} ${frame.rows}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={inkPath} />
      </svg>
      <span className="sr-only">{text}</span>
    </span>
  );
}

function Robot({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={`lp-robot ${small ? "lp-robot-small" : ""}`}
      viewBox="0 0 94 108"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeDasharray="3.2 1.3">
        <path d="M26 26V9h42v17M23 28h49v9H23zM16 38h63v37H16zM10 73h75v28H10zM21 80h54v18H21zM15 100v5h15v-5M67 100v5h13v-5M7 46v25M87 46v25" />
        <path d="m30 57 4-6 4 6m20 0 4-6 4 6M43 62h9M19 43v25m57-25v25" strokeDasharray="none" />
      </g>
      <path d="M22 81h52v16H22z" fill="currentColor" opacity=".7" />
      <circle cx="66" cy="87" r="2.4" className="lp-robot-light" />
    </svg>
  );
}

function Screw({ className = "" }: { className?: string }) {
  return <i className={`lp-screw ${className}`} aria-hidden="true" />;
}

function Paper({
  children,
  className = "",
  punched = false,
}: {
  children: ReactNode;
  className?: string;
  punched?: boolean;
}) {
  return (
    <div className={`lp-paper-wrap ${className}`}>
      <div className={`lp-paper ${punched ? "lp-punched" : ""}`}>{children}</div>
    </div>
  );
}

function Barcode({ className = "" }: { className?: string }) {
  return <span className={`lp-barcode ${className}`} aria-hidden="true" />;
}

function ReceiptRows({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="lp-receipt-rows">
      {rows.map(([label, value], index) => (
        <div key={`${label}-${index}`} className={!label ? "lp-row-description" : undefined}>
          <dt>
            {label}
            {label ? ":" : ""}
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AutonomousLanding() {
  const [selectedStep, setSelectedStep] = useState(3);
  const [dialogContent, setDialogContent] = useState<"print" | "item" | "settings">("print");
  const [selectedItem, setSelectedItem] = useState<(typeof inventory)[number]>(inventory[1]);
  const [requireApproval, setRequireApproval] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const loopRef = useRef<HTMLElement>(null);
  const step = steps[selectedStep];
  const isCovered = selectedStep === 3;
  const visibleEvents = [1, 2, 5, 8][selectedStep];

  function showDialog(content: typeof dialogContent) {
    setDialogContent(content);
    dialogRef.current?.showModal();
  }

  function showItem(item: (typeof inventory)[number]) {
    setSelectedItem(item);
    showDialog("item");
  }

  function exploreLoop() {
    const firstStep = loopRef.current?.querySelector<HTMLButtonElement>("button");
    loopRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
    firstStep?.focus({ preventScroll: true });
  }

  return (
    <div className="lp-page">
      <a className="lp-skip-link" href="#lp-console">
        Skip to the demo
      </a>
      <nav className="lp-navigation" aria-label="Main navigation">
        <a className="lp-wordmark" href="/">
          BUY HARD<span>®</span>
        </a>
        <span className="lp-nav-description">AUTONOMOUS PROCUREMENT SYSTEM</span>
        <div className="lp-navigation-links">
          <button onClick={exploreLoop}>
            How it works <ArrowDown size={12} />
          </button>
          <a href="/setup?mode=login">
            Sign in <ArrowUpRight size={13} />
          </a>
        </div>
      </nav>

      <main className="lp-console" id="lp-console">
        <Screw className="lp-corner-tl" />
        <Screw className="lp-corner-tr" />
        <Screw className="lp-corner-bl" />
        <Screw className="lp-corner-br" />

        <header className="lp-console-header">
          <div className="lp-title-block">
            <div className="lp-company">
              ACME FOODS <span>EST. 2026 / DEMO NO. 001</span>
            </div>
            <h1>
              <PrintedDisplay text={"AUTONOMOUS\nBUYER"} />
            </h1>
            <p>Always watching. Always a step ahead.</p>
          </div>
          <div className="lp-agent-overview">
            <Robot />
            <div className="lp-agent-readout">
              <h2>AGENT: WORKING</h2>
              {["Monitor", "Analyze", "Source", "Procure"].map((label, index) => (
                <div className="lp-agent-row" key={label}>
                  <span>{label}</span>
                  <span className="lp-led-bars" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, bar) => (
                      <i key={bar} className={index <= selectedStep ? "lp-led-on" : ""} />
                    ))}
                  </span>
                  <span className={index <= selectedStep ? "lp-green-light" : "lp-muted"}>
                    {index <= selectedStep ? "OK" : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-system-controls">
            <div className="lp-status-panel">
              <div>
                <span>System status</span>
                <span className="lp-green-light">
                  <i className="lp-status-dot" />
                  Online
                </span>
              </div>
              <div>
                <span>Session</span>
                <span>Interactive demo</span>
              </div>
              <div>
                <span>Run time</span>
                <span>00:00:{["00", "02", "10", "21"][selectedStep]}</span>
              </div>
            </div>
            <button
              className="lp-blue-button"
              onClick={() => showDialog("print")}
              aria-label="Print next action"
            >
              <span>
                Print next action <span aria-hidden="true">▶</span>
              </span>
            </button>
          </div>
        </header>

        <div className="lp-top-grid">
          <Paper className="lp-summary">
            <span className="lp-pushpin" aria-hidden="true" />
            <h2 className="lp-receipt-heading">
              Autonomous buyer summary <span>≪</span>
            </h2>
            <dl className="lp-summary-data">
              <div>
                <dt>Open buys</dt>
                <dd>{isCovered ? "0" : "1"}</dd>
              </div>
              <div>
                <dt>Annual spend</dt>
                <dd>$284,320</dd>
              </div>
              <div>
                <dt>Savings identified</dt>
                <dd>$17,430</dd>
              </div>
              <div>
                <dt>Agent mode</dt>
                <dd>Working</dd>
              </div>
            </dl>
            <div className="lp-receipt-footer">
              <Barcode />
              <span>ACME / SAMPLE WORKSPACE</span>
            </div>
          </Paper>

          <section
            className="lp-workflow"
            ref={loopRef}
            aria-label="Explore the four procurement steps"
          >
            {steps.map((item, index) => (
              <Paper
                className={`lp-step lp-step-${index + 1} ${selectedStep === index ? "lp-step-selected" : ""}`}
                key={item.title}
              >
                <button
                  className="lp-step-trigger"
                  onClick={() => setSelectedStep(index)}
                  aria-pressed={selectedStep === index}
                  aria-label={`Show step ${index + 1}: ${item.title}`}
                >
                  <span>
                    {index + 1}. {item.title}
                  </span>
                  <i aria-hidden="true" />
                </button>
                <div className={`lp-stamp lp-${item.tone}`}>{item.stamp}</div>
                <ReceiptRows rows={item.rows} />
                <div className="lp-step-status">
                  Status: {item.status}
                  <span aria-hidden="true">{index < 3 ? "›" : "✓"}</span>
                </div>
              </Paper>
            ))}
          </section>
        </div>

        <div className="lp-bottom-grid">
          <div className="lp-left-column">
            <Paper className="lp-inventory" punched>
              <h2 className="lp-receipt-heading">Live inventory</h2>
              <div className="lp-inventory-subhead">
                <h3>Packaging items</h3>
                <span>Sample feed</span>
              </div>
              <table>
                <caption className="sr-only">
                  Sample packaging inventory. Select an item to see its details.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">On hand</th>
                    <th scope="col">Days left</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.code}>
                      <td colSpan={4}>
                        <button
                          className="lp-inventory-item"
                          onClick={() => showItem(item)}
                          aria-label={`View ${item.name}`}
                        >
                          <span className="lp-item-name">{item.name}</span>
                          <span className="lp-item-code">{item.code}</span>
                          <span className="lp-item-quantity">{item.onHand}</span>
                          <span className="lp-item-days">{item.days}</span>
                          <span className={`lp-item-status lp-${item.tone}`}>
                            <i />
                            {item.status}
                          </span>
                          {item.code === "LID-16-TE" && isCovered && (
                            <span className="lp-incoming">+15,000 CONFIRMED</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="lp-inventory-note">
                On hand · historical usage · days left
                <br />
                Calculated · incoming · supplier-confirmed
              </p>
              <div className="lp-receipt-footer">
                <Barcode />
                <span>INV-FEED-STREAM&nbsp; ≫</span>
              </div>
            </Paper>
            <section className="lp-ticker" aria-labelledby="lp-ticker-title">
              <h2 id="lp-ticker-title">
                System ticker{" "}
                <span>
                  <i className="lp-status-dot" />
                  Demo
                </span>
              </h2>
              <p>
                <time>17:54:42</time>
                <span>
                  {isCovered ? "All systems nominal." : "Agent processing inventory signal."}
                </span>
              </p>
              <p>
                <time>17:54:20</time>
                <span>Agent working on your next move.</span>
              </p>
              <p>
                <time>17:54:19</time>
                <span>Good things happen ahead of time.</span>
              </p>
              <span className="lp-terminal-cursor" aria-hidden="true">
                &gt;&gt;&gt; <i />
              </span>
            </section>
          </div>

          <div className="lp-center-column">
            <section className="lp-resolution" aria-label="Risk to resolution">
              <h2 className="lp-panel-label">
                <Screw />
                Risk to resolution
                <span />
              </h2>
              <Paper className="lp-resolution-paper">
                <div className="lp-resolution-number lp-rust">
                  <PrintedDisplay text="5.3" />
                  <span>Days left</span>
                </div>
                <span className="lp-resolution-arrow lp-rust" aria-hidden="true">
                  →
                </span>
                <div className={`lp-resolution-number ${isCovered ? "lp-green" : "lp-muted-ink"}`}>
                  <PrintedDisplay text="15,000" />
                  <span>{isCovered ? "Incoming" : "To source"}</span>
                </div>
                <span className={`lp-covered-word ${isCovered ? "lp-green" : "lp-rust"}`}>
                  <PrintedDisplay text={isCovered ? "COVERED" : "ON IT"} />
                  <span>{isCovered ? "✓ RISK RESOLVED" : "AGENT WORKING"}</span>
                </span>
              </Paper>
            </section>

            <section className="lp-printer" aria-labelledby="lp-feed-heading">
              <Screw className="lp-printer-screw" />
              <i className="lp-printer-led" aria-hidden="true" />
              <div className="lp-printer-roller" aria-hidden="true" />
              <Paper className="lp-feed-paper" punched>
                <h2 className="lp-receipt-heading" id="lp-feed-heading">
                  Live activity feed <span>↓</span>
                </h2>
                <ol className="lp-feed-events">
                  {activity.slice(0, visibleEvents).map(([time, message, status, tone]) => (
                    <li key={time}>
                      <time>{time}</time>
                      <span>{message}</span>
                      <span className={`lp-feed-tag lp-${tone}`}>[{status}]</span>
                    </li>
                  ))}
                </ol>
                {selectedStep < 3 && (
                  <p className="lp-feed-waiting">
                    Awaiting next step<span aria-hidden="true"> ▌</span>
                  </p>
                )}
                <div className="lp-feed-bottom">
                  END OF TRANSMISSION <span>· · ·</span>
                </div>
              </Paper>
            </section>

            <div className="lp-output-row">
              <Paper className="lp-output" punched>
                <h2 className="lp-receipt-heading">Agent output</h2>
                <div className="lp-output-content">
                  <div>
                    <strong className={`lp-output-stamp lp-${step.tone}`}>{step.output}</strong>
                    <p>
                      LID-16-TE {isCovered ? "secured." : "in progress."}
                      <br />
                      {isCovered
                        ? "15,000 units incoming by Sep 10."
                        : "15,000 units to replenish."}
                      <br />
                      {isCovered ? "Inventory risk resolved." : "Your agent is on the job."}
                    </p>
                    <p>Keep the lines moving.</p>
                  </div>
                  <Robot small />
                </div>
              </Paper>
              <div className={`lp-seal ${isCovered ? "" : "lp-seal-pending"}`} aria-hidden="true">
                <span>RISK RESOLVED</span>
                <i>★</i>
                <strong>COVERED</strong>
                <span>KEEP IT MOVING</span>
              </div>
            </div>
          </div>

          <div className="lp-right-column">
            <Paper className="lp-job-ticket">
              <div className="lp-hazard" aria-hidden="true" />
              <span className="lp-ticket-hole" aria-hidden="true" />
              <h2 className="lp-receipt-heading">Procurement progress</h2>
              <div className="lp-job-id">
                PC-9258<span>LID-16-TE</span>
              </div>
              <ReceiptRows
                rows={[
                  ["Item", "16 oz Deli Lid"],
                  ["Qty", "15,000 units"],
                  ["Supplier", selectedStep >= 2 ? "Best Lids Co." : "Finding a match"],
                  ["ETA", isCovered ? "2026-09-10" : "Pending"],
                ]}
              />
              <div className="lp-job-status">
                <span>Job status</span>
                <strong>
                  <i aria-hidden="true">★</i>
                  {step.status}
                  <i aria-hidden="true">★</i>
                </strong>
              </div>
              <ReceiptRows
                rows={[
                  ["PO", isCovered ? "PC-9258-8DAPKN" : "Not yet issued"],
                  ["Match", selectedStep >= 2 ? "98%" : "Pending"],
                  ["Policy", isCovered ? "Approved" : "Buyer review"],
                  ["Terms", "Net 30"],
                  ["Ship to", "Acme Foods DC1"],
                ]}
              />
              <Barcode />
              <p className="lp-ticket-thanks">
                THANK YOU! <span>01 / 01</span>
              </p>
            </Paper>
            <section className="lp-quick-controls" aria-labelledby="lp-quick-heading">
              <h2 id="lp-quick-heading">
                Quick controls
                <Screw />
              </h2>
              <button onClick={() => setSelectedStep(selectedStep < 3 ? selectedStep + 1 : 0)}>
                {selectedStep < 3 ? "Advance demo" : "Replay demo"}
                {selectedStep < 3 ? <ChevronRight size={13} /> : <RotateCcw size={12} />}
              </button>
              <a href="/?demo=1">
                Open buy desk
                <ArrowUpRight size={13} />
              </a>
              <button onClick={() => showItem(inventory[1])}>
                View item details
                <ChevronRight size={13} />
              </button>
              <button onClick={() => showDialog("settings")}>
                Agent settings
                <ChevronRight size={13} />
              </button>
            </section>
          </div>
        </div>

        <footer className="lp-console-footer">
          <span>
            <i className="lp-status-dot" />
            ALL SYSTEMS GO
          </span>
          <p>One less thing on your plate.</p>
          <span>AB—001 / BUILT TO KEEP GOING</span>
        </footer>
        <output className="sr-only" aria-live="polite">
          Step {selectedStep + 1} of 4: {step.title}. {step.detail}
        </output>
      </main>

      <footer className="lp-page-footer">
        <div>
          <span>BUILT TO KEEP YOUR BUSINESS MOVING.</span>
          <h2>Put your purchasing on autopilot.</h2>
          <p>From the first signal to the final receipt. You stay in control.</p>
        </div>
        <a className="lp-start-button" href="/setup">
          Start your buy desk <ArrowUpRight size={20} />
        </a>
        <p className="lp-demo-disclosure">
          Interactive sample · Acme Foods is a demo workspace. Figures and activity are
          illustrative.
        </p>
        <span className="lp-footer-brand">
          BUY HARD® <span>KEEP THE LINES MOVING.</span>
        </span>
      </footer>

      <dialog className="lp-dialog" ref={dialogRef} aria-labelledby="lp-dialog-title">
        <div className="lp-dialog-inner">
          <form method="dialog">
            <button className="lp-dialog-close" aria-label="Close dialog">
              <X size={20} />
            </button>
          </form>
          <span className="lp-dialog-eyebrow">ACME FOODS / SAMPLE WORKSPACE</span>
          <h2 id="lp-dialog-title">
            {dialogContent === "print"
              ? "Your next action."
              : dialogContent === "item"
                ? selectedItem.name
                : "Your agent. Your rules."}
          </h2>
          {dialogContent === "print" ? (
            <>
              <span className={`lp-stamp lp-${step.tone}`}>{step.status}</span>
              <p>{step.action}</p>
              <ReceiptRows
                rows={[
                  ["Job", "PC-9258"],
                  ["Item", "LID-16-TE"],
                  ["Quantity", "15,000 units"],
                  ["Step", `${selectedStep + 1} of 4 · ${step.title}`],
                ]}
              />
              <button className="lp-dialog-action" onClick={() => window.print()}>
                <Printer size={17} />
                Print this receipt
              </button>
              <p className="lp-dialog-footnote">
                Prints a sample action receipt using your browser.
              </p>
            </>
          ) : dialogContent === "item" ? (
            <>
              <p className="lp-dialog-code">{selectedItem.code}</p>
              <ReceiptRows
                rows={[
                  ["On hand", `${selectedItem.onHand} units`],
                  ["Daily use", `${selectedItem.daily} units`],
                  ["Days left", `${selectedItem.days} days`],
                  ["Status", selectedItem.status],
                  [
                    "Incoming",
                    selectedItem.code === "LID-16-TE" && isCovered
                      ? "15,000 · Sep 10"
                      : "No confirmed orders",
                  ],
                ]}
              />
              <p>
                Days left are calculated from stock on hand and average daily use. Confirmed
                incoming orders are tracked separately.
              </p>
              <a className="lp-dialog-action" href="/?demo=1">
                Explore the buy desk
                <ArrowUpRight size={16} />
              </a>
            </>
          ) : (
            <>
              <p>
                The agent watches stock and finds suppliers. You decide how purchasing gets
                approved.
              </p>
              <ReceiptRows
                rows={[
                  ["Reorder point", "7 days of stock"],
                  ["Target coverage", "30 days"],
                  ["Supplier terms", "Net 30"],
                ]}
              />
              <label className="lp-setting">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(event) => setRequireApproval(event.target.checked)}
                />
                <span>
                  Require my approval before ordering
                  <small>
                    {requireApproval
                      ? "Every purchase waits for your review."
                      : "Orders within your policy can proceed automatically."}
                  </small>
                </span>
              </label>
              <p className="lp-dialog-footnote">
                Preview setting only. Create your workspace to set up your own purchasing rules.
              </p>
              <a className="lp-dialog-action" href="/setup">
                Set up your agent
                <ArrowUpRight size={16} />
              </a>
            </>
          )}
        </div>
      </dialog>

      <div className="lp-print-document">
        <h1>AUTONOMOUS BUYER</h1>
        <p>ACME FOODS / SAMPLE ACTION RECEIPT</p>
        <hr />
        <h2>{step.title}</h2>
        <p>{step.action}</p>
        <ReceiptRows
          rows={[
            ["Job", "PC-9258"],
            ["Item", "LID-16-TE"],
            ["Quantity", "15,000 units"],
            ["Status", step.status],
          ]}
        />
        <hr />
        <p>Illustrative demo. This receipt is not a purchase order.</p>
        <Barcode />
        <p>Keep the lines moving.</p>
      </div>
    </div>
  );
}
