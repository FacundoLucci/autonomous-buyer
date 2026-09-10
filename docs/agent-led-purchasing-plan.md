# Agent-led purchasing plan

Status: application backend and frontend deployed to development on 2026-09-10. Browser-worker hosting and live supplier validation remain pending. See [implementation verification](./agent-led-purchasing-verification.md) for the tested scope and remaining setup. This plan does not authorize a supplier transaction.

This is the next implementation plan for the current company workspace. It extends the original [product spec](./product-spec.md) and supersedes the original demo plan's manual buying steps and exclusion of website checkout. Use the verification requirements below for this work; the earlier demo-only test restrictions remain historical. Preserve the current frontend and persistent agent.

## Product outcome

The user supplies inventory counts and usage rates, sets buying rules, approves a prepared purchase, and reports physical receipts or exceptions. The agent owns the recurring work: deciding when to buy, calculating quantity and deadline, finding supply, completing the approved order, and following its progress.

Normal flow:

1. Forecast stock using supplied counts, usage, and confirmed incoming deliveries.
2. Start or adjust a buy before stock reaches the reserve level.
3. Research suppliers and collect the missing price and delivery terms.
4. Prepare one complete purchase for approval.
5. After approval, send a purchase order if the supplier accepts POs. Otherwise, complete checkout on the supplier's website using computer use.
6. Read the supplier's confirmation, track the expected delivery, and apply actual receipts to the next forecast.

Manual **Start buy** remains available for one-off purchases. Normal replenishment must work while the user has the app closed.

Keep the existing spending approval. Approval authorizes the displayed purchase and its execution; it must not leave a second **Send purchase order** or **Order from supplier** chore. Automatic spending under a standing budget is a separate future policy.

## Existing foundation and missing work

| Area              | Current foundation                                                       | Work required                                                                                |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Inventory         | Counts, usage, reserves, priorities, forecast and incoming-stock helpers | One consistent planner, correct stock history, automatic buying triggers                     |
| Background checks | Hourly low-stock and overdue-order checks                                | Durable work that creates or adjusts buys, rather than stopping at alerts                    |
| Purchasing agent  | Persistent conversation, research, comparisons and drafts                | Company-scoped background work that does not depend on an open user chat                     |
| Purchase orders   | Approval, dedicated purchasing inbox, sending and delivery checks        | Automatic execution after approval and supplier PO capability checks                         |
| Supplier replies  | Company inbox/thread matching and recorded reply activity                | Extract and verify confirmations, update delivery facts, follow up                           |
| Website ordering  | Supplier links                                                           | Hosted computer-use sessions, cart preparation, approved submission and outcome verification |
| Receiving         | Full and partial receipt records                                         | Correct forecast updates, delivery exceptions and the next replenishment cycle               |

The older demo has quote and confirmation helpers, but its workflows depend on demo identities and records. Reuse general helpers after separating those assumptions; do not route company purchasing through the demo.

## Delivery order

### 1. Make stock calculations reliable

- Use one deterministic planner for the dashboard, background checks and supplier comparisons. Keep money and inventory calculations outside the language model.
- Keep the last physical count separate from estimated current stock. Record count, receipt and usage-change events. Project consumption up to each event before applying it; new usage rates apply from their effective time, and receipts after a stockout must add usable stock without subtracting past unmet demand again.
- Define the inputs: counting unit and pack size, count/date, daily usage, supplier lead time, reserve days, target cover and buying priority. Reuse existing defaults where applicable, but show them to the user. Define target cover as total days of stock after replenishment, including reserve.
- Trigger preparation when projected stock will reach reserve within supplier lead time plus a configurable allowance for research and approval. Calculate quantity from the future stock timeline, account for confirmed incoming quantities on their dates, and round to supplier pack sizes/minimums. Surface minimum-order overbuying in the purchase decision.
- Missing stock or usage stays unknown. Ask for private operational facts; research supplier facts where possible. Zero usage pauses routine depletion buying. Stale counts get a visible confidence warning; a routine reminder alone must not stop a forecast based on the user's saved rate.

