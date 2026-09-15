import { useState } from "react";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { errorText, money } from "./model";

type Connection = FunctionReturnType<typeof api.browserPayments.status>;

export function PurchasingPayments() {
  const connect = useAction(api.browserPayments.connect);
  const status = useAction(api.browserPayments.status);
  const disconnect = useAction(api.browserPayments.disconnect);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "connect" | "check" | "disconnect") {
    setBusy(true);
    setError(null);
    try {
      if (action === "disconnect") {
        await disconnect({});
        setConnection(null);
      } else setConnection(await (action === "connect" ? connect({}) : status({})));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="desk-settings-section" aria-label="Pay for purchases">
      <h2>Pay for purchases</h2>
      <p>
        Connect your card through Link. Approve the store and amount, and the buyer handles
        checkout.
      </p>
      <p className="desk-muted">
        Your card stays with Link. The store receives a card made for that purchase. Cards already
        saved with a supplier can also be used during checkout.
      </p>
      {connection?.connected ? (
        <>
          <output>
            Link connected{connection.mode === "test" ? " · Test payments only" : ""}.
          </output>
          {connection.limitCents && (
            <p className="desk-muted">
              Link currently allows up to {money(connection.limitCents, connection.currency)} per
              request. Link also applies account and daily limits.
            </p>
          )}
          <Button variant="outline" disabled={busy} onClick={() => void run("disconnect")}>
            Disconnect Link
          </Button>
        </>
      ) : (
        <div className="desk-answer-actions">
          <Button disabled={busy} onClick={() => void run("connect")}>
            {busy ? "Connecting…" : connection?.url ? "Get a new Link connection" : "Connect Link"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void run("check")}>
            Check connection
          </Button>
        </div>
      )}
      {!connection?.connected && connection?.url && (
        <div className="desk-section">
          {connection.code && (
            <p>
              Confirm this phrase on Link: <strong>{connection.code}</strong>
            </p>
          )}
          <a
            className="desk-inline-link"
            href={connection.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Continue securely on Link ↗
          </a>
          <p className="desk-muted">Return here and check the connection when you finish.</p>
          {connection.mode === "test" && (
            <p>Test mode. This connection cannot fund a real purchase.</p>
          )}
        </div>
      )}
      <p className="desk-muted">
        Link’s agent wallet currently supports US accounts. Merchant availability and payment limits
        are checked for each purchase.
      </p>
      {error && (
        <p role="alert" className="desk-error">
          {error}
        </p>
      )}
    </section>
  );
}
