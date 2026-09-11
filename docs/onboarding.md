# Signup and company onboarding

`/setup` starts with Convex Auth 2.0 passkeys: an account name, then the device's
passkey prompt. The account exists before any company questions appear. Returning
passkey users enter the same name. Existing password accounts use
`/setup?mode=login&method=password`; their users and company memberships remain intact.

After signup, the flow asks for the company and delivery address, then a product
page link or invoice. Firecrawl reads the linked product page; the existing
TanStack AI/OpenAI extraction layer reads the page or uploaded PDF, image, CSV, TXT, XLSX, or DOCX. Link
imports select only the page's main product. Invoices list up to 20 inventory
lines so the user can choose the first item. Extracted seller, SKU, pack size and
explicit delivery evidence are retained with the source. The user confirms the
counting unit, then supplies current stock and daily usage or defers either.
A three-day reserve is disclosed and adjustable in the desk.

The user does not have to guess a supplier lead time. Unknown terms remain null;
shipping/dispatch time, business-day estimates and historical invoice quantities
are not used as delivery time or current stock. The workspace's **Needs your
input** area requests missing supplier, delivery and usage details. Stock counts
can be updated separately. Human-confirmed delivery information is attributed to
the member and time. Coverage and reorder calculations require the necessary
known inputs.

Company and selected-item creation is atomic and idempotent. Progress is scoped
to the signed-in user in this browser; passwords and private passkeys are never
stored in the onboarding draft. Source jobs run in the Convex Workflow component,
with results also recorded in an Agent component thread. Source records and uploads
are restricted to their owner; workspace reads and edits use company membership.
Uploads accept PDF, PNG, JPEG, CSV, TXT, XLSX, and DOCX up to 8 MB, with server checks of file signatures.
Imports are limited to 20 per account per hour and retried once on provider errors.
Unreadable sources offer another source or a manual item fallback.

The final connection creates a dedicated AgentMail Pod and purchasing inbox with
stable client IDs. A failed connection preserves the company and item, with a way
to retry or open the desk. This step creates email infrastructure; it sends no mail.
The desk supports buy links and approved purchase orders, followed by supplier
confirmation and receiving. Supplier discovery and autonomous negotiation remain
part of the separate demo; private companies choose their own supplier and terms.
See [company ordering](company-ordering.md) for the live workflow and email configuration.

## Auth 2 compatibility

Auth 2 is pinned to `2.0.0-alpha.1` under the `@convex-dev/auth2` alias. Auth 1 remains
for existing password accounts and configured demo access. The alpha needs a small
patch allowing its core to use an explicit issuer. New sessions use
`CONVEX_SITE_URL/auth`, while legacy sessions keep their original issuer and keys.
This avoids older tokens (which have no key ID) becoming invalid. Browser token
storage is also separate. Users are resolved by signed user ID, never by matching
an unverified email or account name.

Development is `festive-coyote-483`. Hosted sign-in uses
`AUTH_ORIGIN=https://festive-coyote-483.convex.site` and
`AUTH_RP_ID=festive-coyote-483.convex.site`. The code defaults to the deployment
site when these overrides are absent. For a separate local-only development
deployment, set `AUTH_ORIGIN=http://localhost:3000` and `AUTH_RP_ID=localhost`. Auth 2 uses base64 PKCS8
`AUTH_PRIVATE_KEY` and a matching `AUTH_JWKS` with a key ID. Legacy signing keys were
preserved. Passkeys are bound to their relying party: a localhost passkey cannot
be used on the hosted site. Keep the origin and relying-party ID aligned when
changing domains. Auth 2 does not
yet expose multi-passkey management or account recovery in this implementation.
Production (`reliable-albatross-463`) was released on 2026-09-10 with separate Auth 2 signing keys and the default production site origin/relying-party ID. Hosted passkey signup, reload persistence, sign-out and sign-in passed using a software authenticator.

## Validation

- `node scripts/qa/source-onboarding.mjs`: development integration checks with
  disposable accounts and a software WebAuthn authenticator. It defaults to the
  hosted review origin; set `BUYER_QA_ORIGIN` for a separately configured local
  deployment. Covers signup before
  setup, cryptographic login, real two-item PDF extraction, unknown terms,
  idempotent completion, company isolation, invalid inputs, and human gap answers.
- `node --test src/lib/source-evidence.test.ts`: rejects dispatch, business-day,
  ranged and mismatched delivery claims, and normalizes counting units.
- `node scripts/qa/product-link.mjs`: legacy password compatibility plus a real
  Firecrawl product-page import. No email sends occur in either script.
- Hosted browser checks use the real signup screen with a software WebAuthn
  authenticator and verify that the signed-in company setup survives a reload.
  Landing steps are checked at phone, tablet, and desktop widths. Device approval
  of a human passkey remains a manual check. The September 6 company-ordering
  rehearsal also created a real AgentMail inbox, sent a clearly marked test PO to
  the app owner, verified alerts through the owner's inbox, and received the test order.

Results are in `output/onboarding/source-checks.json` and
`output/onboarding/product-link-check.json`. These scripts create QA records in
**development** and call the real extraction providers; they are not offline tests.

## Guarded company form agent (local fix, September 10)

Company setup now has a dedicated agent with two argument-free tools,
`processCompanyReply` and `clarifyCompanyField`. The processor reads the current authenticated message itself,
then sends it to a separate structured extractor. Its entire output contract is
`companyName` and `shippingAddress`, with explicit nulls for unknown values, plus
a constrained help category and field when the user requests clarification.
It cannot supply inventory IDs, quantities, purchase terms, or arbitrary UI text.
The server validates and saves the patch, then chooses the next predefined question
from the remaining required fields. The workspace still requires the user's save
button. A failed tool call shows an error instead of silently repeating a question.

A supplied bare website can be read for a public company name. The delivery address
must come from the user, not a public address. Website failures allow manual replies.
The desktop setup keeps the conversation and company preview side by side, including
when the draft is empty; mobile stacks them. Manual entry is in the company column.

Validation: 28 focused offline checks; an opt-in real-model test covers the reported
`luhvfood.com` / `LUHV FOOD` conversation, off-topic input, incomplete address, and
completed address. Website results in that test are fixtures. Run it with
`BUYER_LIVE_ONBOARDING_CHECK=1` and a supplied `OPENAI_API_KEY`; the ordinary test
suite skips external model calls. Browser layout fixtures passed at 1440px and
390px with no horizontal overflow. These checks are not production deployment or
a real account's end-to-end signup proof.

When the user needs help, the second tool selects approved explanations, examples,
rephrased questions, website alternatives, delivery-address guidance, or reasons a
field is needed. It ends with the next missing question. It cannot write form
values or publish arbitrary model prose. A mixed reply can supply a real company
detail and request help; the detail is saved before clarification. Stale or non-setup
help calls are rejected. Visible help uses the same word-by-word reveal as questions.
