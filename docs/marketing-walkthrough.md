# Pilot inquiries and walkthroughs

The landing page explains the product, links to `/walkthrough` and the sample demo, and has a short pilot form. No signup is needed. “Where we’ve bought” remains in place but renders only when its live confirmed-order total is greater than zero.

The sample-data label and “Make it yours” remain. A quiet next-step suggestion appears after the demo understands a stock count or shows an existing purchase’s status. The suggestion can be dismissed.

## Follow-up

`marketingLeads` is the private list. `/leads` requires the exact authenticated user ID configured in `MARKETING_OWNER_USER_ID`; being a business admin does not grant access. It shows contact details, campaign, reply target, email outcomes, meeting status, and a manually managed pilot stage. Owner notifications link to this list. Email addresses and purchasing challenges are not included in funnel events.

Pilot submission saves the lead and schedules two separate email jobs in one database transaction. The visitor sees confirmation only after saving succeeds. Email failures do not erase the inquiry. Duplicate emails reuse a lead; abuse limits apply before scheduling messages. The existing email bridge is used. `queued` means the provider accepted the message, not inbox delivery. Network ambiguity remains `unknown`; reconcile it before resending. No unsafe automatic email retries.

Reply target: the same time on the next weekday in America/Chicago (weekends skipped, public holidays not excluded). This is an internal follow-up goal, not a claim of staffed support or guaranteed response.

## Deployment settings

Set these on the chosen Convex deployment, never as frontend secrets:

- `MARKETING_OWNER_USER_ID`: the app's user ID for the owner who will open `/leads`.
- `MARKETING_NOTIFY_EMAIL`: the owner's notification address.
- `ALERT_EMAIL_URL`, `ALERT_EMAIL_SECRET`: the existing alerts bridge.
- `APP_URL`: the chosen app origin, used in private-list links.
- `CAL_WEBHOOK_SECRET`: a distinct secret shared with the Cal event webhook.

Set `VITE_PUBLIC_SITE_URL` to the public origin at build time. It defaults to `VITE_CONVEX_SITE_URL` when present. Social metadata is emitted in the static HTML, including an absolute 1200 × 630 PNG URL.

Cal event: `facundolucci/buyhard`, event type `7027770`. The website embeds this link using the provided dark calendar settings and offers a full-page fallback. Cal owns the calendar invitation, Google Meet link, booking emails, reminders, and reschedule/cancel links.

Configure an **event-scoped** Cal webhook to `https://<chosen-app-origin>/api/marketing/cal` with the same `CAL_WEBHOOK_SECRET`. Use the standard payload, version `2021-10-20`, and these triggers: `BOOKING_CREATED`, `BOOKING_REQUESTED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`, `BOOKING_REJECTED`; add `BOOKING_CONFIRMED` where supported. Never use a custom payload template. The receiver validates HMAC SHA-256 against the raw body, ignores other event slugs, deduplicates booking UIDs, and ignores older callbacks. Browser calendar-open or success messages never create a confirmed-booking event.

A reschedule can have a new booking UID. The receiver marks the previous UID as rescheduled in the same transaction, including when the original creation callback arrives late. The private list retains individual booking records and their last known statuses.

## Attribution and measurement

A random visitor ID and last campaign-bearing arrival are retained for up to 30 days in local storage, with an in-memory fallback when storage is blocked. Navigating through links with the same campaign preserves the original arrival path. Direct returns retain the last campaign. Only the referrer's origin is stored; arbitrary URL query parameters are excluded.

The five UTM values are preserved in demo navigation and forwarded to Cal. Cal metadata carries the visitor ID and a bounded attribution snapshot, so a blocked analytics request cannot erase booking source. Inquiries persist their own snapshot.

`marketingEvents` records distinct visitors at `visit`, `demo_use`, `inquiry`, `booking_confirmed`, and `pilot_started`. The last three are server-side facts. Each visitor/stage is recorded once. Bookings may skip inquiries; compare both inquiry and booking branches rather than requiring a linear sequence. Cancellation does not erase historical booking conversion. This is stored in Convex; it is not a configured PostHog dashboard.

Private paginated exports (requires deployment CLI access):

```sh
pnpm exec convex run marketing:list '{"paginationOpts":{"numItems":100,"cursor":null}}'
pnpm exec convex run marketing:events '{"paginationOpts":{"numItems":100,"cursor":null}}'
```

Continue using `continueCursor` until `isDone`. Do not publish lead exports.

## Launch proof

Local tests cover saving without authentication, required/optional fields, attribution, duplicate/rate limits, private access, pilot-stage updates, signed and tampered webhooks, stale callback ordering, queued versus delivered email, and weekend reply targets. Browser checks cover mobile layout, calendar rendering, and campaign-bearing links. These do not prove a real meeting, inbox delivery, or a production deployment.

