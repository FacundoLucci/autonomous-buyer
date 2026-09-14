---
format: 1920x1080
duration: 24s
message: Sales bring your next supply order forward, before you run out.
arc: Busy cafe → cups reordered → busy shop → packaging reordered
audience: Small business owners evaluating BUY HARD
mode: autonomous
music: none
captions: skipped (silent UI mock; all meaningful data is visible in the interface)
---
## Video direction
Paper canvas, ink typography, lime buyer panel from frame.md and the new app UI. Each scene holds a single source-to-buyer relationship. Default power3.out easing, small y translations, crisp data swaps and a line draw. Readable staged reveals: source, stock impact, buying decision, reason. No floating decor, camera drift, gradients, synthetic screenshots, or placed-order claims. Each final decision holds for the final two seconds. A clean cut separates the providers. All scenes carry “SAMPLE SCENARIO” and buyhard.app. No general-purpose frame workers are dispatched; the two bounded frames are authored serially under the skill fallback.

## Frame 1 — A busy cafe, a buyer who keeps up
- status: animated
- src: compositions/frames/01-square.html
- duration: 12s
- poster: 10s
- transition_in: cut
- scene: Square coffee sales bring a cup reorder forward.
- voiceover: none
- type: feature_showcase
- narrativeRole: Show the business outcome and the concrete sales-to-supply relationship.
- asset_candidates: none (HTML reconstruction from the supplied UI and computed Square scenario)
- focal: BUY HARD buyer panel, reconstructed from the requested UI mock
- roles: source panel supporting; buyer panel foreground; figures from scenarios.json
- blueprint: compose
- effects: svg-path-draw, stat-bars-and-fills
Scene 1 (0.0–2.0s): Header “Busy day. Stock handled.” above a two-column UI. Square source panel at x96 y285 w640 h555, buyer panel at x870 y285 w954 h555. Buyer displays 800 cups, 8 days left, reorder in 3 days. This is the initial held state.
Scene 2 (2.0–4.5s): 300 completed takeaway coffee sales reveal in the source panel. A small mapping row says “1 coffee uses 1 cup”. Draw the connecting arrow left to right.
Scene 3 (4.5–7.0s): Buyer stock updates in place: 800 → 500, 8 → 5 days; stock fill shrinks to 62.5%. Reorder timing changes from “In 3 days” to “Today”. Same geometry preserves context.
Scene 4 (7.0–10.0s): Buyer message reveals “Busy lunch? Cups are covered.” with purchase draft “600 cups · 6 packs” and “For your review”. Why now row: “3d delivery + 1d preparation + 1d reserve”. No real supplier or completed purchase.
Scene 5 (10.0–12.0s): Hold the resolved UI. Footnote within y890 reads “Your sales change. Your buying plan follows.” No exit motion.

## Frame 2 — More orders, boxes ready
- status: animated
- src: compositions/frames/02-shopify.html
- duration: 12s
- poster: 10s
- transition_in: cut
- scene: Shopify paid orders bring a packaging reorder forward.
- voiceover: none
- type: feature_showcase
- narrativeRole: Show the same buying behavior in ecommerce, with explicit stock and pack calculations.
- asset_candidates: none (HTML reconstruction from the supplied UI and computed Shopify scenario)
- focal: BUY HARD buyer panel, reconstructed from the requested UI mock
- roles: source panel supporting; buyer panel foreground; figures from scenarios.json
- blueprint: compose
- effects: svg-path-draw, stat-bars-and-fills
Scene 1 (0.0–2.0s): Header “More orders. Boxes ready.” and matching geometry from frame 1. Shopify source panel; buyer displays 140 boxes, 7 days left, reorder in 3 days.
Scene 2 (2.0–4.5s): 60 paid gift-set orders reveal. Mapping row “1 gift set uses 1 box”. Draw connecting arrow.
Scene 3 (4.5–7.0s): Buyer updates stock 140 → 80 and coverage 7 → 4 days. Fill shrinks to 57.14%. Reorder shifts from “In 3 days” to “Today”.
Scene 4 (7.0–10.0s): Message “A good launch. A ready buyer.” reveals a purchase draft “125 boxes · 5 packs”, “For your review”. Why now: “2d delivery + 1d preparation + 1d reserve”.
Scene 5 (10.0–12.0s): Hold the full result and footer “Stay stocked. Keep doing your thing.”, buyhard.app. No fade to black.
