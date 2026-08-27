# Autonomous Buyer Product Integrity Policy

Autonomous Buyer detects inventory risk and coordinates supplier discovery, RFQs, quotes, recommendations, human approval, and purchase orders.

## Rules

- Convex is the source of truth for inventory, procurements, suppliers, messages, quotes, recommendations, approvals, purchase orders, and activity history. UI-only state cannot stand in for these records.
- Seeded or demo data must be clearly identified and isolated. Never present mock, hardcoded, or planned behavior as live provider activity.
- Every visible capability needs its real data path, allowed user action, loading/error/empty states, and consistent status everywhere it appears.
- Every purchase order requires an authenticated human approval tied to the exact quote and recommendation revision. Public views stay read-only.
- External research and email actions run on the server. Show sent, received, or confirmed only after durable provider evidence exists; failures must stay visible and retry safely without duplicate sends.
- Procurement state changes must follow the defined workflow and leave an audit trail. Money, quantity, dates, supplier evidence, and decision reasons must remain traceable.
- Missing credentials, data, or provider access must produce an honest unavailable state, never a fake success or silent fallback.
