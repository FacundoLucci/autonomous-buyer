import type { QueryClient } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  ClientOnly,
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import { Button, buttonVariants } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import appCss from "@/styles/app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#090b0b" },
      { title: "BUY HARD — Buy Desk" },
      {
        name: "description",
        content:
          "Your buy desk. Stay ahead of stockouts, compare quotes, and keep procurement moving.",
      },
    ],
    links: [
      { rel: "stylesheet", href: `${import.meta.env.BASE_URL}textures/powder-coat.css` },
      { rel: "stylesheet", href: `${import.meta.env.BASE_URL}textures/screen-print.css` },
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='3' fill='%23090b0b'/%3E%3Cpath fill='%23fbf6ea' d='M5 7h7v2H7v6h5v2H7v6h5v2H5zm7 2h2v6h-2zm0 8h2v6h-2zm6-10h2v8h5V7h2v18h-2v-8h-5v8h-2z'/%3E%3C/svg%3E",
        type: "image/svg+xml",
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    // Keep static hosting's empty shell identical through the first client render.
    <ClientOnly>
      <Outlet />
    </ClientOnly>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
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
    <div className="bh-app powder-coat">
      <header className="bh-app-bar text-xl tracking-widest">
        <span className="bh-stamped">BUY HARD</span>
      </header>
      <main className="flex min-h-[70svh] items-center justify-center px-5 py-12">
        <div className="bh-eink bh-cutout w-full max-w-md space-y-5 p-8">
          <p className="bh-kicker">Display interrupted</p>
          <h1 className="text-xl font-semibold">The buy desk could not load.</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Try loading it again to pick up where you left off.
          </p>
          <Button onClick={reset}>Try again</Button>
        </div>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="bh-app powder-coat">
      <header className="bh-app-bar text-xl tracking-widest">
        <span className="bh-stamped">BUY HARD</span>
      </header>
      <main className="flex min-h-[70svh] items-center justify-center px-5 py-12">
        <div className="bh-eink bh-cutout w-full max-w-md space-y-5 p-8">
          <p className="bh-kicker">404 / Page not found</p>
          <h1 className="text-xl font-semibold">Nothing at this address.</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Head back to your buy desk to keep things moving.
          </p>
          <a href="/" className={buttonVariants()} data-variant="default">
            Open buy desk
          </a>
        </div>
      </main>
    </div>
  );
}
