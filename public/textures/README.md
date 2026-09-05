# Powder coat

An original, procedural SVG with fine pebbled relief, subtle upper-left highlights, and transparent shadows. The paint color comes from the element underneath. No embedded photo, animation, or external dependencies.

Load `powder-coat.css`, then add the class to a metal surface:

```html
<link rel="stylesheet" href="/textures/powder-coat.css" />
<section class="powder-coat" style="background-color: #101313">
  <!-- Surface content -->
</section>
```

- `--powder-coat-strength: 0.19` uses the selected 19% texture opacity.
- `--powder-coat-size: 256px` uses the selected 0.5× grain size. The source SVG remains 512 × 512.
- The helper uses `::before`. If the surface already uses that pseudo-element, apply the same background to an existing decorative layer instead.
- Repeat the tile at a fixed size; `cover` would change the grain size with the surface dimensions.

The SVG wraps its noise before lighting so the light and shade continue across tile edges. The filter is static and attached to a small repeating image.

Open `../../output/powder-coat/index.html` for the interactive material preview.

## Screen-printed text

Load `screen-print.css` and add `screen-print` to live text or a group of markings:

```html
<link rel="stylesheet" href="/textures/screen-print.css" />
<section class="powder-coat" style="background-color: #101313">
  <h1 class="screen-print">BUY HARD</h1>
</section>
```

The warm ink has fine variations in coverage and a very shallow edge shadow. Text stays selectable and accessible. The effect uses a static SVG alpha mask, so it also works on printed rules and icons inside the same element.

- `--screen-print-color: #d3d0be` sets the ink color.
- `--screen-print-opacity: 0.94` sets ink opacity.
- `--screen-print-grain: 0.5` uses the selected 50% ink grain, from `0` (solid) to `1` (most textured).
- `--screen-print-grain-size: 256px` sets the ink grain scale.

Apply the class to the printed content separately from the metal. Applying it to the whole surface would mask the metal too. Use the effect on display labels rather than controls that need an unmasked focus outline.

The app and this preview load these same CSS and SVG files. `--powder-coat-paint` holds the approved graphite gradients. Fixed section labels sit above their displays on the metal; values and changing content stay inside the displays.

The app uses one continuous metal layer across the whole face. Its header scrolls with the page and has no separate background. The BUY HARD wordmark uses the recessed `bh-stamped` treatment; section labels use screen printing.

All four summary metrics share one recessed grille, with metallic labels inside. Values use at most four characters (`284k`, `17k`, `1.2m`) at one shared dot spacing and origin. Dollar readouts carry a USD label, and hovering or focusing a value reveals the full amount. Run `node --test src/components/buy-hard/metric-format.test.ts` to check abbreviation limits and rounding boundaries.
