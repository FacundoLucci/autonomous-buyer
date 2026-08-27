# Autonomous Buyer

## 1. Product Summary

Autonomous Buyer is an AI purchasing agent that monitors inventory risk, researches suppliers, requests quotes, compares commercial terms, recommends the best purchase, obtains human approval when required, and sends the purchase order.

The hackathon version proves one complete purchasing loop for a single SKU.

The product is not a procurement dashboard. It is an agent that performs buyer work.

Core promise:

> Give the agent responsibility for one recurring item. It will make sure you do not run out and do not overpay.

---

## 2. Demo Goal

The demo must prove that the agent can:

1. Detect an upcoming stockout.
2. Determine how much inventory is needed.
3. Research viable suppliers.
4. Contact suppliers for quotes.
5. Receive and understand supplier replies.
6. Follow up when information is missing.
7. Compare price, freight, quantity, and delivery timing.
8. Recommend the best purchase.
9. Request human approval.
10. Generate and send a purchase order.
11. Receive supplier confirmation.
12. Update the inventory projection in real time.

Everything after the initial seeded business data should be operational rather than simulated.

---

# 3. Demo Scenario

## Company

**Acme Foods**

A fictional food manufacturer in Cedar Rapids, Iowa.

The purchasing agent is responsible for packaging materials.

## Critical SKU

**Tamper-Evident 16 oz Deli Lid**

Internal SKU:

`LID-16-TE`

Specification:

- Clear PET
- Fits 16 oz deli container
- Tamper-evident locking tab
- Food-contact compliant
- Case quantity: 500
- Preferred case quantity multiples
- Substitutions allowed only if dimensional and material requirements match

## Starting State

Current inventory:

**3,240 units**

Average recent consumption:

**612 units/day**

Safety stock target:

**3 days**

Projected stockout:

**5.3 days**

Current supplier:

**Apex Packaging**

Historical information:

- Last price: $0.087/unit
- Typical freight: $120
- Typical lead time: 7 days
- Historical on-time rate: 94%

The incumbent supplier cannot satisfy the required arrival date.

---

# 4. Primary User

## Buyer / Purchasing Manager

The user supervises the agent rather than manually performing every purchasing step.

The user needs to know:

- What inventory requires attention
- Why action is required
- What the agent is currently doing
- What alternatives were considered
- Why a supplier was selected
- What financial and operational risk exists
- Whether human approval is required

The user should never need to inspect prompts, tool calls, or raw agent reasoning.

---

# 5. Core User Experience

## Main Dashboard

The default screen displays purchasing responsibilities.

### Inventory table

Fields:

- Item
- Internal SKU
- Current inventory
- Daily usage
- Days remaining
- Safety stock
- Reorder requirement
- Current status
- Active purchasing action

Statuses:

- Healthy
- Watch
- Action Required
- Sourcing
- Awaiting Quotes
- Evaluating
- Approval Required
- Ordered
- Confirmed
- Exception

For the hackathon, only one SKU needs the complete workflow. Additional healthy SKUs may be seeded to make the dashboard believable.

---

# 6. Inventory Risk Detection

The system calculates inventory risk deterministically.

Do not use an LLM for basic inventory math.

## Inputs

- Quantity on hand
- Historical daily consumption
- Safety stock target
- Existing incoming inventory
- Expected delivery dates
- Supplier lead times

## Core calculations

### Average daily usage

Initial MVP:

Trailing 30-day consumption / 30

Optional:

Weighted trailing usage if recent consumption is changing materially.

### Days of inventory

`on_hand / average_daily_usage`

### Projected stockout date

`now + days_of_inventory`

### Required inventory

Enough inventory to cover:

- Supplier lead time
- Safety stock
- Configurable coverage window

### Reorder quantity

Round recommendation according to:

- Supplier case pack
- MOQ
- Price breaks
- Maximum desired inventory

---

# 7. Agent Trigger

When projected inventory falls below the configured threshold:

Create:

`ProcurementCase`

Example:

**Procurement Case PC-1024**

Item:

Tamper-Evident 16 oz Deli Lid

Reason:

Projected stockout before normal replenishment can arrive.

Required-by date:

August 31

Target quantity:

15,000 units

The procurement case becomes the central state machine for the entire workflow.

---

# 8. Procurement Case State Machine

States:

`DETECTED`

↓

`ANALYZING`

↓

`SOURCING`

↓

`RFQ_READY`

↓

`RFQ_SENT`

