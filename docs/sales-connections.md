# Sales that move the next buy

Square completed sales and Shopify paid orders can now update BUY HARD's supply forecast and wake the buyer. Each change records where it came from, what stock changed, and why the next buy changed. Existing purchase approval and supplier confirmation rules still apply.

The user confirms a relationship such as **one coffee uses one cup**, or **one gift set uses one shipping box**. A connection can instead use a provider's inventory count for the supply itself. It does not subtract sales and an inventory count from the same supply.

## Try it

- Interactive sample: `/?demo=true&page=connections`.
- Animated HyperFrames walkthrough: `/sales-story/index.html`.
- Real connections: sign in, open the workspace menu, then **Sales connections** (`/?page=connections`).

The sample has Square and Shopify tabs, a sales event, the changed stock and buying plan, a “Why now?” explanation, duplicate-event replay, and a delivery recovery step. It uses the app's real buying calculator with illustrative events and suppliers. The sample does not call a provider or place a purchase.

| Example             | Starting stock |        Sales | Stock after sales |     Prepared purchase |
| ------------------- | -------------: | -----------: | ----------------: | --------------------: |
| Square coffee sales |       800 cups |  300 coffees |          500 cups |   600 cups, six packs |
| Shopify gift sets   |      140 boxes | 60 gift sets |          80 boxes | 125 boxes, five packs |

## Connection setup

Use a separate test deployment first. Set secret values on that Convex deployment, not in browser code or a `VITE_` variable. `.env.example` lists the names; it contains no credentials.

Common settings:

- `SALES_CREDENTIAL_KEY`: a random 32-byte key encoded as base64, used to encrypt store tokens. Keep it stable; replacing it without migrating credentials requires reconnecting stores.
- `APP_URL`: the frontend origin to return to after authorization.
- `SALES_CALLBACK_BASE_URL`: optional public HTTPS origin for a local callback tunnel. A hosted deployment defaults to its `CONVEX_SITE_URL`.

In the following paths, `<callback-origin>` means that public callback origin.

### Square

1. Create the BUY HARD application in Square's Developer Console and select **Sandbox**.
2. Set `SQUARE_APP_ID`, `SQUARE_APP_SECRET`, and `SQUARE_SANDBOX=true` on the test backend.
3. Add the OAuth redirect URL `<callback-origin>/api/sales/square/callback`.
4. Add a webhook subscription at `<callback-origin>/api/sales/square/events` for `order.created`, `order.updated`, and `inventory.count.updated`. Set its signature key as `SQUARE_WEBHOOK_SIGNATURE_KEY`.
5. From BUY HARD, choose **Connect Square** and authorize the intended sandbox seller. Then match a product variation and location to a supply.

Requested scopes: `ORDERS_READ`, `INVENTORY_READ`, `ITEMS_READ`, `MERCHANT_PROFILE_READ`. Square API calls use version `2026-08-19`. Sandbox is the default unless explicitly set to `false`.

For a local sandbox, open the seller's **Square Dashboard** from the Developer Console before connecting. Sandbox uses that seller session; only production authorization sends `session=false`. Set `SQUARE_SANDBOX_CALLBACK_URL=http://localhost:54362/api/sales/square/callback` when using the local backend described below. Square permits HTTP localhost redirects in Sandbox. This override is ignored in production mode; webhooks still need the public HTTPS origin.

Keep a development tunnel's configuration separate from other projects. An existing Cloudflare ingress configuration can override `--url` and return a misleading 404. Start the tunnel with an explicit, task-owned empty YAML configuration. Before entering its URL in a provider dashboard, send an unsigned POST to `/api/sales/square/events` and confirm **401 Invalid signature**; a 404 at the root is not a route health check.

### Shopify

1. Create a standalone BUY HARD application in Shopify's Dev Dashboard. Configure a non-embedded app and the authorization-code installation flow.
2. Set `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` on the test backend.
3. Add `<callback-origin>/api/sales/shopify/callback` as a redirect URL and the frontend connections page as the app URL.
4. Configure `read_orders`, `read_products`, `read_inventory`, and `read_locations`.
5. In the Partner Dashboard, open **API access requests → Protected customer data access**. For development-store testing, select **Store management** in Step 1 and save. Orders require this setting even when the app does not request customer contact fields. Leave name, email, phone, and address fields unselected for this integration. Production/App Store review is a separate step.
6. Enter the development store's `*.myshopify.com` domain in BUY HARD and choose **Connect Shopify**. Complete installation on the intended store.

After authorization, the callback registers order, inventory, and uninstall webhooks with Shopify. The endpoint is `<callback-origin>/api/sales/shopify/events/<connection-key>`; do not configure the key manually. Admin GraphQL uses version `2026-07`. Offline tokens are expiring and refreshed automatically; rotated refresh tokens are saved together with the new access token.

Shopify sales mappings use all paid orders, because an order's creation location is not reliable fulfillment-location attribution. Direct inventory mappings require a specific inventory location.

### Confirm the mapping

Record a stock count first. Choose the source product, BUY HARD supply, source location, and conversion. For example, a source quantity of one coffee consumes one cup; if BUY HARD counts cases of 100 cups, enter 100 supply pieces per stock unit.

Linking starts a new observation baseline. Older sales and inventory timestamps cannot overwrite it. Record a fresh stock count or send a new provider inventory update when first connecting an inventory feed. The app does not retroactively infer the contents of a stockroom from historical orders.

## What happens after a sale

The endpoint verifies the provider signature before accepting an event. A stored event ID makes repeated deliveries safe. For orders, a worker reads the current order from the provider before applying it. A separate consumption record for each order and mapping also prevents duplicate consumption when the same order arrives through webhooks and the scheduled sync.

