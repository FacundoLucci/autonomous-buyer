# AgentMail: product opportunity and messaging

Reviewed September 15, 2026 against official AgentMail documentation and the local BUY HARD source at `b317194`. This is a source review, not a fresh production email test. Account settings, domain verification, webhook subscriptions, plan limits and actual delivery were not inspected.

Implementation update: the recommended app changes are now implemented and the backend is on development. See [delivered behavior, tests and remaining release steps](agentmail-implementation-2026-09-15.md). The review below records the pre-change findings.

## Recommendation

Make supplier email a core part of the buying story: **“Your buyer has its own email address.”** Explain the work it enables: requesting quotes, chasing missing details, sending approved purchase orders and keeping replies with the purchase. The current company flow implements these jobs; they are not confined to the old demo.

We use AgentMail's central capabilities meaningfully, but we are not yet getting all the useful value from the service. Prioritize reliable incoming documents and a complete supplier conversation over adding every available API.

## What the code uses

| Capability | BUY HARD evidence | Assessment |
| --- | --- | --- |
| Dedicated company inboxes and Pods | `convex/companyMail.ts`: `provision`, `provisionForCompany`; stable client IDs, company ownership checks | Implemented. A Pod groups each company's mail. Runtime requests still use the configured API key; separate scoped keys are not provisioned here. |
| Quote requests and threaded follow-ups | `convex/companyPurchasing.ts`: `requestQuote`, `followup`, `receiveQuoteReply` | Implemented in the current company flow. Follow-ups ask for complete terms, run after 24 hours and cap at two. This is not open-ended negotiation. |
| Approved purchase orders and cancellation requests | `convex/companyOrders.ts`: `queuePurchaseOrder`, `requestCancellation` | Implemented. Supplier acceptance of emailed purchase orders must be verified; spending retains approval. |
| Incoming replies linked to purchases | `convex/http.ts`, `convex/inbound.ts`, company quote/order handlers | Implemented through webhooks, inbox/thread matching and expected sender checks. Unlinked incoming mail does not become a new buying task. |
| Reply extraction and confirmation | Company reply handlers prefer `extracted_text`; `convex/companyConfirmation.ts` uses OpenAI plus exact evidence checks | AgentMail supplies message content and strips quoted replies. BUY HARD/OpenAI interpret purchasing facts. Do not credit AgentMail with our buying decisions. |
| Delivery problems | `companyOrders.reconcile`, `onMailEvent` | Provider status and later bounce/reject/complaint handling exist. Initial `sent` and `delivered` both become app status `sent`; neither means supplier acceptance or goods received. |
| Inbox reading | `companyMail.messages`, `readMessage` | Latest 30 messages and individual text bodies. No user search, pagination or complete conversation view in these actions. |

## Gaps worth addressing

1. **Reliable incoming mail before broader automation.** Quote/order handlers use extracted text, plain text and sometimes preview, with no HTML fallback. HTML-only replies can be ignored or sent to review without their terms. AgentMail explicitly documents this case. Normalize HTML safely and preserve the source message. [Webhook events](https://docs.agentmail.to/events)

2. **Separate unverified mail from trusted business updates.** Our component patch routes `message.received.unauthenticated` into the regular incoming callback. The downstream quote/order handlers check the claimed sender address but do not inspect the `unauthenticated` label. A signed webhook proves provider delivery, not sender identity. Route these messages to review before allowing confirmation/cancellation state changes. Whether the live webhook subscribes to this event remains unverified. AgentMail offers label visibility permissions and sender lists; evaluate these alongside app checks. [Permissions](https://docs.agentmail.to/permissions), [Lists](https://docs.agentmail.to/lists)

3. **Read emailed quotes and invoices.** AgentMail supports incoming/outgoing attachments, but no attachment retrieval or parsing was found in BUY HARD's mail handlers. Existing invoice upload is a separate path. Add PDF/image document intake with file limits, source evidence, company ownership and review for uncertain terms. An invoice must not automatically mean goods have arrived. This is the strongest next product expansion. [Attachments](https://docs.agentmail.to/attachments)

4. **Keep the whole supplier conversation useful.** Add company-scoped search and full threads so the owner can ask what a supplier last quoted or promised. The provider has thread/search capabilities; the current recent-message reader does not use them. A forwarded invoice or a new, unlinked thread needs explicit matching and review rather than silent association. [Capabilities](https://docs.agentmail.to/knowledge-base/what-is-agentmail)

5. **Prepare replies people can inspect.** AgentMail supports stored drafts, reply/forward drafts and scheduled sending. We currently compose messages in app code and schedule follow-ups in Convex. Use provider drafts when they improve review of a changed date, missing charge or proposed substitution. Keep approval, stale-plan checks and duplicate prevention in BUY HARD; migrating timers alone adds little user value. [Drafts](https://docs.agentmail.to/drafts)

6. **Verify identity and isolation settings.** Company provisioning passes no custom domain. AgentMail supports custom domains and scoped access keys; inspect the live account before calling either absent. A recognizable purchasing address and restricted company access are useful production improvements. Do not move an existing business mailbox's DNS as part of a messaging change. [Custom domains](https://docs.agentmail.to/custom-domains), [Multi-tenancy](https://docs.agentmail.to/multi-tenancy)

The installed `@agentmail/convex` wrapper exposes fewer capabilities than the provider: inboxes, sending/replying/forwarding, status and thread/message reads. We already use direct REST calls for Pods. Missing wrapper methods are not evidence that AgentMail lacks a feature.

AgentMail's homepage also advertises semantic search, data extraction and Agent Armor. Treat those as vendor-advertised capabilities until the relevant API, availability and behavior are verified for our account. Do not base a current BUY HARD claim on the homepage alone. [AgentMail](https://www.agentmail.to/)

WebSockets, IMAP/SMTP, agent sign-in and additional framework integrations are lower priority for this product. Existing webhooks already support background work. Labels could help mail triage, but Convex should remain the source of truth for approvals, orders and stock.

## Messaging to use

**Product headline:** Your buyer has its own email address.

**Product copy:** BUY HARD gives your buyer a purchasing inbox powered by AgentMail. It can request quotes, follow up on missing details and send approved purchase orders to suppliers that accept them. Replies stay linked to the purchase. You approve the spend.

**Founder draft:** I gave BUY HARD's buyer its own email address with AgentMail. It can ask suppliers for a quote, follow up on missing details and keep their replies with the purchase. I want the routine back-and-forth to take less of the owner's day, while spending still needs approval.

**Future story, explicitly a question:** What if you could forward a supplier's PDF quote to your buyer and have the next purchase prepared for review?

Keep these as local copy until paired with a checked asset. Show the inbox, outgoing request, matching supplier reply and resulting purchase together. Label sample footage; use a controlled provider run to prove email behavior and an authorized real order to prove purchasing. Do not claim negotiation, automatic document reading, delay recovery or time savings as verified today.

## Next proof

First test HTML-only and unauthenticated replies locally. Then prepare one controlled supplier conversation: request, incomplete quote, follow-up, complete terms, human approval and matching confirmation. Record provider IDs and the exact app result. Include duplicate delivery and mismatched sender cases. Sending the controlled emails requires authorization for the concrete recipients and messages.

After that, prioritize a PDF quote arriving by email and being attached to the right buy for review. This would make AgentMail visibly more valuable than an outbound email credit.