↓

`AWAITING_QUOTES`

↓

`EVALUATING`

↓

`APPROVAL_REQUIRED`

↓

`APPROVED`

↓

`PO_SENT`

↓

`CONFIRMATION_PENDING`

↓

`CONFIRMED`

↓

`CLOSED`

Alternative states:

`NO_VIABLE_SUPPLIER`

`REJECTED`

`EXCEPTION`

`CANCELLED`

Every state transition must be persisted in Convex.

---

# 9. Supplier Discovery

## Objective

Find plausible suppliers capable of supplying the requested product.

Firecrawl should be used for market discovery and supplier intelligence.

It should not be treated as the authoritative source for final commercial terms.

## Search Query Generation

OpenAI generates targeted search queries from structured product specifications.

Examples:

- `"16 oz tamper evident deli lids PET case"`
- `"tamper evident deli container lids wholesale 16 oz"`
- `"food packaging supplier tamper evident deli lids"`

## Firecrawl Responsibilities

Search relevant pages.

Extract:

- Supplier name
- Product URL
- Product title
- Manufacturer
- Manufacturer SKU
- Material
- Dimensions
- Pack size
- Published price
- MOQ
- Published availability
- Published lead time
- Contact information
- Freight information when available

Store the source URL for every extracted claim.

---

# 10. Product Equivalency

OpenAI evaluates whether discovered products plausibly satisfy the required specification.

## Output

Each candidate receives:

- Exact Match
- Likely Match
- Possible Match
- Not Compatible
- Insufficient Information

And:

`matchConfidence: 0–1`

The model must identify which properties are confirmed versus inferred.

Example:

**Likely Match — 0.91**

Confirmed:

- PET
- 16 oz compatibility
- Tamper-evident
- Correct diameter

Unknown:

- Exact locking-tab dimensions

A low-confidence product cannot automatically become the selected supplier without approval.

---

# 11. Supplier Records

Each supplier contains:

- Supplier ID
- Name
- Domain
- Contact email
- Product offered
- Historical relationship status
- Historical lead time
- Historical on-time performance
- Prior purchase price
- Prior freight
- Payment terms
- Notes
- Source URLs

The demo can seed incumbent-supplier history.

---

# 12. RFQ Generation

When enough viable suppliers have been found, the agent generates RFQs.

## RFQ Required Fields

- Product description
- Specification
- Requested quantity
- Delivery destination
- Required delivery date
- Requested pricing
- Freight request
- Lead-time confirmation
- Availability confirmation
- Payment-term request
- Quote-expiration request

Example intent:

> Request a quote for 15,000 units delivered to Cedar Rapids no later than August 31.

The email wording may be generated by OpenAI.

The underlying required data must be structured.

---

# 13. AgentMail Integration

Each company gets a purchasing inbox.

Example:

`purchasing@acme.agentmail...`

AgentMail handles:

- Outbound RFQs
- Supplier replies
- Follow-up emails
- Purchase orders
- Purchase-order confirmations

Each email thread must map to:

- Procurement case
- Supplier
- RFQ
- Quote

---

# 14. Inbound Email Processing

When a supplier replies:

1. AgentMail receives the email.
2. Webhook creates an inbound message event.
3. Convex associates the email with its procurement case.
4. OpenAI extracts structured commercial terms.
5. Quote record is updated.
6. The case is reevaluated.

## Structured quote output

- Quantity available
- Unit price
- Extended price
- Freight
- Taxes if provided
- Total landed cost
- Earliest ship date
- Estimated arrival date
- MOQ
- Pack size
- Payment terms
- Quote expiration
- Exceptions
- Missing information
- Confidence

Raw supplier email must remain attached to the quote for auditability.

---

# 15. Autonomous Follow-Up

If required information is missing, the agent may send a follow-up.

Example missing fields:

- Freight
- Arrival date
- Quantity availability

Example:

> Thanks. Can you confirm whether the $1,350 price includes freight to Cedar Rapids, Iowa and whether delivery by August 31 is guaranteed?

The system should limit autonomous back-and-forth.

Hackathon limit:

**Maximum 2 automatic follow-ups per supplier**

After that:

`HUMAN_REVIEW_REQUIRED`

---

# 16. Quote Comparison

The comparison engine should be deterministic wherever possible.

## Hard Constraints

A supplier is disqualified when:

- Arrival occurs after required-by date
- Product is incompatible
- Quantity available is insufficient
- MOQ exceeds configured limit
- Required certification is missing

