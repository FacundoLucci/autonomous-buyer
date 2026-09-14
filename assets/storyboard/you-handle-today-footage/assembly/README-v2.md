# You handle today — assembled film

Version 02 · 3:00 · 1920 × 1080 · 24 fps

The [complete cut](./you-handle-today-v2.mp4) combines the approved owner footage
with the real mobile app recording. The [review page](./index.html) has scene
shortcuts and optional narration cues. The original review remains at
[version 01](./index-v1.html).

The piano keeps its approved impact timing. The owner returns through the original
doorway while the cleanup crew works outside. The truck and startled driver are
absent from that return shot. This scene stays wide, at **1:32–1:37**.

The app appears alongside the owner while he deals with the immediate problem.
Closeups enlarge recorded app pixels for the replies, purchase terms and bakery
emails. Text streams at the original speed; static app frames supply reading
pauses. Human motion is never slowed or looped to fill a scene.

The app recording uses actual production components with fictional story data.
This is not a live purchasing run. The address change at 2:27 remains a request;
supplier acceptance of that change is not shown.

## Narration and camera

The lower strip is clear for Facundo's Loom camera and narration. The cut has
quiet location sound and the piano impact, with no substitute voice or music.
Facundo's recording is the remaining production layer.

Use the [recording script](../narration.md) and [timed narration cues](./narration-v2.srt).
The review page's **Show narration cues** option displays the guide over the clear
lower strip; those cues are not burned into the downloaded video.

To bake in an existing camera recording, place it in `video/public/voice/`, create
`video/voice-props.json` containing `{"narrator":"voice/facundo.mp4"}`, then run
`npm run render:complete -- --props=voice-props.json` from `video/`. A narration-only
file can instead be supplied with `{"voiceover":"voice/facundo.wav"}`. Use one
audio source to avoid doubling the voice. Match the edit to the actual delivery
when the recording is available.

## Edit map

| Film time | Material |
| --- | --- |
| 0:00–0:33 | Ordinary morning, delivery, piano and the damaged shipment |
| 0:33–0:58 | Phone handoff and streamed acknowledgement |
| 0:58–1:15 | Emergency pickup and replacement cups |
| 1:15–1:49 | Bakery enquiry, reply, follow-up, cleanup and combined plan |
| 1:49–2:07 | Review terms and approve |
| 2:07–2:27 | Order confirmations and the bakery's email |
| 2:27–2:40 | Request a different delivery address |
| 2:40–3:00 | Back to customers and closing card |

## Rebuild

From `video/`, run `npm run render:complete`. The renderer uses the installed local
Remotion environment and ffmpeg. It makes no paid generation calls.

The source is `video/src/CompleteFilm.tsx`; the separate entry point is
`video/src/complete-index.tsx`. `video/src/complete-manifest.json` contains all cuts,
app trims, crop windows and reading holds. The old compositions remain intact.

The preparation scripts verify the approved mobile video's hash, then decode its
frames to lossless PNGs for efficient compositing. Identical frames share a file.
This changes neither the recorded pixels nor their timing. The generated image
cache is ignored by Git and can be reproduced from the approved mobile MP4.

The finish script checks duration, dimensions and frame count, decodes the entire
export, extracts review frames, and builds the playback page.

- [Timeline](./timeline-v2.json)
- [Source files and reading holds](./selected-assets-v2.json)
- [Export validation](./complete-v2.json)
- [Mobile recording and separate inserts](../mobile-app/index.html)
- [Footage only](./footage-sequence-v1.mp4)

**Additional fal generation cost for this assembly: $0.**
