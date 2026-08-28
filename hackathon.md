# Hackathon log

- **Project:** Autonomous Buyer
- **Event:** Convex All Gas Hackathon
- **What it does:** Detects stockout risk and coordinates a human-approved supplier sourcing, RFQ, quote, and purchase-order workflow.
- **Live app:** https://reliable-albatross-463.convex.site
- **Repo:** https://github.com/FacundoLucci/autonomous-buyer
- **Frontend:** Convex static hosting
- **Convex deployment:** https://reliable-albatross-463.convex.cloud (production)
- **Components:** @convex-dev/static-hosting, @convex-dev/workflow, @convex-dev/agent, @firecrawl/firecrawl-convex, @agentmail/convex
- **Convex features:** typed schema, indexed data model, repeatable demo seeding, typed environment contract, reactive queries, actions, scheduled functions, component-backed threads, server-enforced approval identity
- **Auth:** Convex Auth
- **AI models:** OpenAI `gpt-5.4-mini`
- **Started:** 2026-08-27T00:36:38Z
- **Last updated:** 2026-08-28T23:09:56Z

## Log

### 2026-08-27

Started the public build log for a new, empty workspace. No application code,
Convex project, or deployment exists yet.

### 2026-08-27

Selected Convex static hosting for the frontend. Component setup will wait until
a Convex application exists.

### 2026-08-27

Created the TanStack Start and Convex development scaffold, registered Convex
static hosting, and verified the static `dist/client/index.html` artifact for
`convex.site`. Installed the full shadcn Base UI catalog and OXC, then saved the
supplied product spec and dependency-ordered implementation plan. No public
frontend deployment, AI model, authentication, or external supplier interaction
exists yet. The scaffold loads in a live browser with all three build stages
visible and no console errors.

### 2026-08-27 — BC-02

Registered the durable workflow, Firecrawl, and AgentMail components on the
development deployment. Added the app's typed schema and indexes, a typed
provider environment contract, and a public query that reports only configured
or missing. A live browser showed OpenAI, OpenRouter, Firecrawl, and AgentMail as
missing without exposing values, with zero console errors or warnings. No real
provider credentials were added and no external calls or emails were sent.

### 2026-08-27 — BC-03

Added the deterministic inventory, ordering, money, quote, approval, purchase-order,
confirmation, and procurement-state engine. One internal mutation now validates every
procurement-state change and writes its matching audit event atomically. A temporary browser
diagnostic verified the visible calculations and policy outcomes with zero console
errors or warnings, then was removed. The development Convex push and full static
checks passed. No unit-test suite, external calls, emails, public deployment, or
production changes were added.

### 2026-08-27 - d1453d3

Added repeatable Acme Foods demo runs with 90 days of varied usage across three
inventory items. Reset restores 3,240 lids at 612/day with three safety-stock
days, creates a fresh `demoRunId`, and preserves external AgentMail history.
It also seeds Apex purchase history, separate controlled identities, and
clearly marked demo metrics. Hidden `/?demo=1` controls proved ready → active →
ready with zero browser console errors. Convex features: schema, tables,
indexes, mutations, query, and realtime query (`convex/schema.ts`,
`convex/demo.ts`, `src/routes/index.tsx`). No external calls or emails occurred.

### 2026-08-27 — BC-05 + BC-06 — fdd65b0

Replaced the scaffold with a realtime purchasing dashboard and focused
procurement, recommendation, approval, and purchase-order views backed by
Convex queries. Added contextual thread-link states without rendering an icon
until a stored link exists. Starting the demo now calculates lid risk from
stored usage, creates at most one active `PC-*` buy for that item and run,
persists the inputs and calculation version, records Detected and Analyzing,
then begins sourcing (`convex/purchasing.ts`, `convex/demo.ts`,
`convex/schema.ts`, `src/routes/index.tsx`).

### 2026-08-27 — BC-07 — f9fc6e3

Added eight strict AI task contracts for sourcing, product matching, quote
understanding, follow-ups, recommendations, confirmations, and exceptions.
Queued Convex Node actions use OpenAI `gpt-5.4-mini` by default with an
OpenRouter fallback, validate stored evidence references, separate confirmed
from inferred fields, and persist explicit failures. Registered
`@convex-dev/agent` for stable procurement-anchored threads with realtime
thinking, unread, and read states (`convex/ai.ts`, `convex/aiNode.ts`,
`convex/aiContracts.ts`, `convex/convex.config.ts`, `src/routes/index.tsx`).

### 2026-08-27 — BC-08 — 340207e

Added Firecrawl-backed supplier discovery that requires at least two distinct
supplier websites and stores search runs, results, supplier products, and
source claims. Each candidate schedules structured product-equivalence analysis,
while the realtime UI exposes match status and source links. Convex features:
action, mutations, query, and scheduled functions (`convex/sourcing.ts`,
`convex/schema.ts`, `src/routes/index.tsx`).

### 2026-08-27 — BC-09 — 9e7e1e6

Added controlled RFQ preparation after real supplier discovery. It creates
three previews for separate controlled identities, asks AI to draft the fixed
commercial questions without changing supplied fields, and keeps recipient
approval and sending as separate later steps (`convex/rfqs.ts`,
`convex/ai.ts`, `convex/aiContracts.ts`, `src/routes/index.tsx`).

### 2026-08-27 — BC-10 — 8f22e83

Added buyer-gated AgentMail RFQ delivery. Sending requires the exact confirmation
phrase, three approved external recipients, and complete previews. Stable
idempotency keys and provider receipts prevent duplicate sends; delivery
reconciliation stores message and thread links and advances to Awaiting quotes
only after provider success (`convex/mail.ts`, `convex/schema.ts`,
`src/routes/index.tsx`). No email was sent during this phase.

