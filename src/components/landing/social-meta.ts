const title = "BUY HARD — An AI buyer for everyday business supplies";
const description =
  "Spot low stock and prepare reorders for your approval. Explore the sample demo, join the early pilot, or book a 20-minute walkthrough.";
const origin = (
  import.meta.env.VITE_PUBLIC_SITE_URL ||
  import.meta.env.VITE_CONVEX_SITE_URL ||
  "https://reliable-albatross-463.convex.site"
).replace(/\/$/, "");
export const socialMeta = [
  { name: "description", content: description },
  { property: "og:type", content: "website" },
  { property: "og:site_name", content: "BUY HARD" },
  { property: "og:title", content: title },
  { property: "og:description", content: description },
  { property: "og:url", content: `${origin}/` },
  { property: "og:image", content: `${origin}/social-preview.png` },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  {
    property: "og:image:alt",
    content:
      "BUY HARD. An AI buyer for the everyday supplies your business runs on. Book a 20-minute walkthrough.",
  },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: title },
  { name: "twitter:description", content: description },
  { name: "twitter:image", content: `${origin}/social-preview.png` },
];
