# Capture evidence

Captured through the real Chrome UI on September 6, 2026 (UTC), while signed out.
All pictured product screens come from:

https://festive-coyote-483.convex.site/?demo=true

Record: **PC-0180**, procurement `mx712r81b7s4qt1n7ny4jcj60s8d9ftp`.
Purchase order: **PO-PC-0180-8DBWV3**.

This is the **review release**, not a claim that the production host has the
same interface. Recheck the intended judge URL against this release before
publishing the finished film. No release was deployed to create these captures.

## What the files show

| File | Actual observed screen |
| --- | --- |
| overview | Buy Desk entry, demo workspace notice, signed-out walkthrough |
| risk | Recorded guide's original shortage step |
| risk-detail | Unobscured stock 3,240; use 612/day; 15,000 required by September 2 |
| sources | Firecrawl supplier-page evidence and OpenAI provider credits |
| rfqs | Stored SupplyCo request; recipient explicitly marked controlled demo |
| followup1 | SupplyCo first clarification and still-incomplete next reply |
| email | Expanded exact sent clarification asking freight and arrival |
| followup2 | Second clarification and completed revision 3 fields |
| comparison | SupplyCo $3,000 vs RestaurantSupply $2,600, with arrival/stockout rules |
| approval | Recorded guide's exact terms and demo-assumption warning |
| approval-detail | Unobscured Facundo approval, terms, and inspect-PO control |
| confirmation | Supplier terms match; 15,000 confirmed incoming units |
| order | Exact PO totals and approved quote revision 3 |
| delivery | Stored delivered-once receipt and matching confirmation |
| recent | Recent buys with confirmed PC-0180 |

The stills are 1920×1080 browser screenshots. The app's own guide adds its own
spotlight/dimming; supplemental `*-detail` images were captured through normal
app navigation with the guide closed. No text or UI was replaced in a capture.

Motion clips are real browser screencast frames, not inferred state changes.
**They are excluded from the first cut:** the browser recorder cropped the right
edge despite reporting a full-width frame. Keep them only as capture diagnostics;
do not enable them in a final film without recapturing and reviewing the geometry.
`capture-times.json` retains provider timestamps and frame names.
`motion-manifest.json` contains encoded durations. `scripts/encode-captures.mjs`
preserves timing, pads short frames without stretching, and holds the last frame
for one second. Raw JPEG intermediates under `frames/` are ignored by Git.
Keep them locally if re-encoding is needed. PNGs and MP4s are sufficient to render
the film independently of the live app.

Only navigation, read-only inspection, and recorded-guide steps were performed.
No emails, approvals, orders, inventory changes, or account changes were created
for the film. Existing controlled test sends remain identified as such.

The projected shortage is historical demo evidence, not a current inventory
alert. Supplier identities in test emails are not endorsements of the websites
in the discovery panel. A 90% match value is explicitly a demo assumption.
“Confirmed incoming” is not physical receipt of goods.
