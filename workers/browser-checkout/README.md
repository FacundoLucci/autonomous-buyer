# Supplier website worker

This is a runnable hosted Playwright worker. Convex owns approvals and order status; the worker owns isolated supplier browser sessions and durable execution receipts. It does not require the buyer's computer to remain open.

The agent uses the OpenAI Responses API to read screenshots and choose browser clicks, typing, keys, and scrolling. Checkout is bounded to 40 actions / three minutes. The final order is submitted only by the verified adapter after comparing the cart to the approved snapshot. This follows the [OpenAI computer-use integration pattern](https://developers.openai.com/api/docs/guides/tools-computer-use): the application executes model-proposed actions in its own environment. The current default model is configurable; validate account/model access before enabling a supplier.

## Local checks

```
cd workers/browser-checkout
npm ci
npx playwright install chromium
npm test
```

The tests run a real Chromium checkout against an isolated local store: preparation does not purchase, approved exact terms purchase once, changed terms stop, and premature submission is blocked at the network boundary. Computer clicks in this controlled test are scripted; it does not claim a live model or supplier purchase was tested.

## Hosting

Build the included Dockerfile and mount an encrypted persistent volume at `/data`. Run **one replica per volume**; the on-disk job journal and company/supplier session locks deliberately require one process. Use HTTPS behind a reverse proxy. Do not expose the container port directly. Deploying or making a real purchase requires a separately authorized target.

Set:

- `BROWSER_WORKER_SECRET`: random secret of at least 32 characters; same value in Convex.
- `SESSION_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hex characters. Keep in host secret storage; losing it loses existing sign-ins.
- `OPENAI_API_KEY` and `COMPUTER_USE_MODEL`: a screenshot-capable Responses model (default `gpt-5.4`).
- `SUPPLIER_ADAPTERS`: mounted path to reviewed supplier configuration.
- `CONVEX_SITE_URL`: Convex HTTPS site origin; the worker requests a fresh once-only approval immediately before submitting.
- `PUBLIC_URL`: HTTPS worker origin for temporary supplier sign-in links.
- `DATA_DIR=/data`, `PORT=8080`.

Set optional Convex `BROWSER_WORKER_URL` and `BROWSER_WORKER_SECRET`. If absent, BUY HARD records a clear help state. It does not claim that an order was placed.

Supplier adapters are required. `suppliers.example.json` documents the contract; the example domain is not a working integration. Each real adapter must identify exact allowed origins, non-purchase writes, **all** order/payment commit endpoints, cart fields, and the submit and receipt elements. Never allow a commit endpoint in `writePaths`. Review GET endpoints too: only use suppliers where reads do not place orders. Reject unverified suppliers. Prefer narrow origin lists; use infrastructure egress restrictions to exclude private networks in the hosted deployment.

The initial adapter reads a JSON DOM element with `sku`, `unit`, `quantity`, `currency`, `unitPriceCents`, `freightCents`, `taxCents`, `totalCents`, `shipTo`, and `expectedOn` (YYYY-MM-DD). A supplier with different markup needs a reviewed extraction adapter before activation. The receipt includes the same fields plus `confirmation`. Do not paste model-generated selectors into production without testing the complete supplier flow.

Optional `referenceSelector` fills the BUY HARD order ID into the supplier's PO/reference field. Together with `historyUrl`, this enables read-only reconciliation of a lost response. Order history receipt elements must include `buyerReference` equal to that ID. Without this exact reference match, uncertain outcomes require manual supplier confirmation. A timeout never triggers another submission.

## Recovery and privacy

Submission is journaled and synced to disk before the commit click. Concurrent job admission is serialized, unreadable journals fail closed, and a once-only Convex commit authorization checks that the approval still matches immediately before submission. Repeated dispatch uses the same organization/order/phase/approval key and returns the same job. A worker restart cannot replay a submitted job. Changed terms return a new draft for approval. The worker admits at most one commit request per execution.

Browser state is isolated by organization and supplier origin and encrypted with AES-256-GCM on disk. Job journals contain commercial terms, so protect and retain the whole volume according to company policy. Screenshots are not persisted. They are sent to the model only during agent operation. Supplier passwords and payment details are entered through the short-lived human help view, not through the model. Help links expire after ten minutes and reveal only one isolated browser. The agent is stopped during takeover; purchase endpoints remain blocked. Session windows close after fifteen minutes. Do not log capability URLs or request bodies at the proxy.

Use `browserCheckout.helpSession` from the signed-in owning company to open the supplier session. After sign-in, `browserCheckout.retry` resumes preparation. For a submission it performs read-only reconciliation instead. Existing receipt entry remains available when the supplier requires a person to verify order history.

Before launch: configure and prove one real supplier with an explicitly approved product and spending limit, probe model access, review login/payment requirements, and verify the host's volume persistence and egress rules. No live supplier adapter, remote host, model invocation, credentials, or real purchase is provisioned by these source changes.
