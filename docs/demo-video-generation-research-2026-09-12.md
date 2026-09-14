# BUY HARD — video generation research and budget

Researched September 12, 2026. USD before tax. Applies to the [footage storyboard](../assets/storyboard/you-handle-today-footage/README.md), with a real founder camera recording and separately captured app content.

My recommendation: start with **H3 Max Turbo at 1080p during the promotion**, then compare the difficult piano shot with H3 Max before producing the rest. Under our five-take assumption, Turbo's video output costs **$19.20**, with supporting images and editing separate. Assemble the three-minute film in the existing video project. “Best” should be decided on our footage tests, not by the highest price. [Current Turbo rates](https://fal.ai/models/minimax/h3-max-turbo/image-to-video).

## Model choice

**H3 Max Turbo** costs half as much as H3 Max at every published resolution and supports the same first/last-frame inputs needed here. fal describes Turbo as optimized for higher throughput. This does not establish equal quality on our particular shots, so test the impact and owner continuity. Start with the cheaper model and choose any more expensive take on its visible merits. [Turbo model and pricing](https://fal.ai/models/minimax/h3-max-turbo/image-to-video) · [Input specification](https://fal.ai/models/minimax/h3-max-turbo/image-to-video/api).

The current Artificial Analysis **image-to-video with audio** leaderboard puts **MiniMax H3 Max, post-trained by fal**, first. That makes it my first quality candidate. This ranking is for that evaluation category; it does not guarantee the best piano physics or consistency across our film. [Independent evaluation](https://artificialanalysis.ai/video/leaderboard/image-to-video).

Runway’s own current flagship generation model is **Gen-4.5**. It accepts a starting image, generates 2–10-second clips, and outputs 720p at 24 or 25 fps. I would test it alongside H3 Max. [Runway model guide](https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5).

For a more expensive multi-reference option inside Runway, **Seedance 2.5** supports 4–30-second clips, 1080p, first/last frames and multiple reference inputs. Its flexibility could help the difficult impact shot; it is not automatically a better choice for every shot. [Seedance guide](https://help.runwayml.com/hc/en-us/articles/53542207042323-Creating-with-Seedance-2-5).

H3 Max’s 1080p option is documented as refinement from a native 768p source. Do not describe it as native 1080p. Its first/last-frame inputs suit our individually prepared shot images. [fal endpoint specification](https://fal.ai/models/minimax/h3-max/image-to-video/api).

Runway also offers MiniMax H3 at 2K. Do not conflate that model, or an API identifier with a similar name, with the exact fal variant and resolution tested on the leaderboard. [Runway H3 guide](https://help.runwayml.com/hc/en-us/articles/54046029551379-Creating-with-Minimax-H3).

## How to produce this film

1. **Record a rough narration first.** Place it over the storyboard and set the holds. It is a three-minute edit containing short footage clips, app evidence and a presenter layer, not a single three-minute generation.
2. **Create clean shot images.** Use the board as direction, then make separate full-resolution frames of the owner, truck, sidewalk, shipment, store and deli. Remove all storyboard borders, labels, fake app cards and presenter circles from generator inputs. Fix faces and hands before animating them.
3. **Lock visual continuity.** Keep the same character, clothes, storefront, truck and packaging references. Approve these stills before paying for animation. Runway’s image References workflow supports consistent subjects and locations; it is useful for making the starting frames. [References guide](https://help.runwayml.com/hc/en-us/articles/40042718905875-Creating-with-Gen-4-Image-References).
4. **Generate one action per shot, usually 5–8 seconds.** The starting frame establishes appearance; prompts describe the movement and camera. Example: “Locked camera. The worker rolls the loaded hand truck onto the sidewalk and stops beside the bread crates.” Runway recommends motion-focused image-to-video prompts. [Prompting guide](https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide).
5. **Make the impact a small sequence.** Unloading → moving shadow / reaction → short impact insert → damaged shipment. Generate matching intact and damaged views. Do not spend the whole budget asking one long shot to keep people, piano, cups and bread physically consistent. If needed, join before/after shots with sound and a brief cut; that is an editing choice, not a downgrade to the story.
6. **Keep screens separate.** Generate a steady phone shot with a clean screen plane, then composite the real app content. For the middle, generate footage of the owner selecting supplies, loading the parked car and serving customers. Add the actual cup purchase and bakery messages in the pale panel beside that footage. Never ask the video model to generate readable emails, prices or app controls.
7. **Review and select takes before finishing.** Check face, wardrobe, hands, phone shape, packaging and the direction of movement. Re-render only the failed shot. Keep the accepted takes at original quality and upscale only selected footage if needed. An eight-second take can provide several seconds plus editing handles; it need not fill an entire storyboard panel.
8. **Build the final edit locally.** The repository already has `video/package.json` with a separate Remotion project. Update its composition for the new footage, real app panels, narrator bubble and captions. For this scenario I prefer side-by-side during emails, full footage for impact and service, and an enlarged genuine phone message for the handoff. Match the final frame rate to the chosen source footage, or explicitly convert it; the existing storyboard’s 30 fps is not every model’s native rate.

These are production recommendations, not a claim that any model has passed our shot tests. The generated storyboard stills are concept references. No footage generation or paid model test was run during this research.

## What the estimate assumes

- Around **24 distinct footage shots**, averaging **8 seconds generated per take**. Twelve storyboard panels become more than twelve shots: the unloading, impact, phone close-ups and emergency errands each need coverage.
- One chosen take per shot provides about **192 seconds of raw selected footage**. After trimming, expect roughly 140–170 seconds of useful motion; app reading holds and the end card complete the 180-second film. Footage can remain visible next to app content.
- **Five takes per shot on average**: some simple shots work in two or three; the piano, hands and phone may require more. This is a planning assumption, not an observed acceptance rate.
- Working total: **24 × 8 × 5 = 960 generated seconds = 16 minutes billed**. The rejected takes still contribute to the generation budget.
- Your actual face-camera recording, recorded narration, app screen captures and local editing are not AI-video-generation seconds.

## Video generation cost

The amounts below are calculated output charges, not an all-in subscription quote. No reference-video surcharges, professional-format surcharges or taxes are included.

| Model and route | Rate per generated second | 3 takes / 576 sec | 5 takes / 960 sec | 8 takes / 1,536 sec |
| --- | ---: | ---: | ---: | ---: |
| [H3 Max Turbo on fal, 1080p, promotion through September 14](https://fal.ai/models/minimax/h3-max-turbo/image-to-video) | $0.02 | $11.52 | $19.20 | $30.72 |
| [H3 Max Turbo on fal, 1080p, regular rate](https://fal.ai/models/minimax/h3-max-turbo/image-to-video) | $0.08 | $46.08 | $76.80 | $122.88 |
| [H3 Max on fal, 1080p, regular rate](https://fal.ai/minimax-h3-max) | $0.16 | $92.16 | $153.60 | $245.76 |
| [H3 Max on fal, 1080p, promotion through September 14](https://fal.ai/models/minimax/h3-max/image-to-video) | $0.04 | $23.04 | $38.40 | $61.44 |
| [Runway Gen-4.5, standard MP4, API](https://docs.dev.runwayml.com/guides/pricing/) | $0.12 | $69.12 | $115.20 | $184.32 |
| [Seedance 2.5 through Runway, 1080p, API, image inputs only](https://help.runwayml.com/hc/en-us/articles/53542207042323-Creating-with-Seedance-2-5) | $0.68 | $391.68 | $652.80 | $1044.48 |

The H3 Max promotional price ends September 14, 2026; the provider lists the normal 1080p rate from September 15. Budget at the normal price so timing does not determine feasibility. The promotion shown is for the text/image-to-video endpoint; do not assume a separately billed reference workflow has the same promotion. [Promotion and regular rates](https://fal.ai/minimax-h3-max).

Runway API credits cost $0.01 each; Gen-4.5 is 12 credits/second. The table’s $0.12 is the API output rate. Optional ProRes/PNG generation adds 5 credits/second, or **$48 extra across 960 seconds**. [API rate card](https://docs.dev.runwayml.com/guides/pricing/).

At 1080p, Seedance’s optional input/reference video costs an additional 34 credits per second of input video. The table assumes still-image inputs. Sending a 10-second video reference into each of 120 attempts would add **$408**, so this needs deliberate budgeting. [Model billing](https://help.runwayml.com/hc/en-us/articles/53542207042323-Creating-with-Seedance-2-5).

For H3’s separate multi-reference endpoint, input charges can apply beyond its included token allowance. Our default starts from one clean shot image; reprice before adding substantial motion-reference video. [Reference billing](https://fal.ai/models/minimax/h3-max/reference-to-video).

## Practical spending allowance

**Current Turbo route: $19.20 in video output charges** for the five-take working estimate during the promotion, or $30.72 if eight takes are needed. Clean source images, any H3 Max comparison takes and other production costs are additional. These are estimates, not recorded spending or a verified account balance.

**H3 Max regular-price reference budget: $200–250.** Around $154 covers 960 seconds using H3 Max at the regular 1080p rate. Reserve the remainder for clean source-image iterations, a small comparison test and a limited amount of extra work on the hard shots. This excludes editing labor, new filming, commercial stock/music licenses and a full-film premium upscale pass.

**With the current H3 promotion: roughly $75–125** under the same scope, with room for supporting images and a small comparison test. This is not a guaranteed invoice or a reason to rush production.

**Runway Gen-4.5 route: roughly $150–200 via API**, including a modest supporting-asset allowance, for the same five-take assumption. The 720p video output may need selected upscaling; real app text is added at the final canvas resolution.

**Seedance 2.5 for every shot at 1080p: roughly $700–800**, before input-video costs, based on five takes. Its higher price is not evidence it will look better. Use a shot comparison before committing the whole project to it.

If we average eight takes, H3 Max’s normal output charge reaches about $246 before supporting assets. A **$300–350 contingency** is reasonable for that case. Buying credits does not guarantee an acceptable piano shot; the fallback is a simpler impact edit.

## Runway website versus API billing

Current published monthly prices are **Pro $35 / 2,250 credits** and **Max $95 / 9,500 credits**; the lower displayed $28/$76 prices require annual billing. Max would cover roughly 791 seconds of Gen-4.5 before images or other paid tools. Our 960-second working estimate needs 11,520 video credits, so it exceeds that monthly allowance. The pricing page includes unlimited 4K upscaling on Pro/Max, not unlimited generations of every model. [Runway plans](https://runway.com/pricing).

Do not mix web-plan credits with API credits: they are separate balances. Extra web credits can be purchased, with a 1,000-credit minimum, but this research did not verify the checkout price for this account. The tables use public API/per-use rates instead of assuming that web top-ups have an identical conversion. [Credit rules](https://help.runwayml.com/hc/en-us/articles/15124877443219-How-do-credits-work).

## First production test

Make the three five-second tests in the [pilot brief](../assets/storyboard/you-handle-today-footage/pilot.md): unloading, piano impact and phone handoff. One Turbo take each costs about **$0.30** during the promotion. Add one five-second H3 Max piano comparison for **$0.50 total video charges**. Still-image creation is separate. Select for consistency and usable motion, then run the rest in small groups. A successful result on our actual shots is more useful than choosing solely from a benchmark.

After the model choice, save a generation log with shot, reference image, prompt, duration, settings, attempt, charged amount and selected take. The adjacent [budget CSV](../assets/storyboard/you-handle-today-footage/generation-budget.csv) contains the arithmetic used here.