**Proof:** time passing, rate changes, a receipt after zero stock, partial deliveries, pack sizes and overlapping incoming orders all produce the same result in the UI and background planner.

### 2. Let the agent start and manage replenishment

Depends on step 1.

- Add an explicit item setting to let the agent manage replenishment, with readiness, pause and resume states. Explain at setup that this includes researching and contacting suppliers for quotes, with purchases requiring approval. Review existing items before enabling them; backfilling data must not start supplier emails.
- Reevaluate immediately after counts, usage/rule changes, supplier details, order confirmations, cancellations and receipts. Schedule the next relevant stock event and retain a bounded hourly recovery sweep.
- Create company-scoped purchasing work using the existing Convex workflow and agent components. Keep user conversations and their selected tasks independent. Write progress into the shared purchase/activity records so the persistent agent can explain it.
- Create or revise one unsubmitted automatic buy for the uncovered need. Repeated checks and simultaneous user updates must reuse it. The current one-open-order-per-item restriction needs to allow a justified supplemental order when existing incoming supply cannot cover the shortage.
- Recalculate an unapproved draft when facts change. Revoke stale approval readiness. For an order already submitted, preserve its history and resolve the remaining shortage separately.
- Make rejection, snooze and cancellation explicit so the next scheduled check does not immediately recreate dismissed work.

**Proof:** a ready item starts a buy with quantity, deadline and reason without **Start buy**. “We only have two cases left” immediately updates the need, preserves existing work and creates no duplicate order.

### 3. Find supply and choose the ordering route

Depends on step 2. Start the browser feasibility check described in step 6 during this stage.

- Run research, quote collection and comparison automatically. Save drafts internally; normal work must not wait for **Find options** or a user saving a research result.
- Carry forward the item's cost, availability or willingness-to-wait rules. Check the exact product, unit conversion, quantity, tax, freight, currency and delivery date. Show a single valid offer honestly when alternatives are unavailable.
- Use the company's purchasing inbox to request missing terms and follow up within a bounded schedule; retain the existing maximum of two automatic follow-ups per supplier. Stop or change approach when the required date can no longer be met.
- Save supplier ordering facts separately from supplier selection: accepts POs, verified recipient, website, account requirements and supporting evidence. An email address alone is not proof that a supplier accepts POs. Selecting a website offer must not erase a known PO contact.
- Prefer a PO when that route is accepted and its terms are verified. If the supplier requires checkout, prepare the website cart and its final terms before asking for approval. Unknown PO acceptance should trigger research or a supplier inquiry.
- Ask the user only for missing private facts or a consequential choice the saved rules cannot resolve, such as an unapproved substitute.

**Proof:** the agent reaches a purchase-ready decision from a stock need, using saved priorities and traceable supplier terms, without manual research instructions.

### 4. Make approval complete the order

Depends on step 3. Deliver the email route first.

- Present one **Approve and order** action using the current sentence-style purchase summary. Retain the exact-total confirmation and **No, because…** revision path within that approval flow.
- Save an immutable approval snapshot: supplier, product, quantity/unit, full total/currency, address, delivery terms, ordering route and current purchase version. Expired quotes, changed totals or material changes to stock need require a fresh decision.
- Atomically record approval and queue the internal executor. Use one stable purchase identifier across attempts and channels; a repeated click or restarted worker must not create a second order.
- Prepare the purchasing inbox before the decision is ready. After approval, send the PO automatically and retain provider message/thread identifiers, the exact document/body and delivery evidence.
- Distinguish sending, sent/awaiting confirmation, failed and outcome unknown. An email timeout is not proof that no order reached the supplier.
- Prevent cross-channel duplicates: an unanswered or uncertain PO must be reconciled before any website submission. Definitive rejection or confirmed cancellation can allow a new route; obtain fresh approval if the approved terms or route change.

**Proof:** one approved decision sends one PO. Repeated approval, a process restart and a provider timeout cannot cause a duplicate or blind website fallback.

### 5. Close the confirmation and receiving loop

Depends on step 4. This completes the first usable release through email.

