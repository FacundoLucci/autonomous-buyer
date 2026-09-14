# Let business activity start the next buy

September 13, 2026 · Proposal checked against the current repo and Square's developer documentation. No connector, product change, deployment or public reply was made in this review.

Build one complete story: a business has an unexpectedly busy day, its sales feed changes the supply forecast, and BUY HARD prepares the next purchase earlier. The owner returns to a clear decision with the source behind it. This gives us a concrete answer to the LinkedIn question about what starts the buyer's work.

**The experience to build**

An illustrative buyer update:

> More takeaway coffees sold today than expected. I've updated your cup forecast and prepared an earlier reorder. Here are the quantity, supplier and delivery date to review.

Expand the update to see the sales record, the confirmed cups-per-drink rule, the old and new stock outlook, and the resulting buying decision. Those values must come from the same recorded run. The owner approves spending through the existing flow.

Keep this in the existing buyer conversation and item details. Show the last successful data update and next planned check in plain language. Add a quiet “Why now?” action for the supporting evidence.

**The product priority**

Make one external event visibly change one buying decision. Start with one cafe location and paper cups. The useful proof is that a sale changes when and how much to buy while the owner is away from BUY HARD.

Only three additions need to be visible in the simple frontend:

- **Connect the source during item setup.** Choose a sales report or connected account, then confirm which sold item uses this supply and the quantity used. An inventory app that already tracks the supply can provide counts directly. Show the last successful update beside the item.
- **Show a useful buyer update.** For example: “Today's takeaway sales brought your next cup order forward. I've prepared the purchase for your review.” Only use actual recorded changes in the update. Keep routine checks quiet; surface a changed plan or a decision needing attention.
- **Let the owner open “Why now?”** Show the source event, confirmed conversion, stock forecast before and after, supplier delivery time, incoming stock, and resulting quantity and deadline. Include the next planned check. Use existing item and purchase views rather than adding another dashboard.

The same history should explain when the buyer decides to wait: an arriving delivery already covers demand, so it leaves the purchase alone. A feed marked stale must show that the forecast is relying on older data.

For the public proof, record the owner completing a Square test sale while BUY HARD is closed, then reopening it to the revised buying decision. The explanation and supplier options must come from that run. Capture duplicate-event handling as a second short check. This makes the answer to “how?” inspectable from the external input through to the purchasing work.

**What already exists**

The current implementation has three useful ways to start work:

| Trigger | Current source |
| --- | --- |
| Recorded stock, rules and delivery changes prompt a recheck | `companyStock.planningChanged`, inventory and order mutations |
| Each item can schedule its next check at the projected reorder point | `replenishment.evaluate` and `replenishmentPlan` |
| An hourly sweep checks stock and deliveries | `crons.ts` and `companyAlerts.sweep` |

The planner already considers recorded stock, estimated usage, supplier delivery time, preparation time, reserve stock and confirmed incoming deliveries. It also protects against duplicate open buys and invalidates stale approvals. These are source-code findings, not a new production verification.

Current imports read product links and invoices to help set up items. The integration status query covers the AI, crawler and email providers. This review found no sales or external inventory connector in those paths.

**First connection: Square, for a cafe example**

