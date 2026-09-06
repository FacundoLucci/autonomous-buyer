import { useState } from "react";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { setupError } from "./setup";

export function CompanyInbox({ email }: { email: string | null }) {
  const provision = useAction(api.companyMail.provision),
    list = useAction(api.companyMail.messages),
    read = useAction(api.companyMail.readMessage);
  const [messages, setMessages] = useState<FunctionReturnType<
    typeof api.companyMail.messages
  > | null>(null);
  const [message, setMessage] = useState<FunctionReturnType<
    typeof api.companyMail.readMessage
  > | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(job: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="company-tools company-inbox bh-eink bh-cutout">
      <h2>Purchasing inbox</h2>
      {email ? (
        <>
          <p className="company-inbox-address">{email}</p>
          <p>Supplier quotes, purchase orders, and replies for your company.</p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setMessages(await list({}));
                setMessage(null);
              })
            }
          >
            {busy ? "Reading…" : "Read inbox"}
          </button>
        </>
      ) : (
        <>
          <p>
            Create your company’s dedicated address to send purchase orders and receive supplier
            replies.
          </p>
          <button disabled={busy} onClick={() => void run(() => provision({}))}>
            {busy ? "Connecting…" : "Connect purchasing inbox"}
          </button>
        </>
      )}
      {messages !== null ? (
        <div>
          {messages.length === 0 ? (
            <p>No messages yet.</p>
          ) : (
            messages.map((m) => (
              <button
                key={m.id}
                className="company-mail-item"
                disabled={busy}
                onClick={() => void run(async () => setMessage(await read({ messageId: m.id })))}
              >
                <strong>{m.subject || "No subject"}</strong>
                <small>{m.from}</small>
                <small>{m.preview}</small>
              </button>
            ))
          )}
        </div>
      ) : null}
      {message ? (
        <article className="company-mail-body">
          <h3>{message.subject}</h3>
          <p>{message.from}</p>
          <p className="company-preserve-lines">{message.text}</p>
        </article>
      ) : null}
      <p role="alert" className="company-error">
        {error}
      </p>
    </div>
  );
}
