export function landingHead() {
  return {
    meta: [
      { title: "BUY HARD — Your AI buyer" },
      {
        name: "description",
        content:
          "Spot low stock, find a supplier, and order what you need. Your AI buyer does the busywork. You stay in control.",
      },
    ],
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
