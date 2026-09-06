# The Last Lid — visual storyboard

Twelve photorealistic keyframes for a cinematic, sub-three-minute Autonomous
Buyer demo. The generated images use public LUHV photographs only as likeness
and location references. Composite the real Autonomous Buyer UI into the blank
laptop screens; do not generate replacement UI text.

## Visual continuity

- Aspect ratio: 16:9
- Character: Facundo in a pale blue rolled-sleeve shirt and dark deli apron
- Location: warm, busy vegan deli inside a historic indoor market
- Camera: grounded 35mm documentary cinema with natural skin and food texture
- Color arc: warm rush → cooler operational focus → warm resolution
- Recurring motif: the clear round lid
- Screens: clean charcoal planes reserved for real app footage

Animate each still as its own short shot. Cut between different compositions;
do not ask a video model to morph one keyframe directly into the next.

## Scene 1 — The ordinary world breaks

Runtime: 0:00–0:24

### Start: `01-lunch-rush-start.png`

Facundo is completely present with customers in a lively lunch rush.

Motion prompt:

> Subtle handheld documentary camera slowly pushes through the waiting customers
> toward the deli owner. He continues slicing and assembling a sandwich with
> natural hand movement while customers shift gently in the foreground. Warm
> market lights flicker softly. Realistic motion, no slow motion, no face change.

### End: `02-last-lid.png`

The final lid turns an ordinary supply into a visible threat.

Motion prompt:

> A hand slowly lifts the final clear plastic lid from the nearly empty sleeve.
> Rack focus travels through the circular lid to the deli owner's concerned
> eyes. Background lunch-rush movement continues, then seems to fall quiet.
> Preserve the face and transparent plastic geometry.

Edit: hard sound cut when the lid clears the sleeve. Let the lid fill the frame
for a circular match cut into the real dashboard's inventory-risk indicator.

## Scene 2 — The impossible choice

Runtime: 0:24–0:46

### Start: `03-pressure-builds.png`

Prepared containers keep accumulating while service cannot stop.

Motion prompt:

> Locked camera with the deli owner nearly still in sharp focus while workers
> and customers cross quickly around him in natural motion blur. He looks from
> the lidless containers toward the line and takes one controlled breath.
> Operational tension, realistic documentary motion, no panic.

### End: `04-turning-point.png`

His attention shifts for one beat: something is already handling the problem.

Motion prompt:

> Slow cinematic push toward the deli owner's three-quarter profile. He keeps
> preparing food, glances toward an off-camera device, and his concern settles
> into quiet focus. Warm practical light gains a faint cool reflection. Preserve
> identity and subtle expression; no smile to camera.

Edit: cut on his eye line to the real public dashboard and the five-day
stockout calculation.

## Scene 3 — The silent operator

Runtime: 0:46–1:18

### Start: `05-silent-operator.png`

The system enters the story without stopping the deli.

Motion prompt:

> Gentle left-to-right slider move. The deli owner continues assembling the
> sandwich with natural gloved-hand movement while the blank laptop remains
> stable and fully visible. Background customers move softly. Preserve the
> laptop plane for screen replacement; no generated interface.

Composite: real inventory risk, `PC-9258`, and Firecrawl sourcing footage.

### End: `06-search-without-leaving.png`

Supplier work happens in the background while the foreground remains service.

Motion prompt:

> Slow parallax move through the glass counter. Fresh greens and sandwich
> preparation remain tactile in the foreground as the deli owner works
> continuously. The laptop stays fixed, flat, and unobstructed for tracking.
> Natural market motion only; no generated screen content.

Composite: real supplier sources, confidence labels, and three RFQ deliveries.

## Scene 4 — The best quote is incomplete

Runtime: 1:18–1:47

### Start: `07-missing-number.png`

The leading supplier omitted freight, creating a second-act complication.

Motion prompt:

> Very slow push toward the owner and laptop. He reads the blank order ticket,
> compares it with the screen, and tightens his focus slightly. A restrained red
> practical reflection adds tension. Keep the laptop screen flat and blank for
> replacement; preserve face and hands.

Composite: the incomplete SupplyCo quote and `Missing: freight` evidence.

### End: `08-thread-continues.png`

The agent follows up while Facundo finishes the customer's order.

Motion prompt:

> The deli owner naturally extends the wrapped sandwich and the customer takes
> it. He gives a brief professional nod. The laptop stays motionless behind him
> with a subtle warm edge light. Realistic handoff, documentary timing, no
> generated notification or screen text.

Composite: the focused freight follow-up and the complete quote revision.

## Scene 5 — Code recommends, a person decides

Runtime: 1:47–2:15

### Start: `09-trade-off.png`

The pace slows so the recommendation feels earned rather than magical.

Motion prompt:

> Nearly locked intimate camera with a tiny handheld drift. The deli owner reads
> carefully, eyes moving naturally between supplier choices, then settles on the
> recommendation. Background service continues softly. Preserve the blank screen
> plane for a real comparison composite.

Composite: SupplyCo at $3,000 arriving September 2, plus the late-arrival losing
reasons for the alternatives.

### End: `10-human-judgment.png`

Hold the decisive human checkpoint before the click.

Motion prompt:

> Macro shot. The index finger moves slowly toward the trackpad and pauses just
> before contact. The owner's face remains subtly reflected in the dark screen.
> Shallow depth of field, a held breath, realistic finger anatomy, no interface
> or glowing button.

Edit: cut to the real recorded approval click. Never perform a new purchase
approval for the film.

## Scene 6 — Closed loop

Runtime: 2:15–2:55

### Start: `11-confirmed-incoming.png`

The resolution is evidence, not an invented delivery scene.

Motion prompt:

> Slow over-shoulder push toward the blank laptop. The deli owner releases a
> quiet breath and relaxes his shoulders while service continues behind him. A
> very soft green reflection appears at the screen edge. Preserve identity and
> the trackable screen; no boxes, truck, generated UI, or celebration.

Composite: purchase order delivered once, matching supplier confirmation,
`+15,000 confirmed`, and `Covered`.

### End: `12-keep-serving.png`

Return to the opening world and reveal what autonomy bought: attention.

Motion prompt:

> Warm steady camera. The deli owner aligns the clear lid over the filled
> container, presses around the rim until it snaps securely shut, then looks up
> to the next customer. The market remains lively and natural. Preserve face,
> hands, lid geometry, and food. Leave upper-left space clear for the final title.

Final title:

> AUTONOMOUS PURCHASING. HUMAN JUDGMENT.

Hold the sealed lid and title from 2:55–3:00.

## File order

1. `01-lunch-rush-start.png`
2. `02-last-lid.png`
3. `03-pressure-builds.png`
4. `04-turning-point.png`
5. `05-silent-operator.png`
6. `06-search-without-leaving.png`
7. `07-missing-number.png`
8. `08-thread-continues.png`
9. `09-trade-off.png`
10. `10-human-judgment.png`
11. `11-confirmed-incoming.png`
12. `12-keep-serving.png`

`contact-sheet.png` is the quick visual overview.
