import { Navigate } from "@tanstack/react-router";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MoveUpRight,
  Package,
  Undo2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../../convex/_generated/api";
import {
  emptySetup,
  setupFieldError,
  stockOutlook,
  units,
  type CompanySetup,
} from "@/lib/setup-fields";
import "./setup.css";

type Step = keyof CompanySetup;
const questions: {
  field: Step;
  chapter: string;
  title: string;
  hint: string;
  placeholder?: string;
  suffix?: string;
}[] = [
  {
    field: "companyName",
    chapter: "Your company",
    title: "Who are we buying for?",
    hint: "The name that goes on your workspace and purchase orders.",
    placeholder: "Company name",
  },
  {
    field: "shippingAddress",
    chapter: "Your company",
    title: "Where should it all arrive?",
    hint: "Your full delivery address, including the country.",
    placeholder: "Street address\nCity, region, postal code\nCountry",
  },
  {
    field: "itemName",
    chapter: "First inventory item",
    title: "What can’t you run out of?",
    hint: "Start with one essential. You can build from here.",
    placeholder: "e.g. 16 oz deli lids",
  },
  {
    field: "sku",
    chapter: "First inventory item",
    title: "What’s its item code?",
    hint: "Use your existing SKU, or keep the one we suggested.",
    placeholder: "e.g. LID-16",
  },
  {
    field: "unit",
    chapter: "First inventory item",
    title: "How do you count it?",
    hint: "Use the same unit for stock on hand and daily usage.",
  },
  {
    field: "quantity",
    chapter: "First inventory item",
    title: "How much is on the shelf?",
    hint: "Your current stock count. Zero is a valid starting point.",
    placeholder: "0",
    suffix: "unit",
  },
  {
    field: "dailyUsage",
    chapter: "First inventory item",
    title: "How much do you use a day?",
    hint: "An estimate is fine. We’ll use it to work out how long your stock lasts.",
    placeholder: "0",
    suffix: "per day",
  },
  {
    field: "leadTimeDays",
    chapter: "First inventory item",
    title: "How long does a refill take?",
    hint: "Days from placing an order to receiving it. Your best estimate is fine.",
    suffix: "days",
  },
  {
    field: "safetyStockDays",
    chapter: "First inventory item",
    title: "How much breathing room?",
    hint: "Extra days of stock to keep in reserve when a delivery runs late.",
    suffix: "days",
  },
];
function focusQuestion(node: HTMLElement | null) {
  if (node && window.matchMedia("(pointer: fine)").matches) node.focus({ preventScroll: true });
}

const DRAFT_KEY = "buy-hard-company-setup-v1";

function readDraft(): CompanySetup {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return { ...emptySetup };
    const draft = { ...emptySetup };
    for (const key of Object.keys(draft) as Step[]) {
      const value = (saved as Record<string, unknown>)[key];
      if (
        typeof value === "string" &&
        value.length <= 500 &&
        (key !== "unit" || units.includes(value as CompanySetup["unit"]))
      ) {
        Object.assign(draft, { [key]: value });
      }
    }
    return draft;
  } catch {
    return { ...emptySetup };
  }
}

export function setupError(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "That didn’t go through. Check your connection and try again.";
}

