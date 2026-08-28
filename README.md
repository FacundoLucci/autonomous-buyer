# Autonomous Buyer

An autonomous purchasing workflow built on Convex.

**Live demo:** https://reliable-albatross-463.convex.site

The dashboard is public. Select **Enter judge mode** for one-click access to the
completed procurement evidence. Shared resets, controlled recipient details,
buyer approval, and external email sends remain protected.

## Read first

- [Product spec](docs/product-spec.md)
- [Dependency-ordered implementation plan](docs/implementation-plan.md)
- [Hackathon evidence log](hackathon.md)

## Stack

- TanStack Start SPA built with Vite
- Convex backend and `@convex-dev/static-hosting`
- shadcn `base-nova` backed by Base UI, with the full catalog installed
- Tailwind CSS 4
- Oxlint, Oxfmt, and TypeScript static checks

## Local development

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts both Convex development and the Vite app. Use `pnpm dev:web`
only when Convex is already running. Convex writes the ignored `.env.local`
connection used by the browser.

## Static gates

```bash
pnpm lint
pnpm fmt:check
pnpm typecheck
pnpm build
```

There is intentionally no unit or comprehensive test suite. Product behavior is
proved through real user flows in a live browser.

## Deployment

`pnpm deploy` builds and uploads only `dist/client` to Convex static hosting,
but it performs real production writes. Run it only after the full live-browser
rehearsal and explicit deployment approval.

Production is currently served from
https://reliable-albatross-463.convex.site with its backend at
https://reliable-albatross-463.convex.cloud.