## Ranking Inputs

For viable suppliers:

- Landed cost
- Arrival date
- Supplier reliability
- Product-match confidence
- Inventory impact
- Payment terms

### Initial ranking priority

1. Avoid stockout
2. Maintain product requirements
3. Minimize landed cost
4. Avoid unnecessary excess inventory
5. Prefer reliable suppliers
6. Prefer favorable terms

OpenAI can explain the result.

It should not independently calculate the financial comparison.

---

# 17. Recommendation

The recommendation screen should be the core product moment.

Example:

## Recommended

**SupplyCo**

15,000 units

Unit cost:

$0.090

Freight:

$90

Landed cost:

**$1,440**

Arrival:

August 30

Projected inventory at arrival:

1,404 units

Projected inventory coverage after arrival:

24.5 days

### Why

Cheapest qualified option capable of arriving before the projected stockout.

### Alternatives

**RestaurantSupply**

$225 cheaper

Rejected because:

Expected arrival creates a projected 3.2-day stockout.

**Apex Packaging**

$45 cheaper

Rejected because:

Normal lead time misses required delivery.

The user must be able to understand the recommendation without trusting opaque AI judgment.

---

# 18. Human Approval

Purchasing policies determine autonomy.

For the hackathon:

All purchase orders require approval.

Buttons:

- Approve
- Modify
- Reject

Later production policies could include:

`Auto-approve under $500`

`Approval required $500–$5,000`

`Executive approval over $5,000`

The policy layer should exist in the data model even if the demo always requests approval.

---

# 19. Purchase Order

After approval, generate a purchase order.

## PO Fields

- PO number
- Supplier
- Buyer entity
- Ship-to
- Bill-to
- SKU
- Product description
- Quantity
- Unit price
- Freight
- Total
- Required delivery date
- Payment terms
- RFQ reference
- Procurement case reference

Example:

`PO-10482`

The PO can be rendered as HTML or PDF.

AgentMail sends it to the supplier.

---

# 20. Supplier Confirmation

Supplier confirmation arrives through AgentMail.

OpenAI extracts:

- Confirmation status
- Confirmed quantity
- Confirmed price
- Confirmed ship date
- Confirmed arrival date
- Supplier order number
- Exceptions

If terms materially differ from the approved PO:

Status:

`EXCEPTION`

Human review is required.

Otherwise:

`CONFIRMED`

---

# 21. Inventory Projection Update

Once the PO is confirmed, expected inbound inventory is added to the forecast.

The inventory chart should visibly change.

Before:

Inventory curve crosses zero.

After:

Incoming delivery appears before stockout.

Case changes:

**Action Required**

to:

**Covered**

This should be one of the strongest visual moments in the demo.

---

# 22. Live Activity Feed

Convex should power a live event feed.

Example:

**11:03:14**
Stockout risk detected

**11:03:18**
3 potential suppliers discovered

**11:03:27**
Supplier products evaluated

**11:03:34**
3 RFQs sent

**11:04:02**
PackRight replied

**11:04:04**
Quote extracted

**11:04:07**
Quote rejected: delivery too late

**11:04:36**
SupplyCo replied

**11:04:40**
Freight information missing

**11:04:43**
Follow-up sent automatically

**11:05:06**
SupplyCo updated quote

**11:05:09**
Recommendation ready

The dashboard should update without refresh.

---

# 23. Convex Responsibilities

Convex is the system of record and real-time orchestration layer.

Store:

- Organizations
- Users
- Inventory items
- Inventory transactions
- Suppliers
- Supplier products
- Procurement cases
- Search results
- RFQs
- Email threads
- Messages
- Quotes
- Recommendations
- Approvals
- Purchase orders
- Expected inventory
- Agent events
- Audit records

Convex subscriptions drive real-time UI changes.

Convex actions coordinate external integrations.

---

# 24. OpenAI Responsibilities

OpenAI performs semantic and reasoning tasks.

Use OpenAI for:

- Product-specification interpretation
- Search-query generation
- Product-equivalency analysis
- Supplier-email understanding
- Quote extraction
- Missing-information detection
- Follow-up composition
- Recommendation explanation
- Confirmation interpretation
- Exception explanation

Do not use OpenAI for:

- Inventory arithmetic
- Price calculations
- Landed-cost calculations
- Policy thresholds
- State transitions
- Approval authorization
- PO totals

These should remain deterministic.

---

# 25. Firecrawl Responsibilities

