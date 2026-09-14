# Revised footage preview

Updated September 13, 2026. [Watch the revised 14-second opening](https://v3b.fal.media/files/b/0aaa497d/Ue-Qb64E9_BHsiiN5ekuU_buy-hard-opening-revised.mp4) · [Piano shot only](https://v3b.fal.media/files/b/0aaa497d/n49lQYx-BELlSh5VoD28b_buy-hard-piano-crash-revised.mp4) · [Local opening](./pilot-cut-v2.mp4) · [Original/revised comparison](./index.html).

The piano now drops quickly, the owner and delivery worker flinch at the crash, and its wooden cabinet breaks apart onto the cups and bread. The next phone shot retains the broken piano. All new footage uses H3 Max Turbo, following the user's model choice.

The cut is 1920 × 1080, 24 fps, exactly 14 seconds, with generated ambient audio. It contains footage only. The full three-minute film still needs the actual app conversation, bakery emails, captions and Facundo's recorded narration/camera overlay.

## What changed

Three new piano takes were generated. The first retained the intact piano; the second rotated onto its side and was rejected. The selected third take uses a newly edited aftermath frame showing a shattered piano and startled people. The phone reference and footage were also regenerated so the piano stays broken in the following shot.

The selected impact is a new generation with additional timing work: source time 0.25–2.25 seconds plays at 2×, tightening the fall, collision, reactions and debris together. The opening and settled aftermath retain their original speed. Audio follows the same timing with pitch preserved. This makes a four-second impact shot, between five seconds of unloading and five seconds of the phone handoff. No still-frame padding is used. The visible descent is approximately a quarter-second. [Exact edit record](./impact-retiming-v4.json).

The original clips and original 15-second cut remain available. The comparison page now shows original Turbo versus revised Turbo. The earlier Max comparison is retained in the files but is not used in the cut.

## Generation costs

| Clip | Model | Requested length | Estimated charge |
| --- | --- | ---: | ---: |
| [Original unloading](./clips/01-unloading-turbo.mp4) | Turbo | 5 sec | $0.10 |
| [Original piano](./clips/02-impact-turbo.mp4) | Turbo | 5 sec | $0.10 |
| [Original phone](./clips/03-phone-turbo.mp4) | Turbo | 5 sec | $0.10 |
| [Earlier model comparison](./clips/02-impact-max.mp4) | Max | 5 sec | $0.20 |
| [Faster piano, intact](./clips/02-impact-turbo-v2.mp4) | Turbo | 5 sec | $0.10 |
| [Rejected landing angle](./clips/02-impact-turbo-v3.mp4) | Turbo | 5 sec | $0.10 |
| [Selected broken-piano source](./clips/02-impact-turbo-v4.mp4) | Turbo | 5 sec | $0.10 |
| [Updated phone handoff](./clips/03-phone-turbo-v2.mp4) | Turbo | 5 sec | $0.10 |
| **Total** | | **40 sec requested** | **$0.90** |

This revision added an estimated **$0.40** in video charges. Estimates use the published promotional 1080P rates; actual charges and remaining balance are unavailable to the key. The user reported adding $10. The two revised still frames used the built-in image-generation tool, outside fal. No credits were purchased by this workflow.

## Review and records

Frame review confirms the quicker drop, recoil from both people, breaking piano panels and matching broken instrument in the phone background. The phone remains in the owner's hands. Small debris placement is approximate between wide and close views; this is generated footage, not a physical simulation or a completed app purchasing flow.

The four new original downloads have matching provider byte counts and passed complete decoding checks. The edited impact and assembled opening also passed complete decoding. The opening is exactly 14 seconds with H.264 video and AAC audio. Both hosted viewing copies passed HTTP and byte-length checks. Browser playback evidence is recorded separately in [review-v2.json](./review-v2.json).

- [Exact still-frame prompts and reference paths](./frame-prompts.json)
- [Exact video prompts, seeds and settings](./manifest.json)
- [Selected takes and edit metadata](./pilot-cut-v2-edit.json)
- [Generation receipts](./receipts/)
- [Original preview and original review](./pilot-cut.mp4) · [review.json](./review.json)

Reassemble from the repository root without a paid call:

```sh
python3 video/scripts/assemble-footage-pilot.py --impact turbo-v4 --phone turbo-v2 --output pilot-cut-v2.mp4
```

The generation runner's `collect` command retrieves an existing request; `submit` refuses to recreate a job with a saved receipt. It checks download sizes before marking files complete. A local estimated spending limit of $2 bounds this pilot. Recheck pricing before generating more clips.

The [three-minute screenplay](../../../../docs/demo-screenplay.md) and [recording script](../narration.md) remain the full film plan.
