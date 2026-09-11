import "@/components/desk/marketing.css";
import { createFileRoute } from "@tanstack/react-router";
import { Component, type ReactNode } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
export const Route = createFileRoute("/leads")({ component: LeadsPage });
class PrivateBoundary extends Component<{ children: ReactNode }, { denied: boolean }> {
  state = { denied: false };
  static getDerivedStateFromError() {
    return { denied: true };
  }
  render() {
    return this.state.denied ? (
      <p>
        This list is private. <a href="/setup?mode=login">Sign in with the owner account.</a>
      </p>
    ) : (
      this.props.children
    );
  }
}
function LeadsPage() {
  return (
    <main className="desk-public">
      <a className="desk-text-link" href="/">
        ← BUY HARD
      </a>
      <h1>Follow-up list</h1>
      <p>Reply goal: within one business day. Email status shows the provider’s response.</p>
      <PrivateBoundary>
        <Leads />
      </PrivateBoundary>
    </main>
  );
}
const deliveryLabels = {
  pending: "Waiting to send",
  queued: "Accepted by email service",
  delivered: "Delivered",
  unknown: "Delivery unconfirmed",
  failed: "Needs attention",
  cal_managed: "Handled by Cal",
};
function Leads() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.marketing.ownerList,
    {},
    { initialNumItems: 25 },
  );
  const update = useMutation(api.marketing.updateStage);
  return (
    <div className="marketing-leads">
      {status === "LoadingFirstPage" && <p>Loading inquiries…</p>}
      {status !== "LoadingFirstPage" && results.length === 0 && <p>No inquiries yet.</p>}
      {results.map((lead) => (
        <article key={lead._id}>
          <h2>{lead.businessName}</h2>
          <a href={`mailto:${lead.email}`}>{lead.email}</a>
          <p>{lead.challenge || "No challenge added."}</p>
          <p>
            Reply by {new Date(lead.replyDueAt).toLocaleString()} ·{" "}
            {lead.source.utm_source ?? "Direct"} / {lead.source.utm_campaign ?? "No campaign"}
          </p>
          <p>
            Confirmation: {deliveryLabels[lead.confirmation]} · Owner notification:{" "}
            {deliveryLabels[lead.notification]}
          </p>
          <p>
            {lead.confirmedBookingAt
              ? "Previously confirmed a booking"
              : "No confirmed booking yet"}
          </p>
          {lead.bookings.map((booking) => (
            <p key={booking._id}>
              Meeting: {booking.status} · {new Date(booking.startTime).toLocaleString()}
            </p>
          ))}
          <label>
            Status{" "}
            <select
              value={lead.stage}
              onChange={(e) => {
                void update({ leadId: lead._id, stage: e.target.value as typeof lead.stage }).catch(
                  () => alert("Couldn’t save the status. Please try again."),
                );
              }}
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="pilot_started">Pilot started</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </article>
      ))}
      {status === "CanLoadMore" && (
        <button className="desk-cta" onClick={() => loadMore(25)}>
          Load more
        </button>
      )}
    </div>
  );
}
