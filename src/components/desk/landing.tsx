import { ArrowUpRight } from "lucide-react";
import { MerchantMetrics } from "./merchant-metrics";
import { DotMatrixDisplay } from "./dot-matrix-display";
import { PilotForm, VisitTracker } from "./marketing";
import { marketingHref } from "@/lib/marketing";

export function Landing({
  resumeSetup = false,
  staticPreview = false,
}: {
  resumeSetup?: boolean;
  staticPreview?: boolean;
}) {
  const href = staticPreview ? (path: string) => path : marketingHref;
  return (
    <main className="desk-public desk-landing">
      {!staticPreview && <VisitTracker />}
      <header className="desk-public-header desk-landing-nav">
        <a className="desk-text-link" href="/setup?mode=login">
          {resumeSetup ? "Your account" : "Sign in"} <ArrowUpRight size={16} />
        </a>
      </header>
      <section className="desk-hero">
        <p className="desk-eyebrow">PURCHASING. HANDLED.</p>
        <h1 className="desk-wordmark">
          {staticPreview ? "BUY HARD" : <DotMatrixDisplay value="BUY HARD" scrollOnHover />}
        </h1>
        <p className="marketing-description">
          An AI buyer for the everyday supplies your business runs on.
        </p>
        <div className="marketing-actions">
          <a className="desk-cta" href={href("/walkthrough")}>
            Book a 20-minute walkthrough <ArrowUpRight size={21} />
          </a>
          <a className="desk-text-link" href={href("/?demo=true")}>
            Explore the sample demo <ArrowUpRight size={17} />
          </a>
        </div>
        <p className="marketing-offer">
          Bring one item you regularly reorder. We’ll explore how BUY HARD could help.
        </p>
        <a className="desk-text-link" href="#pilot">
          Interested in the pilot? ↓
        </a>
      </section>
      <section className="marketing-example">
        <div>
          <p className="desk-eyebrow">ONE EVERYDAY EXAMPLE</p>
          <h2>Keep the cups coming.</h2>
        </div>
        <p>
          In the sample demo, paper cups are running low. BUY HARD helps spot the shortage and
          prepare a reorder for your review. You approve before anything is purchased.
        </p>
      </section>
      {!staticPreview && <MerchantMetrics />}
      {staticPreview ? (
        <section id="pilot" className="marketing-pilot">
          <h2>Interested in the pilot?</h2>
          <p>
            We’re inviting businesses to explore BUY HARD with their everyday supplies. No account
            or company setup required.
          </p>
          <a href="/walkthrough">Book a walkthrough or leave your interest</a>
        </section>
      ) : (
        <PilotForm />
      )}
      <footer className="desk-landing-footer">
        <span>From low stock to your loading dock.</span>
        <a className="desk-text-link" href="/setup">
          {resumeSetup ? "Continue setup" : "Get started"} <ArrowUpRight size={17} />
        </a>
      </footer>
    </main>
  );
}