Observed sales replace elapsed usage estimates for the observed interval; they are not subtracted twice. A later physical count starts a new baseline, and received supply quantities carry into subsequent calculations. Refunds do not automatically put used cups or packaging back into stock. Direct inventory feeds only accept newer counts for the selected location.

A stock change invalidates any stale planning approval and schedules the existing buyer recheck. The buying calculator uses saved usage, delivery time, preparation time, reserve, pack sizes, and confirmed incoming purchases. A decision history explains the change without exposing tokens or storing customer contact details.

The sync runs every 15 minutes as a recovery path for missed webhooks. Temporary worker failures have bounded retries. A paused connection cannot be silently resumed by a sync that was already running. Expiring credentials use a refresh lease and compare-and-save check to avoid overwriting a newer authorization.

## Current scope

- One product/source mapping per BUY HARD supply. Multiple supplies may use the same sold product. Aggregating multiple menu items into one cup supply is a later extension.
- Up to 20 connections per workspace and 100 mappings per connection.
- Provider catalog browsing is paginated. Shopify supports up to 100 locations in this interface.
- Reconciliation stops with an explicit attention message when its order or inventory page limit is exceeded; it does not silently claim a full import.
- Sales update observed stock. The saved daily usage still supplies the forecast between updates; automatic seasonal learning and historical sales-derived usage are not implemented.
- This is a development integration. End-to-end provider delivery must be proven against the authorized sandbox/store before a release.

## Verification and environment record

Work is isolated on `codex/sales-connections`, based on `b661028`. The primary checkout's unrelated changes were preserved. No production release was made.

Validated locally:

- 25 sales and replenishment tests, including real HTTP signature handling with mocked provider order reads, duplicates, out-of-order updates, stock recounts and receipts, ownership checks, encrypted credentials, token refresh races, and sandbox versus production OAuth behavior.
- TypeScript/build and lint.
- In-app browser: both interactive scenarios, duplicate replay, deliveries, explanations, and a 390px mobile viewport without horizontal overflow.
- HyperFrames: zero lint/runtime/motion issues, nine layout samples passing, and 103/103 text contrast checks passing.

The wider `company.test.ts` suite has three existing alert-workflow failures (`process is not defined`). The same three failures were reproduced in an unchanged `b661028` checkout. This change does not report those checks as passing.

Provider setup at handoff:

- Shopify BUY HARD app `422973243393` was created in organization `131156169`; active development version `sales-local-dev-callback` (`1127364952065`) is configured for `quickstart-93217b41.myshopify.com`. Installation and the local connection completed on September 14, 2026 at 03:17:49 UTC. The first attempts reached token exchange but Shopify rejected `ORDERS_PAID` registration until the development data-use setting above was saved. Customer contact fields remain unselected, and no App Store review was submitted.
- Shopify's four notification registrations completed, and the app loaded 27 real development-store product variants in its mapping form. No Shopify supply mapping or live order-to-stock delivery is claimed yet. `artifacts/sales-connections/shopify-install-readback.json` records the connection and catalog readback. Connection failures now log fixed stage/reason names without codes, tokens, or callback URLs.
- Square BUY HARD app `sq0idp-TO9c6AiZCqojJZrZ2BIeIg` was created in `facundo llc` after the user accepted the Developer Terms. Sandbox OAuth completed against merchant `MLSH9Y1BCTNAE`. Credentials are stored only in the local test backend, and catalog browsing and mapping were verified through the app.
- A zero-dollar Square Sandbox order for 60 test gift sets reached `COMPLETED`. BUY HARD's scheduled recovery sync read the order, subtracted 60 boxes from projected stock (139.93 to 79.93 at the event time), and calculated a 125-box buying plan. This is a plan, not a supplier purchase. The fixture identifiers are recorded in `artifacts/sales-connections/square-pilot.json`.
- The live test caught and fixed a local-runtime incompatibility with `Request.bytes()`; signed webhook bodies now use `arrayBuffer()`. After correcting the tunnel configuration, Square retried `order.created` and `order.updated` at 03:06:33–34 UTC on September 14, 2026. Square reported HTTP 200 for all four deliveries. BUY HARD stored two distinct provider event IDs, read the order, and recognized its already-applied consumption. The buying decision remained a single 60-box reduction and a 125-box plan. `artifacts/sales-connections/square-readback.json` records the sync, webhook events, and unchanged decision.
- Local frontend: `http://127.0.0.1:54363`; local Convex: ports `54361` and `54362`. The working temporary callback tunnel is `https://calvin-focused-mel-twiki.trycloudflare.com`. If restarted with a different URL, update the backend origin and provider redirect/webhook configuration before retrying authorization. Square Sandbox OAuth uses the separate localhost redirect above.
- Authorization links expire after ten minutes. Restart **Connect Shopify** from BUY HARD if a future installation callback expires.

## Provider references

- [Square OAuth and Sandbox redirects](https://developer.squareup.com/docs/oauth-api/overview)
- [Square webhook signatures](https://developer.squareup.com/docs/webhooks/step3validate)
- [Square token renewal](https://developer.squareup.com/docs/oauth-api/refresh-revoke-limit-scope)
- [Square catalog items and variations](https://developer.squareup.com/reference/square/objects/CatalogItem)
- [Shopify standalone authorization](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps)
- [Shopify expiring offline tokens](https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens)
- [Shopify webhook registration](https://shopify.dev/docs/api/admin-graphql/latest/mutations/webhookSubscriptionCreate)
- [Shopify development access to order data](https://shopify.dev/docs/apps/launch/protected-customer-data)
