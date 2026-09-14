# Sales connections walkthrough

A silent, 24-second HyperFrames preview: Square coffee sales move a cup reorder forward, then Shopify gift-set sales move a box reorder forward. The sample is labeled throughout, with draft purchases and illustrative suppliers. It is a reviewable HTML animation, not a recording of a connected store.

The app embeds the portable player at `/sales-story/index.html` and links it from the interactive sample at `/?demo=true&page=connections`.

## Edit and preview

From this directory:

```sh
python3 build-scenes.py
python3 build-player.py
npm run check
npx --yes hyperframes@0.8.37 preview --background
```

`build-scenes.py` regenerates the two editable scenes from `scenarios.json`; `build-player.py` rebuilds `public/sales-story/` using the same scenes. The checked-in `index.html` assembles them at 0 and 12 seconds for HyperFrames. Keep the local GSAP asset reference when rebuilding the root composition.

Open the Studio URL printed by the command in the in-app browser. Do not use the foreground preview command, which opens the system browser. Stop the review server with `npx --yes hyperframes@0.8.37 preview --stop` when it is no longer needed.

The scene figures come from `src/lib/sales-demo.ts` and the app's replenishment calculator. If those scenarios change, regenerate `scenarios.json` from the calculator before rebuilding the HTML. Do not hand-adjust the displayed buying quantities independently of the calculation.

## Files

- `BRIEF.md`, `frame.md`, and `STORYBOARD.md`: story and visual direction.
- `compositions/frames/`: editable HTML/CSS/GSAP scenes.
- `snapshots/contact-sheet.jpg`: six review frames across both scenes.
- `assets/`: local GSAP and fonts; Arimo's OFL license is included.
- `public/sales-story/` at the repo root: generated portable review player.

Each scene has a paused, registered GSAP timeline. The root and player combine the same two scenes. Player controls support play, pause, replay, chapter selection, and seeking. The browser preview starts paused.

The project was built serially in this Codex task. No subagents were started. HyperFrames checks pass with zero warnings; all 103 sampled text contrast checks pass WCAG AA. No MP4 has been rendered or published.
