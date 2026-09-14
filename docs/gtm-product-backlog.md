# Product work driven by the campaign

The campaign should help choose what BUY HARD needs to do next. Define the useful story. If it is a future capability, promote it as an ambitious “what if” question now. Use the response to prioritize improvements, then return with the actual feature and proof. An implementation gap and a missing real-world check need different work.

## GTM-01 — One continuous reorder demo

**Story:** The buyer spots a projected shortage, prepares the purchase, gets approval, and keeps the delivery accounted for.

**Current gap:** The public sample's stock update and existing purchase are separate examples. Editing them into one causal story would overstate the demo. The underlying purchasing workflow is implemented. [Current demo guidance](gtm-marketing-strategy.md#6-record-once-make-several-useful-assets)

**Next work:** Connect one clearly labeled recurring-item scenario through the full sequence. Reuse the product's planner and keep the simple frontend. September 13 source inspection confirms that `DemoDesk.updateCount` and `updateRules` update the workspace, while `initialBuys` seeds an independent purchase snapshot. The next implementation needs one consistent transition that recalculates the same item's plan and creates, revises or removes its sample buy. Repeated changes must preserve the purchase identity and avoid duplicate purchases. Do not add a second planning dashboard.

**Acceptance:** In one uninterrupted recording, the same item and purchase remain connected from forecast to prepared buy, approval, and receipt. Changes in stock or delivery update that scenario. The sample label remains visible, and no real supplier is contacted. Check desktop and mobile in the in-app browser.

**Target story:** The next available product-demo slot after the continuous run passes. Status: implementation gap inspected; no new demo implementation in the September 13 marketing review. Monday midday now uses the sales-driven buying question. Current concurrent agent and inbox changes support presentation previews; they do not establish the connected reorder flow.

## GTM-02 — Prove the first supported supplier order

**Story:** BUY HARD handled an actual approved purchase from a named supplier.

**Current gap:** Hosted workers and a controlled-store model run are verified; those checks did not make a real merchant purchase. This begins as a verification task, not an assumption that the feature is absent. [Purchasing evidence](agent-led-purchasing-verification.md)

**Next work:** Prepare a specific supplier, item, account, delivery details, and capped order for approval. Run the supported flow once authorized. Fix any failed preparation, approval, checkout, or confirmation step before using it in the campaign.

**Acceptance:** Match the approved terms to the actual supplier confirmation. Preserve duplicate prevention and uncertain-outcome recovery. Claim dispatch only from dispatch evidence, and receipt only after goods arrive. Record the release and redact private/payment details from the asset.

**Target story:** The next supplier-proof slot after verification. Status: requires a concrete approved real-order scenario; no purchase is authorized by the marketing calendar alone.

## GTM-03 — Make one recurring item easy to start

**Story:** Bring the supplier link or invoice you already have; get one recurring item ready for your buyer.

**Current state:** Source imports, review, buying rules, and replenishment controls exist. Verify the current released path before deciding which part needs code. Concurrent signup and company-suggestion work is already in the shared checkout.

**Next work:** Walk a new operator through source → reviewed item → confirmed stock/usage → buying rules → enabled replenishment. Improve the first confusing or unsupported step. Preserve the agent-led normal path and explicit spending approval.

**Acceptance:** One ordinary item can complete the supported setup without unexplained fields or invented stock values. The operator can see what the buyer will do next and how to pause it. Check the current frontend on desktop and mobile.

**Target story:** September 14 morning, with the stronger end-to-end claim after verification. Status: inspect and validate first, then implement the concrete gap.

## GTM-04 — Close the loop from a post to a useful conversation

**Story:** Explore the app, bring one recurring item, and book a walkthrough.

**Current state:** The inquiry flow, calendar, signed booking callbacks, campaign attribution, and private lead list have production verification. [Walkthrough evidence](marketing-walkthrough.md)

**Next work:** Review aggregate events and real operator questions. Check where interested visitors stop. Improve the specific step supported by that evidence: the action in a post, the demo handoff, the offer, or the booking flow. Exclude launch checks and do not expose private lead details in campaign reports.

