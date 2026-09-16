# BUY HARD — campaign decisions

## September 11, 2026 — move to daily publishing

**Direction from Facundo:** Three to four posts every day, including weekends; adjust strategy dynamically; use desired product stories to drive product improvements.

**Change:** Replace the spaced launch calendar with three core stories at 08:30, 12:30, and 17:30 Chicago time. Reserve 20:00 for a useful responsive fourth post. Seven concrete posts cover September 12–13, including Saturday’s aspirational inventory question. Keep only the next 48 hours fixed enough to schedule; later themes can move.

**Creative:** Restore the clear OpenAI product card. The handwritten napkin becomes a separate later post, with gun scribbled out and buyer written above it. No extra headline or product material on that image. Hold until September 17 or later and at least two earlier Die Hard references have live post links.

**Observed app evidence:** The production marketing event query returned 19 visits after excluding launch-check events: four attributed to LinkedIn, one to X, and 14 direct or unattributed. No other non-test funnel events were recorded. These are recorded visits, not established operator interest. [Aggregate baseline](baseline-metrics.json).

**Interpretation:** One post and a small event sample do not identify a winning format or diagnose the funnel. Give each upcoming story one clear product action. Compare later demo use, inquiries, and confirmed walkthroughs alongside platform engagement.

**Product work:** Use the linked [product backlog](../../../docs/gtm-product-backlog.md) to connect desired stories to implementation or verification. The first candidates are a continuous sample reorder, a verified supplier order, easier one-item setup, and measured demo-to-walkthrough improvements.

**Publishing direction:** Facundo requested 3–4 daily posts and clarified that future capabilities should become bold “what if” questions. The next 48 hours are to be scheduled as a mix of product stories and aspirational questions. The batch records automatic scheduling; a published result still requires provider confirmation.

## September 11 — bolder marketing hooks

Facundo wants aspirational questions for features we have not built yet. Use “What if you could make inventory magically regenerate?” as the first example. Questions can publish before the feature exists; the response feeds the product backlog. Specific claims of availability, completed orders, or customer outcomes still need their corresponding facts.

## September 11 — separate founder campaign

Facundo clarified that the hackathon can also help him get a job or progress toward YC, then specifically requested a separate campaign. The product batch stays focused on BUY HARD and operators. The new [founder campaign](../../../docs/facundo-founder-campaign.md) has its own copy, campaign tags and measures for hiring conversations and founder introductions. Founder posts use selected fourth slots from September 14; they do not replace the seven weekend product posts or double the daily cadence. No founder post has been scheduled or published yet.

## Review entry template

Record review time, the actual queue, metric source and freshness, useful replies, product changes, the decision made, and the next check. Include receipt links for scheduled or published actions. Keep missing metrics marked unavailable. Do not record private contact details here.

## September 11 — weekend schedule saved

All seven product posts were saved and reopened in Zernio: four September 12, three September 13, each targeting X and LinkedIn. Captions, Chicago times and Schedule mode match the batch. These posts are scheduled, not published yet. The new napkin is a separate verified unscheduled draft. The existing introduction stays published and unchanged. [Receipts](zernio-schedule-receipt.json).

The daily review automation is active at 07:30 and 15:30. It now reads both campaign plans separately and coordinates their shared posting slots. Four founder posts are prepared with their own tracking; none is scheduled.

## September 12 — morning review

At 07:34 Chicago, the refreshed Zernio queue still showed all seven weekend product posts scheduled on both platforms, the napkin as an unscheduled draft, and the introduction published. No failed post was visible. The next 48 hours are covered; retain the queue and avoid duplicate scheduling. Founder posts remain separate prepared copy for selected fourth slots, starting September 14.

The introduction showed 113 views and no replies, reposts, likes or bookmarks on X, and three public reactions on LinkedIn. LinkedIn comments were unavailable without signing in. Zernio's analytics page was unavailable under the current pricing plan; no pricing change was made. These observations are snapshots, not a complete account-level report.

The app recorded 23 non-test visits: 18 direct or unattributed, four from LinkedIn and one from X. That is four more direct visits than the baseline. No later-stage non-test event was recorded. Direct sample approval was under-instrumented and missed the walkthrough suggestion, so zero measured demo use cannot establish that nobody tried the demo. Keep the product and founder scorecards separate and wait for more evidence before choosing a winning format.