Firecrawl handles external supplier intelligence.

Use for:

- Supplier discovery
- Web search
- Product-page extraction
- Supplier-page crawling
- Product specifications
- Public pricing
- Published stock information
- Contact discovery
- MOQ discovery
- Published shipping information

Every claim should retain its source URL.

---

# 26. AgentMail Responsibilities

AgentMail provides the agent's actual purchasing identity.

Use for:

- Sending RFQs
- Receiving supplier quotes
- Thread management
- Autonomous follow-ups
- Sending purchase orders
- Receiving confirmations

Email should not be mocked during the final demonstration.

---

# 27. Suggested Data Model

## organizations

`id`

`name`

`address`

`approvalPolicy`

---

## inventoryItems

`id`

`organizationId`

`sku`

`name`

`description`

`specification`

`quantityOnHand`

`safetyStockDays`

`casePack`

`preferredCoverageDays`

---

## inventoryUsage

`id`

`inventoryItemId`

`date`

`quantityConsumed`

---

## suppliers

`id`

`organizationId`

`name`

`domain`

`email`

`historicalReliability`

---

## supplierProducts

`id`

`supplierId`

`inventoryItemId`

`externalSku`

`productUrl`

`matchConfidence`

`matchStatus`

`publishedPrice`

`publishedLeadTime`

`metadata`

---

## procurementCases

`id`

`organizationId`

`inventoryItemId`

`status`

`triggerReason`

`quantityRequired`

`requiredBy`

`createdAt`

---

## rfqs

`id`

`procurementCaseId`

`supplierId`

`status`

`requestedQuantity`

`requiredBy`

`emailThreadId`

---

## quotes

`id`

`rfqId`

`supplierId`

`quantity`

`unitPrice`

`freight`

`landedCost`

`arrivalDate`

`paymentTerms`

`matchConfidence`

`responseConfidence`

`rawMessageId`

---

## recommendations

`id`

`procurementCaseId`

`selectedQuoteId`

`explanation`

`createdAt`

---

## approvals

`id`

`recommendationId`

`status`

`approvedBy`

`approvedAt`

---

## purchaseOrders

`id`

`procurementCaseId`

`supplierId`

`poNumber`

`quantity`

`unitPrice`

`freight`

`total`

`requiredBy`

`status`

---

## agentEvents

`id`

`procurementCaseId`

`type`

`summary`

`metadata`

`createdAt`

---

# 28. Main Screens

## Screen 1 — Purchasing Dashboard

Shows:

- Inventory health
- Active procurement cases
- Projected stockouts
- Agent activity
- Current autonomous spend

Primary demo starts here.

---

## Screen 2 — Procurement Case

Shows:

- Item
- Inventory projection
- Required-by date
- Recommended quantity
- Current agent state
- Supplier candidates
- RFQ status
- Quote comparison
- Event stream

This is the main demo screen.

---

## Screen 3 — Supplier Comparison

Columns:

- Supplier
- Match quality
- Quantity
- Unit cost
- Freight
- Landed cost
- Arrival
- Reliability
- Result

Clearly visually distinguish:

Recommended

Viable

Rejected

---

## Screen 4 — Approval

Shows:

- Recommended supplier
- Purchase amount
- Inventory impact
- Savings
- Risks
- Alternatives
- Reasoning

Actions:

Approve

Modify

Reject

---

## Screen 5 — Purchase Order

Shows:

- PO information
- Sent timestamp
- Supplier confirmation
- Delivery status

---

# 29. Demo-Only Admin Controls

Create a hidden demo control panel.

It may:

- Reset scenario
- Restore seeded inventory
- Clear prior emails
- Trigger inventory analysis
- Set simulated current inventory
- Reset procurement case
- Display external integration status

It must not fake supplier replies or recommendation results during the submitted demonstration.

The purpose is repeatability, not simulation.

---

# 30. Seed Data

Seed approximately 90 days of usage.

Consumption should show enough variability to appear realistic.

Include three inventory items:

### Deli lids

Action Required

### Deli containers

Healthy

### Shipping cases

Watch

Only deli lids need a complete purchasing workflow.

Seed incumbent purchase history for Apex Packaging.

---

# 31. Demo Supplier Setup

Create three controlled supplier identities.

## Supplier A — Incumbent

Apex Packaging

Cheap but too slow.

---

## Supplier B — Winning Supplier

SupplyCo

Initially provides incomplete terms.

Requires one agent follow-up.

