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
- Production app/backend and `browser-worker-prod` were not released in this run.
- Commits are local; they were not pushed.

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

After approving a production release, connect Link directly in the app and pilot
one specified item, merchant and maximum total. Verify both the merchant receipt
and Link outcome before claiming that merchant as successfully tested. See
[Link integration and setup](./link-agent-payments.md).
