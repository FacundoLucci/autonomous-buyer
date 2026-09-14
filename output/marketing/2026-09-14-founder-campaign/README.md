# Facundo × BUY HARD — visual review package

Four personal posts, with two 1536 × 1024 PNGs each. The captions are relaxed, positive and open. No public caption or image calls out YC. Facundo approved all four posts. They are scheduled on X and LinkedIn for September 14, 16, 18 and 21 at 20:00 Chicago time. [Verified schedule receipts](zernio-schedule-receipt.json).

- [Open the HTML gallery](http://127.0.0.1:54238/2026-09-14-founder-campaign/html-preview/?post=simpler_frontend)
- [Captions and image order](posts.md)
- [Download all eight PNGs](ready/founder-visuals.zip)
- [Image sources, alt text and hashes](visuals.json)
- [Verification](verification.json)

## Image pairs

| Post | First image | Second image |
| --- | --- | --- |
| I’ve been simplifying things | Annotated archived UI | Annotated current UI |
| Figuring out the handoff | Actual sample buyer conversation | Actual purchase decision |
| I’d love to build more of this | Current desktop and mobile views | Enlarged UI details |
| What would you hand off first? | The future idea as a question | Current inventory screen and feedback prompts |

## Editing

Edit `html-preview/index.html` for text, layout, screenshot crops and SVG annotations. Headlines use the same bundled Inter font throughout; Caveat is used for the handwritten notes. Captions live in `posts.json` and are mirrored in `posts.md` and `html-preview/campaign-data.js`.

The old screenshot is the unchanged archived `output/playwright/judge-live-desktop.png`, present in repository commit `ee59776`. Its sample figures are part of that earlier UI. The current screenshots were captured from the public sample workspace at buyhard.app on September 12. These examples use different demo data, so the comparison shows interface design, not a measured customer result.

The supplies photo reuses the previously reviewed product campaign PNG. `cutout.js` reuses that campaign’s HTML renderer to remove its baked preview checkerboard. UI screenshots are not generated or rewritten. All markup sits over the images in HTML/SVG.

## Preview and export

Run from the repository root. A server is already running on port 54238 for this review.

```sh
python3 -m http.server 54238 --bind 127.0.0.1 --directory output/marketing
```

Review in the Codex in-app browser. The export browser is headless:

```sh
/Users/facundo/.codex/skills/playwright/scripts/playwright_cli.sh -s=founder-assets open http://127.0.0.1:54238/2026-09-14-founder-campaign/html-preview/
/Users/facundo/.codex/skills/playwright/scripts/playwright_cli.sh -s=founder-assets run-code --filename output/marketing/2026-09-14-founder-campaign/html-preview/export-cards.js
/Users/facundo/.codex/skills/playwright/scripts/playwright_cli.sh -s=founder-assets close
```

`capture-screens.js` recaptures the current sample screens into `output/playwright/founder-campaign/`. `capture-detail.js` captures the enlarged approval source at 2x resolution. Run them through the same headless `run-code --filename` command, then copy those PNGs into `html-preview/assets/` and re-export. Keep the old screenshot. Recheck the crops, annotations, dates, alt text and hashes after any refresh.

Refresh current screenshots before a later post if the interface or sample dates have moved. These eight approved images are attached to the saved schedules. The posts have not published yet. Use the existing receipt IDs when reviewing or adjusting the queue to avoid duplicates.
