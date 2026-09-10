# Company purchasing

The local implementation now supports agent-led replenishment: stock and usage trigger supplier research, one purchase approval queues ordering, and matching supplier confirmations update delivery plans. See [verification and remaining live setup](./agent-led-purchasing-verification.md). The application backend and frontend are deployed to development (`festive-coyote-483`). The separate browser worker is not hosted yet, and live supplier ordering remains unverified.

Purchase orders are preferred when the supplier accepts them. Website ordering uses the hosted browser worker and requires a verified supplier adapter. Opening a link or receiving an unrelated email never records a purchase as placed.

## Daily use

1. Add product links or upload invoices and inventory lists in **Add items & files**.
   PDF, PNG, JPG, CSV, TXT, XLSX, and DOCX are supported: 8 MB per file, 10 files or
   links per batch, 20 imports per account per hour, 20 extracted products per file.
   Original files stay available even when extraction fails. Review products before
   importing; invoice quantities and historical prices are not current stock or prices.
2. Count stock and fill in daily usage, delivery time, supplier, and a buy link or
   supplier order email. Each workspace supports 100 active items. Archive unused
   items and restore them later; open purchases must be closed first.
3. Set buying priorities, reserve days, target cover and order multiples, then choose **Let the agent replenish**. Existing items stay off until enabled. The agent forecasts stock, accounts for confirmed incoming deliveries and prepares a buy when needed. Missing supplier delivery time is researched before asking for help. Use **One-off buy** for exceptions.
4. Review **Approve and order**. The agent sends the verified PO or completes a prepared website checkout. Matching confirmations update the order automatically; changed or incomplete terms require attention. An uncertain result is reconciled before another attempt. A justified supplemental buy can cover a shortage despite an existing delivery; repeated checks cannot duplicate the same buying work.
5. Receive all or part of a delivery. Stock updates once for each receipt reference,
   with over-receiving rejected. The original stock count must be known first.
   Download the order record or use its saved link to reopen it later. Completed
   purchases and saved sources have paginated history.

The purchasing inbox displays messages as text. Matching supplier replies appear
in order activity and may confirm an already approved purchase; neither a reply nor its contents can approve spending or receive goods. Cancellation requests leave incoming stock in place until the supplier confirms cancellation.
Later provider bounces are recorded and generate an alert if enabled. A send with
uncertain delivery is checked again without blindly resending the order.

## Email alerts

In **Company settings**, enter an address and verify the six-digit code delivered
there. Codes expire after 15 minutes. Requests and verification attempts are rate
limited. Alerts start only after verification, and both categories can be disabled.

- Low stock: hourly evaluation plus scheduled reorder checks using physical counts, receipt/rate changes, delivery time and reserve. At most one warning per item per UTC day. Estimates remain separate from the last physical count; a routine count reminder does not block an enabled replenishment plan.
- Order updates: approval, sending, supplier replies, receiving, cancellation,
  delivery failures, and daily overdue reminders. Order alerts contain a private
  saved link that checks company membership when opened.

The app distinguishes provider acceptance from delivery confirmation. Ambiguous
network outcomes remain unconfirmed and are not automatically sent again.

## Deployment configuration

Development: `festive-coyote-483`. Production: `reliable-albatross-463`.
The production app was released on 2026-09-10. Alert settings and working purchasing-email credentials are configured in production, with a separate signed callback and production app links.

The dedicated sender is `alerts@buyhard.facundo.xyz`, on the Cloudflare account
`facundo@facundo.xyz`. Worker source and configuration are in `workers/alerts/`.
The sending subdomain uses its own MX, SPF, DKIM, and DMARC records.

| Location                   | Variable             | Value                                                   |
| -------------------------- | -------------------- | ------------------------------------------------------- |
| Cloudflare Worker secret   | `ALERT_SECRET`       | Random shared secret                                    |
| Cloudflare Worker variable | `FROM_EMAIL`         | `alerts@buyhard.facundo.xyz`                            |
| Convex environment         | `ALERT_EMAIL_URL`    | `https://buy-hard-alerts.paw-fruition.workers.dev/send` |
| Convex secret              | `ALERT_EMAIL_SECRET` | Same shared secret                                      |
| Convex environment         | `APP_URL`            | Public URL of the chosen deployment                     |

Keep secrets out of source control and frontend variables. The ignored
`.env.alerts.local` contains the development connection secret. The Worker only
accepts authenticated calls and its binding permits the dedicated sender.

Purchasing email also needs the existing `AGENTMAIL_API_KEY` and a signed AgentMail
webhook pointing to the chosen deployment's `/api/agentmail/webhook` endpoint.
Subscribe to message received, sent, delivered, bounced, rejected, and complained
events for the company inboxes. File extraction needs `OPENAI_API_KEY`; product
links also need `FIRECRAWL_API_KEY`. Passkeys need the auth configuration described
in [onboarding](onboarding.md), with the actual production origin and relying-party
ID. Preserve legacy signing keys when adding the separate Auth 2 keys.

Before publishing production, obtain approval for the production backend, frontend,
and environment changes, then rehearse signup and delivery on that exact origin.
The existing passkey implementation does not yet provide account recovery or
multiple-passkey management. The company workspace currently has a single owner;
team invitations are not part of this release.

## Validation

`pnpm check` runs lint, formatting, TypeScript, and the build. `pnpm test:backend`
checks company isolation, approval gates, immutable approved terms, money and date
validation, duplicate submissions and receipts, partial receiving, source imports,
archive/restore, paginated history, verification attempts, alert preferences,
daily stock forecasts, supplier reply matching, and later mail failures.

September 6, 2026 development rehearsal used a fresh passkey account and the
synthetic **Cedar Workshop QA** company. It read a real Uline product page, created
an AgentMail inbox, extracted PDF/CSV/XLSX/DOCX invoices, and imported their selected
items without changing shelf counts. Test order `BH-205N8DWVMZ` was approved at
USD 84.25 and sent only to the app owner with explicit test wording. Verification,
low-stock, order-update, and PO messages reached the owner's Gmail inbox. SPF,
DKIM, and DMARC passed for the Cloudflare sender. An earlier standalone connection
test went to spam. Two simulated receipts of 6 and 12 rolls changed recorded stock
from 5 to 23 and closed the order. No commercial purchase or shipment occurred.
The QA company's alerts were turned off after verification to prevent continuing
test notifications.
