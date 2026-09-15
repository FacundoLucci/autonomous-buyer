# Purchasing runtime verification

Checked September 14, 2026 (America/Chicago).

## Release state

- Initial workspace checkpoint: `699e050`.
- Browser and Link implementation: `ecd4354`.
- Payment recovery and takeover hardening: `197a577`.
- Development app: https://festive-coyote-483.convex.site
- Development worker: https://browser-worker-production-90df.up.railway.app
- Railway deployment `3eab74cb-8365-4606-bbd4-a15d4d834786`: `SUCCESS`.
- Worker health readback: release `197a577`, callback
  `https://festive-coyote-483.convex.site`, adaptive browser, Link, test mode.
- Final frontend upload: `11b171b7-a65e-445e-a483-52a78262ee34`.
- At the September 14 development closeout, production had not yet been released.
- Commits are local; they were not pushed.

## Production release — September 15

The user explicitly approved publishing the verified release and enabling real
Link payments. Application release: `3a69b7c93aa38326a10cc09933fc57afa7db9821`.

- Production Convex deployment completed: `reliable-albatross-463`.
- Production app: https://reliable-albatross-463.convex.site
- Production worker: https://browser-worker-prod-production.up.railway.app
- Railway deployment `af2b22e0-dd9b-4ea8-b4d9-7956eaa0fab4`: `SUCCESS`.
- Worker health readback: `release: 3a69b7c`, `mode: adaptive`, `paymentMode: live`,
  `payments: link`, and callback `https://reliable-albatross-463.convex.site`.
- Frontend production upload: `9fec775f-8b5a-467c-b100-4db15d09fc0a`.
- Production build and type checking passed. All 28 served HTML asset references
  matched the production build. Entry, route and style asset bytes matched. The
  client contains the production backend URL and no development backend URL.
- Production approval validation rejects unauthenticated requests and returns
  false for unknown orders. The wallet action rejects unauthenticated callers.
- A synthetic live-mode connection probe returned Link's hosted device setup URL
  and verification phrase. It stopped before account login, then removed its
  pending connection state. No wallet, card or spend was created.
- Development worker readback remains test mode against `festive-coyote-483`.

No data migration was needed: all five added order fields are optional, and
existing approval keys are unchanged when the pending-terms flag is absent.
Production public/sign-in pages were checked in the in-app browser. An owner
was not signed in during production verification; authenticated payment UI was
previously checked in development.

## Checked behavior

| Check                                                         | Result                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| App/backend suite                                             | 174 passed; 2 existing optional tests skipped                                                     |
| Browser, payment and HTTP lifecycle suite                     | 51 passed                                                                                         |
| Live-model controlled checkout                                | Passed; observed one test purchase and receipt                                                    |
| Live-model payment-first controlled checkout                  | Passed; prepared terms, one test purchase and receipt                                             |
| Type checking, lint, build and changed-file formatting        | Passed                                                                                            |
| In-app browser: hosted development sign-in and purchase pages | Passed using a synthetic workspace                                                                |
| Unpriced order presentation                                   | Shows checking checkout total/delivery; no price, arrival or purchase approval shown              |
| In-app browser: app to Convex to hosted worker to Link        | Hosted URL and verification phrase returned; opened Link's login page                             |
| Deployment assets                                             | All 28 HTML asset references match local output; sampled entry, route and style files match bytes |

The existing SEO handler changes title/meta content when serving HTML, so the raw
served HTML hash differs from the build. Asset references and checked asset bytes
match the final upload.

Recovery tests cover retained carts, stale approvals, payment renewal, interrupted
provider calls, worker restart before/after cart transfer, revoked help sessions,
and one browser writer. The purchase grant remains one-use. Missing receipts are
uncertain and never trigger an automatic repeat purchase. Genuine unknown outcomes
still require supplier-history reconciliation.

The temporary QA account was deactivated, its test buy closed, and its item
archived. Pending Link connection state and the local credential file were removed.
The temporary internal QA functions were removed and Convex redeployed. Temporary
browser tabs were closed.

## Evidence limits and next live step

No real wallet was connected, no live card was issued and no real merchant order
was placed. The live-model tests used real model calls and headless Chromium with
controlled merchant/payment fixtures. No public merchant success count was changed.

The Link path currently supports eligible US wallets, USD and up to $500 per
request, subject to provider account/daily limits. Ordinary supported card forms
can use the issued card. Login challenges, unsupported forms or unavailable terms
can still require help. This is not proof of universal merchant support.

Production is now enabled. Connect Link directly in the app and pilot one
specified item, merchant and maximum total. Verify both the merchant receipt
and Link outcome before claiming that merchant as successfully tested. See
[Link integration and setup](./link-agent-payments.md).
