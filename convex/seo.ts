import { httpAction, env } from "./_generated/server";
import { components } from "./_generated/api";
import { applySeo, escapeHtml, pageSeo, publicPaths } from "../shared/seo";

const origin = () => new URL(env.APP_URL || env.CONVEX_SITE_URL).origin;
export const robots = httpAction(
  async () =>
    new Response(
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: ${origin()}/sitemap.xml\n`,
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      },
    ),
);
export const sitemap = httpAction(
  async () =>
    new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPaths.map((path) => `<url><loc>${escapeHtml(origin() + path)}</loc></url>`).join("")}</urlset>`,
      {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      },
    ),
);
export const page = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (path === "/index.html" || path === "/landing" || url.pathname !== path) {
    const target = new URL(path === "/index.html" || path === "/landing" ? "/" : path, origin());
    target.search = url.search;
    return new Response(null, { status: 308, headers: { Location: target.href } });
  }
  const asset = await ctx.runQuery(components.staticHosting.lib.resolveAssetForHttp, {
    path: "/index.html",
    spaFallback: false,
  });
  if (!asset?.storageUrl)
    return new Response("Temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "5" },
    });
  const stored = await fetch(asset.storageUrl);
  if (!stored.ok) return new Response("Temporarily unavailable", { status: 503 });
  const seo = pageSeo(url, origin());
  return new Response(applySeo(await stored.text(), seo), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": seo.robots,
      Link: `<${seo.canonical}>; rel="canonical"`,
    },
  });
});
