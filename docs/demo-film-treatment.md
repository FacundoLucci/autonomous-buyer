# BUY HARD — You handle today

Updated September 12, 2026. Production direction for the new **3:00** demo.

Facundo hands a damaged-shipment problem to his buyer. A piano has ruined both cups and bread. He gets emergency supplies while the buyer prepares replacement cups from an online store and arranges bread with the email-only bakery. His Loom-style overlay stays visible. The two supplier channels are ordinary buying work happening on his behalf.

The [screenplay](./demo-screenplay.md) owns scene timing and capture actions. The [recording sheet](./demo-voiceover.md) owns the exact spoken script. They supersede the former “The $400 Decision” treatment for this new cut. The older Remotion composition, captures and exports remain an earlier version until rebuilt.

## Match the current frontend

Use the current `src/styles/desk.css` and `src/components/desk/agent.css` as the visual source:

| Element | Treatment |
| --- | --- |
| Main background | Lime `#dce985` |
| Text and rules | Almost black `#15170f` |
| Light surface / buyer dock | Pale `#eef1d5` |
| Secondary surface | `#e4ecaa` |
| Main type | Arial / Helvetica, bold compact headlines, plain readable body |
| Small labels | Existing JetBrains Mono styling |
| Brand | Current dot-matrix BUY HARD wordmark, used sparingly |
| Structure | Open space, thin rules, sentence-led product content, persistent buyer dock |

Use the current frontend as the visual reference. Carry its lime, typography and spacing into the editorial border and end card. Avoid importing the old dark industrial dashboard treatment or decorating the new UI with receipt textures. Keep actual app text unchanged.

## Camera and frame layout

At 1920×1080, reserve a 320-pixel column on the left for the presenter. Put a 240-pixel circular camera overlay at x=40, y=700. Keep that position throughout so the viewer always knows where to look. Use a thin dark outline without a heavy shadow.

Place the product capture within x=360, y=64, width=1504, height=846. Fit a 16:9 source without stretching. This leaves the product, chat dock and approval controls completely outside the camera area. On detail shots, crop within that same product rectangle; keep the relevant state label visible. Editorial headings sit above it; subtitles sit below it, around y=960–1032, starting at x=360.

On the opening and closing title cards, use the same product rectangle for the title content and retain the camera bubble. Do not enlarge or move the presenter between cuts. Preview at normal laptop playback size; use a closer product crop whenever a key value is difficult to read.

Record camera plus microphone together against the silent frame sequence, or capture a separate camera take for compositing. Deliver a clean camera recording if possible so the final edit adds the bubble only once. If recording the finished layout directly in Loom, put its bubble in the reserved presenter column.

## Rhythm

Start with purchasing quietly handled, then the piano landing on the shipment. Establish both cups and bread in that image. After the owner’s handoff, show the cup purchase being prepared online, then give the bakery email exchange enough time to read. Bring both options back for the needed decisions. After approval, show the online order and the emailed order, each with its own confirmation. End with the owner free to handle the business.

Use mostly cuts, short dissolves and gentle reframing. Hold each important value or decision for at least three seconds. Do not animate the camera bubble. Do not type the entire narration onto the screen. Limit editorial text to a short headline or a useful distinction, such as “Later · delivery arrives.”

This scenario describes intended behavior that has not been verified as an end-to-end product flow. For illustrative frames, keep **Product concept · illustrative scenario** legible and use editorial conversation cards, not fabricated app responses. A product-demonstration version needs real captured behavior and claim-matched evidence first. See the screenplay’s production evidence section. Keep production mechanics out of the narration.

Your voice leads the edit. Start around 135–145 spoken words per minute with room for clicks and short pauses. There is no need for generated narration, acted deli footage, or a music montage. Music is optional and should stay unobtrusive. Create captions from the final spoken take.

## Frame-based build handoff

“Frames” here means an editable sequence of genuine frontend captures or clearly labeled editorial concept cards, with timed holds, transitions, captions and your camera layer. The plan can be implemented in the existing video project or the chosen frame editor; it does not depend on a new tool choice.

Organize assets around `02-damaged-shipment`, `03-owner-handoff`, `04-cups-online`, `05a-bakery-enquiry`, `05b-bakery-reply`, `05c-follow-up`, `05d-delivery-terms`, `06-replacement-plan`, `07a-cup-order`, `07b-bread-order`, and the two supplier confirmations. Record each asset’s source, whether it is genuine or illustrative, crop, duration and caption.

Build the cup preparation and bakery exchange first. Check that viewers understand why each supplier uses a different channel without a technical explanation. Assemble all ten scenes, record Facundo and fit the holds to his delivery. Keep the final duration at 180 seconds.

Before the final export, verify the public destination for the end card, keep all sample labels legible, and check that the camera and subtitles never hide the buyer input, purchase terms, approval button or stock values. Deliver the finished MP4, captions and editable frame sequence.

Status: screenplay and script reframed around the user’s intended buyer relationship. End-to-end exception handling is not verified. Evidence capture or a clearly labeled concept composition, camera recording and final rendering remain.


## Show the work without naming the machinery

No technology-provider names, logos, architecture slides or added credits in the narrated story. The cup listing and checkout show online purchasing; the bakery enquiry, follow-up and confirmation show email purchasing. The bakery’s channel is its normal way of doing business. Frame genuine product content without emphasizing provider credits or altering source screenshots.

Keep the exchange inside the current visual language: pale email surface, lime surroundings, dark type, small direction labels such as **Buyer → Bakery** and **Bakery → Buyer** outside the captured UI. Use genuine in-app message views where available. The current reply reader does not itself establish a complete sent-message thread; do not fabricate one as working UI. Illustrative cards must keep the concept label described in the screenplay.

The owner never becomes an inbox operator. These are brief views into work happening on their behalf. Only the recommendation or a material exception calls for their attention.
