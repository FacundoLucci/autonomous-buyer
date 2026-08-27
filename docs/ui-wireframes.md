# Autonomous Buyer UX and wireframes

These wireframes describe the intended product, not the current scaffold.
The dashboard is the only dense screen. Every screen after it guides the buyer
through one decision at a time.

## UX rules

1. The dashboard answers “What needs attention?”
2. A focused screen answers one question and offers one primary action.
3. The agent says what it is doing, what changed, and what it needs from the buyer.
4. Evidence is always available, but starts collapsed.
5. Navigation and highlighting are safe. Approval, rejection, modification, and
   external sends always use the normal authorization and confirmation paths.
6. “Case” means a physical packaging quantity only. The workflow is a procurement;
   the dashboard collection is “Open buys.”

## UX audit

| Earlier risk                                    | Decision                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| The procurement view repeated dashboard density | Replace tabs and parallel panels with one guided step                              |
| Comparison looked like an analyst table         | Lead with the recommendation; collapse alternatives                                |
| Activity appeared in several places             | Keep the full feed on the dashboard; show only the latest relevant event elsewhere |
| Approval competed with Modify and Reject        | Use one primary approval action; keep Modify secondary and Reject separated        |
| The agent was only implied by status text       | Add persistent presence, guidance, and optional highlighting                       |
| A chat box could become another product surface | Make guidance contextual first; conversation is optional and collapsed             |
| Agent UI actions could bypass business rules    | Route every agent action through the same typed mutations and approval gates       |

## Product flow

```text
DASHBOARD — the only complex screen
    |
    +-- Agent is working -> observe or ask “What are you doing?”
    |
    +-- Agent needs the buyer -> one highlighted next action
            |
            v
      PROCUREMENT STEP
      What needs attention now?
            |
            +-- Review recommendation
            +-- Approve purchase
            +-- Resolve exception
            +-- Verify confirmation
            |
            v
      Return to dashboard
```

## Agent collaborator

The agent is a real-time collaborator, not a decorative chatbot.
There is no separate AI chat page. Conversation lives in threads attached to
the component, decision, or highlighted claim being discussed.

### Presence states

```text
[● Watching]  Inventory is healthy. No action needed.
[◐ Working]   Comparing 3 supplier replies.
[!] Needs you Review a $1,440 purchase.
[→ Guiding]   Highlighting why the cheaper quote was rejected.
```

### What the agent may do

- Observe live procurement state and activity.
- Explain the current step using stored evidence.
- Navigate to a relevant screen after the buyer chooses “Take me there.”
- Highlight one control or one evidence region.
- Fill a draft form with visible proposed values.
- Resume idempotent research or extraction work.

### What the agent may not do silently

- Approve, modify, or reject a purchase.
- Send an RFQ or purchase order.
- Accept changed supplier terms.
- Hide a provider failure or invent missing evidence.
- Move keyboard focus while the buyer is typing or reviewing a dialog.

The agent uses the same backend functions as the UI. It never gets a hidden
mutation path around authorization, receipts, or audit events.

### Contextual threads

Threads may attach to a meaningful component such as an open buy, a
recommendation, an alternative, an approval risk, or a highlighted evidence
claim. They do not attach to every label or number.

```text
Recommendation                                      [chat icon · 1 unread]
+------------------------------------------------------------------+
| SupplyCo · $1,440 · arrives Aug 30                              |
| Cheapest qualified option that arrives before stockout.          |
+------------------------------------------------------------------+
                                 |
                                 v
                    +-------------------------------+
                    | THREAD · SUPPLYCO ARRIVAL     |
                    | Agent                         |
                    | This date is supplier-        |
                    | confirmed.                    |
                    |                               |
                    | You                           |
                    | Show me the source.           |
                    |                               |
                    | Agent                         |
                    | [Open supplier email]         |
                    |                               |
                    | [Write a message…]     [Send] |
                    +-------------------------------+
```

Thread icon states:

```text
[chat icon]     Thread exists; everything is read
[chat icon · 2] Two unread messages
[chat icon · ◌] Agent is thinking
[chat icon · !] Reply failed or needs attention
```

- Reserve fixed space for the indicator so counts and thinking never shift the
  component.
- Unread uses a number or dot plus an accessible label, never color alone.
- Thinking may animate opacity, not size; reduced-motion mode uses a static
  “Thinking” label.
