# Hackathon log

- **Project:** Autonomous Buyer
- **Event:** Convex All Gas Hackathon
- **What it does:** Detects stockout risk and coordinates a human-approved supplier sourcing, RFQ, quote, and purchase-order workflow.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** https://festive-coyote-483.convex.cloud (development)
- **Components:** @convex-dev/static-hosting, @convex-dev/workflow, @firecrawl/firecrawl-convex, @agentmail/convex
- **Convex features:** typed schema, indexed data model, typed environment contract, reactive integration-status query
- **Auth:** none
- **AI models:** none
- **Started:** 2026-08-27T00:36:38Z
- **Last updated:** 2026-08-27T11:20:14Z

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