export function SetupFrame({
  children,
  receipt,
  chapter = "Your company",
  progress = 0,
  step = "01",
  footer,
}: {
  children: React.ReactNode;
  receipt?: React.ReactNode;
  chapter?: string;
  progress?: number;
  step?: string;
  footer?: React.ReactNode;
}) {
  return (
    <main className="bh-app powder-coat bh-setup">
      <header className="bh-app-bar bh-setup-bar">
        <a href="/" className="buy-desk-brand" aria-label="BUY HARD home">
          <span className="bh-stamped">BUY HARD</span>
        </a>
        <span className="bh-face-caption screen-print">A little setup. A lot less chasing.</span>
        <a className="bh-setup-exit" href="/">
          Close <span aria-hidden="true">×</span>
        </a>
      </header>
      <div className="bh-setup-shell">
        <div className="bh-setup-label screen-print">
          <span>BUY DESK / INITIAL SETUP</span>
          <span>MADE FOR YOUR BUSINESS</span>
        </div>
        <div className="bh-setup-device">
          <section className="bh-eink bh-cutout bh-setup-screen" aria-label="Company setup">
            <div className="bh-setup-screen-top">
              <span>
                <i aria-hidden="true" />
                {chapter}
              </span>
              <span>{step}</span>
            </div>
            <progress
              className="sr-only"
              aria-label="Setup progress"
              value={Math.round(progress)}
              max={100}
            />
            <div className="bh-setup-progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
            {children}
          </section>
          <aside className="bh-setup-receipt-wrap" aria-label="Your setup receipt">
            <div className="bh-setup-printer-slot" />
            <div className="bh-receipt bh-setup-receipt">
              <div className="bh-setup-receipt-brand">
                BUY HARD<span>YOUR BUY DESK, TAKING SHAPE.</span>
              </div>
              {receipt ?? (
                <>
                  <div className="bh-setup-receipt-empty">
                    <Package strokeWidth={1} />
                    <p>
                      A company.
                      <br />
                      An essential.
                      <br />A head start.
                    </p>
                  </div>
                  <p className="bh-setup-receipt-note">
                    Your setup will appear here,
                    <br />
                    one answer at a time.
                  </p>
                </>
              )}
              <div className="bh-setup-barcode" aria-hidden="true" />
              <p className="bh-setup-receipt-note">LESS CHASING. MORE DOING.</p>
            </div>
          </aside>
        </div>
        <footer className="bh-setup-base screen-print">
          {footer ?? (
            <>
              <span>
                <LockKeyhole /> Private to your company
              </span>
              <span>YOU KEEP THE FINAL SAY.</span>
            </>
          )}
        </footer>
      </div>
    </main>
  );
}

export function Setup({ mode }: { mode: "signup" | "login" }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  const workspace = useQuery(api.onboarding.getWorkspace, isAuthenticated ? {} : "skip");
  if (isLoading || (isAuthenticated && (currentUser === undefined || workspace === undefined))) {
    return (
      <SetupFrame chapter="Connecting" step="—">
        <div className="bh-setup-question">
          <p className="bh-setup-eyebrow">PICKING UP WHERE YOU LEFT OFF</p>
          <h1>Opening your setup.</h1>
        </div>
      </SetupFrame>
    );
  }
  if (mode === "login" && (!isAuthenticated || !currentUser || currentUser.isJudgeDemo))
    return <AccountSetup mode={mode} judge={currentUser?.isJudgeDemo === true} />;
  if (workspace && mode === "login")
    return (
      <Navigate
        to="/"
        search={{ demo: false, view: "procurement", tour: undefined, procurement: undefined }}
        replace
      />
    );
  if (workspace)
    return (
      <WorkspaceReady
        companyName={workspace.companyName}
        email={workspace.inbox?.email ?? null}
        itemName={workspace.items[0]?.name ?? "Your inventory"}
      />
    );
  if (mode === "login" && currentUser && currentUser.role !== "viewer") {
    return (
      <SetupFrame chapter="Your account">
        <div className="bh-setup-question">
          <h1>Welcome back.</h1>
          <a href="/" className="bh-setup-primary">
            Open buy desk <ArrowRight />
          </a>
        </div>
      </SetupFrame>
    );
  }
  return (
    <CompanyQuestions
      key={currentUser?.userId ?? "new-company"}
      needsAccount={
        !isAuthenticated || !currentUser || currentUser.isJudgeDemo || currentUser.role !== "viewer"
      }
      hasSession={isAuthenticated}
    />
  );
}