- Process supplier replies within the company's inbox and purchase thread. Extract an order reference, accepted quantities, full total and delivery dates with source evidence. An exact matching confirmation advances the order automatically; changed or ambiguous terms require attention.
- Keep **PO sent** separate from **supplier confirmed**. Only confirmed quantities and dates count as incoming stock. Confirmation delays trigger bounded follow-up and a visible delivery risk, not a second purchase.
- Support split deliveries, partial receipts, changed arrival dates, shortages and damaged quantities. Ask only for the unresolved receipt facts; a promised delivery date is not proof that stock arrived.
- Reevaluate supply after each change. If an existing order cannot prevent a shortage, prepare an expedite, approved alternative or supplemental purchase without losing track of the original.
- Provide recovery through the current purchase view and agent: pause work, revise before submission, retry a known failure, and request cancellation after submission. A local cancellation must not pretend the supplier cancelled the order or remove possible incoming stock prematurely.
- Record system actions, user approval and supplier evidence distinctly. Keep manual confirmation and receipt entry available when messages cannot be interpreted.

**Proof:** supplier confirmation advances the order without **Add confirmation**. A partial receipt updates available stock and remaining incoming quantity correctly, and the next automatic cycle remains accurate.

### 6. Add supplier website checkout

Early feasibility check depends on step 3's supplier selection; complete integration depends on steps 4–5.