Ultimately becomes the recommended supplier.

---

## Supplier C — Cheapest Supplier

RestaurantSupply

Cheapest price but unacceptable delivery date.

This creates a meaningful optimization decision.

---

# 32. Demo Email Responses

Supplier responses should be sent manually from real email accounts during testing and recording.

They should produce different reasoning outcomes.

### Supplier A

Can deliver after required date.

### Supplier B

Can meet date but initially omits freight.

Agent must ask follow-up.

### Supplier C

Cheapest landed cost but arrives after stockout.

This ensures the winning recommendation cannot simply be “lowest price.”

---

# 33. Demo Success Criteria

The complete flow must execute without manually editing application state.

Success means:

- Stockout automatically identified
- At least two real suppliers discovered or enriched through Firecrawl
- At least two RFQs genuinely sent
- At least two real inbound email responses processed
- At least one autonomous follow-up sent
- Quote comparison generated
- Recommendation produced
- Human approval captured
- PO generated
- PO emailed
- Confirmation processed
- Inventory projection updated
- Convex UI updates throughout without refresh

---

# 34. Explicit Non-Goals

Do not build:

- Full ERP integration
- Full warehouse-management integration
- Accounting integration
- Accounts payable
- Invoice reconciliation
- EDI
- Vendor onboarding
- Contract management
- Multi-currency purchasing
- International shipping logic
- Browser checkout
- Supplier payment
- Sophisticated demand forecasting
- Hundreds of SKUs
- Fully autonomous purchasing without approval
- Generic procurement-suite functionality

These dilute the demo.

---

# 35. Safety and Trust Constraints

The agent must never fabricate:

- Supplier pricing
- Supplier availability
- Delivery commitments
- Product specifications
- Quote terms

Every external claim should identify its source.

The application should distinguish:

- Website information
- Supplier-confirmed information
- Historical information
- Agent inference

Any material ambiguity should either trigger:

- Follow-up
- Reduced confidence
- Human review

---

# 36. Auditability

Every material agent action should produce an event.

Examples:

- Why supplier was rejected
- Why follow-up was sent
- Which source supplied a specification
- Which quote produced the recommendation
- Which user approved the purchase
- Whether final confirmation differs from approved terms

The product should feel autonomous but inspectable.

---

# 37. Key Product Metrics

The dashboard can show:

### Autonomous Spend Under Management

Total annualized purchasing currently assigned to the agent.

### Savings Identified

Difference between selected landed cost and baseline/incumbent purchase cost.

### Stockouts Avoided

Cases where projected stockout was resolved before reaching zero.

### Autonomous Resolution Rate

Percentage of procurement cases reaching approval without manual buyer intervention.

### Average Buyer Touches Per Order

Target direction:

Down.

---

# 38. Hackathon Demo Metrics

Seed impressive but believable summary numbers:

**$284,320**

Annual spend managed

**$17,430**

Savings identified

**0**

Projected stockouts

**71%**

Procurement cases handled without buyer intervention before final approval

Clearly identify seeded historical metrics as demo data.

---

# 39. Product Positioning

Avoid:

“AI-powered procurement platform.”

Avoid:

“Smart inventory management.”

Avoid:

“AI purchasing assistant.”

Preferred positioning:

> **Your autonomous buyer.**

Supporting line:

> It watches inventory, sources suppliers, gets quotes, chooses the best purchase, and places the order.

Alternative:

> Assign it a category. It makes sure you never run out and never overpay.

---

# 40. Future Product Expansion

After proving one SKU:

### Phase 1

One purchasing category.

Examples:

- Packaging
- Janitorial supplies
- Fitness consumables
- Restaurant disposables

### Phase 2

Many SKUs within one category.

### Phase 3

Existing ERP and inventory integrations.

### Phase 4

Supplier performance history.

### Phase 5

Contract pricing.

### Phase 6

Automatic purchasing policies.

### Phase 7

Cross-supplier consolidation.

### Phase 8

Negotiation.

### Phase 9

Invoice and receipt reconciliation.

### Phase 10

The agent owns an organization's routine purchasing function.

---

# 41. Product Principle

Every feature should answer one question:

> Does this help the agent successfully take responsibility for buying the item?

If not, it should not be part of the hackathon build.

The winning prototype is not the one with the most procurement features.

It is the one where an observer can watch one purchasing problem appear, watch the agent solve it, and believe that this could eventually replace a meaningful portion of a buyer's daily work.