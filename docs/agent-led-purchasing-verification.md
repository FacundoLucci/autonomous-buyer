# Agent-led purchasing: implementation verification

Status (2026-09-10): the development app (`festive-coyote-483`) is connected to a hosted generic browser worker on Railway. Merchant adapters and supplier-specific configuration have been removed. The production backend and website (`reliable-albatross-463`) are deployed and connected to their separate, healthy Railway worker after explicit release approval. No real merchant purchases were made by these launch checks.

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
- Hosted browser worker with isolated encrypted supplier sessions, cart preparation, approval recheck immediately before submission, a single final click, and explicit manual reconciliation after uncertain outcomes.
- Existing frontend retained with agent progress, **Approve and order**, replenishment controls, secondary one-off buying, supplier help, and explicit sample labels.

## Local evidence

The repository's existing `pnpm test:backend` suite covers stock timing, duplicate checks, approval invalidation, private company access, exact evidence matching, confirmation/cancellation parsing and receipt replay. A complete local purchase-cycle test uses an explicitly identified provider stand-in: automatic buy, verified offer, approval, matching supplier confirmation and receipt. It does not establish live email delivery or live model research.

The browser worker's tests launch real Chromium against ordinary checkout HTML with no merchant adapter. They cover preparation, exact approved submission, changed prices, revoked approval, premature purchase, unsupported evidence, lost receipts, replay refusal and private-network exclusion. An additional test used the actual OpenAI `gpt-5.4` model to prepare and confirm one controlled local order. This establishes live model operation on the controlled store, not a real merchant purchase.

Local Playwright review exercised the sample purchase approval through receiving readiness without a second order/send action, replenishment pause, editable coverage/priorities, and the mobile layout. At 390 px, measured page content width was 390 px. The supplier directory sample was also checked at 390 px with no horizontal overflow or browser console errors. The public `?demo=1` link was also corrected to handle the router's numeric parsing.

Final local checks passed: **99 backend tests, eight worker checks, and one separately enabled live-model checkout test**, plus TypeScript, lint, formatter, build and `git diff --check`. Convex code generation refreshed bindings; its analysis upload is not a deployment activation.

The merchant metric layout was checked with explicitly labeled local sample counts on desktop and 390 px mobile, including zero and unavailable states. Temporary fixture files were removed. The deployed development landing page now reads the public metric successfully: zero orders and zero tested merchants, with no browser console errors. The hosted index and checked assets match the local build. The unavailable state was checked before deployment. Email-only merchants are identified by supplier domain or a private mailbox key; if an email-only supplier later gains a website, it can currently appear as a second merchant identity.

## Hosted worker evidence

Railway project: `buyer` (`278523d4-09e9-43a3-9f24-8df0fb6f2bec`). Each service has its own `/data` volume, session encryption key, shared secret and Convex callback. One replica per service.

- Development worker: https://browser-worker-production-90df.up.railway.app; callback `festive-coyote-483`.
- Production worker: https://browser-worker-prod-production.up.railway.app; callback `reliable-albatross-463`. Production Convex is connected with its own matching shared secret.
- Development `/health` returned healthy Chromium. Unauthenticated jobs returned HTTP 401. Two identical dispatches returned the same job ID. A read-only public-page job reached a truthful help state through the live model. Help HTML and screenshot returned HTTP 200, and closing the help session succeeded. The same execution journal remained readable after a Railway restart. A fake order sent to the development approval callback returned `authorized: false`.
- Final Railway deployments reached `SUCCESS`: development `cec78239-d5da-4fe2-bd89-c62a080f9d03`, production worker `2fafd254-8757-46f7-9f0d-786e196bf5e2`. Both use implementation commit `3d49932`. Both health endpoints returned healthy Chromium; the production worker also completed a live-model public-page smoke check and correctly requested a real product page. No purchase was submitted.
- No smoke check increments the public merchant metric. Only a confirmed real app-placed merchant order qualifies.

## Production release evidence — 2026-09-10

Released https://reliable-albatross-463.convex.site after explicit approval. Configured a separate Auth 2 key pair and the production worker URL/shared secret; legacy authentication keys were preserved. Backend deployment completed with schema validation and no deleted indexes. Production static hosting built with `VITE_CONVEX_URL=https://reliable-albatross-463.convex.cloud` and published all 67 files.

The hosted index and main JavaScript asset match the local production build. The public merchant query returns zero merchants and zero orders without errors. The production worker health endpoint reports connected Chromium. The authenticated production approval callback rejects a nonexistent order with `authorized: false`.

A headed Chromium session with a software WebAuthn authenticator verified passkey account creation, private setup access, session persistence after reload, sign-out to the account form, and sign-in back to the same account. No browser errors or warnings appeared. The clearly named QA account `qa-prod-launch-20260910` has no company, inventory or purchases. This checks hosted browser authentication; a person's device approval is not simulated as a real hardware interaction.

Use the production `.convex.site` hostname initially. A custom hostname needs its final passkey origin and relying-party ID before onboarding users.

## Real supplier validation

Verify a chosen supplier's sign-in, exact product and cart, approval pause, actual merchant confirmation and recovery using an explicitly approved purchase. Adding a public HTTPS website no longer requires an integration, but it does not guarantee the agent can complete that merchant's checkout. CAPTCHA, missing delivery dates and unusual payment flows can still require human help. Navigation guards recognize common purchase controls and network patterns; they do not classify every possible merchant action.

Production already has OpenAI, Firecrawl and AgentMail credentials. Real supplier email delivery/reply and an actual website purchase remain separate evidence from the launch checks here. Off-site alert settings (`ALERT_EMAIL_URL`, `ALERT_EMAIL_SECRET` and production `APP_URL`) were migrated and their shared-secret connection checked without sending email. Passkey recovery/multiple-passkey management is not yet exposed, as documented in onboarding. Existing inventory remains opted out until replenishment is enabled.

## Production environment audit — 2026-09-10

Every configured development variable has a production counterpart. Migrated alert settings and the working AgentMail API key; the old production key returned HTTP 403 and the replacement can access the configured inbox with HTTP 200. Registered an enabled production AgentMail callback for received, sent, delivered, bounced, rejected and complained events and installed its own verification secret. No supplier messages were sent.

`APP_URL`, `AUTH_ORIGIN` and `AUTH_RP_ID` use the production hostname. Preserved production Auth 2 and legacy signing keys, browser-worker URL/shared secret, session-encryption key and worker callback. Railway model/runtime settings match development while deployment-specific values remain separate. `OPENROUTER_API_KEY`, `FIRECRAWL_WEBHOOK_SECRET` and `AGENTMAIL_BASE_URL` are optional and unset in both deployments; there were no source values to migrate.
