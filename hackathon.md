# Hackathon log

- **Project:** Autonomous Buyer
- **Event:** Convex All Gas Hackathon
- **What it does:** Detects stockout risk and coordinates a human-approved supplier sourcing, RFQ, quote, and purchase-order workflow.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** https://festive-coyote-483.convex.cloud (development)
- **Components:** @convex-dev/static-hosting, @convex-dev/workflow, @firecrawl/firecrawl-convex, @agentmail/convex, @convex-dev/auth
- **Convex features:** typed schema, indexed data model, repeatable demo seeding, typed environment contract, reactive queries, server-enforced approval identity
- **Auth:** stable Convex Auth password account plus one-click anonymous judge-demo access
- **AI models:** none
- **Started:** 2026-08-27T00:36:38Z
- **Last updated:** 2026-08-27T15:26:14Z

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

### 2026-08-27 — BC-04

Added a repeatable Acme Foods demo run with 90 days of varied usage for three
inventory items, the exact 3,240-lid and 612/day starting state, three Apex
purchase-history records, three separate controlled supplier identities, and
clearly marked demo metrics. Hidden browser controls at `/?demo=1` start or
reset only local scenario records; reset never calls AgentMail or deletes its
provider history. Browser proof showed ready → active → ready, restored all
starting values, and reported zero console errors or warnings. A fresh reset
created a different `demoRunId`. Convex development push and full static checks
passed; no external calls, emails, public deployment, or production changes
were made.

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
