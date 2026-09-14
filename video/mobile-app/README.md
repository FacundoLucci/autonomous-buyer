# BUY HARD mobile recording

90-second silent mobile sequence, rendered locally with Hyperframes. The output
is 1080 × 2340 at 24 fps, with the actual application at a 360 × 780 CSS viewport.
Use the whole recording or the six separate clips as inserts over the owner footage.

This imports the production `AgentSurface`, `AgentWork`, `WorkspaceScreen`,
`PurchasingInboxContent`, and app styles directly. The lime background, typography,
composer, approval cards, and email view come from the real UI. The standalone
Tailwind build explicitly scans the same source components as the application.

The conversation, prices, addresses, supplier replies, and purchase outcomes are
fictional film data. Assistant replies reveal words over time; emails and purchase
terms remain still for reading. The recording does not make backend calls and is
not evidence of live streaming, emails sent, or orders placed. The final address
change is acknowledged as a request and is not shown as supplier-confirmed.

## Files

Output folder: `../../assets/storyboard/you-handle-today-footage/mobile-app/`

- `mobile-app-staged-v1.mp4`: complete 90-second recording.
- `clips/`: six separate, precisely trimmed inserts.
- `index.html`: interactive local preview and video player.
- `chapters.json`: chapter timing, dimensions, and frame rate.
- `recording.json`: provenance, file hash, and individual clip metadata.
- `site/`: bundled real UI and the Hyperframes composition.
- `qa/`: inspected sample frames from the exported video.

| Time   | Screen                                                 |
| ------ | ------------------------------------------------------ |
| 0–24s  | Owner's handoff and streamed acknowledgement           |
| 24–32s | Replacement cups and actual purchase terms             |
| 32–53s | Bakery enquiry, price reply, and delivery confirmation |
| 53–68s | Combined plan and individual approval cards            |
| 68–78s | Order confirmations and bakery email                   |
| 78–90s | Owner requests a different delivery address            |

## Rebuild

From this directory, run `npm ci --ignore-scripts`, then `npm run render`.
The root project's dependencies, Node, pnpm, ffmpeg, and ffprobe must be installed.
The script uses the existing headless browser from the video project when present;
otherwise Hyperframes obtains its browser. Set `HYPERFRAMES_BROWSER_PATH` to
choose a working headless Chromium binary. Rendering stays local and requires
no video generation credits.

Start the review server from the repository root with
`node video/scripts/serve-footage-review.mjs`, then open
`http://127.0.0.1:8792/mobile-app/`.

Edit `scenario.ts` to change words and timing. `mobile.tsx` selects actual app
screens and controls scrolling. `stage.ts` registers a paused GSAP timeline that
Hyperframes seeks for each frame. `prepare.mjs` builds the review page, and
`finish.mjs` cuts the clips and writes metadata. The linter may report the timeline
as missing because Vite places its registration in an external module; the browser
loads that module and the rendered samples verify the timeline advances.

The recording is silent and has no added pointer or fake on-screen keyboard.
Facundo's narration and camera overlay are added in the film assembly.
