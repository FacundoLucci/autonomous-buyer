# BUY HARD — GTM and social plan

Working plan · September 5, 2026 · Owner: Facundo

**Lead with the purchasing problem. Show the app solving it. Give each sponsor credit beside the work it enables. Turn that attention into conversations with early customers.**

Before the hackathon ends, every main campaign post should tag **Convex, OpenAI, Firecrawl, and AgentMail**. Each sponsor gets its own feature spotlight, plus a shared place in the final demo.

## 1. Who we want to reach

Our first customer hypothesis is **small food businesses that regularly reorder packaging**: delis, caterers, food producers, and small operators buying lids, containers, and similar supplies. Start with owners and purchasing leads who manage orders through email and spreadsheets. Validate this focus in the first ten conversations.

| Audience                         | What they care about                                 | What we show                                                                  | Next step                                    |
| -------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| Owners and purchasing leads      | Keeping supplies available; less time chasing quotes | One familiar item, a shortage, the supplier options, and the buyer's decision | Watch the demo; reply about an early pilot   |
| Hackathon community and sponsors | Useful software and meaningful integrations          | Short clips showing each sponsor doing a specific job                         | Try the demo, give feedback, share the build |

**Positioning:** BUY HARD is an AI purchasing assistant for recurring supplies. It helps spot shortages, research suppliers, and prepare a purchase for human review.

**Main message:** “Keep the lids coming. Keep the buying under control.”

**Pilot offer:** Start with one recurring item, one buyer, and a guided review of the buying process. Learn where BUY HARD can remove work. Broader automation follows verified product readiness.

## 2. What we can market today

The repository documents a completed purchasing rehearsal with real provider calls and controlled email recipients. New company workspaces support signup, source imports, and inventory setup; automated supplier outreach and ordering for those workspaces remain unfinished. The campaign should invite people to **explore the demo and help shape an early pilot**. [Current app scope](../README.md) · [Onboarding status](onboarding.md)

Use the recorded Buy Desk flow for sponsor proof. The landing page's animated receipts are an **illustrative scenario**; their sample suppliers, dates, percentages, and activity timings are not results from a live purchasing run. [Recording guide](demo-screenplay.md) · [Landing scenario](../src/components/landing/autonomous-landing.tsx)

Keep these distinctions in captions and recordings:

- Label footage “Controlled demo.” Real website research and controlled email replies are separate evidence.
- Describe a confirmed order as incoming inventory; it is not proof that physical goods arrived.
- Share measured outcomes only. Seeded savings, sample confidence percentages, and staged timings are not customer results.
- Credit OpenAI when the selected record shows OpenAI work. The app also supports a separately labeled OpenRouter path.

## 3. Sponsor story and visibility inside the app

