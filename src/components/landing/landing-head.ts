export function landingHead() {
  return {
    meta: [
      { title: "Autonomous Buyer — Keep the lines moving." },
      {
        name: "description",
        content:
          "From inventory risk to confirmed order. Meet the autonomous buy desk that keeps your business moving, and you in control.",
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
