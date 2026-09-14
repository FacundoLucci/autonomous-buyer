import { useState } from "react";
import { ArrowUpRight, Check, CalendarDays } from "lucide-react";
import { useAuthActions } from "@/lib/buyer-auth";
import { bookingUrl, marketingHref } from "@/lib/marketing";
import { Button } from "@/components/ui/button";
import { Brand } from "./primitives";
import { errorText } from "./model";

export function InvitationPending({
  request,
}: {
  request: { companyName: string; shippingAddress: string };
}) {
  const { signOut } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scheduleHref =
    typeof window === "undefined" || !window.location
      ? "https://cal.com/facundolucci/buyhard"
      : bookingUrl();
  return (
    <main className="desk-public">
      <header className="desk-public-header">
        <Brand />
        <Button
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await signOut();
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Signing out…" : "Sign out"}
        </Button>
      </header>
      <section className="desk-invitation" aria-labelledby="invitation-title">
        <div className="desk-invitation-message">
          <p className="desk-eyebrow">INVITE-ONLY EARLY ACCESS</p>
          <h1 id="invitation-title">You’re on the list.</h1>
          <p className="desk-invitation-intro">
            Your company details are saved. Finish onboarding with Facundo to get your business
            ready for BUY HARD.
          </p>
          <a className="desk-cta" href={scheduleHref}>
            Schedule with Facundo <ArrowUpRight size={20} aria-hidden="true" />
          </a>
          <p className="desk-invitation-note">
            Book a 20-minute session for priority onboarding. Workspace access opens after your
            session and invitation.
          </p>
          <a className="desk-text-link" href={marketingHref("/?demo=true")}>
            Explore the demo while you wait <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          {error && (
            <p className="desk-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <aside className="desk-invitation-receipt" aria-label="Your onboarding progress">
          <p className="desk-eyebrow">YOUR INVITATION REQUEST</p>
          <h2>{request.companyName}</h2>
          <p className="desk-invitation-address">{request.shippingAddress}</p>
          <ol>
            <li>
              <Check size={18} aria-hidden="true" />
              <span>Account created</span>
            </li>
            <li>
              <Check size={18} aria-hidden="true" />
              <span>Company details saved</span>
            </li>
            <li>
              <CalendarDays size={18} aria-hidden="true" />
              <span>Next: onboarding with Facundo</span>
            </li>
          </ol>
          <p>Your details will be here when you return.</p>
        </aside>
      </section>
    </main>
  );
}
