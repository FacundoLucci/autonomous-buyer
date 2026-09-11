import { useMountEffect } from "@/lib/use-mount-effect";
import { useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { attribution, bookingUrl, marketingHref } from "@/lib/marketing";
import "./marketing.css";

export function VisitTracker() {
  const track = useMutation(api.marketing.track);
  useMountEffect(() => {
    void track({ event: "visit", source: attribution() }).catch(() => {});
  });
  return null;
}
export function DemoNextStep() {
  const [used, setUsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const track = useMutation(api.marketing.track);
  useMountEffect(() => {
    const onUse = () => {
      setUsed(true);
      void track({ event: "demo_use", source: attribution() }).catch(() => {});
    };
    window.addEventListener("buyhard:demo-use", onUse);
    return () => window.removeEventListener("buyhard:demo-use", onUse);
  });
  return (
    <>
      <a href={marketingHref("/walkthrough")}>Try this with your business</a>
      {used && !dismissed && (
        <aside className="marketing-demo-next" aria-label="Your next step">
          <span>
            Have an item like this?{" "}
            <a href={marketingHref("/walkthrough")}>Book a 20-minute walkthrough</a>
          </span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss walkthrough suggestion"
          >
            ×
          </button>
        </aside>
      )}
    </>
  );
}
export function PilotForm() {
  const inquire = useMutation(api.marketing.inquire);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const locked = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (locked.current) return;
    const data = new FormData(e.currentTarget);
    locked.current = true;
    setStatus("saving");
    setError("");
    try {
      const result = await inquire({
        email: String(data.get("email")),
        businessName: String(data.get("businessName")),
        challenge: String(data.get("challenge")),
        website: String(data.get("website") ?? ""),
        source: attribution(),
      });
      if (!result.ok) throw new Error("rate-limit");
      setStatus("saved");
    } catch (error) {
      setStatus("idle");
      setError(
        error instanceof ConvexError
          ? String(error.data)
          : "We couldn’t save your interest. Please try again shortly, or book a walkthrough.",
      );
    } finally {
      locked.current = false;
    }
  }
  return (
    <section className="marketing-pilot" id="pilot" aria-labelledby="pilot-title">
      <div>
        <p className="desk-eyebrow">EARLY PILOT</p>
        <h2 id="pilot-title">Interested in the pilot?</h2>
        <p>We’re inviting businesses to explore BUY HARD with their everyday supplies.</p>
        <p>No account or company setup required.</p>
      </div>
      {status === "saved" ? (
        <output className="marketing-receipt">
          <h3>Your interest is saved.</h3>
          <p>Thanks for raising your hand. We aim to reply within one business day.</p>
          <p>A confirmation email has been requested. You don’t need to submit again.</p>
          <a className="desk-text-link" href={marketingHref("/walkthrough")}>
            Book a 20-minute walkthrough →
          </a>
        </output>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="pilot-email">Email</label>
          <input
            id="pilot-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
          <label htmlFor="pilot-business">Business name</label>
          <input
            id="pilot-business"
            name="businessName"
            autoComplete="organization"
            maxLength={120}
            required
            pattern=".*\S.*"
          />
          <label htmlFor="pilot-challenge">
            Purchasing challenge <span>(optional)</span>
          </label>
          <textarea id="pilot-challenge" name="challenge" rows={3} maxLength={1000} />
          <div hidden aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <p className="marketing-note">
            We’ll only use these details to follow up about your inquiry.
          </p>
          {error && <p role="alert">{error}</p>}
          <button className="desk-cta" type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "I’m interested"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
      )}
    </section>
  );
}

type CalApi = ((...args: unknown[]) => void) & {
  q?: unknown[][];
  ns: Record<string, CalApi>;
  loaded?: boolean;
  config?: { forwardQueryParams?: boolean };
};
declare global {
  interface Window {
    Cal?: CalApi;
  }
}
export function Walkthrough() {
  const [failed, setFailed] = useState(false);
  const fallback =
    typeof window === "undefined" ? "https://cal.com/facundolucci/buyhard" : bookingUrl();
  useMountEffect(() => {
    if (!window.Cal) {
      const cal = ((...args: unknown[]) => {
        cal.q!.push(args);
        if (args[0] === "init" && typeof args[1] === "string") {
          const ns = ((...values: unknown[]) => {
            ns.q!.push(values);
          }) as CalApi;
          ns.q = [];
          ns.ns = {};
          cal.ns[args[1]] = ns;
          ns.q.push(args);
          cal.q!.push(["initNamespace", args[1]]);
        }
      }) as CalApi;
      cal.q = [];
      cal.ns = {};
      window.Cal = cal;
      const script = document.createElement("script");
      script.src = "https://app.cal.com/embed/embed.js";
      script.async = true;
      script.onerror = () => setFailed(true);
      document.head.appendChild(script);
    }
    const cal = window.Cal;
    cal("init", "buyhard", { origin: "https://app.cal.com" });
    cal.config = { ...cal.config, forwardQueryParams: true };
    const source = attribution();
    cal.ns.buyhard("inline", {
      elementOrSelector: "#my-cal-inline-buyhard",
      calLink: "facundolucci/buyhard",
      config: {
        layout: "month_view",
        useSlotsViewOnSmallScreen: "true",
        theme: "dark",
        "metadata[visitorId]": source.visitorId,
        "metadata[attribution]": JSON.stringify(source),
        ...Object.fromEntries(Object.entries(source).filter(([key]) => key.startsWith("utm_"))),
      },
    });
    cal.ns.buyhard("ui", {
      theme: "dark",
      cssVarsPerTheme: { light: { "cal-brand": "#2e2e2e" }, dark: { "cal-brand": "#f6ff80" } },
      hideEventTypeDetails: true,
      layout: "month_view",
    });
  });
  return (
    <main className="desk-public marketing-walkthrough">
      <VisitTracker />
      <a className="desk-text-link" href={marketingHref("/")}>
        ← BUY HARD
      </a>
      <header>
        <p className="desk-eyebrow">LET’S TALK SUPPLIES</p>
        <h1>Book a 20-minute walkthrough</h1>
        <p>Bring one item you regularly reorder. We’ll explore how BUY HARD could help.</p>
      </header>
      {failed && <p role="alert">The calendar couldn’t load here. Use the booking link below.</p>}
      <a className="desk-text-link" href={fallback}>
        Open the calendar in a full page ↗
      </a>
      <div id="my-cal-inline-buyhard" className="marketing-calendar" />
      <p>Not ready for a meeting? Leave your interest below.</p>
      <PilotForm />
    </main>
  );
}
