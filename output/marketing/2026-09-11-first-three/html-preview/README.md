# BUY HARD — editable HTML campaign gallery

Four editable artworks: the published introduction, the restored OpenAI product card, Firecrawl's illustrated buying flow, and the separate later handwritten napkin. [Posting copy and state](../ready/README.md) · [Weekend schedule](../../2026-09-12-daily-campaign/weekend-posts.md).

The three product cards use the same bundled Inter headline typography, native HTML/CSS layout and separate product PNGs. The introduction retains green checks on the cups, carton and labels. Firecrawl's ecommerce panel includes Add to cart and an illustrated buyer confirmation.

The napkin uses the bundled Caveat handwriting font on folded SVG paper. Its entire artwork is the quote, with gun scribbled out and buyer above it. No headline, sponsor footer, domain or product image appears on that card. The caption carries the public link and credits. It remains an unscheduled later draft.

[Open the gallery](http://127.0.0.1:54237/html-preview/) · [HTML source](index.html) · [Current copy](../ready/posts.json).

Edit the HTML and shared CSS in index.html, then refresh the preview. Artboards are 1536 × 1024. Select `?card=buyer`, `?card=openai`, `?card=firecrawl`, or `?card=napkin`; add `&export=1` to hide review controls. export-cards.js captures the selected card in a headless Playwright session. It waits for fonts and product cutouts. The OpenAI export is your-buyer-stays-ahead-html.png; the standalone napkin is now-i-have-a-machine-buyer-handwritten.png.

Product images come from separate generated PNGs. The existing local Canvas masking creates their transparent silhouettes. All words, checks, ecommerce panels, connectors and napkin folds remain HTML/CSS/SVG. No image editing service runs in the preview.

Font files and licenses are local: Inter, Share Tech Mono, and [Caveat](https://github.com/googlefonts/caveat), which is used only for the requested handwritten note. The napkin's 1536 × 1024 export has been visually inspected.

If the server stops, run from the repository:

```sh
python3 -m http.server 54237 --bind 127.0.0.1 --directory output/marketing/2026-09-11-first-three
```

The introduction is published. OpenAI and Firecrawl are scheduled for September 12 at 08:30 and 12:30 Chicago time. The complete seven-post weekend queue and provider readbacks live in the daily campaign folder. Revision 8's combined napkin image is retained only for history.