The official event calls for posts tagging all four sponsors and judges their actual use in the product. Its linked X accounts are [@convex](https://x.com/Convex), [@OpenAI](https://x.com/openai), [@firecrawl](https://x.com/firecrawl), and [@agentmail](https://x.com/agentmail). On LinkedIn, select the matching official company pages in the mention picker. [Event instructions](https://luma.com/convex-allgas-hackathon)

| Sponsor   | Strength to highlight                                     | BUY HARD proof shot                                                      | In-app attribution                                                   |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Convex    | Keeps the buying record and live workspace in sync        | Inventory, purchase progress, and the saved decision in the same flow    | “Live updates via Convex” beside the activity area                   |
| Firecrawl | Makes supplier website information usable                 | Open a discovered product page and show its stored source link           | “Sources via Firecrawl” beside supplier research                     |
| OpenAI    | Turns supplier language into usable details               | A reply beside the extracted terms, missing information, and explanation | “Details extracted by OpenAI” beside supported output                |
| AgentMail | Gives the buying agent an email inbox and ongoing threads | The quote request, clarification, reply, and order confirmation          | “Sent via AgentMail” / “Replied via AgentMail” beside email evidence |

These contextual credits already exist in the [Buy Desk](../src/routes/index.tsx) through the shared [SponsorCredit component](../src/components/buy-hard/sponsor-credit.tsx). Before recording, verify they appear at readable size in the selected run. Keep them close to the result, with BUY HARD as the main brand. Use the existing [provider marks](../public/brand/README.md).

For each spotlight, explain **the job → the sponsor's contribution → the benefit to the buyer**. Example: “Supplier quotes arrive as emails. OpenAI extracts the stated terms so the buyer can review them together.” BUY HARD's rules handle the comparison and calculations; the human approves the purchase. [AI task boundaries](../convex/aiNode.ts)

An optional build-story post can also credit Codex for implementation, using a concrete change from the build log. Keep that separate from OpenAI's role inside the product.

## 4. Channels and effort

These are starting choices to test, not established audience results.

| Channel                    | Job                                                 | Starting cadence                                                           |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| Facundo's X account        | Build updates, sponsor spotlights, short demo clips | 4 main posts each week through submission; a final demo post               |
| Facundo's LinkedIn         | Reach operators through concrete business problems  | 2 posts each week; reuse the same footage with more context                |
| Convex hackathon community | Get product feedback from participants              | One useful preview and one finished-demo update in the appropriate channel |
| Reels / Shorts             | Test the deli story with a wider audience           | Repurpose the best 2 vertical clips if production time allows              |

Start with **$0 in paid distribution**. Budget one 2–3 hour recording session, then 30 minutes a day for posting, replies, and tracking. Reply to specific feedback; invite interested people into a pilot conversation. Community posting and outreach are future actions in this plan.

## 5. Calendar through the deadline

Submissions close **September 22, 2026 at 12 PM Pacific / 2 PM Chicago**. Winners are scheduled for September 25. Aim to finish the submission package on **September 21**. The video must be under three minutes. [Official timeline and requirements](https://www.convex.dev/hackathons/all-gas)

All main posts below carry all four sponsor tags. The named sponsor gets the main story and visible proof. Dates are planned, not scheduled.

| Date            | Main post                        | Asset and purpose                                           |
| --------------- | -------------------------------- | ----------------------------------------------------------- |
| Sep 6           | P1 — Introduce BUY HARD          | 15-second shortage → buyer review clip; pin this post       |
| Sep 7           | P2 — Convex spotlight            | Show the connected buying record and activity               |
| Sep 9           | P3 — Firecrawl spotlight         | Supplier source page → research result                      |
| Sep 11          | P4 — OpenAI spotlight            | Supplier reply → extracted terms                            |
| Sep 13          | P5 — AgentMail spotlight         | Missing delivery detail → clarification → reply             |
| Sep 15          | P6 — Buyer stays in control      | Quote comparison and recorded approval                      |
| Sep 17          | P7 — Film teaser                 | Quote-comparison hook from the proposed film                |
| Sep 19          | P8 — Early pilot invitation      | One recurring item; invite operator feedback                |
| Sep 21          | P9 — Full demo and sponsor recap | Completed video, working public app link, all four mentions |
| Sep 22, morning | Submission check                 | Check public links, social post URL, and submission receipt |

Adapt P1, P3, P5, and P8 for LinkedIn across the first two weeks; use the longer drafts below as anchors. Keep Sep 22 as a buffer, not the first day sponsors hear about the app.

## 6. Social copy bank

Drafts below are for review and publishing later. Replace **[DEMO_URL]** with the selected public demo and **[VIDEO_URL]** with the finished video. Each short post includes all four sponsor mentions.

### P1 — Product introduction · X

> A lunch rush needs lids.
>
> We're building BUY HARD: spot a shortage, research suppliers, and bring the purchase to a human for review.
>
> Our All Gas Hackathon demo: [DEMO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

### P2 — Convex · X

> A buying process spans inventory, quotes, and approvals. The buyer needs one clear record.
>
> Convex connects that flow in BUY HARD. Here's the controlled demo: [DEMO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

### P3 — Firecrawl · X

> Finding a supplier starts with finding the evidence.
>
> Firecrawl brings supplier pages into BUY HARD's research, with links the buyer can inspect.
>
> See the demo: [DEMO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

### P4 — OpenAI · X

> Supplier quotes arrive as emails.
>
> In BUY HARD, OpenAI extracts the stated terms and flags missing details. The buyer can check the original reply.
>
> Controlled demo: [DEMO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

### P5 — AgentMail · X

> A quote without a delivery date needs a follow-up.
>
> In our controlled BUY HARD demo, AgentMail carries the clarification and reply in the email thread.
>
> Watch: [DEMO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

### P6 — Human approval · X

> The cheapest quote can still arrive too late.
>
> BUY HARD's demo compares cost and delivery before putting the purchase in front of the buyer for approval.
>
> Explore: [DEMO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

### P7 — Film teaser · X

> Why pay more for the same deli lids?
>
> In BUY HARD's recorded demo, delivery timing explains the choice.
>
> Watch the evidence come together, then the buyer decide. [DEMO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

### P8 — Pilot invitation · X

> Do you reorder packaging for a food business?
>
> We're looking for early BUY HARD pilot partners. Start with one recurring item and help shape the buying workflow.
>
> Reply "pilot". Demo: [DEMO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

### P9 — Final demo · X

> BUY HARD, built for the All Gas Hackathon.
>
> Watch our controlled purchasing demo: shortage, supplier research, quote emails, buyer approval, and order confirmation.
>
> [VIDEO_URL]
>
> @convex @OpenAI @firecrawl @agentmail

Attach the completed video where supported and put the public app link in the first reply. Publish this before submission; keep its URL with the submission materials.

### L1 — Founder introduction · LinkedIn

> A food business can have a great product and still get stuck because it ran out of lids.
>
> We're building BUY HARD around that everyday problem.
>
> Our hackathon demo follows one packaging item through a shortage, supplier research, quote emails, buyer approval, and order confirmation.
>
> Convex keeps the buying record connected. Firecrawl brings in supplier pages. OpenAI extracts the stated terms. AgentMail handles the email conversation.
>
> The rehearsal uses real provider calls and controlled email recipients. We're now looking for operators to help shape the next step: a guided pilot around one recurring item.
>
> What supply do you spend too much time chasing?
>
> Explore the demo: [DEMO_URL]
>
> Built for the Convex All Gas Hackathon with [mention Convex], [mention OpenAI], [mention Firecrawl], and [mention AgentMail].

### L2 — Sponsor story · LinkedIn

> A supplier quote arrives. The price is there. The delivery date is missing.
>
> That small gap is where buying work piles up.
>
> In our controlled BUY HARD demo, OpenAI extracts the stated details, the app identifies what is missing, and AgentMail carries a focused clarification in the same email thread. Convex keeps the purchase record updated. Firecrawl provides the supplier website research the buyer can inspect alongside it.
>
> The buyer sees the comparison and approves the purchase.
>
> Here's that flow: [DEMO_URL]
>
> If you buy recurring supplies, which detail do you most often have to chase?
>
> Built for the Convex All Gas Hackathon with [mention Convex], [mention OpenAI], [mention Firecrawl], and [mention AgentMail].

## 7. Creative ideas to try

**Start by cutting social clips from the proposed [“The $400 Decision” film](demo-film-treatment.md).** Its price-versus-arrival question gives the campaign a clear hook and lets us reuse the main recording. Verify the selected purchase before using exact dollar amounts. “The Last Lid” and the other concepts below remain optional follow-on ideas.

| Idea                           | Execution                                                                                   | Sponsor moment                                                          | Effort |
| ------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| The Last Lid                   | A short deli scene: busy counter, nearly empty lid sleeve, BUY HARD showing the buying work | Each sponsor appears beside its actual contribution in the app footage  | Medium |
| One purchase, four sponsors    | Four quick cuts: source page, extracted terms, email thread, connected purchase record      | One useful sentence and a readable credit per sponsor                   | Low    |
| The missing delivery date      | A cropped email, the missing field, then the clarification and reply                        | OpenAI + AgentMail, with Convex keeping the record                      | Low    |
| Cheapest versus useful         | Show two recorded quotes and explain why arrival affects the choice                         | Source information and extracted terms feed BUY HARD's comparison rules | Low    |
| The buying receipt             | A four-frame carousel: problem, evidence, buyer decision, confirmed order                   | Reuse BUY HARD's receipt style and contextual credits                   | Low    |
| Two versions of the lunch rush | A staged split-screen story about chasing supplies versus reviewing a prepared purchase     | Close with real app footage and shared sponsor credits                  | Medium |
| What would you hand over?      | Ask operators which recurring item they would start with                                    | Use a short demo clip as context                                        | Low    |

Use real deli footage where available, with captions and tight app crops. Keep staged scenes clearly separate from recorded product evidence. Follow the proposed film's opening question and brief deli context, then spend most of the submission video showing the working product.

## 8. After submission: turn attention into learning

**Sep 23–25:** Share what we learned and answer feedback. Credit the sponsors for the work shown. Mention any result only after the official announcement.

**Sep 26–Oct 22:** Shift to approximately three customer-problem or learning posts for every build post. Aim for ten operator conversations and three suitable pilot candidates. These are working targets, not commitments or results.

In each conversation, learn the recurring item, reorder frequency, current process, cost of running short, who approves orders, and which buying step takes the most effort. Finish by asking whether they want to review their own workflow with us.

Run supported setup and guided reviews first. Expand pilots into supplier outreach and ordering after those features are ready and each buyer has agreed to the specific activity. Ask about willingness to pay once someone has experienced a useful outcome; use that evidence to shape pricing.

**Post-hackathon draft:**

> We're taking BUY HARD into its next round of learning.
>
> If you regularly buy packaging for a food business, we'd like to understand one item you reorder and the work around it.
>
> Want to help shape an early pilot? Reply "pilot".

## 9. Measure what moves people forward

Track each post in a simple sheet: date, platform, angle, sponsor focus, post URL, demo visits if available, useful replies, operator conversations, and pilot interest.

| Checkpoint                     | Working target                                                          | Decision                                                  |
| ------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| Before Sep 22                  | Four sponsor spotlights and one complete demo post, all properly tagged | Confirm every sponsor's actual work is easy to see        |
| First week of posts            | Establish response and demo-visit baselines                             | Repeat the two angles producing useful replies or visits  |
| First 30 days after submission | Ten operator conversations; three suitable pilot candidates             | Refine the audience and pilot offer around repeated needs |

Use tagged links if visit tracking is available: `utm_source=x` or `linkedin`, `utm_medium=organic_social`, `utm_campaign=all_gas_2026`, and a short post name in `utm_content`. Do not report tracking as installed until checked. Record “not measured” where data is unavailable.

If sponsors and builders respond but buyers do not, spend the next week on operator problems and direct conversations. If people open the demo but do not ask about pilots, make the pilot offer clearer and ask what stopped them. Expand distribution after the demo and guided setup are reliable.

## 10. First actions

Facundo owns the following unless another owner is assigned:

- [ ] Select the campaign URL and open it signed out on phone and desktop. The [current review demo](https://festive-coyote-483.convex.site/?demo=1) has the latest design according to the README; the listed production release is older. A public campaign URL has not been selected in this plan.
- [ ] Capture one short proof clip per sponsor from a recorded purchase, using the recording guide. Confirm readable credits and the actual provider evidence.
- [ ] Review the proposed film treatment and select existing deli footage; cut a short comparison teaser from the same app recording.
- [ ] Replace the two URL placeholders; check company mentions in the publishing interface.
- [ ] Publish P1, then the four sponsor spotlights on the planned dates; log their URLs and replies.
- [ ] Complete the final video, public links, build log, and social recap by Sep 21. Submit through the [official form](https://vibeapps.dev/judging/convex-all-gas-hackathon-openai/submit?utm_source=luma) and retain the receipt. [Submission requirements](https://luma.com/convex-allgas-hackathon)

This document creates the plan and draft copy. Publishing, scheduling, outreach, and submission are not completed by creating it.
