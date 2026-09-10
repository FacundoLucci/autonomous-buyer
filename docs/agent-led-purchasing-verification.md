# Agent-led purchasing: implementation verification

Status (2026-09-10): the development app (`festive-coyote-483`) is connected to a hosted generic browser worker on Railway. Merchant adapters and supplier-specific configuration have been removed. The production app (`reliable-albatross-463`) remains unchanged; its separate Railway worker is prepared for release. No real merchant purchases were made by these launch checks.

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
- Production worker: https://browser-worker-prod-production.up.railway.app; callback `reliable-albatross-463`. Production Convex has not been connected yet.
- Development `/health` returned healthy Chromium. Unauthenticated jobs returned HTTP 401. Two identical dispatches returned the same job ID. A read-only public-page job reached a truthful help state through the live model. Help HTML and screenshot returned HTTP 200, and closing the help session succeeded. The same execution journal remained readable after a Railway restart. A fake order sent to the development approval callback returned `authorized: false`.
- No smoke check increments the public merchant metric. Only a confirmed real app-placed merchant order qualifies.

## Production release remaining

The application target is `reliable-albatross-463`. Before publishing the new application:

1. Add a separate matching Auth 2 key pair (`AUTH_PRIVATE_KEY`, base64 PKCS8, and `AUTH_JWKS` with key ID). Preserve legacy `JWT_PRIVATE_KEY` and `JWKS` so existing accounts remain compatible.
2. Configure `BROWSER_WORKER_URL` to the production worker and copy that worker's own shared secret into `BROWSER_WORKER_SECRET`. Never copy development's worker secret/callback configuration.
3. Deploy backend with `pnpm exec convex deploy`, then frontend with `pnpm exec static-hosting upload --prod --dist dist/client --build-command "pnpm build"`. Schema validation must pass; verify hosted frontend targets the production backend and hosted signup/login works afterward.
4. Use the production `.convex.site` hostname initially. A custom hostname needs its final passkey origin and relying-party ID before onboarding users.

The deployment guard requires explicit approval naming the production target before these production Convex writes. The production worker itself can be provisioned and checked in advance.

## Real supplier validation

Verify a chosen supplier's sign-in, exact product and cart, approval pause, actual merchant confirmation and recovery using an explicitly approved purchase. Adding a public HTTPS website no longer requires an integration, but it does not guarantee the agent can complete that merchant's checkout. CAPTCHA, missing delivery dates and unusual payment flows can still require human help. Navigation guards recognize common purchase controls and network patterns; they do not classify every possible merchant action.

Production already has OpenAI, Firecrawl and AgentMail credentials. Real supplier email delivery/reply and an actual website purchase remain separate evidence from the launch checks here. Optional off-site alert email still needs `ALERT_EMAIL_URL`, `ALERT_EMAIL_SECRET` and `APP_URL`. Passkey recovery/multiple-passkey management is not yet exposed, as documented in onboarding. Existing inventory remains opted out until replenishment is enabled.