- Open only one contextual thread at a time.
- Opening a thread marks its messages read. Merely viewing the component does not.
- Desktop uses an anchored sidecar or popover. Mobile uses a bottom sheet with
  the component name pinned at the top.
- If a component leaves the current view, its thread remains available from
  that procurement’s activity and evidence archive.
- The agent presence card acts as a small inbox: selecting an unread item
  navigates to and highlights its attached component.

## Screen 1: Dashboard

Purpose: scan inventory health, open buys, live work, and required decisions.
This is the only screen allowed to show several data regions at once.

```text
+------------------------------------------------------------------------------------------------+
| ACME FOODS / AUTONOMOUS BUYER                           [Agent ◐ Working]       [Buyer v]      |
+------------------------------------------------------------------------------------------------+
| Purchasing overview                                                       Updated just now    |
| Your agent is watching 3 packaging items and working on 1 buy.                                 |
|                                                                                                |
| +---------------+  +---------------+  +---------------+  +-------------------+                 |
| | Needs action  |  | Open buys     |  | Spend pending |  | Stockouts avoided |                 |
| |       1       |  |       1       |  |    $1,440     |  |         0          |                 |
| +---------------+  +---------------+  +---------------+  +-------------------+                 |
|                                                                                                |
| INVENTORY                                                                                      |
| +--------------------------------------------------------------------------------------------+ |
| | Item / SKU          On hand  Daily use  Days left  Status          Agent action             | |
| |--------------------------------------------------------------------------------------------| |
| | Deli lid            3,240      612        5.3      ACTION REQUIRED  Comparing replies   >   | |
| | LID-16-TE                                                                                  | |
| |--------------------------------------------------------------------------------------------| |
| | Deli container     18,400      420       43.8      Healthy          Watching                | |
| | CTR-16                                                                                     | |
| |--------------------------------------------------------------------------------------------| |
| | Shipping case       4,800      310       15.5      Watch            Monitoring              | |
| | CASE-12                                                                                     | |
| +--------------------------------------------------------------------------------------------+ |
|                                                                                                |
| OPEN BUYS                                                LIVE ACTIVITY                          |
| +----------------------------------------------------+   +------------------------------------+ |
| | PC-1024  Deli lid                                  |   | 11:05  Recommendation ready       | |
| | 30 cases / 15,000 lids · Need by Aug 31           |   | 11:04  SupplyCo replied           | |
| | [Needs approval]                  [Review buy ->]  |   | 11:04  Freight follow-up received | |
| +----------------------------------------------------+   | [View full activity]               | |
|                                                          +------------------------------------+ |
|                                                                                                |
|                                                      +---------------------------------------+ |
|                                                      | AGENT · NEEDS YOU                    | |
|                                                      | I found an on-time option for $1,440.| |
|                                                      | [Why this one?] [Review purchase ->] | |
|                                                      +---------------------------------------+ |
+------------------------------------------------------------------------------------------------+
```

Dashboard behavior:

- The highest-risk row appears first; status uses text plus color.
- “Review purchase” is the only strong action.
- Counts and money use tabular numbers so live updates do not shift the layout.
- The agent card stays compact and never covers dashboard content.
- “Why this one?” opens a short explanation in the agent card; it does not add
  another dashboard panel.

## Agent highlighting and threads

The buyer can ask the agent to show where a claim came from.

```text
+--------------------------------------------------------------+
| Recommendation                                               |
|                                                              |
|  SupplyCo · $1,440 · arrives Aug 30               [chat · 1]|
|  +--------------------------------------------------------+  |
|  | HIGHLIGHT: arrives before the Aug 31 required date     |  |
|  +--------------------------------------------------------+  |
|                                                              |
|                     +--------------------------------------+ |
|                     | AGENT · GUIDING                      | |
|                     | This date is supplier-confirmed.     | |
|                     | [Open thread] [Open evidence] [Done] | |
|                     +--------------------------------------+ |
+--------------------------------------------------------------+
```

Highlight rules:

- Use a quiet outline and anchored note, not a fake mouse cursor.
- Highlight one region at a time.
- A highlighted region may start or resume a thread about that exact claim.
- Never rearrange the page to create the highlight.
- “Done,” Escape, navigation, or starting to type removes it.
- Do not steal focus; screen readers receive a short polite announcement.
- Disable movement when reduced motion is requested.

## Focused screen pattern

