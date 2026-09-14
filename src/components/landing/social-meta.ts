import { defaultPublicOrigin, pageSeo } from "../../../shared/seo";
export const publicOrigin = (
  import.meta.env.VITE_PUBLIC_SITE_URL ||
  import.meta.env.VITE_CONVEX_SITE_URL ||
  defaultPublicOrigin
).replace(/\/$/, "");
export function seoHead(path = "/", search: Record<string, unknown> = {}) {
  const url = new URL(path, publicOrigin);
  for (const [key, value] of Object.entries(search))
    if (value !== undefined) url.searchParams.set(key, String(value));
  const seo = pageSeo(url, publicOrigin);
  return {
    meta: [{ title: seo.title }, ...seo.meta],
    links: [{ rel: "canonical", href: seo.canonical }],
    scripts: seo.structuredData
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify(seo.structuredData).replace(/</g, "\\u003c"),
          },
        ]
      : [],
  };
}
export const socialMeta = seoHead().meta;
