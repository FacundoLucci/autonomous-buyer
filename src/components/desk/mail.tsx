import { MailDomains } from "./mail-domains";
import { useState } from "react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { errorText } from "./model";
import "./mail.css";
type Thread = FunctionReturnType<typeof api.mailbox.thread>;
type ThreadPage = FunctionReturnType<typeof api.mailbox.threads>;
const suggestions = {
  terms:
    "Please confirm the exact product, quantity and stock unit, currency, all charges, total and arrival date. Do you accept emailed purchase orders?",
  date: "Please confirm the revised arrival date and whether the quantity and total remain unchanged.",
  alternative:
    "Please share the exact product, quantity, complete price and arrival date for the proposed alternative. We will review it before making a decision.",
};
export function PurchasingInbox({ email }: { email?: string }) {
  const addresses = useQuery(api.mailbox.addresses);
  const [selectedInbox, setSelectedInbox] = useState<string | undefined>();
  const inboxId = selectedInbox ?? email;
  const threads = useAction(api.mailbox.threads),
    read = useAction(api.mailbox.thread),
    importMessage = useAction(api.mailbox.importMessage),
    refreshReview = useAction(api.mailbox.refreshReview);
  const save = useAction(api.mailDrafts.save),
    send = useAction(api.mailDrafts.send),
    checkSend = useAction(api.mailDrafts.checkSend),
    settings = useAction(api.mailSettings.status),
    restrict = useAction(api.mailSettings.enableRestrictedAccess);
  const acknowledge = useMutation(api.mailReview.acknowledge),
    requestDocument = useMutation(api.mailReview.requestDocument),
    linkDocument = useMutation(api.mailReview.linkDocument);
  const drafts = useQuery(api.mailDrafts.list, email ? {} : "skip"),
    documents = useQuery(api.mailReview.documents, email ? {} : "skip"),
    orders = useQuery(api.companyOrders.list, email ? {} : "skip");
  const reviews = usePaginatedQuery(api.mailReview.reviews, email ? {} : "skip", {
    initialNumItems: 20,
  });
  const [page, setPage] = useState<ThreadPage | null>(null),
    [thread, setThread] = useState<Thread | null>(null);
  const [search, setSearch] = useState(""),
    [submittedSearch, setSubmittedSearch] = useState(""),
    [tab, setTab] = useState<"conversations" | "review" | "documents" | "drafts">("conversations");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const [reply, setReply] = useState<{
    inboxId?: string;
    messageId: string;
    text: string;
    draftId?: Id<"mailDrafts">;
    version?: number;
  } | null>(null);
  const [reviewCursor, setReviewCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<FunctionReturnType<typeof api.mailSettings.status> | null>(
    null,
  );
  async function run(job: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await job();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const result = await threads({ search, inboxId });
    setPage(result);
    setSubmittedSearch(search);
    setThread(null);
    setReply(null);
  }
  return (
    <section className="desk-settings-section desk-mail" aria-label="Purchasing email">
      <div className="desk-section-heading">
        <h2>Your buyer’s email</h2>
        <span className="desk-muted">Powered by AgentMail</span>
      </div>
      <p className="desk-muted">{email ?? "Created when you send your first purchase order."}</p>
      <MailDomains />
      {addresses && addresses.length > 1 && (
        <label>
          Inbox
          <select
            aria-label="Inbox address"
            value={inboxId}
            disabled={busy}
            onChange={(e) => {
              setSelectedInbox(e.target.value);
              setPage(null);
              setThread(null);
              setReply(null);
              setReviewCursor(null);
            }}
          >
            {addresses.map((i) => (
              <option key={i.email} value={i.email}>
                {i.email}
                {i.active ? " — new purchases" : " — previous address"}
              </option>
            ))}
          </select>
        </label>
      )}
      {email && (
        <>
          <nav className="desk-mail-tabs" aria-label="Email views">
            {(
              [
                ["conversations", "Conversations"],
                ["review", "Review"],
                ["documents", "Documents"],
                ["drafts", "Drafts"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                variant={tab === value ? "default" : "outline"}
                aria-pressed={tab === value}
                onClick={() => {
                  setTab(value);
                  setReply(null);
                }}
                disabled={busy}
              >
                {label}
                {value === "review" && reviews.results.some((r) => r.risk && !r.reviewedAt)
                  ? " •"
                  : ""}
              </Button>
            ))}
          </nav>
          {tab === "conversations" && (
            <>
              <form
                className="desk-mail-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(refresh);
                }}
              >
                <label className="sr-only" htmlFor="mail-search">
                  Search supplier conversations
                </label>
                <input
                  id="mail-search"
                  placeholder="Search supplier, product or order"
                  value={search}
                  maxLength={300}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button disabled={busy} type="submit">
                  {busy ? "Reading…" : search.trim() ? "Search" : "Read email"}
                </Button>
              </form>
              <p className="desk-muted">
                Search covers supplier conversations. Unverified mail appears under Review.
              </p>
              {thread ? (
                <>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setThread(null);
                      setReply(null);
                    }}
                  >
                    Back to conversations
                  </Button>
                  <h3>{thread.subject || "No subject"}</h3>
                  {thread.next && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const older = await read({
                            inboxId,
                            threadId: thread.id,
                            cursor: thread.next!,
                          });
                          setThread({
                            ...thread,
                            next: older.next,
                            messages: [...older.messages, ...thread.messages].filter(
                              (m, i, all) => all.findIndex((a) => a.id === m.id) === i,
                            ),
                          });
                        })
                      }
                    >
                      Older messages
                    </Button>
                  )}
                  {thread.messages.map((m) => (
                    <article key={m.id} className="desk-mail-message">
                      <p className="desk-muted">
                        {m.from} · {m.timestamp ? new Date(m.timestamp).toLocaleString() : ""}
                      </p>
                      {m.risk && <p className="desk-error">{m.risk}</p>}
                      <p>{m.text || "No readable message text. Check the attachments."}</p>
                      {m.attachments.map((a) => (
                        <p key={a.id}>
                          📎 {a.filename} · {Math.ceil(a.size / 1024)} KB
                        </p>
                      ))}
                      <div className="desk-mail-actions">
                        {m.from && !m.from.includes(email) && (
                          <Button
                            variant="outline"
                            disabled={busy || !!m.risk}
                            onClick={() =>
                              setReply({ inboxId, messageId: m.id, text: suggestions.terms })
                            }
                          >
                            Prepare reply
                          </Button>
                        )}
                        {m.attachments.length > 0 && (
                          <Button
                            variant="outline"
                            disabled={busy || !!m.risk}
                            onClick={() =>
                              void run(async () => {
                                await importMessage({ inboxId, messageId: m.id });
                                setTab("documents");
                                setNotice(
                                  "Supported PDF and image documents are being read. Other files remain in the conversation.",
                                );
                              })
                            }
                          >
                            Read documents
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </>
              ) : (
                <>
                  {page?.threads.length === 0 && <p>No matching conversations.</p>}
                  {page?.threads.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      className="desk-mail-row"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => setThread(await read({ inboxId, threadId: t.id })))
                      }
                    >
                      <strong>{t.subject || "No subject"}</strong>
                      <small>
                        {t.senders.join(", ")} · {t.count} messages
                      </small>
                      <span>{t.preview}</span>
                    </button>
                  ))}
                  {page?.next && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const next = await threads({
                            inboxId,
                            search: submittedSearch,
                            cursor: page.next!,
                          });
                          setPage({
                            threads: [...page.threads, ...next.threads].filter(
                              (t, i, all) => all.findIndex((a) => a.id === t.id) === i,
                            ),
                            next: next.next,
                          });
                        })
                      }
                    >
                      More conversations
                    </Button>
                  )}
                </>
              )}
            </>
          )}
          {tab === "review" && (
            <>
              <p className="desk-muted">
                Review new or unverified mail. Marking it reviewed does not approve an order or
                trust its sender.
              </p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await refreshReview({ inboxId });
                    setReviewCursor(result.next);
                    setNotice(`Checked ${result.count} unverified messages.`);
                  })
                }
              >
                Check unverified mail
              </Button>
              {reviewCursor && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await refreshReview({ inboxId, cursor: reviewCursor });
                      setReviewCursor(result.next);
                    })
                  }
                >
                  Check older unverified mail
                </Button>
              )}
              {reviews.results.length === 0 && <p>No incoming email saved yet.</p>}
              {reviews.results.map((r) => (
                <article className="desk-mail-message" key={r._id}>
                  <h3>{r.subject || "No subject"}</h3>
                  <p className="desk-muted">{r.from}</p>
                  {r.risk && <p className="desk-error">{r.risk}</p>}
                  <p>{r.text}</p>
                  <p className="desk-muted">
                    {r.orderId || r.buyId ? "Linked to a purchase" : "Not linked to a purchase"}
                  </p>
                  {r.attachments.map((a) => (
                    <div className="desk-mail-actions" key={a.id}>
                      <span>{a.filename}</span>
                      <Button
                        variant="outline"
                        disabled={busy || !!r.risk}
                        onClick={() =>
                          void run(async () => {
                            await requestDocument({ receiptId: r._id, attachmentId: a.id });
                            setTab("documents");
                          })
                        }
                      >
                        Read document
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    disabled={busy || !!r.reviewedAt}
                    onClick={() =>
                      void run(async () => {
                        await acknowledge({ receiptId: r._id });
                      })
                    }
                  >
                    {r.reviewedAt ? "Reviewed" : "Mark reviewed"}
                  </Button>
                </article>
              ))}
              {reviews.status === "CanLoadMore" && (
                <Button variant="outline" onClick={() => reviews.loadMore(20)}>
                  More incoming mail
                </Button>
              )}
            </>
          )}
          {tab === "documents" && (
            <>
              <p className="desk-muted">
                Details extracted by OpenAI. Check the original before using them. Linking a
                document does not place an order or change stock.
              </p>
              {documents?.length === 0 && (
                <p>No documents yet. Open a conversation to read its attachments.</p>
              )}
              {documents?.map((d) => (
                <DocumentReview
                  key={d._id}
                  document={d}
                  orders={orders ?? []}
                  busy={busy}
                  onLink={(orderId) =>
                    void run(async () => {
                      await linkDocument({ documentId: d._id, orderId });
                      setNotice("Document linked. Order and stock are unchanged.");
                    })
                  }
                  onRetry={() =>
                    void run(async () => {
                      await requestDocument({
                        receiptId: d.receiptId,
                        attachmentId: d.attachmentId,
                      });
                    })
                  }
                />
              ))}
            </>
          )}
          {tab === "drafts" && (
            <>
              <p className="desk-muted">
                Review the exact recipient and message before sending. Purchases and cancellations
                use their existing approval controls.
              </p>
              {drafts?.length === 0 && (
                <p>No saved replies. Open a supplier conversation to prepare one.</p>
              )}
              {drafts?.map((d) => (
                <article className="desk-mail-message" key={d._id}>
                  <p>
                    <strong>To: {d.to}</strong>
                  </p>
                  <p>{d.text}</p>
                  <p className="desk-muted">
                    {d.state === "sent"
                      ? "Sent via AgentMail. Supplier response pending."
                      : d.state}
                  </p>
                  {d.error && (
                    <p role="alert" className="desk-error">
                      {d.error}
                    </p>
                  )}
                  <div className="desk-mail-actions">
                    <Button
                      disabled={busy}
                      variant="ghost"
                      onClick={() =>
                        void run(async () => {
                          setSelectedInbox(d.inboxId);
                          setThread(await read({ inboxId: d.inboxId, threadId: d.threadId }));
                          setTab("conversations");
                        })
                      }
                    >
                      View conversation
                    </Button>
                    {["ready", "failed"].includes(d.state) && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          setReply({
                            inboxId: d.inboxId,
                            messageId: d.messageId,
                            text: d.text.replace(
                              /\n\nThis is a request for information, not a purchase order or authorization to change an existing order\.$/,
                              "",
                            ),
                            draftId: d._id,
                            version: d.version,
                          })
                        }
                      >
                        Edit
                      </Button>
                    )}
                    {["sending", "unknown"].includes(d.state) && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const confirmed = await checkSend({ draftId: d._id });
                            setNotice(
                              confirmed
                                ? "AgentMail confirmed this reply was sent."
                                : "No matching send receipt found yet. The reply has not been resent.",
                            );
                          })
                        }
                      >
                        Check sending outcome
                      </Button>
                    )}
                    {d.state === "ready" && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await send({
                              draftId: d._id,
                              version: d.version,
                              approvedText: d.text,
                            });
                          })
                        }
                      >
                        Approve and send reply
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </>
          )}
          {reply && (
            <form
              className="desk-mail-compose"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await save(reply);
                  setReply(null);
                  setTab("drafts");
                });
              }}
            >
              <h3>Prepare a supplier reply</h3>
              <div className="desk-mail-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReply({ ...reply, text: suggestions.terms })}
                >
                  Missing details
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReply({ ...reply, text: suggestions.date })}
                >
                  Changed date
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReply({ ...reply, text: suggestions.alternative })}
                >
                  Alternative item
                </Button>
              </div>
              <label htmlFor="mail-reply">Your message</label>
              <textarea
                id="mail-reply"
                value={reply.text}
                maxLength={8000}
                rows={7}
                onChange={(e) => setReply({ ...reply, text: e.target.value })}
              />
              <p className="desk-muted">
                Saved for review in AgentMail. Nothing is sent yet. An information-only note is
                added to the reply.
              </p>
              <div className="desk-mail-actions">
                <Button type="submit" disabled={busy || !reply.text.trim()}>
                  Save draft for review
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setReply(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
          <details className="desk-mail-settings">
            <summary>Email identity & access</summary>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run(async () => setStatus(await settings({})))}
            >
              Check email setup
            </Button>
            {status && (
              <>
                <p>
                  {status.domain} · {status.domainStatus}
                </p>
                <p>
                  {status.restricted
                    ? "Inbox browsing, documents and drafts use a key restricted to this company inbox."
                    : "Email uses the workspace service connection."}{" "}
                  Approved order delivery uses the protected background mail service.
                </p>
                {!status.restricted && (
                  <Button
                    disabled={busy || !status.canRestrict || status.accessStatus === "creating"}
                    onClick={() =>
                      void run(async () => {
                        await restrict({});
                        setStatus(await settings({}));
                      })
                    }
                  >
                    Restrict inbox access
                  </Button>
                )}
                {!status.canRestrict && !status.restricted && (
                  <p className="desk-muted">
                    Encrypted access setup requires the workspace administrator.
                  </p>
                )}
              </>
            )}
          </details>
        </>
      )}
      {busy && <output className="desk-muted">Working…</output>}
      {notice && <output>{notice}</output>}
      {error && (
        <p className="desk-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function DocumentReview({
  document: d,
  orders,
  busy,
  onLink,
  onRetry,
}: {
  document: Doc<"mailDocuments">;
  orders: FunctionReturnType<typeof api.companyOrders.list>;
  busy: boolean;
  onLink: (id: Id<"companyOrders">) => void;
  onRetry: () => void;
}) {
  const url = useQuery(api.mailReview.download, { documentId: d._id });
  const [orderId, setOrderId] = useState<string>(d.orderId ?? "");
  return (
    <article className="desk-mail-message">
      <h3>{d.filename}</h3>
      <p className="desk-muted">
        {d.status === "reading"
          ? "Reading document…"
          : d.reviewedAt
            ? "Reviewed and linked"
            : "Needs review"}
      </p>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="desk-inline-link">
          Open original document
        </a>
      )}
      {d.error && (
        <>
          <p className="desk-error">{d.error}</p>
          <Button variant="outline" disabled={busy} onClick={onRetry}>
            Try reading again
          </Button>
        </>
      )}
      {d.facts && (
        <>
          <p>{d.facts.summary}</p>
          <dl className="desk-mail-facts">
            <dt>Supplier</dt>
            <dd>{d.facts.supplier || "Not found"}</dd>
            <dt>Reference</dt>
            <dd>{d.facts.reference || "Not found"}</dd>
            <dt>Total</dt>
            <dd>{[d.facts.currency, d.facts.total].filter(Boolean).join(" ") || "Not found"}</dd>
            <dt>Arrival</dt>
            <dd>{d.facts.arrival || "Not found"}</dd>
          </dl>
          {d.facts.lines.map((line, i) => (
            <div className="desk-mail-line" key={i}>
              <strong>{line.name}</strong>
              <p>
                {[line.sku, `${line.quantity} ${line.unit}`, line.unitPrice]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <blockquote>{line.evidence}</blockquote>
            </div>
          ))}
          <label>
            Link to a purchase
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">Choose a purchase</option>
              {orders.map((o) => (
                <option value={o._id} key={o._id}>
                  {o.number} · {o.itemName}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={busy || !orderId}
            onClick={() => onLink(orderId as Id<"companyOrders">)}
          >
            Confirm document link
          </Button>
        </>
      )}
    </article>
  );
}

// Kept for existing recorded demo scenes. Live inbox uses conversations above.
export function PurchasingInboxContent({
  email,
  messages,
  message,
  busy = false,
  error,
  onRefresh,
  onRead,
  onBack,
}: {
  email?: string;
  messages: FunctionReturnType<typeof api.companyMail.messages> | null;
  message: FunctionReturnType<typeof api.companyMail.readMessage> | null;
  busy?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onRead: (messageId: string) => void;
  onBack: () => void;
}) {
  return (
    <section className="desk-settings-section">
      <div className="desk-section-heading">
        <h2>Purchasing email</h2>
        {email && (
          <Button variant="outline" disabled={busy} onClick={onRefresh}>
            {busy ? "Reading…" : "Read replies"}
          </Button>
        )}
      </div>
      <p className="desk-muted">{email ?? "Created when you send your first purchase order."}</p>
      {message ? (
        <article className="desk-mail-message">
          <Button variant="ghost" onClick={onBack}>
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
          <button className="desk-mail-row" disabled={busy} key={m.id} onClick={() => onRead(m.id)}>
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

export function OrderMailDocuments({ orderId }: { orderId: Id<"companyOrders"> }) {
  const documents = useQuery(api.mailReview.forOrder, { orderId });
  if (!documents?.length) return null;
  return (
    <section className="desk-mail">
      <h4>Supplier documents</h4>
      {documents.map((d) => (
        <OrderDocument key={d._id} document={d} />
      ))}
    </section>
  );
}
function OrderDocument({ document }: { document: Doc<"mailDocuments"> }) {
  const url = useQuery(api.mailReview.download, { documentId: document._id });
  return (
    <p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {document.filename}
        </a>
      ) : (
        document.filename
      )}{" "}
      · {document.reviewedAt ? "Reviewed" : "Needs review"}
    </p>
  );
}