function AccountSetup({
  mode,
  judge,
  receipt,
  onBack,
}: {
  mode: "signup" | "login";
  judge: boolean;
  receipt?: React.ReactNode;
  onBack?: () => void;
}) {
  const { signIn, signOut } = useAuthActions();
  const fields =
    mode === "login" ? (["email", "password"] as const) : (["name", "email", "password"] as const);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const field = fields[index];
  const title =
    field === "name"
      ? "Who’s running the buy desk?"
      : field === "email"
        ? "What’s your work email?"
        : mode === "login"
          ? "Welcome back."
          : "Make this desk yours.";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!values[field].trim()) {
      setError("Add an answer to continue.");
      return;
    }
    if (field === "password" && mode === "signup" && values.password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (index < fields.length - 1) {
      setIndex(index + 1);
      return;
    }
    setBusy(true);
    try {
      if (judge) await signOut();
      await signIn("password", {
        ...values,
        email: values.email.trim().toLowerCase(),
        flow: mode === "login" ? "signIn" : "signUp",
      });
      setValues((previous) => ({ ...previous, password: "" }));
    } catch {
      setError(
        mode === "login"
          ? "We couldn’t sign you in. Check your email and password."
          : "We couldn’t create your account. If you already have one, sign in below.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SetupFrame
      chapter="Your account"
      receipt={receipt}
      progress={mode === "login" ? (index / 2) * 100 : ((index + 9) / 14) * 100}
      step={`${String(index + (mode === "login" ? 1 : 10)).padStart(2, "0")} / ${mode === "login" ? "02" : "14"}`}
    >
      <form className="bh-setup-form" onSubmit={submit}>
        <div className="bh-setup-question bh-setup-enter" key={field}>
          <p className="bh-setup-eyebrow">
            {mode === "login" ? "BACK TO BUSINESS" : "LET’S GET YOU SETTLED"}
          </p>
          <h1>
            <label htmlFor={`setup-${field}`}>{title}</label>
          </h1>
          <p id="account-hint">
            {field === "name"
              ? "Your company and first item are ready. Let’s make them yours."
              : field === "email"
                ? "You’ll use this to sign in. Your purchasing inbox comes later."
                : mode === "login"
                  ? "Enter your password to open your buy desk."
                  : "Choose a password with at least 8 characters."}
          </p>
          <div className="bh-setup-input-wrap">
            <input
              id={`setup-${field}`}
              name={field}
              type={
                field === "password"
                  ? visible
                    ? "text"
                    : "password"
                  : field === "email"
                    ? "email"
                    : "text"
              }
              className="bh-setup-input"
              autoComplete={
                field === "password"
                  ? mode === "login"
                    ? "current-password"
                    : "new-password"
                  : field
              }
              value={values[field]}
              placeholder={
                field === "name"
                  ? "Your name"
                  : field === "email"
                    ? "you@company.com"
                    : "Your password"
              }
              onChange={(e) => {
                setError(null);
                setValues({ ...values, [field]: e.target.value });
              }}
              ref={focusQuestion}
              aria-describedby="account-hint setup-error"
              aria-invalid={!!error}
              disabled={busy}
              required
              maxLength={field === "password" ? 256 : 120}
            />
            {field === "password" ? (
              <button
                type="button"
                className="bh-setup-password"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff /> : <Eye />}
              </button>
            ) : null}
          </div>
          <p className="bh-setup-error" id="setup-error" role="alert">
            {error}
          </p>
        </div>
        <div className="bh-setup-controls">
          <button
            type="button"
            className="bh-setup-back"
            aria-label="Previous question"
            disabled={(index === 0 && !onBack) || busy}
            onClick={() => {
              if (index === 0) onBack?.();
              else setIndex(index - 1);
              setError(null);
            }}
          >
            <ArrowLeft />
          </button>
          <button className="bh-setup-primary" disabled={busy}>
            {busy
              ? "Connecting…"
              : index === fields.length - 1
                ? mode === "login"
                  ? "Sign in"
                  : "Create account"
                : "Continue"}
            <ArrowRight />
          </button>
          <span className="bh-setup-key">
            press <kbd>Enter ↵</kbd>
          </span>
        </div>
        <p className="bh-setup-account-switch">
          {mode === "login" ? "New around here?" : "Already have a desk?"}{" "}
          <a href={mode === "login" ? "/setup" : "/setup?mode=login"}>
            {mode === "login" ? "Create an account" : "Sign in"} <MoveUpRight />
          </a>
        </p>
      </form>
    </SetupFrame>
  );
}

