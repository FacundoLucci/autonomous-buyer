# Company onboarding

The local `/setup` flow asks one question at a time: company name, delivery address,
first item, SKU, counting unit, stock on hand, estimated daily usage, supplier lead
time, and safety stock. A receipt builds alongside the form and its answers can be
edited directly. Account creation follows the company questions. Existing users
can sign in at `/setup?mode=login`.

Company answers survive a refresh in the same browser tab. Passwords are kept only
in component memory, never in draft storage. The company and first item are saved
in one authenticated Convex mutation; retrying cannot create another workspace.

The final connection creates an AgentMail Pod and purchasing inbox for that
company. Both use stable client IDs so a retry can recover an existing resource.
The app shows the actual provider-returned address after it is saved. If inbox
setup fails, the company and inventory remain available, with a retry and a way
to open the desk. This step creates email infrastructure but does not send mail.

Each company's workspace and stock updates derive membership from the signed-in
user. New owners cannot claim or reset Acme's demo. Demo lookups include `isDemo`
so another company can legitimately have the same name. Inbound supplier replies
must also arrive at the inbox belonging to the purchase's company.

The resulting desk shows the company's own inventory, estimated coverage, reorder
threshold, delivery address, and inbox. Stock counts can be updated. Supplier
sourcing and purchasing workflows for these new companies are still a separate
implementation step; the desk states this explicitly.

## Validation on 2026-09-05

Development target: `festive-coyote-483`. Production was unchanged.

- Fresh password signup and returning password login passed through the real API.
- Two accounts received separate company workspaces and inventory.
- Invalid stock caused no partial company creation. Repeat completion created no
  duplicate item or company.
- Guest reads/writes and another company's stock update were denied.
- New owners could not reset or claim the shared demo.
- Owner stock updates persisted through sign-out and sign-in.
- The browser flow was checked through company, item, receipt editing, and account
  entry on desktop and a phone viewport. Browser password submission and a live
  AgentMail inbox creation were not performed in this check.

The machine-readable API results are in `output/onboarding/backend-checks.json`.
The test accounts use `buyer-test.example` addresses. No provider messages were
sent by these checks.
