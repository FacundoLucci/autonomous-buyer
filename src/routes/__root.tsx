import { Landing } from "@/components/desk/landing";
import { seoHead } from "@/components/landing/social-meta";
import type { QueryClient } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  ClientOnly,
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";

import { Button, buttonVariants } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles/legacy-theme.css";
import appCss from "@/styles/app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    const current = matches.at(-1);
    const seo = seoHead(current?.pathname ?? "/", current?.search ?? {});
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#dce985" },
        ...seo.meta,
      ],
      scripts: seo.scripts,
      links: [
        ...seo.links,
        { rel: "stylesheet", href: `${import.meta.env.BASE_URL}textures/powder-coat.css` },
        { rel: "stylesheet", href: `${import.meta.env.BASE_URL}textures/screen-print.css` },
        { rel: "stylesheet", href: appCss },
        {
          rel: "icon",
          href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='3' fill='%23090b0b'/%3E%3Cpath fill='%23fbf6ea' d='M5 7h7v2H7v6h5v2H7v6h5v2H5zm7 2h2v6h-2zm0 8h2v6h-2zm6-10h2v8h5V7h2v18h-2v-8h-5v8h-2z'/%3E%3C/svg%3E",
          type: "image/svg+xml",
        },
      ],
    };
  },
  shellComponent: RootDocument,
  component: RootComponent,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootComponent() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    // The shared public preview is identical during the first client render.
    <ClientOnly fallback={<Landing staticPreview />}>
      {path.startsWith("/legacy") || path === "/prototype" ? (
        <div className="legacy-shell dark">
          <Outlet />
        </div>
      ) : (
        <Outlet />
      )}
    </ClientOnly>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="isolate">
        <TooltipProvider>{children}</TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootError({ reset }: ErrorComponentProps) {
  return (
    <main className="desk-public">
      <section className="desk-account">
        <h1>Couldn’t open your desk.</h1>
        <Button onClick={reset}>Try again</Button>
      </section>
    </main>
  );
}
function NotFound() {
  return (
    <main className="desk-public">
      <section className="desk-account">
        <h1>Nothing here.</h1>
        <a href="/" className={buttonVariants()}>
          Go home
        </a>
      </section>
    </main>
  );
}
