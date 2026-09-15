# Link payments for BUY HARD

## What this adds

BUY HARD's browser worker can connect an owner's Link wallet, request approval
for a checkout total, and fill a provider-issued virtual card into a merchant's
card form. The model never receives the card object. Final order submission still
uses BUY HARD's separate approval and receipt checks.

This integration is running against BUY HARD's development backend in test mode.
The app-to-worker connection flow was checked in the in-app browser: Link returned
its hosted URL and verification phrase, and the URL opened Link's own login page.
No wallet was connected. Funding, merchant acceptance and a real order receipt
still require an observed pilot; automated tests do not establish those outcomes.

## Why Link

Stripe confirmed that Muse uses Link's wallet for agents. Stripe provides a
public SDK and CLI for the same payment primitives. Link owns card entry and
wallet approval; BUY HARD does not need to store the owner's underlying card.
Virtual cards work with ordinary card checkout forms, while other Link products
support participating programmatic checkouts.

Sources checked September 14, 2026:

- [Stripe's Muse announcement](https://stripe.com/newsroom/news/stripe-helps-meta-muse-shop-with-link)
- [Stripe Link SDK](https://github.com/stripe/link-cli/tree/main/packages/sdk)
- [Stripe Link CLI and current limits](https://github.com/stripe/link-cli)

The reviewed upstream revision is `75dcffd3114e8c34d35181d7e6615e9a7e719813`.
Installed versions: `@stripe/link-sdk` **0.4.2** and `@stripe/link-cli` **0.19.2**.
Native embedded approval and higher limits require discussing access with Stripe
at its documented `agent-spend@stripe.com` address. No contact has been sent.

## Operator setup

The existing browser worker already needs `DATA_DIR` and a 32-byte
`SESSION_ENCRYPTION_KEY`. The payment broker uses those for authenticated
encryption, with a separate wallet for each organization and payment owner.

- `LINK_PAYMENT_MODE=test` is the default. The broker explicitly requests
  provider test credentials.
- `LINK_PAYMENT_MODE=live` enables real provider requests. Set it only for an
  approved live pilot.
- No global `LINK_ACCESS_TOKEN` is used. The CLI child strips inherited `LINK_*`
  settings so one user's configured session cannot leak into another wallet.
- The owner connects through the app. Link supplies a hosted URL and matching
  verification phrase. The owner enters payment information directly in Link.

Auth is encrypted on the worker volume. Each official CLI auth call uses a
random private temporary directory, then encrypts the resulting state and removes
the temporary directory. Use a private ephemeral filesystem for the worker's
temporary directory; do not collect worker memory, form values or temporary
files in diagnostic systems.

## Broker contract

`createLinkPaymentBroker({ dir, encryptionKey })` exports these operations:

| Operation                                     | Result                                                         |
| --------------------------------------------- | -------------------------------------------------------------- |
| `connect({ organizationId, paymentOwnerId })` | Connection state, hosted URL and phrase                        |
| `connection(scope)`                           | Connection state; completes pending provider login             |
| `disconnect(scope)`                           | Removes local access and attempts provider revocation          |
| `requestPayment(job, quote)`                  | Owner approval URL and safe payment metadata                   |
| `status(job)`                                 | Current provider status and safe payment metadata              |
| `cancelPayment(job)`                          | Cancels an unsubmitted request when possible                   |
| `renewPayment(job)`                           | Explicit owner retry for a denied, expired or canceled request |
| `injectPayment({ page, job, requestId })`     | Fills the issued card; returns brand and last four digits      |

A quote contains `amountCents`, `currency`, `merchantUrl`, and `merchantName`.
The runtime must independently verify the displayed quote before calling the
broker. The binding covers organization, owner, order, item, quantity, unit,
shipping destination, merchant origin, currency and total. The same binding has
a stable provider idempotency key. A changed checkout needs a different approval.

The worker journal may keep the returned `payment` metadata. Auth and provider
request bindings are encrypted separately. The model, Convex and journal must
never receive SDK card responses. Provider error bodies are not suitable logs.

`injectPayment` accepts only approved requests whose returned amount, currency and
merchant match. It finds supported visible card controls in the merchant page or
known payment-provider frames, marks and hides their text before filling, and
does not submit. All observations and human help screenshots must mask sensitive
controls, including `[data-buy-hard-payment]`, in every frame.

## Pilot boundaries

The first implementation accepts USD and caps each request at $500. Provider
eligibility and actual remaining limits may reduce availability. Link currently
requires US wallets. The integration does not bypass identity verification,
payment declines, CAPTCHAs or merchant access restrictions.

Try a small, nonrecurring school-supply purchase after connecting a funded wallet.
Check the full checkout terms, approve the Link request, complete BUY HARD's
purchase approval, then verify both the merchant order reference and Link's
transaction outcome. An issued card or accepted provider request alone is not a
completed order.

## Local verification

Run `node --test payments.test.mjs` from `workers/browser-checkout`.
Tests cover encrypted owner isolation, stable spend requests, explicit renewal, changed terms,
submitted-payment protection, credential-free outputs, expiry rejection and a
real headless Chromium card form. Provider calls use synthetic fixtures. No live
card or purchase is required for these checks. A separate live device-authorization
probe confirmed that the pinned CLI returns Link's hosted verification URL and
matching phrase. It used a synthetic local scope and stopped before login; its
temporary state was deleted. No wallet was connected and no spend was requested.

The browser runtime also has opt-in live-model tests against a controlled store.
They cover both a normal checkout and a store requiring payment before showing
delivery details. These test the actual model and headless browser, with simulated
payment and order endpoints. They are not purchases from a real merchant.

## Purchase flow

1. Ask the buyer for an item and quantity. Set the delivery address in the company.
2. The buyer researches the exact product and opens the store checkout. It can
   begin before the store reveals tax, shipping or delivery dates.
3. Unverified terms appear as "Checking checkout total and delivery" and cannot
   be approved. The browser checks the actual cart before presenting a price.
4. If payment is needed, connect Link in Settings and approve its merchant and
   amount request. A payment-first store may require this before final review.
5. Approve the verified purchase in BUY HARD. The worker resumes the retained cart,
   verifies the terms again, submits once and looks for the merchant receipt.
6. Login or other interruptions return a short-lived browser handoff. A missing
   receipt remains uncertain; it is not automatically submitted again.

Production Convex and the production worker are separate from development. A
live pilot requires the approved application release and `LINK_PAYMENT_MODE=live`
on `browser-worker-prod`, which calls `reliable-albatross-463`. Development uses
`browser-worker`, calls `festive-coyote-483`, and must remain in test mode.
