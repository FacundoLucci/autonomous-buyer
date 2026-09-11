# BUY HARD — GTM and social plan

Revised September 10, 2026 · Owner: Facundo · Campaign not started

**Purchasing. Handled. Keep the line moving.**

Introduce BUY HARD through its simpler daily experience: tell your buyer what is on hand, review the purchase it prepares, and report what arrives. Show one useful moment per post. Before the hackathon deadline, tag **Convex, OpenAI, Firecrawl, and AgentMail** and explain the work each enables.

This replaces the September 5 campaign. No earlier posts, outreach, or results are assumed. Start from September 10; there is no backlog to catch up on.

## 1. The story we should tell

**Positioning:** BUY HARD is an AI buyer for the everyday supplies that keep a small business running.

**Supporting line:** “Tell your buyer what you have. Review what needs buying. Get back to your business.”

The product direction is that the agent handles recurring purchasing work using stock counts, usage, and buying rules. The owner approves spending and handles physical deliveries or exceptions. Replenishment must first be enabled for the item. Keep live availability claims within the evidence below.

Our first audience remains owners and purchasing leads at small food businesses: delis, cafés, caterers, and food producers. Cups, lids, gloves, towels, and labels make the story concrete. This is a starting audience hypothesis; learn from the first ten operator conversations before expanding to other businesses.

Three messages should carry the campaign:

- **Say it naturally.** “We have 8 cases of paper cups left.” The conversation stays beside the work.
- **Know what needs you.** Clear stock sentences and a specific buying decision make the next step easy to understand.
- **Keep the buying moving.** Counts, supplier information, approvals, and delivery updates belong to the same process.

Use the current lime background, black type, large sentences, dot-matrix wordmark, and persistent **Your buyer** dock. Keep captions short and readable on a phone. Introduce BUY HARD as new to the audience; a redesign post can explain the build process later.

## 2. What changed, and what we can show

Reviewed the current working tree, including uncommitted purchasing additions, against commits through September 9. On September 10, the public review link displayed the new frontend and sample workspace. A local sample interaction accepted “We have 8 cases of paper cups left” and showed 8 cases on hand. This verifies the sample interaction, not a live OpenAI request.

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

The old plan's statement that company ordering is simply unfinished is outdated. Company purchase orders, imports, alerts, and receiving have an earlier documented development rehearsal. The newer automatic replenishment, supplier research, and browser checkout work has local verification, with live supplier checks still pending in the current verification notes. The hosted sample shows the interface; it does not establish those live outcomes. This review did not test private company purchasing or a real supplier checkout.

The new ordering direction also covers how suppliers sell: use an emailed purchase order when acceptance is verified, or a prepared website checkout for a supported supplier. The owner reviews the purchase terms in the same buying experience. Website checkout remains preview content until that supplier and the hosted worker have passed live checks. [Ordering plan](agent-led-purchasing-plan.md)

**Use three clear evidence labels:**

- **Sample demo:** the public demo uses sample data and says no supplier is contacted. Preserve that label, including when cropping footage.
- **Implementation preview:** new automation shown without a completed live supplier run. Describe what we are building and what the preview demonstrates.
- **Verified provider run:** an actual recorded request, reply, or order result on the selected release. State when recipients or stores are controlled tests.

The landing page's new **Where we've bought** section showed **0 orders and 0 merchants** during this review. It can become a useful proof point after confirmed orders exist. Demo spend, sample supplier names, and sample counts are not customer traction. Amazon, WebstaurantStore, or another listed website is not automatically a verified buying integration. [Metric implementation](../src/components/desk/merchant-metrics.tsx)

## 3. Make each sponsor's contribution obvious