Square is a reasonable first choice for our food-business story. Its Orders API exposes itemized sales, including orders completed in Square POS, and order events. Its Inventory API sends count-change events. Seller authorization and an isolated test environment are available. This is a feasibility recommendation; we have not connected or tested a Square account. [Orders](https://developer.squareup.com/docs/orders-api/what-it-does), [inventory events](https://developer.squareup.com/docs/inventory-api/webhooks), [authorization and test environment](https://developer.squareup.com/docs/oauth-api/overview).

Start with one location, one drink variation and one recurring supply. The owner confirms the relationship: this takeaway drink uses one cup of this size. Include a lid only when its relationship is confirmed. Convert pieces into the stock unit, such as cases, using an explicit pack size. A sales feed alone cannot tell us the physical cup count or infer that every coffee uses the same packaging.

A daily itemized sales-file import is a useful first implementation step and fallback. It should feed the same processing path as the connector. Report upload, a signed sample event and a provider-delivered event are separate levels of proof; describe each accurately.

**Smallest complete build**

1. **Receive a business event.** Start with itemized daily sales imports; add the Square connection to obtain events without another manual task. Save the source, business, location, event ID, version, occurrence time and processing result. Persist a verified event before acknowledging it, then process it in the background. Fetch the current order details when an event contains only a reference. Square's documented order events are marked Beta in the reference, so include periodic reconciliation rather than treating delivery as the sole source of truth. [Order event reference](https://developer.squareup.com/reference/square/orders-api/webhooks/order.updated), [signature validation](https://developer.squareup.com/docs/webhooks/step3validate).
2. **Turn sales into supply use.** Apply the owner's confirmed mapping and unit conversion. Keep the last physical count separate from consumption inferred from sales. Choose an authoritative consumption path per item and time period so an imported sale does not get subtracted again by the existing elapsed-usage estimate. A later physical count establishes a new baseline. Direct inventory counts from another system need their own mapping and observation time.
3. **Recalculate and act.** Pass the reconciled stock and usage facts to the existing planner. A busy day can bring the next check forward; an incoming delivery can delay or remove the need to buy. Update the existing automatic buy instead of starting another. Preserve the approval invalidation and uncertain-order handling already in the product. Use actual sales history to improve future usage estimates only when the data covers a meaningful period; one busy hour should not silently become a permanent daily rate.
4. **Explain the decision.** Record a small structured decision history: triggering source, facts before and after, next check, and why a buy started, changed or was unnecessary. Generate the buyer's explanation from those facts. Stock arithmetic and spending conditions remain explicit rules. OpenAI handles the research and explanation around a purchase decision.
5. **Run while the app is closed.** Reuse Convex's scheduled work. Add a visible connection-health state so a stale feed is not described as live. Late or duplicate events must reconcile without rolling stock back, applying consumption twice or creating another purchase.

Returns, cancellations and refunds require a recorded handling rule: a refunded coffee does not necessarily put its cup back on the shelf. Signed webhooks, account-to-company mapping, duplicate detection and source versions are part of the first connector, since those details directly affect stock and buying decisions.

**The demonstration that earns the stronger answer**

Use a clearly labeled Square test account, one BUY HARD test company and the same recurring item throughout:

1. Show the starting forecast and confirmed sales-to-cup mapping, with replenishment enabled.
2. Close BUY HARD. Complete a test sale that changes the outlook enough to require an earlier buy.
3. Verify the provider event was received and the backend revised the plan before reopening the app.
4. Reopen BUY HARD to the buyer's prepared purchase and “Why now?” explanation. Show the matching source, quantities and timestamps.
5. Replay the event and show that no second consumption or buy occurs. Record a new count or confirmed delivery and show the same plan adjust.

Capture one uninterrupted run for the public demonstration. Verify the changed state and approval flow on desktop and mobile in the in-app browser. A Square test event proves a test integration; it does not prove a real customer's operations or a completed merchant purchase.

Focused checks should cover item/pack mapping, ownership, signature verification, duplicates, out-of-order updates, refunds, physical-count baselines, the overlap between estimated and observed consumption, and stale approval prevention. The marketing success check is that someone can follow the external event all the way to the buyer's decision without needing to type a prompt.

**The answer this would earn after the connected run passes**

> A bit of both, but each item also has its own next check based on when we expect it to need a reorder.
>
> I just connected a Square test account to show the whole thing. A takeaway sale uses the cup mapping, updates projected stock, and can move the next buy forward. Convex handles the event and scheduling; the buyer starts the purchasing work when the plan calls for it. You still approve spending.
>
> You can open “Why now?” and follow it back to the sale and the forecast change. Here's the run with BUY HARD closed when the sale came in.

Use “test account” until the equivalent real seller flow has been verified. A daily import demonstration needs wording about an imported report instead. Keep the LinkedIn conversation moving with the accurate current answer while this is built, then return with the working demonstration.

Implementation should use an isolated checkout because inventory, onboarding and demo work are concurrent in the shared tree. The first deliverable is the connected test flow and its evidence; production rollout is a separate step.