GTM-04 now has a minimal local fix on isolated branch `codex/marketing-demo-engagement`, commit `59277a1`. Sample approval shows the walkthrough suggestion, preserves campaign tags, and produces one deduplicated demo-use event in the released backend using the excluded QA source. Mobile behavior, dismissal, typecheck, build, focused lint and attribution tests passed. Production code is unchanged. [Morning record](reviews/2026-09-12-0730-review.json) · [Fix scope and verification](reviews/2026-09-12-demo-engagement-fix.md).

## September 12 — personal campaign approved and scheduled

Facundo approved the revised personal posts: “personal ones are good to go i like them!” All four are now scheduled on X and LinkedIn for September 14, 16, 18 and 21 at 20:00 Chicago time. Each has its two approved images, image descriptions, platform-specific captions and separate founder campaign tags. The copy stays relaxed, positive and open, with no public YC callout.

Each saved post was reopened and checked, and the four schedules remained after a fresh queue reload. These are scheduled posts, not completed publications. Use their existing IDs to avoid duplicates during daily review. [Approval and scope](../2026-09-14-founder-campaign/approval.json) · [Verified receipts](../2026-09-14-founder-campaign/zernio-schedule-receipt.json).

## September 13 — afternoon review and next 48 hours

At the 15:30 Chicago review, seven product stories had published on X and LinkedIn, including today's morning purchase-approval post and midday walkthrough invitation. The AgentMail story remained scheduled for 17:30. No failed post was visible. Monday's prepared product package had not been saved to Zernio; the four approved founder posts remained scheduled at their existing times and IDs.

**Action:** Scheduled five product stories with one reviewed HTML-rendered PNG each: Monday 08:30 source setup, 12:30 sales-driven buying question, 17:30 “A good day to buy hard”; Tuesday 08:30 existing-supplier walkthrough and 12:30 “No, because…” sample purchase feedback. Each saved post was reopened to verify exact LinkedIn and X copy, image description, saved image, Chicago date/time and Schedule mode. A final queue reload confirmed all five. Monday has four total stories including the approved 20:00 personal post. Tuesday evening stays flexible outside this review's 48-hour window. [Captions and images](../2026-09-13-daily-campaign/posts.md) · [Schedule receipts](../2026-09-13-daily-campaign/zernio-schedule-receipt.json).

**Results:** The fully paginated production funnel read returned 53 non-test recorded visitor IDs across tracking history, 39 since the first campaign publication. Seventeen are product-campaign tagged: 15 LinkedIn and two X. This is five additional recorded visitors since morning, four tagged. Today's walkthrough post brought three tagged visits and the approval post one. No non-test inquiry, confirmed booking, pilot start or demo-use event was recorded; there are no non-test lead records. The known sample approval/receiving tracking gap means zero demo use is inconclusive. These browser IDs are not verified people or operators. [App aggregates](../2026-09-13-daily-campaign/app-metrics-1530.json).

Zernio reported 366 impressions, six likes and one comment across the seven product rows. Platform contribution is not established by those combined rows. Native X was refreshed for the four newest posts only; do not combine or compare that subset with earlier full-campaign totals. The public LinkedIn discussion still shows the same one question about scheduled versus event-driven stock checks. No new public reply was visible and none was sent. Founder posts have not published, and private messages were not inspected; hiring conversations and founder introductions remain unmeasured. [Social snapshot](../2026-09-13-daily-campaign/social-metrics-1530.json) · [Publication links](../2026-09-13-daily-campaign/publication-receipt.json).

**Product decision:** Keep operator setup and purchase decisions prominent while inviting input on external sales and inventory connections. The sales question replaces the unverified continuous-demo slot. Source inspection confirms that sample count/rule updates and preset purchases remain separate; GTM-01 now names the needed transition and proof. GTM-05 retains the external-data proposal and will use operator responses to choose a connector. The tested GTM-04 handoff/tracking fix remains local at `59277a1`; this review made no product deployment or new application-code change. Preserve the ongoing film/presentation edits in the shared checkout.

**Brand timing:** “Live free. Buy hard.” has published receipts. Monday's “A good day to buy hard” is only scheduled and does not count as the second published prerequisite yet. The standalone napkin stays an unscheduled draft for September 17 or later, subject to that second receipt.

**Next review:** Check the AgentMail publication, the new operator invitations, and any answer to the sales-connection question when it publishes. Compare posts at matching ages, preserve founder tracking separately, and fill the next rolling slots without recreating existing schedules.


## September 13 — Facundo recordings in the existing schedule

