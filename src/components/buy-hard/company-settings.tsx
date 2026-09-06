import { useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { setupError } from "./setup";

export function CompanySettings({
  name,
  shippingAddress,
}: {
  name: string;
  shippingAddress: string;
}) {
  const settings = useQuery(api.companyAlerts.getSettings);
  const request = useAction(api.companyEmail.requestVerification),
    verify = useAction(api.companyEmail.verify);
  const preferences = useMutation(api.companyAlerts.preferences).withOptimisticUpdate(
      (store, next) => {
        const previous = store.getQuery(api.companyAlerts.getSettings, {});
        if (previous) store.setQuery(api.companyAlerts.getSettings, {}, { ...previous, ...next });
      },
    ),
    saveCompany = useMutation(api.companyInventory.updateCompany);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run(job: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await job();
      setMessage(success);
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  function email(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(
      () => request({ email: String(data.get("email")) }),
      "Verification requested. Check your inbox and spam folder for a six-digit code from alerts@buyhard.facundo.xyz.",
    );
  }
  function code(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(
      () => verify({ code: String(data.get("code")) }),
      "Email verified. Your alerts are enabled.",
    );
  }
  function company(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(
      () =>
        saveCompany({
          name: String(data.get("name")),
          shippingAddress: String(data.get("address")),
        }),
      "Company details saved. New orders will use this address.",
    );
  }
  return (
    <section className="company-tools bh-eink bh-cutout" aria-label="Company settings">
      <div className="company-inventory-intro">
        <h2>Company settings & alerts</h2>
        <p>Get low-stock warnings, order updates, and overdue delivery alerts in your inbox.</p>
      </div>
      <div className="company-tool-body">
        {settings === undefined ? (
          <p>Loading settings…</p>
        ) : (
          <>
            {!settings.configured ? (
              <output>
                Email service setup is still in progress. Purchasing and inventory remain available.
              </output>
            ) : null}
            <form className="company-form" onSubmit={email} key={settings.email}>
              <label>
                Alert email
                <input
                  name="email"
                  type="email"
                  defaultValue={settings.email}
                  required
                  maxLength={254}
                  disabled={busy}
                />
              </label>
              <div className="company-button-row">
                <button disabled={busy || !settings.configured}>
                  {settings.verified ? "Change / reverify email" : "Send verification code"}
                </button>
                <span>{settings.verified ? "Verified" : "Verification required"}</span>
              </div>
            </form>
            {settings.email && !settings.verified ? (
              <form className="company-form" onSubmit={code}>
                <label>
                  Six-digit email code
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                </label>
                <button disabled={busy}>Verify email</button>
              </form>
            ) : null}
            {settings.verified ? (
              <div className="company-alert-options">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.lowStock}
                    disabled={busy}
                    onChange={(e) =>
                      void run(
                        () =>
                          preferences({
                            lowStock: e.target.checked,
                            orderUpdates: settings.orderUpdates,
                          }),
                        "Alert preferences saved.",
                      )
                    }
                  />{" "}
                  Low stock · at most once per item per day
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.orderUpdates}
                    disabled={busy}
                    onChange={(e) =>
                      void run(
                        () =>
                          preferences({
                            lowStock: settings.lowStock,
                            orderUpdates: e.target.checked,
                          }),
                        "Alert preferences saved.",
                      )
                    }
                  />{" "}
                  Order updates & overdue deliveries
                </label>
                <p>
                  Stock is checked hourly using your last count and daily-use estimate. Turn alerts
                  off here at any time.
                </p>
              </div>
            ) : null}
            {settings.recent.length ? (
              <details>
                <summary>Recent email activity</summary>
                <ol className="company-activity">
                  {settings.recent.map((a) => (
                    <li key={a.id}>
                      <strong>{a.subject}</strong>
                      <p>
                        {a.status === "queued"
                          ? "Accepted by email provider"
                          : a.status === "delivered"
                            ? "Delivered"
                            : a.status === "pending" || a.status === "sending"
                              ? "Sending"
                              : a.status === "skipped"
                                ? "Skipped after settings changed"
                                : a.status === "unknown"
                                  ? "Delivery unconfirmed"
                                  : "Delivery failed"}{" "}
                        · {new Date(a.createdAt).toLocaleString()}
                      </p>
                      {a.error ? <p>{a.error}</p> : null}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </>
        )}
        <details>
          <summary>Company name & delivery address</summary>
          <form className="company-form" key={`${name}|${shippingAddress}`} onSubmit={company}>
            <label>
              Company name
              <input name="name" required maxLength={120} defaultValue={name} />
            </label>
            <label>
              Delivery address
              <textarea
                name="address"
                required
                minLength={12}
                maxLength={500}
                defaultValue={shippingAddress}
                rows={4}
              />
            </label>
            <button disabled={busy}>Save company details</button>
          </form>
        </details>
        <output>{message}</output>
        <p role="alert" className="company-error">
          {error}
        </p>
      </div>
    </section>
  );
}
