/// <reference types="vite/client" />
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { Agent } from "@convex-dev/agent";
import { createFunctionHandle } from "convex/server";
import { api, internal, components } from "./_generated/api";
import { mailBody, htmlText, documentType } from "./mailContent";
import { receiveSupplierReply } from "./companyOrders";
import { receiveQuoteReply } from "./companyPurchasing";
import { downloadUrl } from "./mailDocument";
import { configuredDomain } from "./mailSettings";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.stubEnv("AGENTMAIL_API_KEY", "test-key");
  vi.stubEnv("AGENTMAIL_BASE_URL", "https://api.agentmail.to/v0");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function fixture() {
  const t = convexTest(schema, modules);
  for (const name of [
    "@convex-dev/rate-limiter/test",
    "@convex-dev/workflow/test",
    "@convex-dev/agent/test",
  ]) {
    const harness: { default: { register: (instance: typeof t) => void } } = await import(name);
    harness.default.register(t);
  }
  const ids = await t.run(async (ctx) => {
    const org = await ctx.db.insert("organizations", {
      name: "A",
      timezone: "America/Chicago",
      isDemo: false,
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 2 },
    });
    const other = await ctx.db.insert("organizations", {
      name: "B",
      timezone: "America/Chicago",
      isDemo: false,
      approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 2 },
    });
    const user = await ctx.db.insert("users", {
      organizationId: org,
      role: "admin",
      isActive: true,
    });
    const otherUser = await ctx.db.insert("users", {
      organizationId: other,
      role: "admin",
      isActive: true,
    });
    await ctx.db.insert("purchasingInboxes", {
      organizationId: org,
      provider: "agentmail",
      inboxId: "a@agentmail.to",
      email: "a@agentmail.to",
      selectedAt: 1,
    });
    await ctx.db.insert("purchasingInboxes", {
      organizationId: other,
      provider: "agentmail",
      inboxId: "b@agentmail.to",
      email: "b@agentmail.to",
      selectedAt: 1,
    });
    return { org, other, user, otherUser };
  });
  return {
    t,
    ...ids,
    a: t.withIdentity({ subject: ids.user }),
    b: t.withIdentity({ subject: ids.otherUser }),
  };
}
const message = {
  inbox_id: "a@agentmail.to",
  thread_id: "thread-1",
  message_id: "msg-1",
  from: "Supplier <supplier@example.com>",
  to: ["a@agentmail.to"],
  subject: "Quote",
  extracted_text: "10 cases for USD 100",
  labels: ["received"],
  attachments: [],
};
function mockMail(extra?: (url: string, init: RequestInit) => unknown) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const custom = extra?.(url, init);
    if (custom instanceof Response) return custom;
    if (custom !== undefined) return Response.json(custom);
    if (url.includes("/messages/")) return Response.json(message);
    if (url.includes("/threads/"))
      return Response.json({
        inbox_id: "a@agentmail.to",
        thread_id: "thread-1",
        subject: "Quote",
        last_message_id: "msg-1",
        messages: [message],
      });
    if (url.includes("/drafts")) return Response.json({ draft_id: "remote-1" });
    return Response.json({ threads: [], next_page_token: "next" });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
