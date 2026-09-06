import { Navigate } from "@tanstack/react-router";
import { useAuthActions, useConvexAuth } from "@/lib/buyer-auth";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MoveUpRight,
  Package,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../../convex/_generated/api";
import { SourceSetup } from "./source-setup";
import { usePasskey } from "@convex-dev/auth2/providers/passkey/react";
import "./setup.css";

function focusQuestion(node: HTMLElement | null) {
  if (node && window.matchMedia("(pointer: fine)").matches) node.focus({ preventScroll: true });
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
  const { version } = useAuthActions();
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
  if (!isAuthenticated || !currentUser || currentUser.isJudgeDemo)
    return version === "passkey" ? (
      <PasskeyAccount judge={currentUser?.isJudgeDemo === true} />
    ) : (
      <AccountSetup mode={mode} judge={currentUser?.isJudgeDemo === true} />
    );
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
  if (currentUser.role !== "viewer")
    return (
      <SetupFrame chapter="Your account">
        <div className="bh-setup-question">
          <h1>A desk of your own.</h1>
          <p>You’re signed into the shared demo. Sign out to create a private company.</p>
          <SignOutForSetup />
        </div>
      </SetupFrame>
    );
  return <SourceSetup key={currentUser.userId} userId={currentUser.userId} />;
}
function SignOutForSetup() {
  const { signOut } = useAuthActions();
  return (
    <button className="bh-setup-primary" onClick={() => void signOut()}>
      Sign out <ArrowRight />
    </button>
  );
}
function PasskeyAccount({ judge }: { judge: boolean }) {
  const { signOut } = useAuthActions();
  const { signIn, pending } = usePasskey(
    {
      startSignIn: api.passkeyAuth.startSignIn,
      startAutofillSignIn: api.passkeyAuth.startAutofillSignIn,
      finishSignIn: api.passkeyAuth.finishSignIn,
      finishSignUp: api.passkeyAuth.finishSignUp,
    },
    { autofill: !judge },
  );
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (judge) await signOut();
    const result = await signIn({ username: username.trim().toLowerCase() });
    if (!result.success) {
      const code = result.userError.error;
      setError(
        code === "CEREMONY_ABORTED"
          ? "Passkey setup was cancelled. You can try again."
          : code === "WEBAUTHN_UNSUPPORTED"
            ? "Open this page in a browser that supports passkeys, such as Chrome or Safari."
            : "We couldn’t use that passkey. Check your account name and try again.",
      );
    }
  }
  return (
    <SetupFrame
      chapter="Your account"
      step="START HERE"
      progress={0}
      receipt={
        <div className="bh-setup-receipt-section">
          <span className="bh-setup-receipt-label">YOUR NEXT TWO MINUTES</span>
          <p>01 / Make it yours</p>
          <p>02 / Set up your company</p>
          <p>03 / Add a link or invoice</p>
          <p className="bh-setup-receipt-note">
            Your device holds your passkey. Your company holds the final say.
          </p>
        </div>
      }
    >
      <form className="bh-setup-form" onSubmit={submit}>
        <div className="bh-setup-question bh-setup-enter">
          <p className="bh-setup-eyebrow">LESS ADMIN. STARTING NOW.</p>
          <h1>
            Your buy desk
            <br />
            starts here.
          </h1>
          <p>Choose an account name. Your device will create a passkey to keep your desk yours.</p>
          <div className="bh-setup-input-wrap">
            <label className="sr-only" htmlFor="passkey-name">
              Account name
            </label>
            <input
              id="passkey-name"
              className="bh-setup-input"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              // WebAuthn is the standard conditional passkey autocomplete token.
              // oxlint-disable-next-line jsx-a11y/autocomplete-valid
              autoComplete="username webauthn"
              placeholder="Your account name"
              maxLength={120}
              required
              disabled={pending}
              ref={focusQuestion}
            />
          </div>
          <p className="bh-setup-error" role="alert">
            {error}
          </p>
        </div>
        <div className="bh-setup-controls">
          <button className="bh-setup-primary" disabled={pending}>
            {pending ? "Check your device…" : "Continue with passkey"}
            <ArrowRight />
          </button>
        </div>
        <p className="bh-setup-account-switch">
          Already have a passkey? Use the same account name.
        </p>
        <p className="bh-setup-account-switch">
          <a href="/setup?mode=login&method=password">
            Sign in to an existing password account <MoveUpRight />
          </a>
        </p>
      </form>
    </SetupFrame>
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
    mode === "login" ? (["email", "password"] as const) : (["email", "password"] as const);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const field = fields[index];
  const title =
    field === "email"
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
      progress={(index / 2) * 100}
      step={`${String(index + 1).padStart(2, "0")} / 02`}
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
            {field === "email"
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
              placeholder={field === "email" ? "you@company.com" : "Your password"}
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
          <a
            href={mode === "login" ? "/setup?method=passkey" : "/setup?mode=login&method=password"}
          >
            {mode === "login" ? "Create an account" : "Sign in"} <MoveUpRight />
          </a>
        </p>
      </form>
    </SetupFrame>
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
      step={email ? "✓" : "FINAL STEP"}
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