function CompanyQuestions({
  needsAccount,
  hasSession,
}: {
  needsAccount: boolean;
  hasSession: boolean;
}) {
  const [draft, setDraft] = useState(readDraft);
  const [index, setIndex] = useState(() => {
    const saved = readDraft();
    const firstMissing = questions.findIndex((question) =>
      setupFieldError(question.field, saved[question.field]),
    );
    return firstMissing < 0 ? questions.length : firstMissing;
  });
  const [accountStage, setAccountStage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const complete = useMutation(api.onboarding.complete);
  const current = questions[index];
  const review = index === questions.length;
  const [editing, setEditing] = useState(false);
  function update(field: Step, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setError(null);
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      /* Setup works without browser storage. */
    }
  }
  function next() {
    const message = setupFieldError(current.field, draft[current.field]);
    if (message) {
      setError(message);
      return;
    }
    if (current.field === "itemName" && !draft.sku)
      update(
        "sku",
        draft.itemName
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 32) || "ITEM-001",
      );
    setIndex(editing ? questions.length : index + 1);
    setEditing(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!review) {
      next();
      return;
    }
    for (const [i, question] of questions.entries()) {
      const message = setupFieldError(question.field, draft[question.field]);
      if (message) {
        setIndex(i);
        setError(message);
        return;
      }
    }
    if (needsAccount) {
      setAccountStage(true);
      return;
    }
    setBusy(true);
    try {
      await complete({ ...draft, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* No persistent draft to clear. */
      }
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  function edit(field: Step) {
    setAccountStage(false);
    setEditing(review);
    setIndex(questions.findIndex((q) => q.field === field));
    setError(null);
  }
  const receipt = <SetupReceipt draft={draft} edit={edit} />;
  if (accountStage && needsAccount)
    return (
      <AccountSetup
        mode="signup"
        judge={hasSession}
        receipt={receipt}
        onBack={() => setAccountStage(false)}
      />
    );
  return (
    <SetupFrame
      chapter={review ? "Ready for a first look" : current.chapter}
      progress={((review ? (needsAccount ? 9 : 12) : index) / 14) * 100}
      step={review ? "REVIEW" : `${String(index + 1).padStart(2, "0")} / 14`}
      receipt={receipt}
    >
      <form className="bh-setup-form" onSubmit={submit}>
        <div className="bh-setup-question bh-setup-enter" key={review ? "review" : current.field}>
          <p className="bh-setup-eyebrow">
            {review
              ? "ONE LAST LOOK"
              : `${current.chapter === "Your company" ? "01" : "02"} / ${current.chapter.toUpperCase()}`}
          </p>
          <h1>
            {review ? (
              "Looks like your kind of desk."
            ) : (
              <label htmlFor={`setup-${current.field}`}>{current.title}</label>
            )}
          </h1>
          <p id="question-hint">
            {review
              ? "Your company and first item are ready to save. Next, we’ll connect your dedicated purchasing inbox."
              : current.hint}
          </p>
          {review ? (
            <div className="bh-setup-review">
              <p>
                <Check /> {draft.companyName}
              </p>
              <p>
                <Package /> {draft.itemName} · {Number(draft.quantity).toLocaleString()}{" "}
                {draft.unit}
              </p>
              <p>
                <Mail /> A dedicated purchasing email
              </p>
              <p className="bh-setup-review-note">
                You approve purchases. Nothing is ordered during setup.
              </p>
            </div>
          ) : current.field === "unit" ? (
            <fieldset className="bh-setup-unit-options">
              <legend className="sr-only">How do you count it?</legend>
              {units.map((unit, i) => (
                <label key={unit} data-selected={draft.unit === unit}>
                  <input
                    type="radio"
                    ref={draft.unit === unit ? focusQuestion : undefined}
                    onKeyDown={(event) => {
                      const choice = units[Number(event.key) - 1];
                      if (/^[1-5]$/.test(event.key) && choice) {
                        event.preventDefault();
                        update("unit", choice);
                      }
                    }}
                    name="unit"
                    value={unit}
                    checked={draft.unit === unit}
                    onChange={() => update("unit", unit)}
                  />
                  <span className="bh-setup-option-key">{i + 1}</span>
                  <span>{unit[0].toUpperCase() + unit.slice(1)}</span>
                  {draft.unit === unit ? <Check /> : null}
                </label>
              ))}
            </fieldset>
          ) : current.field === "shippingAddress" ? (
            <textarea
              id={`setup-${current.field}`}
              className="bh-setup-input bh-setup-address"
              rows={3}
              value={draft.shippingAddress}
              placeholder={current.placeholder}
              onChange={(e) => update("shippingAddress", e.target.value)}
              aria-describedby="question-hint setup-error"
              aria-invalid={!!error}
              autoComplete="street-address"
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  next();
                }
              }}
              ref={focusQuestion}
            />
          ) : (
            <div className="bh-setup-input-wrap">
              <input
                id={`setup-${current.field}`}
                name={current.field}
                className="bh-setup-input"
                value={draft[current.field]}
                onChange={(e) => update(current.field, e.target.value)}
                placeholder={current.placeholder}
                type={current.suffix ? "number" : "text"}
                min={current.suffix ? 0 : undefined}
                step={current.field.endsWith("Days") ? 1 : "any"}
                max={
                  current.field.endsWith("Days") ? 365 : current.suffix ? 1_000_000_000 : undefined
                }
                autoComplete={current.field === "companyName" ? "organization" : "off"}
                aria-describedby="question-hint setup-error"
                aria-invalid={!!error}
                maxLength={current.field === "sku" ? 64 : 120}
                ref={focusQuestion}
              />
              {current.suffix ? (
                <span className="bh-setup-input-suffix">
                  {current.suffix === "unit"
                    ? draft.unit
                    : current.suffix === "per day"
                      ? `${draft.unit} / day`
                      : current.suffix}
                </span>
              ) : null}
            </div>
          )}
          <p className="bh-setup-error" id="setup-error" role="alert">
            {error}
          </p>
        </div>
        <div className="bh-setup-controls">
          <button
            className="bh-setup-back"
            type="button"
            disabled={index === 0 || busy}
            aria-label="Previous question"
            onClick={() => {
              setIndex(index - 1);
              setError(null);
              setEditing(false);
            }}
          >
            <ArrowLeft />
          </button>
          <button className="bh-setup-primary" disabled={busy}>
            {busy
              ? "Saving your desk…"
              : review
                ? needsAccount
                  ? "Make this desk mine"
                  : "Create my buy desk"
                : editing
                  ? "Save answer"
                  : "Continue"}
            <ArrowRight />
          </button>
          <span className="bh-setup-key">
            press <kbd>Enter ↵</kbd>
          </span>
        </div>
        <p className="bh-setup-account-switch">
          {current?.field === "shippingAddress"
            ? "Shift + Enter for a new line"
            : "Your answers stay here if you step away."}
        </p>
      </form>
    </SetupFrame>
  );
}

