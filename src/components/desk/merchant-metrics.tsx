import { Component, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { DotMatrixDisplay } from "./dot-matrix-display";

type MerchantSummary = {
  totalOrders: number;
  merchantCount: number;
  merchants: { name: string; domain: string; orders: number }[];
};

export function MerchantMetrics() {
  return (
    <MetricsBoundary>
      <LiveMerchantMetrics />
    </MetricsBoundary>
  );
}
function LiveMerchantMetrics() {
  const summary = useQuery(api.merchantMetrics.summary, {});
  return <MerchantMetricsView summary={summary} />;
}

class MetricsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <MerchantMetricsView unavailable /> : this.props.children;
  }
}

export function MerchantMetricsView({
  summary,
  unavailable = false,
}: {
  summary?: MerchantSummary;
  unavailable?: boolean;
}) {
  const number = (value: number) => value.toLocaleString("en-US");
  return (
    <section id="tested-merchants" className="desk-merchant-metrics" aria-label="Tested merchants">
      <div className="desk-merchant-heading">
        <div>
          <p className="desk-eyebrow">REAL ORDERS. REAL MERCHANTS.</p>
          <h2>Where we’ve bought.</h2>
        </div>
        <a
          className="desk-text-link"
          href="https://www.convex.dev"
          target="_blank"
          rel="noreferrer"
        >
          Powered by Convex <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
      <p className="desk-merchant-intro">
        Every merchant joins this list with their first confirmed order. Email or website. You can
        bring a new merchant anytime.
      </p>
      {summary ? (
        <>
          <dl className="desk-merchant-totals">
            <div>
              <dt>Orders placed</dt>
              <dd>
                <DotMatrixDisplay value={number(summary.totalOrders)} />
              </dd>
            </div>
            <div>
              <dt>Merchants tested</dt>
              <dd>
                <DotMatrixDisplay value={number(summary.merchantCount)} />
              </dd>
            </div>
          </dl>
          {summary.merchants.length ? (
            <table className="desk-merchant-table">
              <caption className="sr-only">
                Confirmed orders placed by BUY HARD, by merchant
              </caption>
              <thead>
                <tr>
                  <th scope="col">Merchant</th>
                  <th scope="col">Orders placed</th>
                </tr>
              </thead>
              <tbody>
                {summary.merchants.map((merchant, index) => (
                  <tr key={`${merchant.domain}-${index}`}>
                    <th scope="row">
                      <span>{merchant.name}</span>
                      {merchant.domain && <small>{merchant.domain}</small>}
                    </th>
                    <td>{number(merchant.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="desk-merchant-empty">The first confirmed order starts the list.</p>
          )}
          <p className="desk-merchant-footnote">
            {summary.merchantCount > summary.merchants.length
              ? `Showing the ${summary.merchants.length} most-used merchants. `
              : ""}
            Counts update live after supplier confirmation.
          </p>
        </>
      ) : (
        <p className="desk-merchant-empty">
          <output>
            {unavailable ? "Order totals are unavailable right now." : "Loading order totals…"}
          </output>
        </p>
      )}
    </section>
  );
}