Facundo requested specific iPhone recording prompts and asked Codex to edit his real camera and voice into the current image, slide and Hyperframes posts, including captions. He authorized redrafting scheduled posts when the footage arrives in time. The [recording packet](../../../docs/founder-recording-plan.md) now has four short founder scripts, an optional narrated sales/cups concept, and a separate main-film handoff. Start with F01 only.

**Live queue readback:** Zernio still shows the four founder stories scheduled at 20:00 on Sep 14, 16, 18 and 21 with two images each; five product stories remain scheduled through Tuesday midday. The AgentMail story is now published with both platform links. No publishing mutation was made. [Nine-post schedule observation](../2026-09-14-founder-recordings/queue-readback.json).

**Operating decision:** Use the same founder IDs and time slots. Target F01 delivery Sep 14 at noon; later founder takes Sep 15 at 18:00, Sep 17 at 18:00, and Sep 20 at noon. Only replace an image post if the edited, checked video is ready at least two hours before it runs. Otherwise the approved images publish and the footage can support a later story. The optional sales/Hyperframes clip targets Sep 17 midday as a flexible theme, not a saved schedule. Main-film raw narration target: Sep 19 noon; final export Sep 20 at 18:00, strictly under three minutes.

**Production:** Codex owns take selection, image/product composition, captions and sound. fal options were checked against current official docs: Whisper word times, DeepFilterNet 3 noise cleanup, optional Bria background removal and H3 Max Turbo for a missing illustrative insert. Reuse existing visuals first. Preserve Facundo's actual face and voice. No recording has arrived and no paid generation job was submitted. The current sales Hyperframes source is an HTML preview; render and verify it before using an MP4.

Both strategies and the shared GTM desk now expose the recording handoff. The existing twice-daily marketing review was updated and read back: it remains active at 07:30 and 15:30 on the same task, now checking this plan and ready assets. Prepared video-copy drafts are separate from saved provider receipts. Keep product and founder outcomes separate; improved trust/engagement is a hypothesis to evaluate, not a promised result.


## September 14 — afternoon review

**Queue:** Ten product stories have published on both platforms. The morning source post and midday sales question have live links. Tonight's 17:30 reference and 20:00 F01 founder video remain scheduled. All four founder IDs and times remain unchanged; the first uses its saved video, the other three retain their image fallbacks. No failed post was visible.

**Scheduled:** Three new product stories, each with a reviewed 1536×1024 HTML-rendered PNG and separate X/LinkedIn copy: Tuesday 17:30 Square Sandbox result; Wednesday 08:30 delayed-delivery what-if; Wednesday 12:30 partial receiving. Each post was reopened to verify saved media, alt text, both captions, sponsor mentions, campaign tags, Chicago date/time and Schedule mode. The queue was then reloaded. Wednesday evening stays flexible outside this rolling window. [Exact copy](../2026-09-14-daily-campaign/posts.md) · [Receipts](../2026-09-14-daily-campaign/zernio-schedule-receipt.json).

**Results:** Complete production pagination returned 75 non-test visit events, including 26 tagged product visits (24 LinkedIn, two X), up from 61 total and 20 tagged in the previous saved snapshot. No non-test demo-use, inquiry, confirmed booking, pilot-start event or lead record was returned. These are browser tracking records, not verified operators. Demo measurement still needs a production release check. Zernio's ten combined product rows show 744 impressions; platform contributions and missing counters remain unavailable. Post ages differ and no format winner is inferred. Founder publication and video metrics are not available yet.

**Audience:** Public LinkedIn still exposes the scheduled-versus-event-driven question and the sponsor comment. Facundo already reported replying to both; guest view does not expose the full reply threads. No private messages were inspected or sent. The Square test is a concrete follow-up to the technical question, not evidence that a customer requested Square.

**Product:** Updated GTM-05 from obsolete proposal status to merged implementation, verified local Square test and Shopify connection/catalog proof. Shopify paid-order-to-stock delivery, multi-product mappings and learned daily usage remain open. GTM-04 is merged and pushed; production tracking is unverified in this review. Added GTM-06 for the delayed-delivery idea with inspection and proof criteria; no new feature or deployment was needed for these accurately framed stories.

**Recordings:** F01's completed edit and saved replacement are already recorded by its editing task. The manifest inbox directory does not exist; no F02 recording is recorded as received. Keep its approved images and do not repeat the pending recording request. Preserve all ongoing founder-edit work.

