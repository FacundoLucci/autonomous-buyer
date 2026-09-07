import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";

import { dotMatrixDriver } from "@/components/buy-hard/dot-matrix-driver";
import "./autonomous-landing.css";

const steps = [
  {
    title: "Low stock warning",
    stamp: "Running low",
    tone: "rust",
    status: "Checking stock",
    output: "LOW STOCK",
    detail: "You have 5.3 days of lids left. Your buyer spots the shortage early.",
    rows: [
      ["Item", "16 oz deli lids"],
      ["In stock", "3,240 lids"],
      ["Used each day", "612 lids"],
      ["Days left", "5.3"],
    ],
  },
  {
    title: "Time to order",
    stamp: "More lids needed",
    tone: "rust",
    status: "Finding a supplier",
    output: "FINDING",
    detail: "Stock is below your 7-day limit. Your buyer starts looking for more lids.",
    rows: [
      ["Item", "16 oz deli lids"],
      ["Days left", "5.3 days"],
      ["Order at", "7 days left"],
      ["Need to buy", "15,000 lids"],
    ],
  },
  {
    title: "Supplier found",
    stamp: "Ready for review",
    tone: "blue",
    status: "Review order",
    output: "REVIEW",
    detail: "Best Lids Co. can supply 15,000 lids. You check the price and approve the order.",
    rows: [
      ["Supplier", "Best Lids Co."],
      ["Quantity", "15,000 lids"],
      ["Item match", "98%"],
      ["Your approval", "Needed"],
    ],
  },
  {
    title: "Order confirmed",
    stamp: "More lids ordered",
    tone: "green",
    status: "Confirmed",
    output: "ORDERED",
    detail: "The supplier confirmed your order. All 15,000 lids are due September 10.",
    rows: [
      ["Order", "PC-9258-8DAPKN"],
      ["Supplier", "Best Lids Co."],
      ["Quantity", "15,000 lids"],
      ["Arrives", "Sep 10, 2026"],
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
    status: "Check",
    tone: "amber",
  },
  {
    name: "Tamper-Evident 16 oz Deli Lid",
    code: "LID-16-TE",
    onHand: "3,240",
    days: "5.3",
    daily: "612",
    status: "Low",
    tone: "rust",
  },
  {
    name: "16 oz Deli Container",
    code: "CONTAINER-16",
    onHand: "12,480",
    days: "32.7",
    daily: "382",
    status: "Enough",
    tone: "green",
  },
] as const;

const activity = [
  ["17:54:21", "Low stock warning: 5.3 days of lids left", "LOW STOCK", "rust"],
  ["17:54:23", "Time to order: less than 7 days left", "ORDER NEEDED", "rust"],
  ["17:54:25", "Looking for a supplier", "SEARCHING", "blue"],
  ["17:54:28", "Best Lids Co. has the right lids", "FOUND", "blue"],
  ["17:54:31", "Price and delivery terms checked", "READY", "green"],
  ["17:54:35", "Order approved for 15,000 lids", "APPROVED", "green"],
  ["17:54:41", "Supplier confirmed the order", "CONFIRMED", "green"],
  ["17:54:42", "15,000 lids due Sep 10", "ORDERED", "green"],
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
  const [selectedStep, setSelectedStep] = useState(0);
  const [dialogContent, setDialogContent] = useState<"item" | "settings">("item");
  const [selectedItem, setSelectedItem] = useState<(typeof inventory)[number]>(inventory[1]);
  const [requireApproval, setRequireApproval] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const loopRef = useRef<HTMLElement>(null);
  const step = steps[selectedStep];
  const isCovered = selectedStep === 3;
  const visibleEvents = [1, 2, 5, 8][selectedStep];

  function advanceDemo() {
    setSelectedStep((current) => (current + 1) % steps.length);
  }

  function showDialog(content: typeof dialogContent) {
    setDialogContent(content);
    dialogRef.current?.showModal();
  }

  function showItem(item: (typeof inventory)[number]) {
    setSelectedItem(item);
    showDialog("item");
  }

  function exploreLoop() {
    const heading = loopRef.current?.querySelector<HTMLElement>("#lp-step-title");
    loopRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
    heading?.focus({ preventScroll: true });
  }

  return (
    <div className="lp-page">
      <a className="lp-skip-link" href="#lp-console">
        Skip to the demo
      </a>
      <nav className="lp-navigation" aria-label="Main navigation">
        <a className="lp-wordmark" href="/legacy">
          BUY HARD<span>®</span>
        </a>
        <span className="lp-nav-description">AI HELP FOR EVERYDAY BUYING</span>
        <div className="lp-navigation-links">
          <button onClick={exploreLoop}>
            How it works <ArrowDown size={12} />
          </button>
          <a href="/legacy/setup?mode=login">
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
              <PrintedDisplay text={"YOUR AI\nBUYER"} />
            </h1>
            <p>Spots low stock. Helps you order in time.</p>
          </div>
          <div className="lp-agent-overview">
            <Robot />
            <div className="lp-agent-readout">
              <h2>BUYER: WORKING</h2>
              {["Watch stock", "Check need", "Find seller", "Place order"].map((label, index) => (
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
                <span>Status</span>
                <span className="lp-green-light">
                  <i className="lp-status-dot" />
                  Online
                </span>
              </div>
              <div>
                <span>Mode</span>
                <span>Try the demo</span>
              </div>
              <div>
                <span>Demo step</span>
                <span>
                  Step {selectedStep + 1} of {steps.length}
                </span>
              </div>
            </div>
            <button
              className="lp-blue-button"
              onClick={advanceDemo}
              aria-label={isCovered ? "Replay demo" : "Next demo step"}
              aria-controls="lp-demo-steps"
              aria-describedby="lp-demo-status"
            >
              <span>
                {isCovered ? "Replay demo" : "Next demo step"}
                {isCovered ? (
                  <RotateCcw size={14} aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">▶</span>
                )}
              </span>
            </button>
          </div>
        </header>

        <div className="lp-top-grid">
          <Paper className="lp-summary">
            <span className="lp-pushpin" aria-hidden="true" />
            <h2 className="lp-receipt-heading">
              Buying summary <span>≪</span>
            </h2>
            <dl className="lp-summary-data">
              <div>
                <dt>To buy</dt>
                <dd>{isCovered ? "0" : "1"}</dd>
              </div>
              <div>
                <dt>Yearly spend</dt>
                <dd>$284,320</dd>
              </div>
              <div>
                <dt>Possible savings</dt>
                <dd>$17,430</dd>
              </div>
              <div>
                <dt>Buyer</dt>
                <dd>Working</dd>
              </div>
            </dl>
            <div className="lp-receipt-footer">
              <Barcode />
              <span>ACME / EXAMPLE COMPANY</span>
            </div>
          </Paper>

          <section
            className="lp-workflow"
            id="lp-demo-steps"
            ref={loopRef}
            aria-label="How your buyer helps"
          >
            <Paper className="lp-demo-receipt">
              <div className="lp-demo-receipt-topline">
                <span>ACME FOODS / LID-16-TE</span>
                <span>
                  Step {selectedStep + 1} of {steps.length}
                </span>
              </div>
              <div className="lp-demo-receipt-body">
                <div className="lp-demo-story">
                  <span className={`lp-stamp lp-${step.tone}`}>{step.stamp}</span>
                  <h2 id="lp-step-title" tabIndex={-1}>
                    {step.title}
                  </h2>
                  <p>{step.detail}</p>
                </div>
                <ReceiptRows rows={step.rows} />
              </div>
              <div className="lp-demo-receipt-footer">
                <button
                  onClick={() => setSelectedStep((current) => Math.max(0, current - 1))}
                  disabled={selectedStep === 0}
                  aria-controls="lp-demo-steps"
                >
                  <ChevronLeft size={15} aria-hidden="true" /> Back
                </button>
                <span className="lp-demo-dots" aria-hidden="true">
                  {steps.map((item, index) => (
                    <i key={item.title} data-active={index <= selectedStep} />
                  ))}
                </span>
                <button onClick={advanceDemo} aria-controls="lp-demo-steps">
                  {isCovered ? "Replay demo" : "Next step"}
                  {isCovered ? (
                    <RotateCcw size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={15} aria-hidden="true" />
                  )}
                </button>
              </div>
            </Paper>
          </section>
        </div>

        <div className="lp-bottom-grid">
          <div className="lp-left-column">
            <Paper className="lp-inventory" punched>
              <h2 className="lp-receipt-heading">Your stock</h2>
              <div className="lp-inventory-subhead">
                <h3>Packaging items</h3>
                <span>Example data</span>
              </div>
              <table>
                <caption className="sr-only">
                  Example stock counts. Select an item to see more.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">In stock</th>
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
                            <span className="lp-incoming">+15,000 ORDERED</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="lp-inventory-note">
                Days left = stock ÷ daily use.
                <br />
                New orders appear once confirmed.
              </p>
              <div className="lp-receipt-footer">
                <Barcode />
                <span>STOCK CHECK&nbsp; ≫</span>
              </div>
            </Paper>
            <section className="lp-ticker" aria-labelledby="lp-ticker-title">
              <h2 id="lp-ticker-title">
                Latest updates{" "}
                <span>
                  <i className="lp-status-dot" />
                  Demo
                </span>
              </h2>
              <p>
                <time>{activity[visibleEvents - 1][0]}</time>
                <span>{step.status}.</span>
              </p>
              <p>
                <time>17:54:20</time>
                <span>Your buyer is working.</span>
              </p>
              <p>
                <time>17:54:19</time>
                <span>Keeping an eye on your stock.</span>
              </p>
              <span className="lp-terminal-cursor" aria-hidden="true">
                &gt;&gt;&gt; <i />
              </span>
            </section>
          </div>

          <div className="lp-center-column">
            <section className="lp-resolution" aria-label="More stock, in time">
              <h2 className="lp-panel-label">
                <Screw />
                More stock, in time
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
                  <span>{isCovered ? "Due Sep 10" : "To buy"}</span>
                </div>
                <span className={`lp-covered-word ${isCovered ? "lp-green" : "lp-rust"}`}>
                  <PrintedDisplay text={isCovered ? "ORDERED" : "ON IT"} />
                  <span>{isCovered ? "✓ ORDER CONFIRMED" : "BUYER WORKING"}</span>
                </span>
              </Paper>
            </section>

            <section className="lp-printer" aria-labelledby="lp-feed-heading">
              <Screw className="lp-printer-screw" />
              <i className="lp-printer-led" aria-hidden="true" />
              <div className="lp-printer-roller" aria-hidden="true" />
              <Paper className="lp-feed-paper" punched>
                <h2 className="lp-receipt-heading" id="lp-feed-heading">
                  What your buyer did <span>↓</span>
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
                    Ready for the next step<span aria-hidden="true"> ▌</span>
                  </p>
                )}
                <div className="lp-feed-bottom">
                  {isCovered ? "ALL DONE" : "MORE TO COME"} <span>· · ·</span>
                </div>
              </Paper>
            </section>

            <div className="lp-output-row">
              <Paper className="lp-output" punched>
                <h2 className="lp-receipt-heading">Buyer update</h2>
                <div className="lp-output-content">
                  <div>
                    <strong className={`lp-output-stamp lp-${step.tone}`}>{step.output}</strong>
                    <p>
                      16 oz deli lids.
                      <br />
                      {isCovered ? "15,000 lids due Sep 10." : "15,000 more lids needed."}
                      <br />
                      {isCovered ? "Order confirmed." : "Your buyer is on it."}
                    </p>
                    <p>Keep the lines moving.</p>
                  </div>
                  <Robot small />
                </div>
              </Paper>
              <div className={`lp-seal ${isCovered ? "" : "lp-seal-pending"}`} aria-hidden="true">
                <span>ORDER CONFIRMED</span>
                <i>★</i>
                <strong>ORDERED</strong>
                <span>MORE LIDS COMING</span>
              </div>
            </div>
          </div>

          <div className="lp-right-column">
            <Paper className="lp-job-ticket">
              <div className="lp-hazard" aria-hidden="true" />
              <span className="lp-ticket-hole" aria-hidden="true" />
              <h2 className="lp-receipt-heading">Your order</h2>
              <div className="lp-job-id">
                PC-9258<span>LID-16-TE</span>
              </div>
              <ReceiptRows
                rows={[
                  ["Item", "16 oz Deli Lid"],
                  ["Quantity", "15,000 lids"],
                  ["Supplier", selectedStep >= 2 ? "Best Lids Co." : "Not chosen yet"],
                  ["Arrives", isCovered ? "Sep 10, 2026" : "Not confirmed"],
                ]}
              />
              <div className="lp-job-status">
                <span>Order status</span>
                <strong>
                  <i aria-hidden="true">★</i>
                  {step.status}
                  <i aria-hidden="true">★</i>
                </strong>
              </div>
              <ReceiptRows
                rows={[
                  ["Order no.", isCovered ? "PC-9258-8DAPKN" : "Not placed yet"],
                  ["Item match", selectedStep >= 2 ? "98%" : "Not checked"],
                  ["Your approval", isCovered ? "Approved" : "Needed"],
                  ["Pay within", "30 days"],
                  ["Deliver to", "Acme warehouse"],
                ]}
              />
              <Barcode />
              <p className="lp-ticket-thanks">
                THANK YOU! <span>01 / 01</span>
              </p>
            </Paper>
            <section className="lp-quick-controls" aria-labelledby="lp-quick-heading">
              <h2 id="lp-quick-heading">
                Try the demo
                <Screw />
              </h2>
              <button onClick={advanceDemo} aria-controls="lp-demo-steps">
                {selectedStep < 3 ? "Next demo step" : "Replay demo"}
                {selectedStep < 3 ? <ChevronRight size={13} /> : <RotateCcw size={12} />}
              </button>
              <a href="/legacy?demo=1">
                Open buy desk
                <ArrowUpRight size={13} />
              </a>
              <button onClick={() => showItem(inventory[1])}>
                See item details
                <ChevronRight size={13} />
              </button>
              <button onClick={() => showDialog("settings")}>
                Buyer settings
                <ChevronRight size={13} />
              </button>
            </section>
          </div>
        </div>

        <footer className="lp-console-footer">
          <span>
            <i className="lp-status-dot" />
            READY WHEN YOU ARE
          </span>
          <p>One less thing on your plate.</p>
          <span>AB—001 / BUILT TO KEEP GOING</span>
        </footer>
        <output className="sr-only" id="lp-demo-status" aria-live="polite">
          Step {selectedStep + 1} of 4: {step.title}. {step.detail}
        </output>
      </main>

      <footer className="lp-page-footer">
        <div>
          <span>BUILT TO KEEP YOUR BUSINESS MOVING.</span>
          <h2>Let your buyer handle the busywork.</h2>
          <p>Spot low stock, find a supplier, and approve the order.</p>
        </div>
        <a className="lp-start-button" href="/legacy/setup?method=passkey">
          Set up my company <ArrowUpRight size={20} />
        </a>
        <p className="lp-demo-disclosure">
          Try it out. Acme Foods and the numbers shown are examples.
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
          <span className="lp-dialog-eyebrow">ACME FOODS / EXAMPLE COMPANY</span>
          <h2 id="lp-dialog-title">
            {dialogContent === "item" ? selectedItem.name : "You decide when to buy."}
          </h2>
          {dialogContent === "item" ? (
            <>
              <p className="lp-dialog-code">{selectedItem.code}</p>
              <ReceiptRows
                rows={[
                  ["In stock", `${selectedItem.onHand} units`],
                  ["Used each day", `${selectedItem.daily} units`],
                  ["Days left", `${selectedItem.days} days`],
                  ["Status", selectedItem.status],
                  [
                    "Due to arrive",
                    selectedItem.code === "LID-16-TE" && isCovered
                      ? "15,000 · Sep 10"
                      : "Nothing ordered yet",
                  ],
                ]}
              />
              <p>
                Days left shows how long your current stock should last at your usual daily use. New
                orders are listed separately.
              </p>
              <a className="lp-dialog-action" href="/legacy?demo=1">
                Explore the buy desk
                <ArrowUpRight size={16} />
              </a>
            </>
          ) : (
            <>
              <p>
                Your buyer checks stock and finds suppliers. You decide when it can place an order.
              </p>
              <ReceiptRows
                rows={[
                  ["Order when under", "7 days of stock"],
                  ["Keep enough for", "30 days"],
                  ["Pay within", "30 days"],
                ]}
              />
              <label className="lp-setting">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(event) => setRequireApproval(event.target.checked)}
                />
                <span>
                  Ask me before placing orders
                  <small>
                    {requireApproval
                      ? "Every order waits for your OK."
                      : "Orders that follow your rules can go ahead."}
                  </small>
                </span>
              </label>
              <p className="lp-dialog-footnote">
                These are example settings. Set up your company to choose your own buying rules.
              </p>
              <a className="lp-dialog-action" href="/legacy/setup?method=passkey">
                Set up my company
                <ArrowUpRight size={16} />
              </a>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