**Acceptance:** Campaign tags remain connected to real inquiries or confirmed bookings. A browser click is not counted as a booking. Record the before/after behavior and the observed outcome.

**September 12 review:** The released sample only recorded demo use after a stock update or a purchase-status conversation. A direct sample approval did not show the walkthrough suggestion or record demo use. This is an observed measurement and handoff gap; the 23 non-test visits are still too small a sample to diagnose conversion.

**Local improvement:** Sample changes now trigger the existing demo-use event after an actual change is saved. Direct approval shows the walkthrough suggestion with campaign tags preserved. Desktop and mobile checks passed; dismissing the suggestion stays respected after receiving. The released analytics backend recorded one excluded QA visit and one demo-use event across multiple sample actions. No supplier was contacted. Typecheck, build, focused lint and both attribution tests passed.

The change is committed as `59277a1` on isolated branch `codex/marketing-demo-engagement`, based on the marketing release `68718f1`. It is not pushed or deployed. [Review and deployment scope](../output/marketing/2026-09-12-daily-campaign/reviews/2026-09-12-demo-engagement-fix.md) · [QA event readback](../output/marketing/2026-09-12-daily-campaign/reviews/2026-09-12-demo-use-proof.json).

**Target story:** Ongoing daily reviews. Status: a concrete local handoff fix is ready; released behavior remains unchanged until deployment.

## GTM-05 — Let sales and inventory data bring the next buy forward

**Story:** A busy day changes supply needs. BUY HARD notices through the business's existing data, updates its forecast, and prepares the next purchase while the owner is away.

**Audience signal:** The public LinkedIn question asks whether proactive checks are scheduled or triggered by inventory events. Facundo wants the answer to include the intention to use daily sales and inventory integrations, supported by an impressive working demonstration.

**Current state:** Source review on September 13 confirms immediate rechecks after recorded stock/rule changes, per-item scheduled evaluations, and an hourly sweep. No external sales or inventory connector was established by this review. The detailed design remains a proposal. [Build and demonstration scope](sales-driven-replenishment-proposal.md)

**Smallest next change:** Connect one cafe location and one recurring supply through a shared event-processing path. Start with an itemized sales import for repeatable development, then deliver the complete Square test-account flow. Confirm the sales-to-supply conversion; reconcile observed consumption with estimates so the same use is never subtracted twice. Pass the resulting facts into the existing planner and retain a structured source-to-decision history.

**Frontend:** Add source setup to the existing item flow, a buyer update when a plan materially changes, and a “Why now?” explanation. Preserve the simple frontend and existing spending approval.

**Acceptance:** A provider-delivered test event received while BUY HARD is closed revises the same item's forecast and creates or adjusts one automatic buy. The explanation matches the actual source, units, quantities and times. A duplicate event does not consume stock or create a buy twice; a newer physical count or confirmed delivery adjusts the same plan. Feed freshness and the next planned check are visible. Verify desktop/mobile and record the complete run without contacting a real supplier.

**Owner:** Product implementation in an isolated checkout, coordinated through this campaign thread.

**Target story:** A follow-up to the LinkedIn conversation with the working test-account demonstration. Status: proposed; no connector implementation or release claimed. Promote the external-data benefit as an intended capability until verified.

**September 13 campaign action:** The September 14 12:30 product post asks which sales or inventory app should connect to BUY HARD. Both platform captions and the visual identify an intended capability. The original LinkedIn question remains the only visible technical comment in this review; it does not establish demand for Square or a particular integration. Use specific operator responses to choose the first live connection. [Scheduled question](../output/marketing/2026-09-13-daily-campaign/posts.md).

## How work moves

Each task needs an owner, current state, smallest next change, acceptance check, and the post it unlocks. Use an isolated checkout when a change overlaps existing work. Complete local implementation and focused checks before requesting approval for a concrete production release. Recheck the released user flow before changing a claim from planned to available.

When a task is incomplete, turn the idea into an aspirational question or show current progress. Keep building toward the stronger story. Do not make an unbuilt capability sound already available.
