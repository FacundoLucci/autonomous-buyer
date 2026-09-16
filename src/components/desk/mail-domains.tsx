import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { errorText } from "./model";
export function MailDomains() {
  const domain = useQuery(api.mailDomains.current);
  const connect = useAction(api.mailDomains.connect),
    check = useAction(api.mailDomains.check),
    setup = useAction(api.mailDomains.setupLink),
    provision = useAction(api.companyMail.provision);
  const [name, setName] = useState(""),
    [username, setUsername] = useState("buyer"),
    [owns, setOwns] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const [link, setLink] = useState<{
    url: string | null;
    provider: string;
    conflict: string;
  } | null>(null);
  async function run(job: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await job();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="desk-mail-settings desk-mail-domain">
      <summary>Use your own email domain</summary>
      <p>Your buyer can start with the included address, or use your company’s domain.</p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const result = await provision({});
            setNote(`Your buyer’s address: ${result.email}`);
          })
        }
      >
        {domain?.inboxId ? "Show current address" : "Use included address"}
      </Button>
      <p className="desk-muted">
        We recommend a separate subdomain, such as purchasing.acme.com, to keep your existing Gmail
        or Outlook email working.
      </p>
      {domain === undefined ? (
        <p>Loading domain setup…</p>
      ) : domain ? (
        <>
          <h3>
            {domain.username}@{domain.domain}
          </h3>
          <p>
            {domain.inboxId
              ? "Connected. New purchases use this address. Previous addresses remain available for existing conversations."
              : domain.status === "verified"
                ? "Domain verified. Check setup to finish creating your inbox."
                : "Waiting for domain verification. Your current email keeps working."}
          </p>
          {!domain.inboxId && (
            <>
              <p>
                Add these exact records at your DNS provider. Do not replace the records for your
                existing business email.
              </p>
              {domain.records.map((r, i) => (
                <div className="desk-mail-dns" key={`${r.name}-${i}`}>
                  <strong>
                    {r.type}
                    {r.priority !== undefined ? ` · priority ${r.priority}` : ""}
                  </strong>
                  <label>
                    Name<code>{r.name}</code>
                  </label>
                  <label>
                    Value<code>{r.value}</code>
                  </label>
                  <span className="desk-muted">{r.status}</span>
                </div>
              ))}
              {!domain.records.length && (
                <p>Registration has not finished. Check setup to recover it safely.</p>
              )}
              <div className="desk-mail-actions">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await check({});
                      setNote(
                        "Checked. Setup will also check automatically for about an hour; you can check again whenever DNS is ready.",
                      );
                    })
                  }
                >
                  Check verification
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !domain.providerId}
                  onClick={() => void run(async () => setLink(await setup({})))}
                >
                  Find automatic DNS setup
                </Button>
              </div>
              {link?.url && (
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  Connect with {link.provider || "your DNS provider"}
                </a>
              )}
              {link && !link.url && (
                <p>
                  {link.conflict
                    ? `Automatic setup would replace ${link.conflict} email records. Use a separate purchasing subdomain and contact support if this domain needs changing.`
                    : "Automatic setup is unavailable for this provider. Add the records above, then check verification."}
                </p>
              )}
              {domain.reason && (
                <p className="desk-muted">
                  Verification detail: {domain.reason.replaceAll("_", " ")}
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => connect({ domain: name, username, ownsDomain: owns }));
          }}
        >
          <label htmlFor="buyer-domain">Your email subdomain</label>
          <input
            id="buyer-domain"
            placeholder="purchasing.acme.com"
            required
            maxLength={253}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label htmlFor="buyer-username">Address name</label>
          <input
            id="buyer-username"
            required
            maxLength={63}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <p>
            {username || "buyer"}@{name || "purchasing.acme.com"}
          </p>
          <label className="desk-mail-domain-consent">
            <input type="checkbox" checked={owns} onChange={(e) => setOwns(e.target.checked)} />I
            can manage DNS for this domain. Use this address for new purchases once verified.
          </label>
          <Button type="submit" disabled={busy || !owns}>
            Connect my domain
          </Button>
        </form>
      )}
      {busy && <output>Checking email setup…</output>}
      {note && <output>{note}</output>}
      {error && (
        <p role="alert" className="desk-error">
          {error}
        </p>
      )}
    </details>
  );
}
