# Supplier website worker

BUY HARD runs its own Chromium browsers on Railway. No merchant-specific adapter, selector configuration or managed browser vendor is required. Users may add any public HTTPS buying website. The agent reads its visible page and screenshot, prepares the requested cart, and asks for help if it cannot establish the terms.

Convex owns purchase approval. The worker compares product, quantity, unit, address, delivery date, price, shipping, tax and total with the approved snapshot. It checks approval again immediately before the final click and journals submission first. Changed terms require a new approval. A lost receipt produces an uncertain outcome; it never automatically repeats the purchase.

## Runtime

The agent uses the OpenAI Responses API with screenshot and visible-page input (`gpt-5.4`, configurable). Each job is bounded to 60 actions and eight minutes, with individual network and browser timeouts. Final terms need visible evidence and a second model review. This is general browser operation, not a guarantee that every merchant works. CAPTCHAs, unavailable products, unsupported payment flows and ambiguous delivery dates require help. Merchant-specific automation defenses can still prevent ordering.

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

Configure `BROWSER_WORKER_URL` and the matching secret in that same Convex deployment. Do not point multiple deployments at a worker with a different approval callback.

Supplier browser storage is isolated by company and supplier origin and encrypted using AES-256-GCM. Job journals contain commercial terms; protect the volume accordingly. Screenshots are not saved. Human sign-in and payment setup use an expiring help link while the agent is stopped. The help view blocks recognizable purchase buttons and Enter submissions; users should complete setup and return to BUY HARD for purchase approval. Help links expire after ten minutes and idle sessions close after fifteen minutes.

## Verification

```
npm ci
npx playwright install chromium
npm test
```

Tests use real Chromium and ordinary checkout HTML, with no supplier adapter. They cover preparation, approved submission, changed terms, revoked approval, premature purchase, missing evidence, uncertain receipts and public-network filtering. Set `BUYER_LIVE_MODEL_TEST=1` with `OPENAI_API_KEY` to run the additional live-model checkout against the controlled local store. This creates only a local test order, not a real merchant purchase.

A real merchant is counted as tested only after a confirmed app-placed order. Hosting, a prepared cart and controlled test purchases do not increment that public metric.
