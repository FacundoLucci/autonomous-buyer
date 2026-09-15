# BUY HARD — GTM and social plan

Revised September 13, 2026 · Owner: Facundo · Campaign started September 11

This remains the **product campaign**. A separate [Facundo founder campaign](facundo-founder-campaign.md) supports hiring opportunities and YC connections through the work behind BUY HARD. Keep their copy, tracking and outcomes distinct; coordinate the shared daily posting slots.

**Purchasing. Handled. Keep the line moving.**

Introduce BUY HARD through the work it takes off an operator's plate: keeping supplies stocked, preparing reorders, and handling approved purchases. The buyer starts the routine work; the owner approves spending and handles deliveries or exceptions. Before the hackathon deadline, tag **Convex, OpenAI, Firecrawl, and AgentMail** and explain the work each enables.

The introduction is published: [X](https://twitter.com/i/web/status/2098480454227698101) · [LinkedIn](https://www.linkedin.com/feed/update/urn:li:share:7504246162770821120/). The campaign now targets **three product posts every day, including weekends, plus a fourth responsive post when useful**. The [weekend batch](../output/marketing/2026-09-12-daily-campaign/weekend-posts.md) contains the next seven posts. The [editable gallery](../output/marketing/2026-09-11-first-three/html-preview/index.html) keeps the product cards separate from the later handwritten napkin. Publishing mode and actual queue receipts are recorded in the daily campaign folder; proposed times are not proof of scheduling.

## 1. The story we should tell

**Positioning:** BUY HARD is an AI buyer for the everyday supplies that keep a small business running.

**Supporting line:** “Stay stocked. Skip the last-minute scramble.”

The agent handles recurring purchasing work using recorded stock counts, usage, buying rules, and expected deliveries. Replenishment must first be enabled for the item. Once it is set up, the owner should not have to open a chat to start every buy. Manual stock corrections and one-off buys are useful exception stories, not the opening pitch. Keep live availability claims within the evidence below.

Our first audience remains owners and purchasing leads at small food businesses: delis, cafés, caterers, and food producers. Cups, lids, gloves, towels, and labels make the story concrete. This is a starting audience hypothesis; learn from the first ten operator conversations before expanding to other businesses.

Three messages should carry the campaign:

- **Stay ahead of shortages.** The buyer watches projected stock and starts replenishment when needed.
- **Delegate the buying work.** Supplier research, a prepared reorder, and approved purchasing belong to the buyer.
- **Keep control of decisions.** The owner approves spending, records deliveries, and deals with exceptions.

Use the current lime background, black type, large headlines, and consistent Inter typography in the campaign cards. Use the current frontend and persistent **Your buyer** dock in app clips. Keep captions short and readable on a phone. Introduce BUY HARD as new to the audience; a redesign post can explain the build process later.

### Brand voice: establish the references, then use the napkin

Keep the product clear in ordinary posts. Introduce a short Die Hard nod in roughly one of every five or six stories. The early references are **“Live free. Buy hard.”** with background buying work, **“A good day to buy hard.”** with a product demo, and **“Happy trails, paperwork.”** with a source-import story. Each should make sense without knowing the films.

The napkin is a separate brand post for **September 17 at 17:30 Chicago time or later**. Publish it only after at least two earlier references are live, with their post links recorded. Move it back if those stories have not run. Its whole image is the handwritten quote: **“Now I have a machine gun. Ho ho ho.”**, with **gun** visibly scribbled out and **buyer** written in its place. No extra headline, product photo, explanation, or sponsor footer on this artwork. The caption stays short, with buyhard.app and the pre-deadline sponsor mentions.

| Line | Where it belongs |
| --- | --- |
| Live free. Buy hard. | September 12 background-work post: the operator gets time back |
| A good day to buy hard. | September 14 demo invitation or a later verified feature launch |
| Happy trails, paperwork. | September 16 invoice or product-link import story |
| Now I have a machine buyer. Ho ho ho. | Standalone handwritten napkin, held until the earlier references are established |
| Welcome to the pilot, pal. | Welcome copy after an operator agrees to a pilot |
| Yippee-ki-yay. Stock's on the way. | An occasional actual dispatch story, using the supplier's confirmed shipment details |

Post numbers remain internal. Product cards retain Inter and the lime/ink palette. The napkin deliberately uses handwriting and a scribbled correction. Keep all four sponsor mentions in each pre-deadline caption.

## 2. What changed, and what we can show

Reviewed the current working tree and September 10 purchasing verification notes again on September 11. The notes record hosted development and production workers, automatic replenishment, and approved ordering. They also distinguish a controlled-store model test from a real merchant purchase. The public demo shows the new frontend with sample data; it is suitable for explaining the workflow, not proving a supplier order.

| Current feature                                                           | Customer benefit                                                       | Marketing treatment                                                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Simple Dashboard, Inventory, and Buys; sentence-based actions             | See the situation and the next decision quickly                        | Lead with the new public demo; use current screenshots                                            |
| Persistent buyer conversation with contextual actions                     | Update stock and work on buying tasks without repeatedly opening forms | Show a short conversation; distinguish sample replies from live agent work                        |
| Product links and bulk file imports, including invoices and spreadsheets  | Start with information the business already has                        | Show source → extracted item → human review; confirm stock separately                             |
| Buying priorities, stock forecasts, and automatic replenishment controls  | Set how the buyer should handle recurring supplies                     | Show as an implementation preview until the current live company flow is proved                   |
| **Approve and order**, supplier confirmations, full and partial receiving | Make a purchase decision and keep deliveries accounted for             | Show the sample experience now; use verified provider records for delivery claims                 |
| Supplier directory with buying websites and notes                         | Bring the suppliers the business uses                                  | A supporting feature; adding a website does not prove checkout support                            |
| Verified email alerts, purchase history, and audit history                | Stay informed and inspect what happened                                | Follow-up content after the core story; purchasing email and alert delivery are separate services |

Sources: [current frontend](../src/components/desk/app.tsx), [buyer conversation](../src/components/desk/agent-live.tsx), [company purchasing and its September 6 rehearsal](company-ordering.md), and [latest implementation verification](agent-led-purchasing-verification.md).

Company ordering, automatic replenishment, supplier research, and a generic browser checkout worker are implemented, with hosted releases recorded in the verification notes. A live model completed a controlled-store test; no real merchant purchase was made by those launch checks. Marketing can explain the complete intended workflow with clear example labels. A claim about a real supplier order needs that order's evidence.

The buying workflow can use an emailed purchase order when acceptance is verified, or a prepared website checkout. The owner reviews the purchase terms in the same buying experience. Hosted worker health is already documented; successful purchasing from a specific supplier remains a separate claim. [Ordering plan](agent-led-purchasing-plan.md)

**Use three clear evidence labels:**

- **Sample demo:** the public demo uses sample data and says no supplier is contacted. Preserve that label, including when cropping footage.
- **Implementation preview:** new automation shown without a completed live supplier run. Describe what we are building and what the preview demonstrates.
- **Verified provider run:** an actual recorded request, reply, or order result on the selected release. State when recipients or stores are controlled tests.

The public merchant metric counts confirmed app-placed orders. Demo spend, sample supplier names, and sample counts are not customer traction. Amazon, WebstaurantStore, or another listed website is not automatically a verified buying integration. The Firecrawl card uses WebstaurantStore in a labeled workflow illustration, not as a report of a completed merchant order. [Metric implementation](../src/components/desk/merchant-metrics.tsx)

## 3. Make each sponsor's contribution obvious

Every main pre-deadline post includes all four tags: **@convex @OpenAI @firecrawl @agentmail**. On LinkedIn, select the official company mentions. Give each sponsor one focused story inside that shared credit. [Official event instructions](https://www.convex.dev/hackathons/all-gas)

| Spotlight | Strength inside BUY HARD                                                              | Short proof to capture                                                               | Buyer-facing explanation                        |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| OpenAI    | Helps the buyer research options and prepare purchases within the buying rules       | An agent-prepared reorder with its research; verified run or labeled illustration     | “Your buyer stays ahead.”                       |
| Firecrawl | Reads product and supplier pages for research                                         | A source link beside the extracted item or supplier details                          | “Start with the product link you already have.” |
| AgentMail | Gives the buyer a purchasing inbox and linked supplier conversations                  | A verified purchase email and matching reply in the current interface                | “Keep the supplier conversation with the buy.”  |
| Convex    | Stores stock, approvals, and scheduled purchasing work; updates the workspace        | Background replenishment and saved progress, with the actual evidence level shown    | “Your buyer keeps working between visits.”      |

The current [agent dock](../src/components/desk/agent.tsx) already names all four sponsors. [Task results](../src/components/desk/agent-work.tsx) and [activity messages](../src/components/desk/agent-live.tsx) also support credits beside the relevant work. Keep those credits readable in clips. The earlier six-stop demo's placement instructions no longer describe the main frontend.

For provider spotlights, a logo or scripted sample reply alone does not prove a provider call. Capture the actual result when available. Otherwise use the preview wording in the copy bank and label the asset accordingly. Purchase emails belong to AgentMail; the separate low-stock alert sender should not be credited to it. BUY HARD's rules handle stock and money calculations, and the user approves spending.

## 4. Daily publishing and adjustment

**September 14 afternoon review:** Ten product stories are published; six product stories and four founder stories are scheduled. The next 48 hours now include the Square Sandbox result (Tuesday 17:30), a delivery-delay what-if question (Wednesday 08:30), and partial receiving (Wednesday 12:30). Wednesday evening remains flexible for the next review. F01 is a saved video for tonight at 20:00; F02–F04 keep their image fallbacks. The napkin remains a draft because the second earlier reference is still scheduled, not published. [New batch and receipts](../output/marketing/2026-09-14-daily-campaign/posts.md).

**Three core stories a day, every day.** Start at **08:30, 12:30, and 17:30 America/Chicago**. Keep **20:00** for a fourth post when a bold product question, a useful reply, a verified improvement, or a result warrants it. Saturday starts with “What if you could make inventory magically regenerate?” The initial channels remain X and LinkedIn, with copy adapted to each. Schedule the next 48 hours, then adjust the following slots from evidence. These times are a starting experiment, not a claim about optimal reach.

- Morning: an operator's problem and the BUY HARD benefit.
- Midday: show one buying job, decision, or result in the product.
- Evening: a concrete demo or walkthrough invitation, a useful answer, or a product improvement.
- Optional fourth: an ambitious “what if” question, timely evidence, or a real audience question. Do not present a question we invented as customer feedback.

Keep the next **48 hours** concrete. Prepare the following days as themes so product progress and audience response can change them. [Weekend captions](../output/marketing/2026-09-12-daily-campaign/weekend-posts.md) · [Structured weekend batch](../output/marketing/2026-09-12-daily-campaign/weekend-posts.json).

**September 13 late-evening queue:** Eight product stories have published on both platforms, including Sunday's AgentMail post. Five product stories cover Monday's three slots and Tuesday's first two. The four founder image posts remain scheduled at 20:00 on September 14, 16, 18 and 21. The live Zernio overview was read again for the [recording plan](founder-recording-plan.md); no post was changed. Tuesday evening remains flexible. [New captions and visuals](../output/marketing/2026-09-13-daily-campaign/posts.md) · [Schedule receipts](../output/marketing/2026-09-13-daily-campaign/zernio-schedule-receipt.json) · [Recording queue readback](../output/marketing/2026-09-14-founder-recordings/queue-readback.json).

| Date | 08:30 | 12:30 | 17:30 |
| --- | --- | --- | --- |
| Sat Sep 12 | Your buyer stays ahead — OpenAI product card | Start with a link — Firecrawl product card | Working between visits — Convex; “Live free. Buy hard.” |
| Sun Sep 13 | Your buyer does the legwork; you approve spending | Bring one recurring item to a walkthrough | Supplier replies belong with the buy — AgentMail |
| Mon Sep 14 | Bring an invoice or product link | What if sales planned the next buy? — intended sales and inventory connections | “A good day to buy hard.” — explore the sample |
| Tue Sep 15 | Start with a supplier you already use | “No, because…” — ask for a change to the sample purchase | Answer a useful buying question or show the next verified improvement; flexible |
| Wed Sep 16 | Supplier follow-up connected to the purchase | Count the delivery and see what remains outstanding | “Happy trails, paperwork.” — source import |
| Thu Sep 17 | Why the buyer starts before a shortage | A concrete product improvement or stronger workflow proof | Handwritten napkin, only after two earlier references are live |
| Fri Sep 18 | One recurring item for a food business | Supplier comparison with the actual source evidence | Bring your own supplier link to a walkthrough |
| Sat Sep 19 | Everyday supplies still need buying on weekends | The current buying experience on a phone | Product FAQ based on observed questions |
| Sun Sep 20 | Stock need → prepared purchase | Supplier conversation → confirmed result, when verified | Walk through one item with us |
| Mon Sep 21 | Current full product demo | Four sponsors, each doing visible buying work | What the product now handles; invite pilot conversations |
| Tue Sep 22 | Product demo and public app | Final pre-deadline product recap | Verified submission update or the next product improvement |

Every row also has the conditional 20:00 slot. After September 22, retain the same daily rhythm around operator problems, product demonstrations, and verified improvements. The hackathon submission deadline remains **September 22, noon Pacific / 14:00 Chicago**; finish the submission assets on September 21. Keep buyhard.app in marketing and an accepted convex.site or chatgpt.site app address for the submission. [Official event requirements](https://www.convex.dev/hackathons/all-gas).

**September 14 progress:** F01 is now edited and saved in its original 8 p.m. X/LinkedIn slot. The package includes square and vertical captioned videos, a clean square video, subtitles and a cover. [Watch](http://127.0.0.1:60692/) · [Verification](../output/marketing/2026-09-14-founder-recordings/f01-verification.json). F02 is next, due September 15 at 6 p.m.

**Add Facundo's voice to selected existing slots.** The four founder posts can become 25–40 second narrated videos using their current images and actual sample screens. Start with the September 14 frontend comparison; raw recording target is noon that day. The [recording packet](founder-recording-plan.md) includes exact scripts, asset matches and deadlines. The optional sales/cups narration can use the existing Hyperframes sample in September 17's midday slot; that slot is a flexible theme, not a saved schedule. Retain “sample” and “idea being explored” wording unless release and provider proof support stronger claims. Keep the total cadence unchanged.

The original image is each scheduled post's fallback. Replace media and adapt the copy on the existing Zernio ID only after the finished cut passes review and at least two hours remain. Late footage moves to a later suitable story. Use the [recording manifest](../output/marketing/2026-09-14-founder-recordings/recording-plan.json) to distinguish footage received, edit ready, video scheduled and publication. The existing marketing review owns this handoff; do not create a second posting automation.

### Adjust twice daily

At **07:30 and 15:30 Chicago time**, read the actual publishing queue, recent replies, available platform metrics, the app's campaign funnel, and the latest product changes. Update the next 48 hours and record what changed and why in the [decision log](../output/marketing/2026-09-12-daily-campaign/decision-log.md).

Also read the recording plan, check supplied clips, and advance edits that fit the next slots. Compare narrated posts with image posts within each campaign and platform at 24 and 72 hours. Useful conversations and walkthroughs remain the outcomes; higher engagement or trust is a hypothesis, not an established result. Keep unavailable video metrics marked unavailable.

Use demo use, inquiries, confirmed walkthroughs, and pilot starts as the main outcomes. Keep impressions, reactions, comments, and clicks as supporting signals. Compare X with X and LinkedIn with LinkedIn. Read both 24-hour and 72-hour results when available. One new post is too little evidence to declare a winning topic or posting time.

Repeat useful topics with a new example; change the hook or action when people look but do not use the app. If only builders respond, make the next story more concrete for the operator. Use observed objections to choose product work. Keep three daily stories as the baseline, choosing the fourth when there is enough substance.

[Zernio post analytics](https://docs.zernio.com/analytics/get-analytics) can be delayed or unavailable; keep missing metrics marked unavailable. Its [daily aggregate endpoint](https://docs.zernio.com/analytics/get-daily-metrics) requires the Analytics add-on. The app's existing marketing events provide a separate conversion source. Exclude `launch-check` events and keep personal lead details out of public reports. [Current aggregate baseline](../output/marketing/2026-09-12-daily-campaign/baseline-metrics.json).

### Let the campaign drive product improvements

Start with the useful product story we want to demonstrate. If BUY HARD falls short, publish the idea as a bold “what if” question and turn the desired capability into a specific build task. Use the response to prioritize improvements, then follow up with the actual feature and its proof. Do not let the current feature list permanently limit the campaign.

Use the [campaign product backlog](gtm-product-backlog.md) to connect each desired post to the needed change and proof. Keep existing frontend work intact; use an isolated checkout when implementation overlaps concurrent edits. Prepare changes and focused checks before bringing a concrete production release for approval. Actual purchases and supplier messages still need authorization for their recipients, terms, and spend.

Questions about future capabilities can run now. For example: “What if you could make inventory magically regenerate?” Pair them with a relevant product link and an invitation to respond. Use concrete statements for existing features and actual results; use questions or future-oriented wording for what we want to make possible. Publish specific availability or completed-outcome claims after the relevant feature or result is verified. Keep the distinction between a missing feature and a feature that exists but still needs a real supplier check.

## 5. Revised social copy

Use buyhard.app for all public campaign links. Post numbers and planning labels stay internal. The demo link below opened the public sample workspace on September 11. Check it again before publishing. Only **[VIDEO_URL]** remains to be filled after a current video exists. Each X draft fits a 280-character budget with the usual link allowance.

### P1 — Introduction · X

> Meet your new buyer.
>
> BUY HARD helps keep everyday supplies stocked. It watches usage and prepares reorders. You approve the spend.
>
> See the sample demo or book a walkthrough: https://buyhard.app
>
> @convex @OpenAI @firecrawl @agentmail

### P2 — OpenAI · X

> Your buyer stays ahead.
>
> BUY HARD watches stock and prepares reorders before you run out. OpenAI helps research and prepare the buy.
>
> Sample workflow: https://buyhard.app/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P3 — Firecrawl · X

> Start with a link. Automated buying.
>
> Firecrawl reads the product page. BUY HARD prepares the purchase and orders after your approval.
>
> Illustrated workflow. Book a walkthrough: https://buyhard.app/walkthrough
>
> @convex @OpenAI @firecrawl @agentmail

### P4 — AgentMail · X

> Supplier replies belong with the purchase.
>
> AgentMail gives BUY HARD's buyer an inbox for quote requests, replies, and order messages.
>
> Explore the sample experience: https://buyhard.app/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P5 — Convex · X

> Your buyer keeps working between visits.
>
> Convex runs BUY HARD's background replenishment and keeps stock, buying progress, and approvals connected.
>
> Live free. Buy hard.
>
> Explore the sample demo: https://buyhard.app/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P6 — A one-off stock correction · X · After the core sequence

> "We have 8 cases of paper cups left."
>
> An unexpected stock change shouldn't mean a form to fill out. Tell BUY HARD what changed; its buyer can adjust the plan.
>
> Sample stock update: https://buyhard.app/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P7 — Receiving · X

> Ordered 20 cases. Only 8 arrived.
>
> BUY HARD's receiving flow records what arrived and keeps the rest outstanding.
>
> One small detail from the sample app: https://buyhard.app/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P8 — Pilot invitation · X

> Do you buy supplies for a deli, café, or food business?
>
> Help shape BUY HARD around one item you reorder. We're looking for early pilot partners.
>
> Bring one item to a walkthrough: https://buyhard.app/walkthrough
>
> @convex @OpenAI @firecrawl @agentmail

### P9 — Final demo · X

> BUY HARD. Keep the line moving.
>
> Our All Gas Hackathon demo: your buyer watches stock, prepares the reorder, and handles the approved purchase.
>
> Built with four sponsors doing useful work. [VIDEO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

Label the final video with the evidence level actually shown. Include at least one verified result for each provider claim; describe any remaining automation as a preview. Add the working public app link in the first reply and retain the post URL for submission.

### L1 — A simpler way to buy · LinkedIn

> Buying supplies should fit into running a business.
>
> That's the idea behind BUY HARD.
>
> Set up a recurring item. Your buyer watches projected stock and prepares the reorder. You approve spending and record what arrives.
>
> I've been simplifying the app around the work it handles for you: routine replenishment, supplier research, and approved purchasing. The next decision is clear when it needs your attention.
>
> OpenAI powers the live buyer. Firecrawl reads product pages. AgentMail handles purchasing conversations. Convex keeps the work connected.
>
> The public demo uses sample data. We're building toward a guided pilot around one recurring item, with live supplier checks still ahead for the newest automation.
>
> What supply do you spend too much time chasing?
>
> Explore: https://buyhard.app/?demo=true
>
> Building for the Convex All Gas Hackathon with [mention Convex], [mention OpenAI], [mention Firecrawl], and [mention AgentMail].

### L2 — One item to start · LinkedIn

> Cups. Lids. Gloves. Labels.
>
> Ordinary supplies create real work: checking stock, chasing supplier details, reviewing an order, and counting a delivery.
>
> BUY HARD watches projected stock and prepares the next purchase, so the operator can focus on decisions and deliveries.
>
> We're looking for a few food-business operators to help shape an early pilot. Start with one recurring item and walk through how you buy it today. We'll try the supported setup together and agree on the next step.
>
> Which item would you start with?
>
> Sample demo: https://buyhard.app/?demo=true
>
> Built with [mention Convex], [mention OpenAI], [mention Firecrawl], and [mention AgentMail] for the All Gas Hackathon.

## 6. Record once, make several useful assets

**Facundo records; Codex edits.** The [short recording packet](founder-recording-plan.md) is now the starting point. Record one sentence at a time on an iPhone; Codex selects takes, cleans sound when needed, combines the footage with approved visuals, adds readable animated captions and produces the exports. New social shorts use Hyperframes. fal supplies word timings, optional noise cleanup and optional background removal; extra generated scene footage is used only where existing assets cannot do the job. Keep Facundo's actual face, voice and delivery.

**Current main film:** [You handle today, version 2](../assets/storyboard/you-handle-today-footage/assembly/README-v2.md) is already assembled and has playback evidence. It needs Facundo's camera/narration and a shorter final export: target 2:45–2:55, strictly below three minutes. Raw narration target is September 19 at noon; final export target is September 20 at 18:00. The current cut is about 180.053 seconds and is not the finished narrated submission. Use its [current script](../assets/storyboard/you-handle-today-footage/narration.md) and working compositor. Staged app scenes do not establish a real supplier purchase.

**First clip: 15–30 seconds.** Open on a recurring item with replenishment enabled, then show why stock is projected to run low and the purchase the buyer has prepared. Finish on the owner's approval decision and buyhard.app. Preserve sample labels. Use a continuous verified run for cause-and-effect claims; otherwise identify the scenes as examples. Manual stock entry should not be the opening action.

**Main demo: aim for 2:15–2:40.** Open with an everyday supply problem, then show the buyer doing useful work in the current interface.

| Moment                   | What to show                                                     | What the viewer should understand                          |
| ------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Stay ahead of low stock  | Enabled replenishment, stock forecast, and the buyer starting work | The buyer notices the need and starts preparing the buy    |
| Prepare and review a buy | Product evidence, a prepared purchase, and **Approve and order** | The agent does the preparation; I decide what to spend     |
| Follow the delivery      | A linked supplier confirmation, then full or partial receiving   | Promised stock and physically received stock stay distinct |

The stock update and existing purchase in the public sample are separate examples. Do not edit them to imply the sample generated and placed a real order. A continuous purchasing story needs a verified company run. **Approve and order** includes a confirmation of exact terms; describe one purchase decision, not a guaranteed one-click transaction.

Capture the new frontend for any additional product shots. The older [film treatment](demo-film-treatment.md) and [six-stop recording guide](demo-screenplay.md) describe a previous interface and are historical references. The current version 2 assembly and narration script above are the source for this film. Use the current buyer conversation for new short examples.

Additional ideas, in order of effort:

1. **What your buyer handled:** a prepared reorder, supplier research, and a linked supplier reply, each with its evidence level visible.
2. **Less screen, clearer decision:** one optional build post showing how the interface was simplified; finish on the new experience.
3. **Bring your own supplier:** show the directory and notes, while making the supplier's actual support status clear.
4. **The delivery that arrived in parts:** show an ordinary receiving problem handled clearly.
5. **Our first verified merchant:** publish only after a confirmed order appears, explaining exactly what was proved.

Use captions and real app footage. Repurpose the best clip vertically after the X and LinkedIn assets are ready.

## 7. Turn attention into early customer conversations

**Primary action:** explore the sample demo. **Next action:** book a [20-minute walkthrough](https://buyhard.app/walkthrough) around one recurring item. Treat sponsor and builder engagement as distribution; count operator interest separately.

Offer a 20-minute review of one recurring item: how it is bought today, where the work piles up, and whether BUY HARD's supported setup helps. Ask about counts, usage, suppliers, approval, and delivery handling. Expand to live purchasing after the selected supplier and workflow are verified and the buyer agrees to the specific activity.

Working targets: five operator conversations and two interested pilot candidates by submission; ten conversations and three suitable candidates in the first 30 days after it. These are planning targets, not existing traction or promised capacity.

Track date, post URL, sponsor focus, useful replies, operator conversations, and pilot interest in a simple sheet. Add demo visits only if tracking is confirmed; otherwise mark them unmeasured. Repeat the story that produces relevant conversations. If only builders respond, make the next post about the operator's daily work and ask existing contacts for relevant introductions.

After September 22, shift toward customer problems, lessons, and verified pilot outcomes. Continue crediting sponsors where their work appears. Any pricing proposal should follow a useful pilot outcome and a conversation about willingness to pay.

**Post-hackathon draft:**

> We're shaping BUY HARD around the work of buying everyday supplies.
>
> If you run a food business, pick one item you reorder and show us the process around it.
>
> Bring one recurring item to a walkthrough: https://buyhard.app/walkthrough

## 8. Operating checklist

- [x] Introduction published September 11 on X and LinkedIn.
- [x] Prepare seven posts covering Saturday and Sunday, including the aspirational inventory question.
- [x] Restore the OpenAI product card and separate the handwritten napkin for later.
- [x] Confirm seven weekend posts in Zernio; [saved schedule receipts](../output/marketing/2026-09-12-daily-campaign/zernio-schedule-receipt.json) are separate from later publication.
- [x] Activate reviews at 07:30 and 15:30 Chicago time. At each run, record material evidence, content decisions and product work.
- [x] Add iPhone recording scripts, edit ownership, conditional replacements and image fallbacks to both campaign plans and the GTM desk.
- [x] Receive F01, edit the first captioned clip and verify its replacement schedule if ready in time. Completed September 14: 37.9-second square video saved on the original X/LinkedIn post for 8 p.m. [Receipt](../output/marketing/2026-09-14-founder-recordings/zernio-schedule-receipt.json).
- [ ] Receive F02 by September 15 at 6 p.m. for the September 16 founder slot.
- [ ] Complete the continuous reorder demo and supplier proof tasks before their stronger claims run.
- [ ] By September 21, finish and verify the narrated main demo, replace [VIDEO_URL], and assemble the app, repository, build log, video, and social links for the [submission form](https://vibeapps.dev/judging/convex-all-gas-hackathon-openai/submit?utm_source=luma).

Current publishing state is recorded in the [daily campaign batch](../output/marketing/2026-09-12-daily-campaign/weekend-posts.json) and [posting package](../output/marketing/2026-09-11-first-three/ready/README.md). The campaign plan is updated as product proof and audience evidence change.
