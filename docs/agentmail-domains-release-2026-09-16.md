# Customer email domains — September 16, 2026

Customers can connect an email subdomain from Settings → Your buyer’s email → Use your own email domain. The app registers it inside the company's AgentMail Pod, shows the returned DNS records, offers Domain Connect when supported, and checks verification. A confirmed domain creates the requested inbox and makes it the sender for new purchases. Existing addresses remain readable and keep receiving replies. Earlier orders, quote follow-ups, cancellations and drafts retain their original sender. Inbox credentials remain scoped to their respective address.

The customer must confirm control of the domain. Automatic setup links are withheld when AgentMail reports an existing mail-provider conflict. No browser callback is trusted as proof: activation requires a fresh provider verification result. Registration and inbox creation use recoverable identities, ownership is checked on the server, and domain actions are rate-limited. Automatic checking runs for about an hour; manual checking remains available. This version supports one custom domain per company; changing that domain requires support.

Default provisioning already creates a separate Pod per company. The optional shared `AGENTMAIL_DOMAIN` setting supports a verified BUY HARD domain; it is deliberately not set until DNS is verified.

## Verified locally and in development

- 200 tests passed, 2 pre-existing skips. Added domain ownership, duplicate registration, provider Pod mismatch, DNS conflict, verified activation and retained-inbox tests.
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

## Production verification

- Main implementation committed and pushed as `4ec6dc5`, including the previously uncommitted marketing work requested by the user.
- Backend deployed to `reliable-albatross-463`; website published through its static-hosting component and visibly verified on `https://buyhard.app`.
- The published production domain UI bundle matched the local build by SHA-256. An unauthenticated `mailDomains:current` call was rejected.
- The new landing section was visible in the in-app browser. A pre-existing React hydration warning (#418) appeared both before and after the deployment; the page recovered and rendered. This is separate from the clean simulated inbox checks.
- The existing production webhook now also subscribes to `message.received.unauthenticated`, preserving its URL and other event types.
- A single marked release-test message was sent to the two user-authorized addresses. Production recorded separate `message.delivered` callbacks for both recipients. Receipt: `output/agentmail-release/controlled-send.json`. This proves mail-server delivery, not that either message was read. An incoming human reply has not yet been verified.
- Final follow-up pins restricted-access setup and open conversations to their original inbox when a domain changes concurrently. Its regression test passes.

## Branded domain activation

- The user upgraded AgentMail to Developer and signed into Cloudflare. Domain capacity is now 10.
- Registered the shared `buyers.buyhard.app` domain at organization scope. Customer-owned domains still use their own company Pods.
- Imported AgentMail's five DNS records into Cloudflare: inbound MX, return-path MX/SPF, DKIM and DMARC. Existing root website records were preserved.
- AgentMail reports all five DNS records VALID; public DNS also resolves the mail and signing records.
- The console labels the domain Verified, but the API still reports VERIFYING with `ses_dkim_pending`. The app relies on that API, so `AGENTMAIL_DOMAIN` remains unset until its status becomes VERIFIED.
- Branded delivery testing remains pending provider verification. Existing mail continues through the prior addresses. Evidence: `output/agentmail-release/branded-domain-activation.json`.

Next: refresh provider verification, set production `AGENTMAIL_DOMAIN=buyers.buyhard.app` only after VERIFIED, then test an isolated branded inbox against the two authorized user addresses.
