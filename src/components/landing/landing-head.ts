import { seoHead } from "./social-meta";
export function landingHead() {
  return {
    meta: seoHead("/legacy/landing").meta,
    links: [
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
        href: `${import.meta.env.BASE_URL}fonts/share-tech-mono-latin.woff2`,
      },
      {
        rel: "preload",
        as: "image",
        href: `${import.meta.env.BASE_URL}textures/landing/paper.webp`,
      },
    ],
  };
}