Every main pre-deadline post includes all four tags: **@convex @OpenAI @firecrawl @agentmail**. On LinkedIn, select the official company mentions. Give each sponsor one focused story inside that shared credit. [Official event instructions](https://www.convex.dev/hackathons/all-gas)

| Spotlight | Strength inside BUY HARD                                                              | Short proof to capture                                                               | Buyer-facing explanation                        |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| OpenAI    | Understands requests, prepares structured work, and reads supplied information        | A live request beside its resulting stock update or reviewed draft                   | “Tell your buyer what changed.”                 |
| Firecrawl | Reads product and supplier pages for research                                         | A source link beside the extracted item or supplier details                          | “Start with the product link you already have.” |
| AgentMail | Gives the buyer a purchasing inbox and linked supplier conversations                  | A verified purchase email and matching reply in the current interface                | “Keep the supplier conversation with the buy.”  |
| Convex    | Stores the conversation, stock, approvals, and background work; updates the workspace | A saved change reflected in another view, or a conversation resumed after navigation | “Your buyer keeps track as the work moves.”     |

The current [agent dock](../src/components/desk/agent.tsx) already names all four sponsors. [Task results](../src/components/desk/agent-work.tsx) and [activity messages](../src/components/desk/agent-live.tsx) also support credits beside the relevant work. Keep those credits readable in clips. The earlier six-stop demo's placement instructions no longer describe the main frontend.

For provider spotlights, a logo or scripted sample reply alone does not prove a provider call. Capture the actual result when available. Otherwise use the preview wording in the copy bank and label the asset accordingly. Purchase emails belong to AgentMail; the separate low-stock alert sender should not be credited to it. BUY HARD's rules handle stock and money calculations, and the user approves spending.

## 4. A manageable calendar starting now

The deadline remains **September 22, 2026, 12 PM Pacific / 2 PM Chicago**. Finish the package on September 21. The submission requires a public app and repository, social sharing, and a video under three minutes. [Verified event requirements](https://www.convex.dev/hackathons/all-gas)

**Minimum campaign: six posts** — introduction, four sponsor spotlights, final demo. Add the three optional posts only if assets are ready. Use X for the short build updates and two LinkedIn adaptations to reach operators. Reserve about 30 minutes per publishing day plus one recording session. Start with $0 in paid distribution.

| Date            | Post                                    | Priority      | Asset                                                      |
| --------------- | --------------------------------------- | ------------- | ---------------------------------------------------------- |
| Sep 10          | P1 — Introduce the simpler BUY HARD     | Essential     | 15-second dashboard and buyer dock clip                    |
| Sep 11          | P2 — Talk to your buyer / OpenAI        | Essential     | Stock sentence → response; sample or live label            |
| Sep 13          | P3 — Start with a link / Firecrawl      | Essential     | Product source → reviewed item details                     |
| Sep 15          | P4 — Supplier conversations / AgentMail | Essential     | Purchasing inbox and linked reply; verified run or preview |
| Sep 17          | P5 — Keep the work connected / Convex   | Essential     | Conversation and stock context across views                |
| Sep 18          | P6 — Replenishment preview              | Optional      | Item rules and prepared purchase; retain preview label     |
| Sep 19          | P7 — A delivery can arrive in parts     | Optional      | Partial receiving interaction using sample data            |
| Sep 20          | P8 — Find early pilot partners          | Optional      | One familiar supply item and a clear invitation            |
| Sep 21          | P9 — Full demo and sponsor recap        | Essential     | Fresh video of the current frontend; working public link   |
| Sep 22, morning | Submission receipt and link check       | Required task | Public app, repo, video, social URL, submission receipt    |

Use L1 on LinkedIn on September 10 or 11 and L2 on September 20. Reuse the same clips. Share one relevant update in the hackathon community when the demo is ready. Check replies after publishing and again the next day; follow up with operators who express interest. These are planned actions, not scheduled or completed activity.

If time gets tight, retain the six essential posts and the submission. A useful screen recording is enough to start; the cinematic film does not need to be finished first.

## 5. Revised social copy

The demo link below opened the new public sample workspace on September 10. Check it again before publishing. Only **[VIDEO_URL]** remains to be filled after a current video exists. Each X draft fits a 280-character budget with the usual link allowance.

### P1 — Introduction · X

> Meet BUY HARD. An AI buyer for everyday supplies.
>
> A clear stock picture. A conversation beside the work. A purchase for you to review.
>
> Explore the sample demo: https://festive-coyote-483.convex.site/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P2 — OpenAI · X

> "We have 8 cases of paper cups left."
>
> That's how a stock update should start.
>
> We're building BUY HARD's buyer with OpenAI. Try the sample conversation: https://festive-coyote-483.convex.site/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P3 — Firecrawl · X

> Already have a product link? Start there.
>
> BUY HARD uses Firecrawl to read product pages and bring details into the buying process for review.
>
> Explore the sample app: https://festive-coyote-483.convex.site/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P4 — AgentMail · X

> Supplier replies belong with the purchase.
>
> AgentMail gives BUY HARD's buyer an inbox for quote requests, replies, and order messages.
>
> Explore the sample experience: https://festive-coyote-483.convex.site/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P5 — Convex · X

> Your buyer needs to remember the work.
>
> Convex keeps BUY HARD's conversation, stock, and purchases connected as you move through the app.
>
> Explore the sample demo: https://festive-coyote-483.convex.site/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P6 — Replenishment preview · X

> Give your buyer the count, usage, and buying rules. Review the purchase it prepares.
>
> That's the replenishment flow we're building in BUY HARD.
>
> Sample preview: https://festive-coyote-483.convex.site/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P7 — Receiving · X

> Ordered 20 cases. Only 8 arrived.
>
> BUY HARD's receiving flow records what arrived and keeps the rest outstanding.
>
> One small detail from the sample app: https://festive-coyote-483.convex.site/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P8 — Pilot invitation · X

> Do you buy supplies for a deli, café, or food business?
>
> Help shape BUY HARD around one item you reorder. We're looking for early pilot partners.
>
> Reply "pilot". Sample demo: https://festive-coyote-483.convex.site/?demo=true
>
> @convex @OpenAI @firecrawl @agentmail

### P9 — Final demo · X

> BUY HARD. Keep the line moving.
>
> Here's our All Gas Hackathon demo: talk to your buyer, review a purchase, and track what arrives.
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
> Tell your buyer what's on hand. See what needs attention. Review a prepared purchase. Record what actually arrives.
>
> I've been simplifying the app around those everyday moments: clear sentences, a persistent conversation, and the details close by when you need them.
>
> OpenAI powers the live buyer. Firecrawl reads product pages. AgentMail handles purchasing conversations. Convex keeps the work connected.
>
> The public demo uses sample data. We're building toward a guided pilot around one recurring item, with live supplier checks still ahead for the newest automation.
>
> What supply do you spend too much time chasing?
>
> Explore: https://festive-coyote-483.convex.site/?demo=true
>
> Building for the Convex All Gas Hackathon with [mention Convex], [mention OpenAI], [mention Firecrawl], and [mention AgentMail].

### L2 — One item to start · LinkedIn

> Cups. Lids. Gloves. Labels.
>
> Ordinary supplies create real work: checking stock, chasing supplier details, reviewing an order, and counting a delivery.
>
> BUY HARD brings that work into a conversation and a clear buying view.
>
> We're looking for a few food-business operators to help shape an early pilot. Start with one recurring item and walk through how you buy it today. We'll try the supported setup together and agree on the next step.
>
> Which item would you start with?
>
> Sample demo: https://festive-coyote-483.convex.site/?demo=true
>
> Built with [mention Convex], [mention OpenAI], [mention Firecrawl], and [mention AgentMail] for the All Gas Hackathon.

## 6. Record once, make several useful assets

**First clip: 15–30 seconds.** Show the dashboard, type “We have 8 cases of paper cups left,” and show the sample buyer's response. End on “Keep the line moving” and the demo link. Preserve the sample label and sponsor footer. This is enough for the introduction and a conversation teaser.

**Main demo: aim for 2:15–2:40.** Open with an everyday supply problem, then show the buyer doing useful work in the current interface.

| Moment                   | What to show                                                     | What the viewer should understand                          |
| ------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Know the stock           | A short stock update and the relevant inventory view             | I can tell it what changed                                 |
| Prepare and review a buy | Product evidence, a prepared purchase, and **Approve and order** | The agent does the preparation; I decide what to spend     |
| Follow the delivery      | A linked supplier confirmation, then full or partial receiving   | Promised stock and physically received stock stay distinct |

The stock update and existing purchase in the public sample are separate examples. Do not edit them to imply the sample generated and placed a real order. A continuous purchasing story needs a verified company run. **Approve and order** includes a confirmation of exact terms; describe one purchase decision, not a guaranteed one-click transaction.

Capture the new frontend throughout. The older [film treatment](demo-film-treatment.md) and [six-stop recording guide](demo-screenplay.md) describe the previous interface; their product shots and timings need a new recording before campaign use. Existing deli footage can provide a brief opening. Use the current buyer conversation as the main story.

Additional ideas, in order of effort:

1. **One sentence, one job:** a series of short stock, item, and delivery interactions.
2. **Less screen, clearer decision:** one optional build post showing how the interface was simplified; finish on the new experience.
3. **Bring your own supplier:** show the directory and notes, while making the supplier's actual support status clear.
4. **The delivery that arrived in parts:** show an ordinary receiving problem handled clearly.
5. **Our first verified merchant:** publish only after a confirmed order appears, explaining exactly what was proved.

Use captions and real app footage. Repurpose the best clip vertically after the X and LinkedIn assets are ready.

## 7. Turn attention into early customer conversations

**Primary action now:** explore the sample demo. **Next action:** reply about an early pilot. Treat sponsor and builder engagement as distribution; count operator interest separately.

Offer a 20-minute review of one recurring item: how it is bought today, where the work piles up, and whether BUY HARD's supported setup helps. Ask about counts, usage, suppliers, approval, and delivery handling. Expand to live purchasing after the selected supplier and workflow are verified and the buyer agrees to the specific activity.

Working targets: five operator conversations and two interested pilot candidates by submission; ten conversations and three suitable candidates in the first 30 days after it. These are planning targets, not existing traction or promised capacity.

Track date, post URL, sponsor focus, useful replies, operator conversations, and pilot interest in a simple sheet. Add demo visits only if tracking is confirmed; otherwise mark them unmeasured. Repeat the story that produces relevant conversations. If only builders respond, make the next post about the operator's daily work and ask existing contacts for relevant introductions.

After September 22, shift toward customer problems, lessons, and verified pilot outcomes. Continue crediting sponsors where their work appears. Any pricing proposal should follow a useful pilot outcome and a conversation about willingness to pay.

**Post-hackathon draft:**

> We're shaping BUY HARD around the work of buying everyday supplies.
>
> If you run a food business, pick one item you reorder and show us the process around it.
>
> Want to help shape an early pilot? Reply "pilot".

## 8. Start here

- [ ] **Today:** record the short stock-conversation clip from the current sample app and prepare P1. The [public demo](https://festive-coyote-483.convex.site/?demo=true) was checked September 10; verify the same page before capture.
- [ ] **Next:** prepare the four sponsor assets. Use actual provider evidence where available and labeled previews where live proof is pending. Keep the current interface and readable credits in view.
- [ ] **By September 21:** record the current main demo, replace [VIDEO_URL], publish the final sponsor recap, and assemble the public app, repo, build log, and video for the [official submission form](https://vibeapps.dev/judging/convex-all-gas-hackathon-openai/submit?utm_source=luma). Retain the submission receipt. [Event requirements](https://www.convex.dev/hackathons/all-gas)

Status: strategy and drafts revised. No posts, outreach, scheduling, deployment, or submission performed by this revision.