### 2026-08-27 — BC-11 — bcbe968

Added signed AgentMail webhook handling for inbound supplier replies. It
deduplicates event and provider message IDs, maps the provider thread to its RFQ,
stores source evidence, and schedules structured quote extraction. A development
test accepted a signed `message.received` example, rejected unsigned traffic
with `401 invalid signature`, and ignored the duplicate replay; the canned
unlinked thread correctly did not create a quote (`convex/http.ts`,
`convex/inbound.ts`, `convex/ai.ts`, `convex/schema.ts`).

### 2026-08-27 — BC-12

Added stored, idempotent automatic follow-ups for incomplete supplier quotes.
The workflow asks only for missing availability, freight, or arrival details,
increments the attempt before sending, replies in the existing AgentMail
thread, and stops after two attempts for buyer review. The browser now shows
the exact requested fields and wording for every attempt. Convex development
push, OXC, type checking, production build, and local browser load passed. The
real incomplete-reply and completed-reply proof remains pending; this change
did not send email.

### 2026-08-27 — BC-13

Added immutable quote-comparison snapshots and deterministic ranking across
arrival, product match, landed cost, excess inventory, supplier reliability,
and payment terms. The selected quote and every losing reason are stored before
OpenAI writes a sourced explanation; the model cannot change the winner. The
browser comparison exposes each input and its source label. Convex development
push and all static checks passed. Live three-reply proof remains pending.

### 2026-08-27 — BC-14

Kept the dashboard public while adding stable Convex Auth for protected approval
actions. The configured buyer can use a password account; judges can enter a
real anonymous auth session with one click and may approve demo procurements
only. The server derives organization, role, and approver identity and validates
Approve, Modify, and Reject transitions. A live browser proved the public page
and judge-auth round trip, while the Convex development push and all static
checks passed. Full approval audit proof awaits a recommendation from real quote
replies.

### 2026-08-27 — BC-15

Added one stable purchase order per signed approval. Each stored order includes
the buyer and supplier, ship-to and bill-to, item, exact approved quote revision,
deterministic price math, required date, payment terms, RFQ reference, and an
accessible HTML preview. Judge identities cannot send email. A configured buyer
must separately approve a real recipient with an exact confirmation phrase;
AgentMail delivery is then idempotent and advances the workflow only after a
successful provider receipt. The development backend, full static checks, and a
live browser reload passed. No purchase order was sent.

### 2026-08-27 — BC-16

Added durable supplier-confirmation processing on the exact purchase-order email
thread. OpenAI extracts only the terms stated in the reply; deterministic code
checks quantity, SKU, price, freight, total, arrival, and payment terms against
the approved order. Material changes create a visible exception. Matching terms
create confirmed incoming inventory and change the public inventory status from
Action Required to Covered. The development backend, static checks, and live
browser surface passed. Real reply and two-window realtime proof remain gated by
the controlled email flow.

### 2026-08-27 — BC-17

Hardened the public demo boundary and resume behavior. Public and judge views
hide recipient addresses and provider record IDs. Judge mode may run demo-only
steps but cannot reset shared data, create an AgentMail inbox, approve external
recipients, or send email. Failed PO delivery resumes the same durable outbound
record instead of creating another message. Provider readiness, evidence-source
labels, actionable safe errors, loading states, keyboard labels, responsive
layouts, and the two-attempt follow-up cap remain visible. Computer browser proof
confirmed the judge-safe controls, while the development backend and all static
checks passed. Configured-buyer reset and real delivery resume proof remain
gated by the controlled live rehearsal.

### 2026-08-27 — BC-18

Completed the full controlled rehearsal in the Convex development deployment
with the configured buyer and two user-controlled Gmail inboxes. AgentMail sent
three RFQs, received real replies, and sent focused follow-ups. Follow-up terms
now merge into immutable quote revisions, and missing fields are derived from
the merged record instead of trusting inconsistent model labels. The stored
comparison selected SupplyCo at $3,000 with arrival on 2026-09-01; the cheaper
RestaurantSupply quote and Apex quote were both rejected for late arrival.
The configured buyer approved exact quote revision 3, and AgentMail delivered purchase order
`PO-PC-0180-8DBWV3` exactly once to the approved controlled recipient. OpenAI
extracted supplier confirmation `SC-2026-0827-0180` at 99% confidence; every
term matched, the procurement reached Confirmed, and a confirmed 15,000-unit
expected inventory record was created. Browser proof also exposed and fixed the
approval review-state transition and the unit-price display. No production
deployment or public repository action occurred.

### 2026-08-28 - 569e612

Deployed the backend and static frontend to production deployment
`reliable-albatross-463` and completed the controlled flow on the exact public
host. Procurement `PC-9258` selected the only on-time SupplyCo quote: 15,000
units at $0.20 each, $0 freight, $3,000 total, arriving 2026-09-02 on Net 30.
AgentMail delivered `PO-PC-9258-8DAPKN` once to the approved controlled address.
OpenAI extracted supplier confirmation `SC-2026-0828-9258`; the deterministic
comparison matched every approved term and created 15,000 confirmed incoming
units, changing inventory to Covered. A fresh browser session entered judge
mode with one click, displayed the complete dashboard and evidence, hid
controlled recipient addresses, disabled shared reset/start controls, and
could not send external email. OXC, formatting, TypeScript, and production
build checks passed. No repository publication or hackathon submission occurred.
