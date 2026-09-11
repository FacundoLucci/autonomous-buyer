export const defaultPublicOrigin = "https://reliable-albatross-463.convex.site";
export const siteTitle = "BUY HARD — AI buyer for everyday business supplies";
export const siteDescription =
  "An AI buyer for the everyday supplies your business runs on. Prepare reorders for your approval, explore the demo, or book a 20-minute walkthrough.";
export const publicPaths = ["/", "/walkthrough"];
export const appPaths = [
  "/leads",
  "/setup",
  "/legacy",
  "/prototype",
  "/legacy/landing",
  "/legacy/prototype",
  "/legacy/setup",
];
export function pageSeo(url: URL, publicOrigin: string) {
  const origin = new URL(publicOrigin).origin;
  const path = url.pathname.replace(/\/$/, "") || "/";
  const demo = ["true", "1"].includes(url.searchParams.get("demo") ?? "");
  const workspace =
    (url.searchParams.has("page") && url.searchParams.get("page") !== "dashboard") ||
    ["item", "buy", "companyOrder"].some((key) => url.searchParams.has(key));
  const indexable = publicPaths.includes(path) && !demo && !workspace && url.origin === origin;
  const title = demo
    ? "Sample demo — BUY HARD"
    : path === "/walkthrough"
      ? "Book a 20-minute walkthrough — BUY HARD"
      : path === "/leads"
        ? "Private follow-up list — BUY HARD"
        : path === "/setup"
          ? "Your account — BUY HARD"
          : siteTitle;
  const description =
    path === "/walkthrough"
      ? "Bring one item you regularly reorder. Explore how BUY HARD could help in a 20-minute walkthrough, or leave your interest in the early pilot."
      : siteDescription;
  const canonical = `${origin}${path === "/landing" ? "/" : path}`;
  const image = `${origin}/social-preview.png`;
  const imageAlt =
    "BUY HARD. An AI buyer for the everyday supplies your business runs on. Book a 20-minute walkthrough.";
  const robots = indexable ? "index, follow, max-image-preview:large" : "noindex, follow";
  const meta = [
    { name: "description", content: description },
    { name: "robots", content: robots },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "BUY HARD" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { property: "og:locale", content: "en_US" },
    { property: "og:image", content: image },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: imageAlt },
  ];
  const structuredData = indexable
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${origin}/#organization`,
            name: "BUY HARD",
            url: `${origin}/`,
          },
          {
            "@type": "WebSite",
            "@id": `${origin}/#website`,
            name: "BUY HARD",
            url: `${origin}/`,
            description: siteDescription,
            publisher: { "@id": `${origin}/#organization` },
          },
          {
            "@type": "WebPage",
            "@id": canonical,
            url: canonical,
            name: title,
            description,
            isPartOf: { "@id": `${origin}/#website` },
          },
        ],
      }
    : undefined;
  return { title, description, canonical, robots, meta, structuredData };
}
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
export function seoHtml(seo: ReturnType<typeof pageSeo>) {
  return (
    `<title>${escapeHtml(seo.title)}</title><link rel="canonical" href="${escapeHtml(seo.canonical)}"/>` +
    seo.meta
      .map(
        (tag) =>
          `<meta ${"name" in tag ? `name="${tag.name}"` : `property="${tag.property}"`} content="${escapeHtml(tag.content)}"/>`,
      )
      .join("") +
    (seo.structuredData
      ? `<script type="application/ld+json">${JSON.stringify(seo.structuredData).replace(/</g, "\\u003c")}</script>`
      : "")
  );
}
export function applySeo(html: string, seo: ReturnType<typeof pageSeo>) {
  return html.replace(
    /<head>([\s\S]*?)<\/head>/i,
    (_, head: string) =>
      `<head>${head
        .replace(/<title>[\s\S]*?<\/title>/gi, "")
        .replace(
          /<meta\b[^>]*(?:name|property)=["'](?:description|robots|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi,
          "",
        )
        .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "")
        .replace(
          /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
          "",
        )}${seoHtml(seo)}</head>`,
  );
}
