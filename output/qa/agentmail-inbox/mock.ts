import { useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
let version = 0;
const listeners = new Set<() => void>();
const update = () => {
  version++;
  listeners.forEach((l) => l());
};
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const msg = {
  id: "msg-1",
  threadId: "thread-1",
  from: "Supply Shop <supplier@sample.example>",
  to: ["buyer@sample.example"],
  subject: "Quote for deli lids",
  text: "We can supply 10 cases of deli lids. Total USD 100 including delivery. Please confirm the arrival date before ordering.",
  timestamp: "2026-09-15T13:30:00Z",
  attachments: [
    { id: "att-1", filename: "Deli-lids-quote.pdf", contentType: "application/pdf", size: 16234 },
  ],
};
const docs = [
  {
    _id: "doc-1",
    _creationTime: 1,
    organizationId: "org-1",
    receiptId: "receipt-1",
    attachmentId: "att-1",
    filename: "Deli-lids-quote.pdf",
    contentType: "application/pdf",
    status: "ready",
    facts: {
      kind: "quote",
      supplier: "Supply Shop",
      reference: "Q-100",
      currency: "USD",
      total: "100.00",
      arrival: "",
      summary: "Quote for 10 cases of lids. Arrival date is missing and needs checking.",
      lines: [
        {
          name: "Deli lids",
          sku: "LID-16",
          quantity: "10",
          unit: "cases",
          unitPrice: "10.00",
          evidence: "LID-16 · Deli lids · 10 cases · USD 10.00 per case",
        },
      ],
    },
  },
];
const reviews = [
  {
    _id: "receipt-2",
    from: "supplier@sample.example",
    subject: "Updated order details",
    text: "Please use the revised delivery details.",
    risk: "Sender verification needs review. This email cannot update purchasing automatically.",
    attachments: [],
    receivedAt: 1,
  },
];
let drafts: any[] = [];
let domain: any = null;
export const useQuery = (ref: any, args: any) => {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  if (args === "skip") return undefined;
  const n = getFunctionName(ref);
  if (n === "mailDomains:current") return domain;
  if (n === "mailbox:addresses") return [{ email: "buyer@sample.example", active: true }];
  if (n === "mailDrafts:list") return drafts;
  if (n === "mailReview:documents") return docs;
  if (n === "mailReview:download") return null;
  if (n === "companyOrders:list")
    return [{ _id: "order-1", number: "PO-100", itemName: "Deli lids" }];
  return [];
};
export const usePaginatedQuery = () => {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  return { results: reviews, status: "Exhausted", loadMore: () => {} };
};
async function call(ref: any, args: any) {
  const n = getFunctionName(ref);
  (window as any).mailQaCalls ??= [];
  (window as any).mailQaCalls.push({ name: n, args });
  if (n === "mailDomains:connect") {
    domain = {
      domain: args.domain,
      username: args.username,
      status: "pending",
      providerId: "domain-1",
      records: [
        {
          type: "TXT",
          name: "dkim." + args.domain,
          value: "sample-dns-verification-value",
          status: "MISSING",
        },
      ],
    };
    update();
    return null;
  }
  if (n === "mailDomains:setupLink")
    return { url: null, provider: "Sample provider", conflict: "" };
  if (n === "mailDomains:check") {
    domain = { ...domain, status: "verified", inboxId: domain.username + "@" + domain.domain };
    update();
    return null;
  }
  if (n === "companyMail:provision") return { email: "buyer@sample.example" };
  if (n === "mailbox:threads")
    return {
      threads:
        args.search && !/lid|supply|quote/i.test(args.search)
          ? []
          : [
              {
                id: "thread-1",
                subject: msg.subject,
                preview: msg.text,
                senders: [msg.from],
                count: 3,
                timestamp: msg.timestamp,
              },
            ],
      next: args.cursor ? null : "page-2",
    };
  if (n === "mailbox:thread")
    return {
      id: "thread-1",
      subject: msg.subject,
      messages: args.cursor
        ? [
            {
              ...msg,
              id: "older",
              from: "buyer@sample.example",
              text: "Please quote 10 cases of lids.",
              attachments: [],
            },
          ]
        : [msg],
      next: args.cursor ? null : "older",
      lastMessageId: "msg-1",
    };
  if (n === "mailbox:importMessage") return "receipt-1";
  if (n === "mailDrafts:save") {
    const d = {
      _id: args.draftId ?? "draft-1",
      messageId: args.messageId,
      threadId: "thread-1",
      to: "supplier@sample.example",
      text:
        args.text +
        "\n\nThis is a request for information, not a purchase order or authorization to change an existing order.",
      state: "ready",
      version: (args.version ?? 0) + 1,
    };
    drafts = [d];
    update();
    return d._id;
  }
  if (n === "mailDrafts:send") {
    drafts = drafts.map((d) => ({ ...d, state: "sent" }));
    update();
    return null;
  }
  if (n === "mailReview:linkDocument") {
    Object.assign(docs[0], { orderId: args.orderId, reviewedAt: 1 });
    update();
    return null;
  }
  if (n === "mailReview:acknowledge") {
    Object.assign(reviews[0], { reviewedAt: 1 });
    update();
    return null;
  }
  if (n === "mailbox:refreshReview") return { count: 1, next: null };
  if (n === "mailSettings:status")
    return {
      email: "buyer@sample.example",
      domain: "sample.example",
      domainStatus: "Sample only",
      restricted: false,
      canRestrict: false,
      accessStatus: "service",
    };
  return null;
}
export const useAction = (ref: any) => (args: any) => call(ref, args);
export const useMutation = useAction;