test("HTML-only replies preserve rows/entities and omit scripts, hidden content and quoted terms", () => {
  expect(
    mailBody({
      html: '<style>bad</style><div>New &amp; valid</div><table><tr><td>Total</td><td>USD 100</td></tr></table><blockquote>Old USD 20</blockquote><div class="gmail_quote">Old quoted terms</div><script>bad()</script>',
    }),
  ).toBe("New & valid\n\n| Total | USD 100");
  expect(mailBody({ extracted_text: "New", text: "New plus old" })).toBe("New");
  expect(htmlText("<div hidden>private</div><p>Visible<br>next</p>")).toBe("Visible\nnext");
  expect(mailBody({ extracted_html: "<p>New</p>", html: "<p>Old</p>" })).toBe("New");
});
test("unauthenticated events are preserved once and cannot reach order or quote automation", async () => {
  const { t, a, b } = await fixture();
  const risky = {
    ...message,
    labels: ["received", "unauthenticated"],
    attachments: [
      { attachment_id: "att", filename: "quote.pdf", content_type: "application/pdf", size: 200 },
    ],
  };
  await t.mutation(internal.inbound.onMessageReceived, {
    message: risky,
    thread: {},
    eventId: "evt1",
  });
  await t.mutation(internal.inbound.onMessageReceived, {
    message: risky,
    thread: {},
    eventId: "evt1",
  });
  const rows = await a.query(api.mailReview.reviews, {
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(rows.page).toHaveLength(1);
  expect(rows.page[0].risk).toContain("verification");
  expect(await a.query(api.mailReview.documents, {})).toEqual([]);
  expect(
    (await b.query(api.mailReview.reviews, { paginationOpts: { numItems: 20, cursor: null } }))
      .page,
  ).toEqual([]);
  await expect(
    b.mutation(api.mailReview.acknowledge, { receiptId: rows.page[0]._id }),
  ).rejects.toThrow();
  await a.mutation(api.mailReview.acknowledge, { receiptId: rows.page[0]._id });
  await expect(
    a.mutation(api.mailReview.requestDocument, {
      receiptId: rows.page[0]._id,
      attachmentId: "att",
    }),
  ).rejects.toThrow(/verification/);
  expect(await t.run((ctx) => receiveSupplierReply(ctx, risky, "event"))).toBe(true);
  expect(await t.run((ctx) => receiveQuoteReply(ctx, risky, "event"))).toBe(true);
});
test("unlinked incoming mail stays reviewable without creating a purchase", async () => {
  const { t, a } = await fixture();
  await t.mutation(internal.inbound.onMessageReceived, {
    message: { ...message, extracted_text: undefined, html: "<p>Forwarded quote</p>" },
    thread: {},
    eventId: "evt1",
  });
  const rows = await a.query(api.mailReview.reviews, {
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(rows.page[0]).toMatchObject({ text: "Forwarded quote", subject: "Quote" });
  expect(rows.page[0].orderId).toBeUndefined();
  expect(await a.query(api.companyOrders.list, {})).toEqual([]);
});
test("search and older messages always use the caller's inbox and preserve cursors", async () => {
  const { a, b, t } = await fixture();
  const fetch = mockMail();
  await a.action(api.mailbox.threads, { search: "lids & cups", cursor: "page-two" });
  expect(fetch.mock.calls[0][0]).toContain("/a%40agentmail.to/threads/search?");
  expect(fetch.mock.calls[0][0]).toContain("q=lids+%26+cups");
  expect(fetch.mock.calls[0][0]).toContain("page_token=page-two");
  await expect(b.action(api.mailbox.thread, { threadId: "thread-1" })).rejects.toThrow(/not found/);
  await expect(t.action(api.mailbox.threads, {})).rejects.toThrow();
});
test("drafts save without sending and enforce ownership and revision checks", async () => {
  const { a, b, t } = await fixture();
  const fetch = mockMail();
  const id = await a.action(api.mailDrafts.save, {
    messageId: "msg-1",
    text: "Please confirm arrival.",
  });
  const d = (await a.query(api.mailDrafts.list, {}))[0];
  expect(d.state).toBe("ready");
  expect(d.text).toContain("not a purchase order");
  expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/send"))).toBe(false);
  await expect(
    b.action(api.mailDrafts.send, { draftId: id, version: 1, approvedText: d.text }),
  ).rejects.toThrow();
  await expect(
    a.action(api.mailDrafts.send, { draftId: id, version: 1, approvedText: "Different" }),
  ).rejects.toThrow(/latest/);
  await expect(a.mutation(internal.mailDrafts.claim, { draftId: id, version: 0 })).rejects.toThrow(
    /not ready/,
  );
  expect(await t.run((ctx) => ctx.db.get("mailDrafts", id))).toMatchObject({
    state: "ready",
    version: 1,
  });
});
test("drafts refuse unverified senders and mismatched reply-to addresses", async () => {
  const { a } = await fixture();
  mockMail((url) =>
    url.includes("/messages/") ? { ...message, labels: ["unauthenticated"] } : undefined,
  );
  await expect(
    a.action(api.mailDrafts.save, { messageId: "msg-1", text: "Hello" }),
  ).rejects.toThrow(/verification/);
  mockMail((url) =>
    url.includes("/messages/") ? { ...message, reply_to: ["attacker@example.com"] } : undefined,
  );
  await expect(
    a.action(api.mailDrafts.save, { messageId: "msg-1", text: "Hello" }),
  ).rejects.toThrow(/address/);
});
test("new email invalidates a saved draft before sending", async () => {
  const { a } = await fixture();
  mockMail();
  const id = await a.action(api.mailDrafts.save, { messageId: "msg-1", text: "Arrival?" });
  const d = (await a.query(api.mailDrafts.list, {}))[0];
  const fetch = mockMail((url) =>
    url.endsWith("/drafts/remote-1")
      ? { text: d.text, to: [d.to] }
      : url.includes("/threads/")
        ? { last_message_id: "new-message" }
        : undefined,
  );
  await expect(
    a.action(api.mailDrafts.send, { draftId: id, version: d.version, approvedText: d.text }),
  ).rejects.toThrow(/new email/);
  expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/send"))).toBe(false);
});
test("uncertain sends cannot be retried or edited into a duplicate", async () => {
  const { a } = await fixture();
  mockMail();
  const id = await a.action(api.mailDrafts.save, { messageId: "msg-1", text: "Arrival?" });
  const d = (await a.query(api.mailDrafts.list, {}))[0];
  const fetch = mockMail((url) =>
    url.endsWith("/drafts/remote-1")
      ? { text: d.text, to: [d.to] }
      : url.endsWith("/send")
        ? new Response("", { status: 503 })
        : undefined,
  );
  await a.action(api.mailDrafts.send, { draftId: id, version: d.version, approvedText: d.text });
  expect((await a.query(api.mailDrafts.list, {}))[0].state).toBe("unknown");
  await expect(
    a.action(api.mailDrafts.send, { draftId: id, version: d.version, approvedText: d.text }),
  ).rejects.toThrow();
  expect(fetch.mock.calls.filter(([url]) => String(url).endsWith("/send"))).toHaveLength(1);
});
test("remote recipient changes block sending", async () => {
  const { a } = await fixture();
  mockMail();
  const id = await a.action(api.mailDrafts.save, { messageId: "msg-1", text: "Arrival?" });
  const d = (await a.query(api.mailDrafts.list, {}))[0];
  mockMail((url) =>
    url.endsWith("/drafts/remote-1") ? { text: d.text, to: ["attacker@example.com"] } : undefined,
  );
  await expect(
    a.action(api.mailDrafts.send, { draftId: id, version: d.version, approvedText: d.text }),
  ).rejects.toThrow(/provider draft changed/);
});
test("document signatures and download URLs reject unsafe or mislabeled files", () => {
  expect(documentType(new TextEncoder().encode("%PDF-1.7 test"), "application/pdf")).toBe(
    "application/pdf",
  );
  expect(() =>
    documentType(new TextEncoder().encode("<script>bad</script>"), "application/pdf"),
  ).toThrow();
  for (const url of [
    "http://files.example.com/a",
    "https://127.0.0.1/a",
    "https://user:password@files.example.com/a",
    "https://files.internal/a",
  ])
    expect(() => downloadUrl(url)).toThrow();
});
test("cross-company document downloads and linking are rejected", async () => {
  const { t, org, a, b } = await fixture();
  const receiptId = await t.mutation(internal.mailReview.capture, { message });
  const documentId = await t.run((ctx) =>
    ctx.db.insert("mailDocuments", {
      organizationId: org,
      receiptId: receiptId!,
      attachmentId: "att",
      filename: "q.pdf",
      contentType: "application/pdf",
      status: "ready",
    }),
  );
  expect(await b.query(api.mailReview.download, { documentId })).toBeNull();
  expect(await b.query(api.mailReview.documents, {})).toEqual([]);
  expect(await a.query(api.mailReview.documents, {})).toHaveLength(1);
});
test("custom inbox domains must already be verified", async () => {
  vi.stubEnv("AGENTMAIL_DOMAIN", "purchasing.example.com");
  mockMail(() => ({ status: "pending" }));
  await expect(configuredDomain()).rejects.toThrow(/verified/);
  mockMail(() => ({ status: "verified" }));
  expect(await configuredDomain()).toEqual({ domain: "purchasing.example.com" });
});

test("a saved reply sends exactly once and records the provider receipt", async () => {
  const { a } = await fixture();
  mockMail();
  const id = await a.action(api.mailDrafts.save, { messageId: "msg-1", text: "Arrival?" });
  const d = (await a.query(api.mailDrafts.list, {}))[0];
  const fetch = mockMail((url) =>
    url.endsWith("/drafts/remote-1")
      ? { text: d.text, to: [d.to] }
      : url.endsWith("/send")
        ? { message_id: "sent-1", thread_id: d.threadId }
        : undefined,
  );
  await a.action(api.mailDrafts.send, { draftId: id, version: d.version, approvedText: d.text });
  expect((await a.query(api.mailDrafts.list, {}))[0]).toMatchObject({
    state: "sent",
    providerMessageId: "sent-1",
  });
  await expect(
    a.action(api.mailDrafts.send, { draftId: id, version: d.version, approvedText: d.text }),
  ).rejects.toThrow();
  expect(fetch.mock.calls.filter(([url]) => String(url).endsWith("/send"))).toHaveLength(1);
});

test("unknown send outcomes reconcile by a matching labeled provider message without resending", async () => {
  const { a } = await fixture();
  mockMail();
  const id = await a.action(api.mailDrafts.save, { messageId: "msg-1", text: "Arrival?" });
  const d = (await a.query(api.mailDrafts.list, {}))[0];
  mockMail((url) =>
    url.endsWith("/drafts/remote-1")
      ? { text: d.text, to: [d.to] }
      : url.endsWith("/send")
        ? new Response("", { status: 503 })
        : undefined,
  );
  await a.action(api.mailDrafts.send, { draftId: id, version: d.version, approvedText: d.text });
  const fetch = mockMail((url) =>
    url.includes("/messages?")
      ? { messages: [{ message_id: "sent-1" }] }
      : url.includes("/messages/sent-1")
        ? {
            inbox_id: d.inboxId,
            message_id: "sent-1",
            thread_id: d.threadId,
            from: d.inboxId,
            to: [d.to],
            text: d.text,
            labels: [`buyer-draft-${d._id}`],
          }
        : undefined,
  );
  expect(await a.action(api.mailDrafts.checkSend, { draftId: id })).toBe(true);
  expect((await a.query(api.mailDrafts.list, {}))[0].state).toBe("sent");
  expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

test("inbox-scoped credentials are encrypted and used only for their company", async () => {
  const { a, b, t, org } = await fixture();
  vi.stubEnv("AGENTMAIL_CREDENTIAL_KEY", btoa("a".repeat(32)));
  const fetch = mockMail((url) =>
    url.endsWith("/api-keys") ? { api_key: "inbox-private-key", api_key_id: "key-1" } : undefined,
  );
  await a.action(api.mailSettings.enableRestrictedAccess, {});
  const row = await t.query(internal.mailSettings.credentials, { organizationId: org });
  expect(row?.encryptedKey).not.toContain("inbox-private-key");
  await a.action(api.mailbox.threads, {});
  await b.action(api.mailbox.threads, {});
  const calls = fetch.mock.calls.filter(([url]) => String(url).includes("/threads?"));
  expect(new Headers(calls[0][1]?.headers).get("Authorization")).toBe("Bearer inbox-private-key");
  expect(new Headers(calls[1][1]?.headers).get("Authorization")).toBe("Bearer test-key");
  const status = await a.action(api.mailSettings.status, {});
  expect(status.restricted).toBe(true);
  expect(JSON.stringify(status)).not.toContain("inbox-private-key");
});

test("attachment retrieval enforces byte limits and leaves failures reviewable", async () => {
  const { t, org } = await fixture();
  const receiptId = await t.mutation(internal.mailReview.capture, { message });
  const documentId = await t.run((ctx) =>
    ctx.db.insert("mailDocuments", {
      organizationId: org,
      receiptId: receiptId!,
      attachmentId: "att",
      filename: "quote.pdf",
      contentType: "application/pdf",
      status: "reading",
    }),
  );
  const fetch = mockMail(() => ({
    attachment_id: "att",
    size: 9 * 1024 * 1024,
    download_url: "https://files.example.com/quote.pdf",
  }));
  await expect(t.action(internal.mailDocument.extract, { documentId })).rejects.toThrow(/large/);
  expect(fetch.mock.calls).toHaveLength(1);
  expect((await t.run((ctx) => ctx.db.get("mailDocuments", documentId)))?.fileId).toBeUndefined();
});

test("duplicate attachment events run one document workflow and retain reviewable evidence", async () => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  const { t, a } = await fixture();
  const parsed = {
    kind: "quote",
    supplier: "Supply Shop",
    reference: "Q100",
    currency: "USD",
    total: "100",
    arrival: "",
    summary: "Arrival missing; review before buying.",
    lines: [
      {
        name: "Lids",
        sku: "LID-16",
        quantity: "10",
        unit: "cases",
        unitPrice: "10",
        evidence: "LID-16 10 cases USD 10",
      },
    ],
  };
  const extract = vi
    .spyOn(Agent.prototype, "generateObject")
    .mockResolvedValue({ object: parsed } as never);
  mockMail((url) =>
    url.includes("/attachments/")
      ? { attachment_id: "att", size: 20, download_url: "https://files.example.com/quote.pdf" }
      : url.startsWith("https://files.example.com/")
        ? new Response("%PDF-1.7 sample bytes", { headers: { "Content-Type": "application/pdf" } })
        : undefined,
  );
  const incoming = {
    ...message,
    attachments: [
      { attachment_id: "att", filename: "quote.pdf", content_type: "application/pdf", size: 20 },
    ],
  };
  await t.mutation(internal.mailReview.capture, { message: incoming });
  await t.mutation(internal.mailReview.capture, { message: incoming });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const documents = await a.query(api.mailReview.documents, {});
  expect(documents).toHaveLength(1);
  expect(documents[0]).toMatchObject({ status: "ready", facts: parsed });
  expect(documents[0].fileId).toBeTruthy();
  expect(documents[0].reviewedAt).toBeUndefined();
  expect(extract).toHaveBeenCalledTimes(1);
  expect(await a.query(api.companyOrders.list, {})).toEqual([]);
});

test("the patched provider callback quarantines unauthenticated events even without labels", async () => {
  vi.useFakeTimers();
  const { t, a } = await fixture();
  const providerPath: string = "@agentmail/convex/test",
    poolPath: string = "@convex-dev/workpool/test";
  const provider: { default: { schema: Parameters<typeof t.registerComponent>[1] } } = await import(
    providerPath
  );
  const pool: { default: { register: (instance: typeof t, name: string) => void } } = await import(
    poolPath
  );
  t.registerComponent(
    "agentmail",
    provider.default.schema,
    import.meta.glob([
      "../node_modules/@agentmail/convex/src/component/**/*.{ts,js}",
      "!../node_modules/@agentmail/convex/src/component/**/*.d.ts",
    ]),
  );
  pool.default.register(t, "agentmail/callbackPool");
  pool.default.register(t, "agentmail/sendPool");
  const fnHandle = await t.run(() => createFunctionHandle(internal.inbound.onMessageReceived));
  await t.mutation(components.agentmail.lib.handleEvent, {
    event: {
      type: "event",
      event_id: "provider-unauth",
      event_type: "message.received.unauthenticated",
      message: { ...message, labels: undefined, timestamp: "2026-09-15T10:00:00Z" },
      thread: {},
    },
    config: { retryAttempts: 1, initialBackoffMs: 1, onMessageReceived: { fnHandle } },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const reviews = await a.query(api.mailReview.reviews, {
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(reviews.page).toHaveLength(1);
  expect(reviews.page[0].risk).toContain("verification");
});

test("customer domain setup is owned, normalized and cannot claim another company's domain", async () => {
  const { a, b } = await fixture();
  const id = await a.mutation(internal.mailDomains.reserve, {
    domain: "Purchasing.Acme.com.",
    username: "Buyer",
  });
  expect(await a.query(api.mailDomains.current, {})).toMatchObject({
    _id: id,
    domain: "purchasing.acme.com",
    username: "buyer",
  });
  expect(await b.query(api.mailDomains.current, {})).toBeNull();
  await expect(
    b.mutation(internal.mailDomains.reserve, { domain: "purchasing.acme.com", username: "buyer" }),
  ).rejects.toThrow("already");
  for (const domain of [
    "https://acme.com",
    "acme.com/path",
    "buyer@acme.com",
    "buyers.buyhard.app",
    "agentmail.to",
  ]) {
    await expect(
      b.mutation(internal.mailDomains.reserve, { domain, username: "buyer" }),
    ).rejects.toThrow("subdomain");
  }
});

test("verification switches new purchases while preserving the original inbox and credentials", async () => {
  const { t, a, b, org } = await fixture();
  const id = await a.mutation(internal.mailDomains.reserve, {
    domain: "purchasing.acme.com",
    username: "buyer",
  });
  await expect(
    t.mutation(internal.mailDomains.activate, {
      id,
      inboxId: "buyer@purchasing.acme.com",
      podId: "pod-a",
    }),
  ).rejects.toThrow("not verified");
  await t.mutation(internal.mailDomains.save, {
    id,
    podId: "pod-a",
    providerId: "domain-a",
    status: "verified",
    records: [],
  });
  await t.mutation(internal.mailDomains.activate, {
    id,
    inboxId: "buyer@purchasing.acme.com",
    podId: "pod-a",
  });
  await t.mutation(internal.mailDomains.activate, {
    id,
    inboxId: "buyer@purchasing.acme.com",
    podId: "pod-a",
  });
  expect(await a.query(api.mailbox.addresses, {})).toEqual([
    { email: "buyer@purchasing.acme.com", active: true },
    { email: "a@agentmail.to", active: false },
  ]);
  expect(
    (await a.query(internal.companyMail.context, { inboxId: "a@agentmail.to" })).organizationId,
  ).toBe(org);
  await expect(
    b.query(internal.companyMail.context, { inboxId: "a@agentmail.to" }),
  ).rejects.toThrow("not found");
  const receipt = await t.mutation(internal.mailReview.capture, { message });
  expect(receipt).toBeTruthy();
  const { conversationInbox } = await import("./mailIdentity");
  expect(await t.run(async (ctx) => (await conversationInbox(ctx, org))?.inboxId)).toBe(
    "a@agentmail.to",
  );
  expect(
    await t.run(
      async (ctx) => (await conversationInbox(ctx, org, "buyer@purchasing.acme.com"))?.inboxId,
    ),
  ).toBe("buyer@purchasing.acme.com");
});

test("customer domain sync uses its Pod and waits for verification before creating an inbox", async () => {
  const { a } = await fixture();
  const fetch = mockMail((url, init) => {
    if (url.endsWith("/pods")) return { pod_id: "pod-a" };
    if (url.endsWith("/verify")) return new Response(null, { status: 204 });
    if (url.includes("/domains/"))
      return {
        domain_id: "domain-a",
        domain: "purchasing.acme.com",
        pod_id: "pod-a",
        status: "PENDING",
        records: [
          { type: "TXT", name: "dkim.purchasing.acme.com", value: "key", status: "MISSING" },
        ],
      };
    throw new Error(`Unexpected ${init.method} ${url}`);
  });
  await a.action(api.mailDomains.connect, {
    domain: "purchasing.acme.com",
    username: "buyer",
    ownsDomain: true,
  });
  expect(await a.query(api.mailDomains.current, {})).toMatchObject({
    status: "pending",
    records: [{ value: "key" }],
  });
  expect(fetch.mock.calls.some((c) => String(c[0]).endsWith("/inboxes"))).toBe(false);
});

test("verified domains create a stable inbox and repeated checking does not switch again", async () => {
  const { a } = await fixture();
  const fetch = mockMail((url) => {
    if (url.endsWith("/pods")) return { pod_id: "pod-a" };
    if (url.includes("/domains/"))
      return {
        domain_id: "domain-a",
        domain: "purchasing.acme.com",
        pod_id: "pod-a",
        status: "VERIFIED",
        records: [],
      };
    if (url.endsWith("/inboxes")) return { inbox_id: "buyer@purchasing.acme.com", pod_id: "pod-a" };
    throw new Error(url);
  });
  await a.action(api.mailDomains.connect, {
    domain: "purchasing.acme.com",
    username: "buyer",
    ownsDomain: true,
  });
  await a.action(api.mailDomains.check, {});
  expect(fetch.mock.calls.filter((c) => String(c[0]).endsWith("/inboxes"))).toHaveLength(1);
  expect(await a.query(api.mailDomains.current, {})).toMatchObject({
    inboxId: "buyer@purchasing.acme.com",
  });
});

test("wrong Pod responses never attach domains or inboxes", async () => {
  const { a } = await fixture();
  mockMail((url) =>
    url.endsWith("/pods")
      ? { pod_id: "pod-a" }
      : {
          domain_id: "domain-a",
          domain: "purchasing.acme.com",
          pod_id: "pod-b",
          status: "VERIFIED",
        },
  );
  await expect(
    a.action(api.mailDomains.connect, {
      domain: "purchasing.acme.com",
      username: "buyer",
      ownsDomain: true,
    }),
  ).rejects.toThrow("ownership");
  expect((await a.query(internal.companyMail.context, {})).email).toBe("a@agentmail.to");
});

test("automatic DNS setup never offers a link that replaces business email", async () => {
  const { t, a } = await fixture();
  const id = await a.mutation(internal.mailDomains.reserve, {
    domain: "purchasing.acme.com",
    username: "buyer",
  });
  await t.mutation(internal.mailDomains.save, {
    id,
    podId: "pod-a",
    providerId: "domain-a",
    status: "pending",
    records: [],
  });
  mockMail((url) =>
    url.endsWith("/setup-link")
      ? {
          supported: true,
          url: "https://dns.example/approve",
          conflicting_provider: "Google Workspace",
        }
      : { pod_id: "pod-a", domain: "purchasing.acme.com" },
  );
  expect(await a.action(api.mailDomains.setupLink, {})).toMatchObject({
    url: null,
    conflict: "Google Workspace",
  });
});