Every non-dashboard screen uses the same small structure.

```text
+------------------------------------------------------------------+
| < Dashboard                    Procurement PC-1024      [status]  |
|------------------------------------------------------------------|
| STEP TITLE                                                       |
| One sentence explaining why this step matters.                   |
|                                                                  |
| +--------------------------------------------------------------+ |
| | The information needed for this decision                     | |
| +--------------------------------------------------------------+ |
|                                                                  |
| [View evidence]                           [One primary action ->] |
|                                                                  |
| Agent: one relevant update or offer to guide                     |
+------------------------------------------------------------------+
```

No tabs, secondary dashboard, permanent activity feed, or dense comparison
table appears in this focused flow.

## Screen 2: Procurement progress

Purpose: answer “What is happening now?” without asking the buyer to manage it.

```text
+------------------------------------------------------------------+
| < Dashboard                    Procurement PC-1024     [WORKING]  |
|------------------------------------------------------------------|
| Comparing supplier replies                                      |
| The agent has 3 replies and is checking delivery and total cost. |
|                                                                  |
| ✓ Risk detected                                                  |
| ✓ 3 suppliers found                                              |
| ✓ 3 RFQs sent                                                    |
| ● Comparing replies                                              |
| ○ Buyer review                                                   |
| ○ Purchase order                                                 |
|                                                                  |
| Latest: SupplyCo confirmed freight at 11:04 AM.                  |
|                                                                  |
| [View activity and evidence]                        [Dashboard]  |
|                                                                  |
| +--------------------------------------------------------------+ |
| | AGENT · WORKING                                              | |
| | I’ll notify you when there is a decision to make.            | |
| | [What are you checking?]                                     | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

If no buyer action exists, there is no fake “Continue” button.

## Screen 3: Recommendation

Purpose: answer “Why is this the best safe option?”

```text
+------------------------------------------------------------------+
| < Dashboard                    Procurement PC-1024  [NEEDS YOU]  |
|------------------------------------------------------------------|
| Review the recommended purchase                                  |
|                                                                  |
| SUPPLYCO                                                         |
| 30 cases / 15,000 lids                                           |
| $1,350 product + $90 freight = $1,440 total                      |
| Arrives Aug 30 · one day before required                         |
|                                                                  |
| Why this one                                                     |
| Cheapest qualified option that arrives before stockout.          |
|                                                                  |
| Product match: Likely · 91%                                      |
| Risk: locking-tab dimensions are inferred                        |
|                                                                  |
| [View evidence]  [See 2 rejected alternatives]                   |
|                                           [Review approval ->]    |
|                                                                  |
| Agent: “Show me why the $1,215 quote lost.”                       |
+------------------------------------------------------------------+
```

Alternatives expand inline as short cards. There is no comparison table on
this screen.

```text
RestaurantSupply · $1,215
Rejected: arrives Sep 04 and creates a 3.2-day stockout.
[Show delivery evidence]

