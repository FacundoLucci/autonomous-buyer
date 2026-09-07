import { useState } from "react";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { errorText } from "./model";

export function PurchasingInbox({ email }: { email?: string }) {
  const list = useAction(api.companyMail.messages),
    read = useAction(api.companyMail.readMessage);
  const [messages, setMessages] = useState<FunctionReturnType<
    typeof api.companyMail.messages
  > | null>(null);
  const [message, setMessage] = useState<FunctionReturnType<
    typeof api.companyMail.readMessage
  > | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function run(job: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="desk-settings-section">
      <div className="desk-section-heading">
        <h2>Purchasing email</h2>
        {email && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setMessages(await list({}));
                setMessage(null);
              })
            }
          >
            {busy ? "Reading…" : "Read replies"}
          </Button>
        )}
      </div>
      <p className="desk-muted">{email ?? "Created when you send your first purchase order."}</p>
      {message ? (
        <article className="desk-mail-message">
          <Button variant="ghost" onClick={() => setMessage(null)}>
            Back to replies
          </Button>
          <h3>{message.subject || "No subject"}</h3>
          <p className="desk-muted">{message.from}</p>
          <p>{message.text}</p>
        </article>
      ) : messages?.length === 0 ? (
        <p className="desk-empty">No replies yet.</p>
      ) : (
        messages?.map((m) => (
          <button
            className="desk-mail-row"
            disabled={busy}
            key={m.id}
            onClick={() =>
              void run(async () => {
                setMessage(await read({ messageId: m.id }));
              })
            }
          >
            <span>{m.subject || "No subject"}</span>
            <small>{m.from}</small>
          </button>
        ))
      )}
      {error && (
        <p className="desk-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
