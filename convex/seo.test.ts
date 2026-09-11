/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi, afterEach } from "vitest";
import schema from "./schema";
import { applySeo, pageSeo, defaultPublicOrigin as origin } from "../shared/seo";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.unstubAllEnvs());
test("public pages canonicalize campaign parameters without blocking indexing", () => {
  for (const path of [
    "/?utm_source=launch&demo=false&page=dashboard",
    "/walkthrough?utm_campaign=pilot",
  ]) {
    const seo = pageSeo(new URL(path, origin), origin);
    expect(seo.robots).toBe("index, follow, max-image-preview:large");
    expect(seo.canonical).not.toContain("?");
    expect(seo.structuredData).toBeDefined();
  }
});
test("demo, private, alternate hosts and unknown routes are not indexable", () => {
  for (const path of [
    "/?demo=true",
    "/?demo=1",
    "/?page=inventory",
    "/?item=private-id",
    "/?buy=private-id",
    "/leads",
    "/setup?mode=login",
    "/legacy",
    "/prototype",
    "/missing",
    "https://preview.example.com/",
  ]) {
    const seo = pageSeo(new URL(path, origin), origin);
    expect(seo.robots).toBe("noindex, follow");
    expect(seo.structuredData).toBeUndefined();
  }
});
test("HTML rewriting replaces stale metadata once and preserves assets and app scripts", () => {
  const shell =
    '<html><head><meta charset="utf-8"><title>old</title><meta name="robots" content="index"><meta property="og:title" content="old"><link rel="canonical" href="old"><link rel="stylesheet" href="/a.css"><script type="application/ld+json">{}</script></head><body><script src="/app.js"></script></body></html>';
  const seo = pageSeo(new URL("/leads", origin), origin);
  const html = applySeo(shell, seo);
  expect(html.match(/<title>/g)).toHaveLength(1);
  expect(html.match(/rel="canonical"/g)).toHaveLength(1);
  expect(html).toContain('content="noindex, follow"');
  expect(html).not.toContain("application/ld+json");
  expect(html).toContain('<link rel="stylesheet" href="/a.css">');
  expect(html).toContain('<script src="/app.js"></script>');
  expect(applySeo(html, seo)).toBe(html);
});
test("robots allows crawling noindex pages and sitemap lists only canonical public pages", async () => {
  vi.stubEnv("APP_URL", origin);
  const t = convexTest(schema, modules);
  const robots = await t.fetch("/robots.txt");
  expect(robots.status).toBe(200);
  const text = await robots.text();
  expect(text).toContain(`Sitemap: ${origin}/sitemap.xml`);
  expect(text).not.toContain("Disallow: /leads");
  const sitemap = await t.fetch("/sitemap.xml");
  expect(sitemap.headers.get("Content-Type")).toContain("application/xml");
  const xml = await sitemap.text();
  expect(xml.match(/<loc>/g)).toHaveLength(2);
  expect(xml).toContain(`<loc>${origin}/walkthrough</loc>`);
});
test("duplicate and trailing-slash pages redirect with attribution preserved", async () => {
  vi.stubEnv("APP_URL", origin);
  const t = convexTest(schema, modules);
  for (const path of [
    "/landing?utm_source=launch",
    "/index.html?utm_source=launch",
    "/walkthrough/?utm_source=launch",
  ]) {
    const result = await t.fetch(path);
    expect(result.status).toBe(308);
    expect(result.headers.get("Location")).toBe(
      origin + (path.startsWith("/walkthrough") ? "/walkthrough" : "/") + "?utm_source=launch",
    );
  }
});