Apex Packaging · $1,425
Rejected: arrives Sep 02, after the required date.
[Show delivery evidence]
```

## Screen 4: Approval

Purpose: make one authenticated decision with exact terms.

```text
+------------------------------------------------------------------+
| < Recommendation                                 APPROVAL       |
|------------------------------------------------------------------|
| Approve 30 cases from SupplyCo?                                  |
|                                                                  |
| 30 cases / 15,000 lids                             $1,440 total  |
| Arrives Aug 30                                    Terms: Net 30  |
|                                                                  |
| Inventory impact                                                 |
| 1,404 lids projected at arrival                                  |
| 24.5 days order-only coverage                                    |
| 26.8 days total coverage after arrival                           |
|                                                                  |
| Risk to acknowledge                                              |
| Locking-tab dimensions are inferred; match confidence is 91%.    |
|                                                                  |
| [Reject purchase]       [Modify]       [Approve $1,440 ->]       |
+------------------------------------------------------------------+
```

- Approve is the single primary button.
- Modify is secondary and returns a new versioned recommendation.
- Reject is separated from approval and requires a reason.
- Passkey sign-in returns the buyer to this exact decision.
- Approval is tied to the exact recommendation, quote ID, and quote revision.

## Screen 5: Purchase order status

Purpose: answer “Was the approved order really sent?”

```text
+------------------------------------------------------------------+
| < Dashboard                    PO-10482            [SENT]        |
|------------------------------------------------------------------|
| Purchase order sent                                              |
| SupplyCo received PO-10482 at 11:06 AM.                          |
|                                                                  |
| 30 cases / 15,000 lids                             $1,440 total  |
| Required by Aug 31                                 Terms: Net 30  |
|                                                                  |
| Waiting for supplier confirmation.                               |
|                                                                  |
| [View purchase order] [View email receipt]          [Dashboard]  |
|                                                                  |
| Agent: “I’m watching this thread for changed terms.”              |
+------------------------------------------------------------------+
```

Sent appears only after the purchase order and matching provider receipt are
durable. A failure replaces “Sent” with the exact recovery action.

## Screen 6: Confirmed

Purpose: close the loop with one strong outcome.

```text
+------------------------------------------------------------------+
| < Dashboard                    PO-10482       [CONFIRMED]        |
|------------------------------------------------------------------|
| Inventory is covered                                             |
| SupplyCo confirmed the approved terms.                            |
|                                                                  |
| Delivery: Aug 30                                                 |
| Quantity: 30 cases / 15,000 lids                                 |
| Supplier order: SC-88341                                         |
|                                                                  |
| Before                           After                            |
| Stockout in 5.3 days             Covered for 26.8 total days     |
|                                                                  |
| [View confirmation evidence]                     [Dashboard ->]  |
|                                                                  |
| Agent: “I updated expected inventory and closed this buy.”        |
+------------------------------------------------------------------+
```

## Exception flow

```text
Supplier confirmation differs from approved purchase
                         |
                         v
              +------------------------+
              | REVIEW CHANGED TERMS   |
              | Freight: $90 -> $140   |
              | Total: $1,440 -> $1,490|
              |                        |
              | Agent: “I paused the   |
              | buy. Nothing was       |
              | accepted.”             |
              |                        |
              | [Contact supplier]     |
              | [Review new approval]  |
              +------------------------+
```

The agent explains and highlights the difference. It cannot accept the change.

## Mobile

The dashboard becomes stacked cards. Focused screens keep the same reading
order and one-action structure.

```text
+----------------------------------+
| Autonomous Buyer        [Buyer] |
|----------------------------------|
| Needs action 1 · Open buys 1    |
|                                  |
| ACTION REQUIRED                  |
| Deli lid · 3,240 · 5.3 days     |
| [Review buy ->]                  |
|                                  |
| LIVE ACTIVITY                    |
| Recommendation ready             |
| SupplyCo replied                 |
|                                  |
|----------------------------------|
| AGENT · NEEDS YOU                |
| I found an on-time option.       |
| [Why?] [Review ->]               |
+----------------------------------+
```

- The agent card is in normal document flow on mobile, not a floating bubble.
- A sticky primary action accounts for the device safe area and never covers
  the last content.
- Every target is at least 44 by 44 pixels.

## Empty, loading, and failure guidance

```text
No open buys
Your agent is watching inventory. You do not need to do anything.

Supplier search failed
No suppliers were added. Check Firecrawl and retry the search.
[Retry supplier search]

Purchase-order send failed
The order was not marked sent. The saved PO is safe to retry.
[Retry send]

Agent unavailable
The procurement workflow is still visible and usable.
[Continue without guidance]
```

The agent enhances the workflow but is never the only way to use it.

## Accessibility and behavior

- Agent updates use a polite live region; urgent approval never auto-opens.
- Highlighting never moves keyboard focus or relies on color alone.
- Escape closes guidance and returns focus to its trigger.
- Reduced-motion mode removes highlight movement and panel transitions.
- Loading skeletons preserve final layout dimensions.
- Evidence drawers trap focus and return it on close.
- Mobile controls use 44-pixel minimum targets and 16-pixel inputs.
- The full activity and audit trail remains reachable from every procurement.

## Demo flow

```text
Dashboard
  -> Agent detects risk and opens a buy
  -> Agent works while the buyer observes
  -> Agent changes to Needs you and highlights Review purchase
  -> Buyer reviews one recommendation and expands one rejected alternative
  -> Buyer approves exact terms with passkey identity
  -> Agent sends the PO through the guarded provider path
  -> Supplier confirmation arrives
  -> Agent highlights the updated covered-inventory result
  -> Buyer returns to a calm dashboard
```

Demo controls may reset or start the scenario. They never fake replies,
recommendations, approvals, sends, receipts, or confirmations.
