# Customer email domains — September 16, 2026

Customers can connect an email subdomain from Settings → Your buyer’s email → Use your own email domain. The app registers it inside the company's AgentMail Pod, shows the returned DNS records, offers Domain Connect when supported, and checks verification. A confirmed domain creates the requested inbox and makes it the sender for new purchases. Existing addresses remain readable and keep receiving replies. Earlier orders, quote follow-ups, cancellations and drafts retain their original sender. Inbox credentials remain scoped to their respective address.

The customer must confirm control of the domain. Automatic setup links are withheld when AgentMail reports an existing mail-provider conflict. No browser callback is trusted as proof: activation requires a fresh provider verification result. Registration and inbox creation use recoverable identities, ownership is checked on the server, and domain actions are rate-limited. Automatic checking runs for about an hour; manual checking remains available. This version supports one custom domain per company; changing that domain requires support.

Default provisioning already creates a separate Pod per company. The optional shared `AGENTMAIL_DOMAIN` setting supports a verified BUY HARD domain; it is deliberately not set until DNS is verified.

## Verified locally and in development

- 199 tests passed, 2 pre-existing skips. Added domain ownership, duplicate registration, provider Pod mismatch, DNS conflict, verified activation and retained-inbox tests.
- Typecheck, lint, build and whitespace checks pass.
- In-app browser exercised consent gating, DNS instructions, manual fallback, verification and connected states with simulated provider data. The mobile form fit a 390px viewport; no console errors were observed.
- Backend compiled and deployed to development `festive-coyote-483`.

## Production preparation

- Confirmed production target: `reliable-albatross-463`.
- Existing AgentMail and OpenAI keys are configured.
- Added a random encryption key for restricted inbox access without exposing its value. Existing credentials were preserved.
- Live AgentMail domain creation was rejected with HTTP 403, `limit_exceeded`, resource `domain`, limit 0. The response offered Developer at $20/month for 10 domains. No domain was created, and no plan was purchased.
- `buyhard.app` uses Cloudflare. The in-app Cloudflare session requires sign-in; the saved CLI credential cannot access the zone. No DNS records were changed.
- The app may be released using existing `@agentmail.to` inboxes. Branded default addresses and customer custom-domain activation require provider domain capacity. `buyers.buyhard.app` additionally requires DNS setup. The UI explains unavailable domain capacity.

## Provider references

- https://docs.agentmail.to/api-reference/pods/domains/create
- https://docs.agentmail.to/api-reference/domains/get-setup-link
- https://docs.agentmail.to/knowledge-base/mx-record-conflicts
