# Supplier website worker

BUY HARD runs its own Chromium browsers on Railway. No merchant-specific adapter, selector configuration or managed browser vendor is required. Users may add any public HTTPS buying website. The agent reads its visible page and screenshot, prepares the requested cart, and asks for help if it cannot establish the terms.

Convex owns purchase approval. The worker compares product, quantity, unit, address, delivery date, price, shipping, tax and total with the approved snapshot. It checks approval again immediately before the final click and journals submission first. Changed terms require a new approval. A lost receipt produces an uncertain outcome; it never automatically repeats the purchase.

## Runtime

The agent uses the OpenAI Responses API with screenshot and visible-page input (`gpt-5.4`, configurable). Each job is bounded to 60 actions and eight minutes, with individual network and browser timeouts. Final terms need visible evidence and a second model review. This is general browser operation, not a guarantee that every merchant works. CAPTCHAs, unavailable products, unsupported payment flows and ambiguous delivery dates require help. Merchant-specific automation defenses can still prevent ordering.

The browser keeps the live cart through supplier help, Link payment approval, and final purchase approval. A bounded action history helps it avoid loops and duplicate cart additions. Temporary model/page failures recover in place. Receipt checks can wait for a slow confirmation without clicking Buy again.

## Payment

Use **Settings → Pay for purchases → Connect Link**. Link hosts card entry and issues a virtual card for the approved merchant and amount; raw card data stays outside the model, Convex, and job journal. The trusted worker fills supported merchant/payment-provider card fields. See [Link integration and current limits](../../docs/link-agent-payments.md).

Some stores need a card before showing final delivery/tax. The buyer can ask for a Link spending approval at that step, then finish preparing the actual order for approval in BUY HARD. Supplying payment details does not grant the final purchase click.

Navigation rejects recognizable final-purchase controls and request patterns. These checks supplement model review; they cannot classify every possible merchant action. Browser traffic passes through a local HTTPS proxy which resolves and pins public IP addresses, rejecting private networks and cloud metadata. Service workers and WebSockets are disabled. Popup flows require help.

## Railway deployment

Deploy this folder as the build root using its Dockerfile and railway.json. Mount a persistent volume at `/data`, use one replica, and expose port 8080 through Railway HTTPS. `/health` checks that Chromium is connected. The job journal and company/supplier locks require one process per volume.

Required variables:

- `BROWSER_WORKER_SECRET`: random 32+ character shared secret, also configured in Convex.
- `SESSION_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hexadecimal characters.
- `OPENAI_API_KEY`; optional `COMPUTER_USE_MODEL` defaults to `gpt-5.4`.
- `CONVEX_SITE_URL`: the matching Convex deployment's HTTPS site URL.
- `PUBLIC_URL`: Railway's HTTPS worker URL for temporary supplier help sessions.
- `DATA_DIR=/data`, `PORT=8080`.
- `LINK_PAYMENT_MODE=test` for development (default); `live` for an approved live rollout.
- `RELEASE_SHA`: the deployed source revision, returned by `/health`.

Configure `BROWSER_WORKER_URL` and the matching secret in that same Convex deployment. Do not point multiple deployments at a worker with a different approval callback.

Supplier browser storage is isolated by company, payment owner, and supplier origin and encrypted using AES-256-GCM. Job journals contain commercial terms; protect the volume accordingly. Screenshots are not saved. Human sign-in uses an expiring help link while the agent is stopped. Finishing help retains the page and revokes human access until a fresh handoff. Help links expire after ten minutes and idle sessions close after fifteen minutes. A worker restart retains encrypted supplier access and the submission journal; it cannot preserve a live page across a process restart.

The Docker entrypoint holds an exclusive file lock on the volume so a second process cannot submit the same purchase. Dependency install scripts are disabled: the pinned Link CLI is used only for its official authentication flow.

## Verification

```
npm ci --ignore-scripts
npx playwright install chromium
npm test
```

Tests use headless Chromium and ordinary checkout HTML, with no supplier adapter. They cover preparation, approved submission, changed terms, revoked approval, payment handoff, wallet isolation, live-cart transfer, temporary outages, uncertain receipts and public-network filtering. Set `BUYER_LIVE_MODEL_TEST=1` with `OPENAI_API_KEY` to run live-model checkouts against controlled stores, including a store that requests payment before delivery terms. These create local test orders, not real merchant purchases.

A real merchant is counted as tested only after a confirmed app-placed order. Hosting, a prepared cart and controlled test purchases do not increment that public metric.
