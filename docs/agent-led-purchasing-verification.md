# Agent-led purchasing: implementation verification

Status: application backend and frontend deployed to development (`festive-coyote-483`) on 2026-09-10 from implementation commit `b820cef`. Production remains unchanged. The separate browser worker is committed but not hosted; a hosting destination is still required. No real supplier messages, purchases, account credentials or hosted browser sessions were used in verification.

## Implemented

- Item-level replenishment activation and pause, stock/usage forecasting, reserve/coverage settings and order multiples in the item's counting unit.
- Immediate reevaluation after counts, usage, rules, receipts and supplier changes; scheduled reorder checks with hourly recovery.
- Separate physical-count and forecast history. Receipts after running out add usable stock; changed usage applies prospectively.
- Automatic company purchasing workflows and research threads, independent of a user's open conversation. Version checks prevent stale work from replacing newer plans.
- Public tested-merchant metric: a merchant is added automatically after the first confirmed app-placed email or website order. Atomic per-order markers prevent duplicate counts; the landing page shows total orders, merchant count and the top 20 merchant totals with a Convex credit. Demo orders, manual reports and unknown outcomes do not count. Public output contains merchant identity and aggregate counts only. No historical backfill or invented totals.
- Company supplier directory in Settings: add any public buying website, approve/pause suppliers, browser/email/both findings, special notes and dated sources. Amazon and WebstaurantStore are starter suggestions, not certified integrations. Read-only agent assessment has bounded research, retries, timeout recovery and stale-result protection. Paused suppliers are blocked at purchase approval and execution.
- Supplier research and exact evidence checks, supplier product-code mapping, deterministic offer comparison, quote requests and bounded followups.
- Purchase-order preference when acceptance and contact are verified. Approval queues execution; uncertain attempts cannot silently switch channels or submit again.
- Matching supplier confirmation processing, partial receiving, cancellation requests and reconciliation. An external cancellation must be confirmed before incoming stock is removed.
- Hosted browser worker with isolated encrypted supplier sessions, cart preparation, approval recheck immediately before submission, one permitted commit, and receipt reconciliation after uncertain outcomes.
- Existing frontend retained with agent progress, **Approve and order**, replenishment controls, secondary one-off buying, supplier help, and explicit sample labels.

## Local evidence

The repository's existing `pnpm test:backend` suite covers stock timing, duplicate checks, approval invalidation, private company access, exact evidence matching, confirmation/cancellation parsing and receipt replay. A complete local purchase-cycle test uses an explicitly identified provider stand-in: automatic buy, verified offer, approval, matching supplier confirmation and receipt. It does not establish live email delivery or live model research.

The browser worker's `npm test` launches real Chromium against a controlled local store. It checks preparation without purchasing, exact approved submission, changed-price rejection, premature-submit blocking and revoked approval. Computer actions in this test are scripted; live model behavior and a real supplier checkout remain unverified.

Local Playwright review exercised the sample purchase approval through receiving readiness without a second order/send action, replenishment pause, editable coverage/priorities, and the mobile layout. At 390 px, measured page content width was 390 px. The supplier directory sample was also checked at 390 px with no horizontal overflow or browser console errors. The public `?demo=1` link was also corrected to handle the router's numeric parsing.

Final local checks passed: **96 tests in the main suite; the earlier 4 real Chromium worker tests also passed**, plus TypeScript, lint, formatter, build and `git diff --check`. Convex code generation refreshed bindings; its analysis upload is not a deployment activation.

The merchant metric layout was checked with explicitly labeled local sample counts on desktop and 390 px mobile, including zero and unavailable states. Temporary fixture files were removed. The deployed development landing page now reads the public metric successfully: zero orders and zero tested merchants, with no browser console errors. The hosted index and checked assets match the local build. The unavailable state was checked before deployment. Email-only merchants are identified by supplier domain or a private mailbox key; if an email-only supplier later gains a website, it can currently appear as a second merchant identity.

## Required before live use

1. The development application is deployed at `festive-coyote-483`; production is outside this change's deployment authority. Complete live supplier validation before a production release. Existing inventory remains opted out until someone enables replenishment.
2. Verify the existing OpenAI, Firecrawl and AgentMail connections with a controlled company and approved email recipients. Prove an actual quote request, PO delivery, supplier reply and receipt cycle.
3. Validate live supplier assessment with the configured OpenAI/Firecrawl services; the local tests cover assessment state and evidence checks, not live model research. Adding a website does not create a working checkout integration. Choose a real website supplier and product. Configure and verify its cart/receipt extraction and permitted checkout endpoints; an arbitrary supplier website is not automatically supported.
4. Host the worker with HTTPS, protected persistent storage, model access and session encryption. Configure its Convex callback and the optional `BROWSER_WORKER_URL` / `BROWSER_WORKER_SECRET`. See the [worker setup](../workers/browser-checkout/README.md).
5. Prove the selected supplier's login, final terms, approval pause, actual order receipt and recovery against an explicitly approved test purchase. A prepared cart alone is not a completed-order proof.

Missing worker configuration or an unsupported supplier produces a visible help state. It never reports a successful purchase. Until the live checks are complete, this work should be described as a locally verified implementation, not a launched autonomous purchasing service.
