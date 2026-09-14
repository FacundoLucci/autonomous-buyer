# First footage test

Prepared September 12, 2026; revised September 13. [Watch and review the generated footage](./pilot/README.md). The current opening is 14 seconds: unloading, a sudden piano crash, and the phone handoff. The piano breaks apart and both people recoil. This tests footage before the full three-minute film; it does not replace the screenplay timings.

## Connection and cost

The saved key authenticated successfully against fal's model discovery, pricing and generation endpoints. Eight video jobs completed and were downloaded on September 13; estimated video charges total $0.90. The key cannot read account billing details, so actual charges and the remaining balance are unverified. The user reported adding $10 before generation began.

Use `minimax/h3-max-turbo/image-to-video`, `1080P`, five seconds, `prompt_expansion_mode: balanced`, safety checking enabled. Feed clean landscape keyframes, not the storyboard contact sheet. The API follows the source image's aspect ratio. Its 1080P mode refines a native 768P generation. The user reviewed the initial Max comparison and chose Turbo for subsequent footage. The exact revised prompts and source frames are recorded in [the manifest](./pilot/manifest.json); the shot briefs below preserve the initial pilot plan.

The [Turbo endpoint](https://fal.ai/models/minimax/h3-max-turbo/image-to-video) lists $0.02 per output second at 1080P through September 14; its regular $0.08 rate resumes September 15. Three five-second Turbo clips are approximately **$0.30 in video generation charges**, or **$0.60 for two takes each**. One five-second H3 Max piano comparison adds $0.20, making the three-shot test plus comparison **$0.50**. Still-image creation is separate. The earlier account pricing lookup was for H3 Max and returned its $0.0125 480P base rate; it was not a resolution-specific 1080P quote. Check rates again at submission time. Buying credits alone does not lock the promotional generation rate.

Turbo costs half as much as H3 Max at each listed resolution. The provider describes it as optimized for greater throughput; the published pages do not establish identical quality for our footage. Judge the piano's movement, faces, hands and continuity from the comparison rather than assuming the higher-priced version will win.

## Shared visual reference

Use [the photographic storyboard](./contact-sheet.png) for the owner, wardrobe, location and light. Create clean individual frames from that reference: no panel borders, titles, narrator circle, captions, logos or generated app interface. Maintain one fictional owner in his thirties with short dark hair, olive work shirt and charcoal apron; a red-brick deli, white delivery truck, cardboard cup cartons and black bread crates. Warm natural morning light, restrained commercial photography, believable physical detail and dry humor.

Keep the crucial action away from the bottom of the picture so the final edit can accommodate the presenter and subtitles. Apply the frontend's lime, pale panels and dark thin rules during composition, while retaining natural colors in the footage.

## 01 — Unloading

**Starting frame:** Wide, eye-level landscape view outside the deli. White delivery truck at left, open rear visible. A delivery worker in navy work clothes holds a carton by the truck. One low stack of cup cartons and two bread crates sit on the sidewalk in the center. Visible white paper cups and bread establish both products without relying on labels. The owner stands at the deli doorway on the right. Leave the delivery pile spatially distinct from both people.

**Motion prompt:** One continuous five-second naturalistic shot. The worker sets a carton onto a hand truck beside the white delivery truck, then steps toward the truck. The deli owner glances at the delivery from his doorway. Subtle camera drift, ordinary morning activity, realistic hands and weight. Keep the pile of cup cartons and bread crates stable in the center. Quiet street ambience and carton rustle. No dialogue, music, text or edits.

**Check:** Both products read clearly; owner, truck and location match the reference. No sudden new objects or changing carton shapes.

## 02 — Piano impact

**Starting frame:** Match the established exterior camera position. The shipment is now stationary and unattended at the center. The worker is beside the truck on the far left; the owner remains in the doorway on the far right. Clear space separates both people from the shipment.

**Optional ending frame:** Same composition after impact. A heavy dark wooden upright piano rests on crushed cartons and broken bread crates. White cups and bread have scattered around its base. Owner and worker remain in their original safe positions. Preserve the truck, doorway, light and camera angle.

**Motion prompt:** Locked camera, one continuous five-second shot. For the first second the unattended delivery pile is still. A large shadow crosses the cartons. A single heavy upright piano drops vertically from above the frame onto the shipment, crushing the cup cartons and bread crates together. A short burst of cardboard dust, a few white paper cups and bread rolls scatter and settle. The owner at the far-right doorway and worker by the far-left truck react with a restrained flinch; neither is struck. The piano comes to rest and remains solid. One weighty impact with a brief discordant piano resonance, followed by quiet street ambience. Dry absurdist humor rendered with realistic mass and gravity. No explosion, injury, dialogue, music, text or camera cut.

**Check:** One piano, one impact, both product types affected, people clear. The piano must arrive from above and settle on the same shipment. If the physical action fails, use the storyboard's short impact insert and aftermath cut rather than stretching a weak take.

## 03 — Phone handoff

**Starting frame:** Medium three-quarter view of the same owner standing still beside the deli entrance, holding a dark smartphone naturally in front of his chest with both hands. His face and hands are visible. The damaged delivery and upright piano remain softly out of focus in the background. Angle the phone screen toward him, without legible generated screen content.

**Motion prompt:** One continuous five-second shot with a gentle push in. The owner looks at the smartphone held in his hands, types a short message with his thumbs, taps once and lowers the phone slightly. His expression shifts from dry disbelief to practical resolve. He stays stationary throughout. Preserve his face, olive shirt, charcoal apron, hands and phone shape. The wrecked shipment remains softly blurred behind him. Quiet street ambience and faint clothing movement. No phone call, dialogue, music, text, interface overlays or cuts.

**Edit layer:** Place the actual supported app handoff beside the footage, with readable text: “The shipment's ruined. I'm picking up emergency supplies for the next few days. Please arrange replacement cups and bread as quickly as possible. The cups can come from the online store. Our bakery takes orders by email.” Hold this longer in the final edit; the five-second test only evaluates the actor's action. Use the existing narration over that hold.

**Check:** Same owner; believable fingers; phone stays in his hands; expression feels practical. Generated phone pixels are not evidence of product behavior.

## After the test

Review the three clips together for continuity and tone. Then produce the emergency pickup and deli service footage, capture the app's cup purchasing and bakery email exchange, and assemble the three-minute frame sequence. Show the bakery enquiry, incoming reply, delivery-time follow-up and eventual supplier confirmation while the owner handles the immediate problem. Record Facundo's Loom-style overlay after the timing settles. The actual app captures and narrator recording remain separate production steps.
