# BUY HARD + Facundo: GTM check-in

Reviewed September 13, 2026, around 9:50 p.m. Chicago. Scope: the BUY HARD product campaign and Facundo's founder content.

[Open the local GTM desk](http://127.0.0.1:8796) · [Run it again](../scripts/marketing/gtm-desk/README.md)

Publishing is underway. The next useful work is turning attention into operator conversations and relevant opportunities for Facundo. The current records are much more complete for content production than for follow-up and outcomes. There is too little traffic to diagnose conversion or declare a winning format.

## Current evidence

| Area               | Verified state                                                                                             | Next step                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Product publishing | Eight stories published on both X and LinkedIn; five more scheduled through Tuesday midday                 | Fill Tuesday's 5:30 p.m. slot at the next rolling review                        |
| Founder publishing | Four approved stories scheduled for Sep 14, 16, 18 and 21 at 8 p.m.; none published yet                    | Track meaningful replies, introductions and hiring conversations                |
| Traffic            | Twenty product-campaign browser IDs: 18 LinkedIn, two X                                                    | Give LinkedIn follow-ups attention; keep comparing like-aged posts              |
| Conversion         | Zero non-test inquiries, confirmed bookings or pilot starts recorded across the app                        | Begin logging real operator conversations and their next steps                  |
| Demo measurement   | Known demo-use and direct-approval handoff gap; tested local fix at `59277a1`                              | Include the fix in a chosen release, then verify production                     |
| Video              | Assembled cut and playback verified; actual duration is 180.053333 seconds                                 | Add Facundo's narration/camera and trim the finished export below three minutes |
| Sales integrations | Square/Shopify work committed locally at `6b09402` in the separate sales-connections checkout; task active | Finish provider event, account and release checks                               |
| Brand napkin       | Still a draft; one prerequisite reference published                                                        | Hold until Sep 17+ and two earlier references have published links              |

Queue evidence: [fresh Zernio observation](../output/marketing/gtm-desk/queue-observation.json). App evidence: [fresh production aggregates](../output/marketing/gtm-desk/app-metrics.json). The app queries read all pages of `marketing:events` and `marketing:list` on production `reliable-albatross-463` using the existing administrative CLI; launch-check records were excluded and raw visitor/lead data was not retained. The last saved afternoon check had 17 tagged visitors; the fresh check has 20.

Browser IDs are not verified people. Own visits and bots may be included. Missing demo-use measurements cannot establish that nobody used the demo. Bookings can happen without an inquiry, so those are separate outcomes. Private messages and offline meetings were not reviewed. Social comments may include Facundo's own replies; counts alone do not establish a prospect.

## Where to focus

1. **Start the operator list.** Use the existing narrow audience: small food businesses buying cups, lids, gloves, labels or similar supplies. Track a named contact, one recurring supply, the conversation stage, next action and date. The existing targets are five operator conversations and two interested pilot candidates by submission; these are targets, not recorded progress.
2. **Repair measurement before judging the funnel.** The tested tracking/handoff fix is ready locally. A production release and readback are still needed before demo conversion becomes useful evidence.
3. **Finish a reusable, eligible demo.** The assembled film is ready for narration. Its staged app data explains the experience; it does not prove a real supplier order. The official criteria say “Under 3 minutes,” so leave a few seconds of margin after narration and any closing changes. [Official hackathon page](https://www.convex.dev/hackathons/all-gas)
4. **Keep founder outcomes separate.** Product interest leads toward walkthroughs and pilots. Founder interest leads toward introductions, interviews and work opportunities. They can share a calendar and asset library while keeping their outcome measures distinct.
5. **Complete the existing sales build before increasing scope.** The active task has moved beyond the proposal. Its local implementation and interactive walkthrough do not yet establish a provider-delivered test run or production availability. Let specific operator responses guide which connection to pilot first.

The existing three-post rhythm is an experiment. More posts are not presently supported by enough evidence. Keep the approved queue, use meaningful replies to choose the next examples, and reserve time for the conversations the posts are meant to create.

## One place to operate

The local GTM desk combines:

- **Overview:** dated results, next actions and the two campaign goals.
- **Publishing:** a shared queue, campaign/status filters, post links, captions and claim labels.
- **Follow-ups:** editable operator and founder conversations with stages, next steps and dates. Entries persist on this computer, outside the repository.
- **Work & assets:** owner, next action and evidence for the video, tracking fix, sales connections, supplier proof and submission.
- **Source records:** links back to the original plans, decision log, receipts and aggregate results.

Zernio remains the publishing source, the app's private `/leads` page remains the app lead source, and the existing daily marketing task remains the reviewer. No duplicate calendar or automation was created. The dashboard reads supported existing schedule/publication receipts and app aggregate files when reloaded. It displays when the underlying checks happened; reloading local files is not a live platform refresh.

Work and asset summaries are dated review notes. They need updating when the product task or video work changes. Action checkboxes record a personal completion note; they do not change release or publishing evidence. Follow-up stages are manually recorded and do not create app leads, bookings or messages.

## Status drift found

- The strategy's recording section describes old film material that still needs replacing. The current `you-handle-today-v2.mp4` is already assembled and playback-checked; Facundo's narration is the remaining layer. [Current film notes](../assets/storyboard/you-handle-today-footage/assembly/README-v2.md)
- The product backlog calls the external sales connections a proposal. The active task now has local commit `6b09402`, with additional auth/test work in progress. Hosted release and provider-event proof remain separate.
- The afternoon queue said the AgentMail post was scheduled. The live table now marks it published and provides both platform links.

The existing shared strategy, campaign files and product checkout were left intact because other work is active. The dashboard records these differences with dates and source links.

## Submission checkpoint

Prepare the package on September 21. The current official deadline is September 22 at noon Pacific / 2 p.m. Chicago. The official checklist requires the public repository, root `hackathon.md`, a public `convex.site` or `chatgpt.site` app, sponsor-tagged social posts, and the video. Verify the actual submitted receipt separately. [Official requirements](https://www.convex.dev/hackathons/all-gas)

This review did not publish, reschedule, send outreach, change the marketing automation, deploy production, or submit the hackathon entry.


## Late-evening recording-plan update

Facundo requested short iPhone recordings mixed with the existing images, slides and Hyperframes videos. The [recording plan](founder-recording-plan.md) now gives four founder scripts, delivery targets, an optional sales/cups clip and a main-film narration handoff. The GTM desk has a [Recordings page](http://127.0.0.1:8796/#recordings), and publishing rows show the corresponding recording deadlines. Both strategies and the existing twice-daily marketing review now include this handoff.

Start with F01 by September 14 at noon for the existing 20:00 post. Codex handles the edit and captions. The four founder image schedules were confirmed again; they remain the fallback until a finished video is ready at least two hours before posting. Video-copy drafts are prepared separately. No raw recording, rendered short, paid fal job or live post replacement exists from this update. [Verification](../output/marketing/2026-09-14-founder-recordings/verification.json). The earlier assessment above remains dated; the old recording-section drift has now been corrected in the strategy.
