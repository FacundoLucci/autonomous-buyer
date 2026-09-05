# Autonomous Buyer

An autonomous purchasing workflow built on Convex.

**Development review:** [Current design and demo](https://festive-coyote-483.convex.site/?demo=1)

**Deployed production (older release):** https://reliable-albatross-463.convex.site

The dashboard is public. Select **Demo** or **Start walkthrough** to follow the
latest confirmed purchase without signing in or running any actions. Everyday
purchasing uses the same evidence without guide overlays. Shared resets, controlled recipient details,
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

Compact metric formatting has focused tests: `node --test src/components/buy-hard/metric-format.test.ts`.
Product behavior is checked through real user flows in a live browser.

## Deployment

For the configured development review site, run
`pnpm exec static-hosting upload --dev --dist dist/client --build-command "pnpm build"`.
This builds with the deployment's asset prefix and uploads the frontend.

`pnpm deploy` builds and uploads only `dist/client` to Convex static hosting,
but it performs real production writes. Run it only after the full live-browser
rehearsal and explicit deployment approval.

The older production release is served from
https://reliable-albatross-463.convex.site with its backend at
https://reliable-albatross-463.convex.cloud.