Computer use requires an application-controlled browser environment. The [OpenAI computer-use guide](https://developers.openai.com/api/docs/guides/tools-computer-use) supports this approach, but does not establish that any particular supplier checkout will work. Validate one representative supplier before committing to broad coverage.

- **Early check:** identify a representative checkout-only supplier and suitable hosted browser runtime. Prove isolated sessions, resumable account access, product selection, cart totals, delivery terms and the approval pause. Record supplier limitations and operating costs. This check stops before purchase submission.
- **Build:** use a hosted browser worker that runs while the user's computer is off. Convex remains the system of record and owns jobs, permissions and results; do not add another business database or queue.
- Separate preparing the cart from submitting the approved purchase. Recheck the final terms against approval immediately before submission. Stop for changed price, product, quantity, delivery, payment method or required consent.
- Scope each browser job/session to its company, supplier and purchase. Keep credentials and payment setup in secure human setup/takeover, with protected session references. Support login, MFA, CAPTCHA and payment-authentication handoff without exposing secrets in conversation or evidence logs.
- Capture the supplier's order number, final total and confirmation evidence. After an uncertain submit, inspect order history or confirmation messages before retrying. Never assume that losing the browser means the purchase failed.
- Show a supported-site limitation or specific help request when the worker cannot complete a site. Retain the same purchase record and activity history across email and website work.

**Proof:** an approved purchase completes in a controlled checkout with a real order record and survives a restart after submission without buying twice. A cart screenshot alone is not proof of ordering. Validate a real supplier transaction only against an explicitly approved supplier, item and spending limit.

### 7. Make the frontend show the agent's work

Deliver alongside steps 2–6, preserving the current layout, visual language and persistent agent.

- Replace routine **Order more**, **Find options** and post-approval send chores with progress and completed actions. Keep **Start buy** secondary for exceptions.
- Show what triggered each buy, quantity/deadline, current work, the next expected update and the specific decision needed. Use the same state in the dashboard, item page, purchase page and agent.
- Use direct updates: “At your current usage, gloves will reach reserve stock next Tuesday. I'm finding a replacement delivery.” “Your existing order covers the next three weeks.” “I need the supplier's delivery time before I can schedule replenishment.”
- Surface approval, missing facts, supply problems and checkout handoffs as actions. Routine research and waiting should not look like tasks for the user.
- Update the sample demo to show this automatic flow, clearly labelled as sample behavior. Preserve manual buying, stock corrections and receipt controls.

**Proof:** a user can tell what the agent is doing and why, approve when needed, and resolve an exception through the existing interface without instructions to start routine work.

## Where the work belongs

| Work                          | Existing code to extend                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Stock timeline and planning   | `src/lib/inventory-planning.ts`, `convex/companyStock.ts`, `convex/companyInventory.ts`                                                 |
| Scheduled replenishment       | `convex/companyAlerts.ts`, `convex/crons.ts`; new company replenishment workflow                                                        |
| Background agent and research | `convex/desk.ts`, `convex/deskAgent.ts`, `convex/buyer.ts`, `convex/buyerSession.ts`; general helpers from the demo sourcing/quote flow |
| Approval and order execution  | `convex/companyOrders.ts`, `convex/companyMail.ts`, `convex/schema.ts`; new execution-attempt records and browser-worker boundary       |
| Confirmations and recovery    | `convex/inbound.ts`, company reply handlers, receipt/cancellation functions and audit records                                           |
| Frontend                      | `src/components/desk/app.tsx`, `agent-live.tsx`, `agent-work.tsx`, `sentences.tsx`, inventory/settings and sample demo                  |

Background work needs validated internal entry points; it must not impersonate a logged-in user to call chat-only functions. Use indexed, bounded reads, durable retry limits and company isolation. Save stock, plan and approval versions so stale scheduled jobs cannot overwrite newer decisions.

## Required scenarios before release

| Scenario                                                               | Expected behavior                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Healthy stock; enough confirmed incoming                               | Explain coverage and schedule the next check; no unnecessary buy          |
| Time alone creates a need, app closed                                  | Start research with quantity and deadline                                 |
| Missing count or usage; zero usage                                     | Ask for the missing fact, or pause depletion buying for zero usage        |
| Sudden low count or changed usage                                      | Recalculate immediately; revise existing work and refresh stale approvals |
| Two checks or users act together                                       | One current plan and no duplicate submission                              |
| Incoming order is late, short or has no confirmed date                 | Identify uncovered demand; follow up and prepare justified recovery       |
| Cost / availability / can-wait priorities                              | Apply each saved rule, show the tradeoff, never invent terms              |
| PO accepted; checkout required                                         | Use the verified route and execute after approval                         |
| Supplier changes terms or approved cart expires                        | Refresh terms and return the changed decision for approval                |
| PO unanswered, email outcome unknown, browser disconnects after submit | Reconcile the existing attempt before another purchase                    |
| Supplier rejects, has no stock, or account needs login                 | Find an acceptable alternative or ask for the specific missing action     |
| Full, partial, split or damaged receipt                                | Add actual usable stock, retain remaining incoming quantities, reevaluate |
| Pause, cancellation, archive or repeated callbacks                     | Stop appropriate future work, preserve uncertain orders and audit history |
| Another company or user's conversation is active                       | Preserve company privacy and independent interactive tasks                |

## Verification and rollout

1. Add focused tests to the existing suite for stock timing, duplicate prevention, approval changes, company isolation, reply matching and uncertain submission. Use controlled time and provider failures where those prove important behavior. Do not introduce a broad new test framework.
2. Run the existing backend tests and static checks for implementation changes. Complete real browser flows for the current workspace; passing tests or a build alone is not release proof.
3. Run the planner without supplier contact first and inspect its proposed needs. Then enable a controlled company/item with allowlisted email recipients. Prove the email loop before enabling checkout.
4. Development target is `festive-coyote-483`, verified from `.env.local`. Reconfirm it before deployment; production `reliable-albatross-463` remains outside this plan's execution authority. Any test that sends messages or spends money needs its explicit test target authorized.
5. Enable selected items gradually. Provide a stop control for new buying actions while retaining visibility and reconciliation of orders already submitted. Track missed stock deadlines, stale approvals, duplicate attempts, stuck work and unconfirmed orders.

The first release is complete when a real company item moves from supplied stock and usage to an automatically started buy, an approved PO, a verified supplier confirmation, an actual receipt and the next correct forecast. The user performs setup, spending approval and receipt/exception reporting; the agent performs the purchasing work.

Website ordering is complete only after its separate submission and recovery proof. Wider supplier coverage, standing-budget auto-approval, returns/refund accounting and unrelated bulk import/export improvements can follow without delaying the first complete email loop.
