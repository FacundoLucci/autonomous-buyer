import { useState, type FormEvent } from "react";
import { Navigate } from "@tanstack/react-router";
import { usePasskey } from "@convex-dev/auth2/providers/passkey/react";
import { useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useAuthActions, useConvexAuth } from "@/lib/buyer-auth";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "./floating-input";
import { Brand, Loading } from "./primitives";
import { TaskChat } from "./chat";
import { errorText } from "./model";
import { InvitationPending } from "./invitation";
export function AccountPage({ mode }: { mode: "signup" | "login" }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { version, signOut } = useAuthActions();
  const [accountError, setAccountError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const user = useQuery(api.authData.getCurrentUser, isAuthenticated ? {} : "skip");
  const workspace = useQuery(api.onboarding.getWorkspace, isAuthenticated ? {} : "skip");
  const invitation = useQuery(api.onboardingAccess.current, isAuthenticated ? {} : "skip");
  if (
    !authenticating &&
    (isLoading ||
      (isAuthenticated &&
        (user === undefined || workspace === undefined || invitation === undefined)))
  )
    return <Loading />;
  if (workspace)
    return (
      <Navigate
        to="/"
        search={{ demo: false, page: "dashboard", item: undefined, buy: undefined }}
        replace
      />
    );
  if (isAuthenticated && invitation) return <InvitationPending request={invitation} />;
  return (
    <main className="desk-public">
      <header className="desk-public-header">
        <Brand />
        <a className="desk-text-link" href="/">
          Close ×
        </a>
      </header>
      {isAuthenticated && user && !user.isJudgeDemo && !user.canApproveDemo ? (
        <section className="desk-onboarding">
          <p className="desk-eyebrow">INVITE-ONLY EARLY ACCESS · COMPANY DETAILS</p>
          <h1>Tell us about your business.</h1>
          <p className="desk-setup-intro">
            We’ll save these details, then you can schedule time with Facundo to finish onboarding.
            Your workspace opens by invitation.
          </p>
          <p>{user.email ?? user.name}</p>
          <a className="desk-secondary-link" href="/">
            Finish later
          </a>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await signOut();
              } catch (e) {
                setAccountError(errorText(e));
              }
            }}
          >
            Use another account
          </Button>
          {accountError && (
            <p className="desk-error" role="alert">
              {accountError}
            </p>
          )}
          <TaskChat
            request={{ task: "onboarding" }}
            onSaved={() => {
              window.location.href = "/setup";
            }}
          />
        </section>
      ) : (
        <section className="desk-account">
          <p className="desk-eyebrow">
            {mode === "login" ? "YOUR BUY DESK" : "INVITE-ONLY EARLY ACCESS"}
          </p>
          <h1>{mode === "login" ? "Sign in." : "Request your invitation."}</h1>
          {mode === "signup" && (
            <p className="desk-setup-intro">
              Create your account and tell us about your business. Then finish onboarding with
              Facundo before your workspace opens.
            </p>
          )}
          {isAuthenticated && <p>Demo access is separate from your own account.</p>}
          {version === "passkey" ? (
            <PasskeyForm mode={mode} onBusyChange={setAuthenticating} />
          ) : (
            <PasswordForm mode={mode} onBusyChange={setAuthenticating} />
          )}
          <a
            className="desk-secondary-link"
            href={`/setup?mode=${mode === "login" ? "signup" : "login"}&method=${version}`}
          >
            {mode === "login"
              ? "New here? Request an invitation"
              : "Already have an account? Sign in"}
          </a>
        </section>
      )}
    </main>
  );
}
function PasskeyForm({
  mode,
  onBusyChange,
}: {
  mode: "signup" | "login";
  onBusyChange: (busy: boolean) => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const { signIn, pending } = usePasskey(
    {
      startSignIn: api.passkeyAuth.startSignIn,
      startAutofillSignIn: api.passkeyAuth.startAutofillSignIn,
      finishSignIn: api.passkeyAuth.finishSignIn,
      finishSignUp: api.passkeyAuth.finishSignUp,
    },
    { autofill: !isAuthenticated && mode === "login" },
  );
  const [username, setUsername] = useState(""),
    [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSwitching(true);
    onBusyChange(true);
    try {
      if (isAuthenticated) await signOut();
      const result = await signIn({ username: username.trim().toLowerCase() });
      if (!result.success)
        setError(
          result.userError.error === "CEREMONY_ABORTED"
            ? "Passkey cancelled. Try again when you’re ready."
            : "We couldn’t use that passkey. Check your email and try again.",
        );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSwitching(false);
      onBusyChange(false);
    }
  }
  return (
    <form onSubmit={submit} className="desk-auth-form">
      <FloatingInput
        id="passkey-email"
        label="Email"
        type="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        autoComplete="username webauthn"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        maxLength={254}
      />
      <Button type="submit" disabled={switching || pending || !username.trim()}>
        {switching || pending
          ? "Connecting…"
          : mode === "login"
            ? "Sign in with passkey"
            : "Create account"}
        <ArrowRight size={17} />
      </Button>
      {error && (
        <p role="alert" className="desk-error">
          {error}
        </p>
      )}
      <a className="desk-secondary-link" href={`/setup?mode=${mode}&method=password`}>
        Use a password instead
      </a>
    </form>
  );
}
function PasswordForm({
  mode,
  onBusyChange,
}: {
  mode: "signup" | "login";
  onBusyChange: (busy: boolean) => void;
}) {
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      if (isAuthenticated) await signOut();
      await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: mode === "login" ? "signIn" : "signUp",
      });
      setPassword("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <form onSubmit={submit} className="desk-auth-form">
      <FloatingInput
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <FloatingInput
        id="password"
        label="Password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" disabled={busy}>
        {busy ? "Connecting…" : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      {error && (
        <p role="alert" className="desk-error">
          {error}
        </p>
      )}
      <a className="desk-secondary-link" href={`/setup?mode=${mode}&method=passkey`}>
        Use a passkey instead
      </a>
    </form>
  );
}
