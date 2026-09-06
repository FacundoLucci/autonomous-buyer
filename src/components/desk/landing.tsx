import { ArrowUpRight } from "lucide-react";

import { DotMatrixDisplay } from "./dot-matrix-display";

export function Landing() {
  return (
    <main className="desk-public desk-landing">
      <header className="desk-public-header desk-landing-nav">
        <a className="desk-text-link" href="/setup?mode=login">
          Sign in <ArrowUpRight size={16} />
        </a>
      </header>
      <section className="desk-hero">
        <p className="desk-eyebrow">PURCHASING. HANDLED.</p>
        <h1 className="desk-wordmark">
          <DotMatrixDisplay value="BUY HARD" />
        </h1>
        <p className="desk-tagline">Keep the line moving.</p>
        <a className="desk-cta" href="/setup">
          Get started <ArrowUpRight size={21} />
        </a>
      </section>
      <footer className="desk-landing-footer">
        <span>From low stock to your loading dock.</span>
        <a className="desk-text-link" href="/?demo=true">
          Explore the demo <ArrowUpRight size={17} />
        </a>
      </footer>
    </main>
  );
}