Before launch, on the exact public origin, submit a controlled inquiry and verify its confirmation inbox, owner inbox, and private list. Book a controlled meeting and verify the calendar invitation, working Meet link, reminder workflow, signed webhook row, source metadata, and rescheduling/cancellation. Mark a pilot only when a real pilot starts.

Sources: [short form guidance](https://www.nngroup.com/articles/web-form-design/), [PostHog UTM guidance](https://posthog.com/docs/data/utm-segmentation), [Cal webhook contract](https://cal.com/docs/developing/guides/automation/webhooks).

## Production release verified September 10, 2026

Released from an isolated checkout based on `b661028` to production `reliable-albatross-463`. The concurrent signup changes in the shared checkout were excluded. Static hosting publication: `66b99f1f-630f-4dda-bc29-5a4f6f5e5574`. Production owner, notification email, and Cal signing secret are configured; no secret is committed.

The live Cal event has the walkthrough title and offer description, 20-minute duration, Google Meet, the owner calendar, attendee and host confirmation emails, and reschedule/cancel controls. Workflow `447973`, “BUY HARD — 24-hour attendee reminder”, is enabled only for event `7027770`. Its future scheduled execution was not observed. The event-scoped signed webhook is enabled for the five booking lifecycle triggers listed above. Its signed ping returns 200 without creating a test lead.

Production verification used the in-app browser at 390 × 844:

- The offer, both actions, and pilot form fit without horizontal overflow. The zero-order merchant section is hidden.
- An anonymous inquiry displayed “Your interest is saved.” The private lead contains its email, business, challenge, next-weekday reply target, and `launch-check / walkthrough-20260910` attribution.
- The visitor confirmation and owner notification both arrived in the owner's Gmail inbox. The provider statuses remain `queued`, accurately reflecting the bridge response rather than replacing it with a manual claim of delivery.
- Campaign tags survived entry into the sample demo. A purchase-status question produced a useful answer and the dismissible walkthrough suggestion, preserving the sample-data labels.
- A real 20-minute test booking completed through the phone embed. Attendee and host emails arrived with calendar attachments and a Google Meet link. The Meet lobby recognized the booking and scheduled time; no call was joined.
- The signed callback linked the confirmed booking to the inquiry. A real reschedule marked the former UID rescheduled and the new UID confirmed. Cancellation then marked the new UID cancelled. Reschedule and cancellation emails arrived.
- The test appointment is cancelled and its lead is closed. Test funnel events remain tagged `utm_source=launch-check`; exclude this source from launch reporting. No pilot start was fabricated.
- Anonymous `/leads` access is denied in the browser. The production owner query and close-stage mutation were checked using the administrative CLI's owner identity. A fresh owner passkey sign-in in the browser was not exercised.
- The public static HTML contains Open Graph and Twitter metadata with absolute production URLs. The 1200 × 630 social image returns HTTP 200.

Validation: the final full suite passed 121 tests with one skipped, including 11 marketing tests. Typecheck, lint, production build, schema validation, and both backend pushes passed. The isolated checkout required its own dependency installation for the edge-runtime tests.

## SEO release

The public origin remains `https://reliable-albatross-463.convex.site`. The homepage and `/walkthrough` have distinct titles, descriptions, canonical URLs, Open Graph/Twitter tags, image alt text/type/dimensions, and Organization/WebSite/WebPage JSON-LD. Canonicals omit campaign and workspace parameters while navigation continues preserving campaign attribution.

App-owned HTTP routes serve the current static-hosting HTML with page-specific metadata and matching `X-Robots-Tag` headers. Assets remain in the existing static-hosting component, using its supported app-router integration. Demo URLs, workspace views, setup, leads, prototypes, and legacy pages are `noindex, follow`; authentication still controls private data. `/robots.txt` allows crawling those pages so crawlers can see `noindex`, while excluding API/auth endpoints. `/sitemap.xml` lists only the two public canonical pages. `/landing`, `/index.html`, and trailing-slash page variants redirect with campaign parameters preserved. Unknown routes return 404 rather than an indexable application shell.

The initial shared HTML contains the public offer and product example before JavaScript loads. The interactive page takes over after hydration. The preview contains no account data or functioning inquiry submission, so it cannot send inquiries before the app is ready. Existing merchant visibility and walkthrough behavior remain unchanged.

Verified on production: public and campaign-bearing homepage HTML, walkthrough metadata, both demo query forms, private/setup/legacy/prototype noindex headers, sitemap/robots content types, social image, and unknown-route 404. In-app browser checks confirmed metadata after hydration, the sample demo, and the live Cal calendar. Full suite: 126 passing tests, one skipped; typecheck, lint, build, and backend schema checks passed. Search Console submission and search-engine indexing/ranking are not claimed.

References: [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Google robots metadata](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
