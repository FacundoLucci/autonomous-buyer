# You handle today — review assembly

> The [assembled version 02](./README-v2.md) now combines the approved footage with
> the real mobile UI recording. This document describes the earlier version 01.

September 13, 2026 · 3:00 · 1920 × 1080 · 24 fps

The [review page](./index.html) contains the three-minute film assembly and the [54-second footage sequence](./footage-sequence-v1.mp4). The editable timeline matches the current lime, ink, pale panels, thin rules and dot-matrix BUY HARD wordmark. The fictional owner handles emergency supplies while the buyer arranges replacements.

This is a production review, with illustrative buyer messages and a timed narration guide. Verified app captures and Facundo’s actual Loom camera/narration recording are still needed for the final demo. No live purchases, supplier emails or address changes were made to create these cards.

## Selected footage

All eleven selected shots are assembled in story order in the footage-only copy. Human movement plays at normal speed; the piano uses the previously approved tightened impact edit. No human footage is looped or stretched to fill the three minutes.

The return shot uses `08-returning-cleanup-turbo`: the owner enters the **original doorway at the right**, the piano stays in the original foreground, and two workers collect debris. The delivery truck, driver and hand truck are gone. The reverse-angle return frame and the earlier take with the startled driver are superseded and excluded from the selected assets.

The full film shows this return at **1:32–1:37** in a wide frame so the cleanup workers and original doorway remain visible. The owner is carrying supplies bought locally; replacement supplier orders have not arrived.

## Buyer story and narration

The cup order uses an online store. The bakery sequence shows an email enquiry, a price reply missing the delivery time, the buyer’s follow-up, completed terms, the owner’s decision, and a separate bakery order confirmation. A later address-change message remains a request.

The review’s example terms are fictional: four cases / 2,000 cups at $96 delivered, tomorrow by 5 pm; 120 bread rolls at $84 delivered, tomorrow before 7 am; $180 combined. Replace them with values from the same verified run when adding app evidence.

Use the [recording script](../narration.md) and [timed narration guide](./narration-guide.srt). The circular space at the lower left is reserved for Facundo; it is separate from the actor playing the owner. The composition accepts an optional `narrator` camera video and/or `voiceover` file, supplied relative to `video/public/`. Avoid supplying duplicate audio in both. Fit the final timing to the real narration.

## Files and reproduction

- [Three-minute review](./you-handle-today-review-v1.mp4)
- [Footage only](./footage-sequence-v1.mp4)
- [Timeline and narration cues](./timeline.json)
- [Selected source files](./selected-assets.json)
- [Footage-only edit record](./footage-sequence-v1-edit.json)
- [Export and playback checks](./review.json)

Viewing copies for another device: [three-minute review](https://v3b.fal.media/files/b/0aaa4ae1/UuxlTXyaNbAmghaRKz588_buy-hard-three-minute-review-v1.mp4) and [footage only](https://v3b.fal.media/files/b/0aaa4a9f/gpBzAHaHf4x_cm9nIxIuN_buy-hard-footage-sequence-v1.mp4).

From the repository root:

```sh
node video/scripts/prepare-footage.mjs
python3 video/scripts/assemble-footage-sequence.py
```

Then from `video/`:

```sh
npm run typecheck
npx remotion render src/footage-index.tsx YouHandleTodayReview ../assets/storyboard/you-handle-today-footage/assembly/you-handle-today-review-v1.mp4 --codec=h264 --crf=20 --pixel-format=yuv420p --concurrency=2 --offthreadvideo-video-threads=1 --offthreadvideo-cache-size-in-bytes=268435456 --timeout=120000
```

The separate footage entry point leaves the older film composition intact. Rendering and local edits make no paid generation calls.

For the review page, run `node video/scripts/serve-footage-review.mjs` from the repository root and open `http://127.0.0.1:8792/assembly/`. This local server supports video seeking, including the chapter buttons.

## Generation costs

The eight continuation clips and cleanup retake were generated with H3 Max Turbo, five seconds at 1080P each, estimated at $0.10 per clip: **$0.90 additional**. All 17 generated video requests, including the earlier comparison and revisions, total **$1.80 estimated**. Request receipts are retained under `../pilot/receipts/`.

These estimates use the provider’s promotional price checked on September 13. They are not actual billing or a confirmed remaining balance. Reference frames were created with the built-in image tool, separate from these fal video charges.
