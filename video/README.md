# BUY HARD — The $400 Decision

An editable 2:45 film: 1920×1080, 30 fps, nine scenes. Every product image is an
actual app capture. Titles and captions sit in a separate editorial frame. The
renderer makes no live app queries, decisions, or sends.

This project has its own package and lockfile. It does not change the app build.

## Run

```sh
cd video
npm install
npm run typecheck
npm run assets
npm run studio
npm run render:preview
npm run render:silent
npm run render:cues
```

The preview renders only the opening 12 seconds. Full silent and cue copies are
165 seconds. Exports go into ignored `out/`. Rendering fails if required genuine
captures are missing; it never silently substitutes a fabricated interface.

## Actual media

Place genuine screenshots of the same recorded purchase in `public/captures/`:

`overview.png`, `risk.png`, `sources.png`, `rfqs.png`, `followup1.png`, `email.png`,
`followup2.png`, `comparison.png`, `approval.png`, `confirmation.png`, `order.png`,
`recent.png`, plus supplemental `risk-detail.png`, `approval-detail.png` and
`delivery.png`.

The approved source record is PC-0180 from the Buy Desk guide on
`https://festive-coyote-483.convex.site/?demo=true`. The pictured run shows the
$2,600 late option and $3,000 recommended option, with 15,000 confirmed incoming
units. The final judge URL must identify the same release and visible flow.

The initial owner scene uses the real overview until Facundo's documentary deli
clip is supplied. No synthetic deli footage is included. The clean cut has no
placeholder label; the cue copy is explicitly a voiceover rehearsal.

Optional genuine motion clips override individual screenshot shots through
composition props. Example props file:

```json
{
  "motion": {
    "email": {"src": "captures/email.mp4", "durationInFrames": 98, "trimBefore": 0, "playbackRate": 1}
  },
  "deliClip": {"src": "deli/counter.mp4", "trimBefore": 0},
  "judgeUrl": "festive-coyote-483.convex.site/?demo=true"
}
```

All clip trim values are composition frames (30 fps). Set `durationInFrames` to
the actual transition length; the genuine still supplies the remaining reading
hold. Motion does not loop. Keep waits visibly compressed and
preserve chronology. Screen captions must never suggest a new action occurred
when the capture is inspecting stored evidence.

## Record the narration

The clean recording sheet is [demo-voiceover.md](../docs/demo-voiceover.md).
The nine timed blocks also live in `src/manifest.ts` and
`../docs/demo-film-treatment.md`. Watch `BuyHardCues` or the cue MP4 and record
each block separately, leaving a short quiet lead-in and tail. WAV is preferred;
a clean MP3 or M4A can also be used if the local renderer supports its codec.

Put recordings in ignored `public/voice/`. Create ignored `voice-props.json`:

```json
{
  "voiceClips": [
    {"sceneId": "question", "src": "voice/01-question.wav", "trimBefore": 0},
    {"sceneId": "owner", "src": "voice/02-owner.wav", "trimBefore": 0}
  ]
}
```

Or supply one uninterrupted take with `{"voiceover":"voice/full-take.wav"}`.
Do not set both whole-film and per-scene narration. Run `npm run render:voice`.
Fit scene timings to Facundo's delivery before the final export; the cue timing
is guidance, not an instruction to rush. The silent version intentionally has
no generated voice, music, or sound effects.

## Edit

- `src/manifest.ts`: scene starts, shot durations, file references, narration.
- `src/Film.tsx`: editorial design, restrained camera motion, caption layout.
- `src/Root.tsx`: silent and voiceover-cue compositions.
- `scripts/check-assets.mjs`: authentic screenshot coverage check.

The first rendered cut uses real screenshots plus editorial camera movement.
The local browser screencasts have inconsistent capture geometry, including
a clipped right edge in the email clip, so no MP4 capture is enabled by default.
Optional motion support remains for a future correctly framed capture pass.
Raw frames and captured MP4 diagnostics are ignored. Their timing metadata and
`scripts/encode-captures.mjs` document the attempted capture pass locally; the
committed PNGs are sufficient to reproduce the finished first cut.

The sources are the app's cream, dark-green and acid-accent visual language,
not copies of its interactive components. Recorded browser pixels remain intact
inside the media frame. Current scenes use deliberate still holds with measured
pans/zooms. These are reading holds, not claims of new app actions.

Official implementation references: [video](https://www.remotion.dev/docs/media/video),
[sequences](https://www.remotion.dev/docs/sequence),
[audio](https://www.remotion.dev/docs/media/audio).