function SetupReceipt({ draft, edit }: { draft: CompanySetup; edit: (field: Step) => void }) {
  const outlook =
    draft.quantity !== "" && draft.dailyUsage !== ""
      ? stockOutlook(
          Number(draft.quantity),
          Number(draft.dailyUsage),
          Number(draft.leadTimeDays),
          Number(draft.safetyStockDays),
        )
      : null;
  return (
    <>
      <div className="bh-setup-receipt-section">
        <span className="bh-setup-receipt-label">COMPANY</span>
        <button type="button" onClick={() => edit("companyName")}>
          {draft.companyName || "Your company"}
          <Undo2 />
        </button>
        {draft.shippingAddress ? (
          <button
            type="button"
            className="bh-setup-receipt-address"
            onClick={() => edit("shippingAddress")}
          >
            {draft.shippingAddress}
            <Undo2 />
          </button>
        ) : (
          <p className="bh-setup-receipt-placeholder">Delivery address to follow.</p>
        )}
      </div>
      <div className="bh-setup-receipt-section">
        <span className="bh-setup-receipt-label">ITEM / 001</span>
        <button type="button" onClick={() => edit("itemName")}>
          {draft.itemName || "Your first essential"}
          <Undo2 />
        </button>
        {draft.sku ? (
          <button type="button" className="bh-setup-receipt-address" onClick={() => edit("sku")}>
            {draft.sku}
            <Undo2 />
          </button>
        ) : null}
        {(
          [
            [
              "quantity",
              "On hand",
              draft.quantity ? `${Number(draft.quantity).toLocaleString()} ${draft.unit}` : "—",
            ],
            [
              "dailyUsage",
              "Daily use",
              draft.dailyUsage ? `${Number(draft.dailyUsage).toLocaleString()} ${draft.unit}` : "—",
            ],
            ["leadTimeDays", "Lead time", `${draft.leadTimeDays} days`],
            ["safetyStockDays", "Safety stock", `${draft.safetyStockDays} days`],
          ] as [Step, string, string][]
        ).map(([key, label, value]) => (
          <button
            className="bh-setup-receipt-row"
            key={key}
            type="button"
            onClick={() => edit(key)}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
      {outlook ? (
        <div className="bh-setup-receipt-outlook">
          <span>ESTIMATED COVERAGE</span>
          <strong>
            {outlook.daysLeft === null
              ? "No daily usage yet"
              : `${Math.round(outlook.daysLeft * 10) / 10} days`}
          </strong>
          <p>
            {outlook.daysLeft === null
              ? "Add daily usage when you know it."
              : `Reorder at ${Math.ceil(outlook.reorderAt).toLocaleString()} ${draft.unit}.`}
          </p>
        </div>
      ) : null}
    </>
  );
}

function WorkspaceReady({
  companyName,
  email,
  itemName,
}: {
  companyName: string;
  email: string | null;
  itemName: string;
}) {
  const provision = useAction(api.companyMail.provision);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function connect() {
    setBusy(true);
    setError(null);
    try {
      await provision({});
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SetupFrame
      chapter={email ? "Ready for business" : "Your purchasing inbox"}
      step={email ? "✓" : "14 / 14"}
      progress={email ? 100 : 96}
      receipt={
        <>
          <div className="bh-setup-receipt-section">
            <span className="bh-setup-receipt-label">COMPANY CREATED</span>
            <h2>{companyName}</h2>
          </div>
          <div className="bh-setup-receipt-section">
            <span className="bh-setup-receipt-label">INVENTORY SAVED</span>
            <p>{itemName}</p>
          </div>
          <div className="bh-setup-receipt-section">
            <span className="bh-setup-receipt-label">PURCHASING EMAIL</span>
            <p>{email ?? "Ready to connect"}</p>
          </div>
        </>
      }
    >
      <div className="bh-setup-form">
        <div className="bh-setup-question bh-setup-enter">
          <div className="bh-setup-ready-icon">{email ? <CheckCheck /> : <Mail />}</div>
          <p className="bh-setup-eyebrow">
            {email ? "SETUP COMPLETE" : "YOUR COMPANY AND ITEM ARE SAVED"}
          </p>
          <h1>{email ? "You’re in business." : "Give your buyer an inbox."}</h1>
          <p>
            {email
              ? "Your company, first inventory item, and purchasing address are ready. Let’s open your desk."
              : "Create a dedicated address for supplier quotes and order confirmations. We’ll handle the setup."}
          </p>
          {email ? (
            <div className="bh-setup-email">{email}</div>
          ) : (
            <p className="bh-setup-review-note">
              No separate email account needed. No messages sent during setup.
            </p>
          )}
          <p className="bh-setup-error" role="alert">
            {error}
          </p>
        </div>
        <div className="bh-setup-controls">
          {email ? (
            <a className="bh-setup-primary" href="/">
              Open my buy desk <ArrowRight />
            </a>
          ) : (
            <button className="bh-setup-primary" disabled={busy} onClick={() => void connect()}>
              {busy
                ? "Creating your inbox…"
                : error
                  ? "Try inbox setup again"
                  : "Create purchasing inbox"}
              <ArrowRight />
            </button>
          )}
        </div>
        {!email ? (
          <a className="bh-setup-account-switch" href="/">
            Open my desk and connect later
          </a>
        ) : null}
      </div>
    </SetupFrame>
  );
}