**Next check:** Confirm tonight's two publications separately, then fill Wednesday evening and Thursday's rolling slots. The napkin stays held until September 17 or later and a second reference has a published receipt. Compare F01 at 24/72 hours only within campaign and platform, with unavailable metrics marked explicitly.


## September 15 morning review

F01 published on X and LinkedIn, and the native LinkedIn page plays its 37-second video. The evening product reference also published on both platforms. There are now 11 published product stories and one founder story. No failed publication was visible. Both original queue pages were checked.

Scheduled one new product story for Wednesday September 16 at 17:30 Chicago: “Know the whole price. Then say yes.” It uses a fresh HTML-rendered illustration, all sponsor mentions, separate platform copy and product tracking. The saved post was reopened to verify both accounts, captions, time, image and alt text. Wednesday has three product stories plus the existing 20:00 founder post. Thursday falls outside this morning's 48-hour window and stays flexible. Happy trails paperwork remains a later theme; the current checkout improvement earns this slot.

The separate purchasing task recorded production release 3a69b7c, live-mode Link wiring and controlled-store/model checks. No real wallet/card or merchant purchase was proven. GTM-02 now reflects that progress and the specific remaining pilot. No production deployment, purchase or private message was performed in this review.

Production aggregates, fully paginated and excluding launch-check: 86 visits, 27 product-tagged (25 LinkedIn, two X), one founder-tagged LinkedIn visit, 58 unattributed. No non-test demo-use, inquiry, booking or lead record. These are browser tracking records, not verified people. The demo tracking change is included in the recorded production rollout, but fresh authenticated event validation remains open.

F01's Zernio row reports 25 views and 49 reach, with impressions/reactions/comments unavailable. Those are combined provider figures, not LinkedIn-only measurements. It is about 11.5 hours old. No 24/72-hour matched comparison or improved-trust claim is justified. Guest LinkedIn shows no founder comments and does not expose full signed-in discussion. AgentMail is present as text but is not a clickable mention in that guest view; future captions retain the established official organization label. No post was silently edited to repair this observation.

F02 remains unreceived; the manifest inbox directory does not exist. Its image fallback remains scheduled. The existing recording request is not repeated. F01's manifest and draft status now point to published receipts.

Napkin prerequisites: Live free, buy hard and A good day to buy hard both have publication links. Keep the draft unscheduled until the September 17-or-later slot enters rolling review. No duplicate or extra daily volume was added.

Next review: confirm today's publications, keep founder/operator measures separate, choose Thursday slots, and check for F02 before its existing replacement cutoff.

[Receipt](../2026-09-15-daily-campaign/zernio-schedule-receipt.json) · [Publications](../2026-09-15-daily-campaign/publication-receipt.json)


## September 16 morning review

Both Zernio table pages reviewed: 24 campaign stories, 16 published, two scheduled videos and six drafts. Five remaining image-only posts were changed to drafts and verified; the sixth is the already-held napkin. Original IDs, slots, captions and assets retained. No duplicate stories created.

The Square image yesterday evening and delivery-delay image this morning published before the hold was completed. The no-because image also published yesterday. The pause should have been completed earlier; this review establishes the actual hold rather than claiming it had already happened.

Video slots retained: September 17 at 08:30 and September 18 at 12:30 Chicago. The latter's LinkedIn caption now invites a 20-minute conversation about buying today and what Facundo is testing. Reopened editor confirms saved video, X caption, LinkedIn caption, both accounts and original date. There is no post scheduled for the rest of today. No image filler added.

100 non-test visits: 33 product, two founder, 65 unattributed. No recorded demo-use, inquiry, booking or lead. Previous morning: 86 visits, 27 product, one founder. Tracking and visitor identity limitations remain. F01 combined metrics: 39 views, 90 impressions, 64 reach, one like; comments unavailable. Its approximate 37-hour age and combined metrics prevent a matched within-platform 24/72-hour format comparison.

Square's one visible comment is a third-party promotion, not a product question or operator lead. No outreach or reply sent. AgentMail appears plain text on guest LinkedIn despite the stored organization mention; no claim that all four tags resolve natively.

Recordings: existing F01 and IMG_6987 two-prompt package found; no inbox directory or additional founder take in the manifest. Preserve P02/P03 finished videos. No paid editing jobs or repeated recording request.

Concurrent AgentMail implementation remains untouched. Updated the backlog's invitation/proof follow-up, campaign guides, recording manifest, GTM desk and automation; no deployment, purchase or code change.
