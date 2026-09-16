# AgentMail implementation — September 15, 2026

## Delivered

- Supplier replies use extracted text or safely converted HTML. Scripts, hidden content and quoted HTML are excluded from new reply text.
- Unauthenticated, blocked and spam-labeled messages cannot update quotes, confirmations or cancellations. The AgentMail component preserves the unauthenticated classification even when its callback payload omits labels.
- Incoming messages are retained in a company-owned review queue. Reviewing an email does not trust its sender or replay its business effects. The queue can fetch unverified mail directly from AgentMail, including older pages.
- Up to five supported attachments per incoming message enter a bounded document workflow. PDF, PNG and JPEG files are capped at 8 MB, checked by file signature, stored privately and extracted with OpenAI. Documents retain their message and attachment identity, source file, extracted facts and line evidence. They remain suggestions until reviewed; they never mark stock received or authorize spending.
- The inbox offers provider search, paginated conversations and older messages within a thread. The existing buyer assistant routes email/history/document requests to these controls.
- Documents can be linked explicitly to a company purchase and opened from its activity. Unlinked/forwarded documents remain in Documents for matching; they do not silently create purchases or apply quoted terms.
- Reply templates cover missing terms, changed dates and alternative products. Replies are editable and saved as AgentMail drafts. Sending requires the exact saved text and recipient, a current draft revision, unchanged purchase context and no newer conversation message. Drafts are for information requests; existing order and cancellation controls remain the execution path.
- Unknown send results cannot be resent automatically. “Check sending outcome” looks for a matching provider message with the draft's label and records the receipt if found.
- New inbox provisioning supports an already-verified `AGENTMAIL_DOMAIN`. Existing addresses are preserved. The UI reports domain and access status.
- Inbox reads, documents and drafts can use an encrypted inbox-scoped key. The existing component continues to deliver approved orders through the protected service connection. This is not a claim that all mail access has moved off the service key.
- The current landing page now explains “Your buyer has its own email address” and AgentMail's role. Product and founder campaign plans already carry the same message.

## Verification

- Full suite: **193 passed, 2 skipped** across 27 files. The pre-existing skipped tests were not enabled by this work.
- New coverage includes the actual patched provider callback, HTML-only confirmations, unauthenticated confirmation/cancellation rejection, company isolation, duplicate document events, attachment size/signature checks, document workflow and extraction persistence, unchanged stock after linking, remote recipient changes, stale drafts, one-time send claims, uncertain send reconciliation and encrypted scoped credentials.
- Provider operations and the document model use stand-ins in these tests. This proves app behavior, not live email delivery or the model's accuracy on customer documents.
- Typecheck, lint, production build and whitespace checks pass.
- In-app browser: desktop and 390px inbox checks cover conversation loading, older messages, reply preparation/save/review, simulated send, document linking, unverified-mail acknowledgement and empty search. No console errors; mobile width did not overflow. The save form's submit-button issue found during this check was fixed and retested.
- The actual local landing page shows the AgentMail section; its 390px check also had no overflow or console errors.
- Backend deployed successfully to **development `festive-coyote-483`**. A live unauthenticated inbox request was rejected as expected. The frontend was built and tested locally, not published to production.

## Live account observations and release steps

Read-only checks using the configured development and production credentials returned the same visible configuration:

- No custom domains.
- One enabled webhook targeting `reliable-albatross-463.convex.site` with sent, delivered, received, bounced, rejected and complained events. It does not subscribe to unauthenticated events; the new manual review refresh provides a read path for those messages.
- One organization key without explicit restricted permissions and one Pod-scoped key with restricted permissions. Existing keys were not rotated or removed.

Before production release:

1. Approve and deploy the reviewed app/backend changes to production. Changes are currently in the local working tree; no commit or push was made in this implementation turn.
2. Choose the purchasing domain, create/verify it in AgentMail and set `AGENTMAIL_DOMAIN` only after verification. DNS for existing business mailboxes was not changed. Domain selection is still open.
3. Set a new random 32-byte base64 `AGENTMAIL_CREDENTIAL_KEY` on the intended deployment, then enable restricted inbox access for each company. Never use a `VITE_` variable for this secret. Read-only inspection did not establish who owns the existing Pod key, so it was preserved.
4. If key creation is interrupted, inspect and revoke any orphaned provider key before resetting its local `creating` record. Do not blindly issue another key. Store only encrypted credentials; do not print provider key responses.
5. Approve concrete controlled sender/recipient inboxes and test quote → follow-up → complete terms → human approval → supplier confirmation with real provider receipts. The shared account's current webhook points to production; do not redirect it to development for a rehearsal.

No real supplier was contacted, no purchase was made, and no production deployment, domain or webhook configuration was changed.

## Local review

Run `pnpm exec vite --config output/qa/agentmail-inbox/vite.config.ts` and open `http://127.0.0.1:4317/` in the in-app browser for the clearly labeled, simulated inbox UI fixture. It renders the actual inbox component with local stand-ins and never sends emails. Use `pnpm dev:web` for the actual app.

Relevant code: `convex/mailContent.ts`, `mailReview.ts`, `mailDocument.ts`, `mailbox.ts`, `mailDrafts.ts`, `mailSettings.ts`, `mailProvider.ts`, `mailFields.ts`; `src/components/desk/mail.tsx`; `convex/mail.test.ts` and the added company-order regression case.
