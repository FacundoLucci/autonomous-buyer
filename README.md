# Autonomous Buyer

An autonomous purchasing workflow built on Convex.

Signup starts at `/setup` with Convex Auth 2.0 passkeys, followed by one-question-at-a-time company setup, a product link or invoice import, and purchasing email setup. Missing details are collected from the workspace. See [onboarding behavior and validation](docs/onboarding.md).

**Development review:** [Landing page](https://festive-coyote-483.convex.site/) · [Buy desk demo](https://festive-coyote-483.convex.site/?demo=1)

**Deployed production (older release):** https://reliable-albatross-463.convex.site

The demo dashboard is public. Select **Demo** or **Start walkthrough** to follow the
latest confirmed purchase without signing in or running any actions. Everyday
purchasing uses the same evidence without guide overlays. Shared resets, controlled recipient details,
buyer approval, and external email sends remain protected.

## App routes

| Address                         | Destination                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                             | Landing page for visitors; company workspace for signed-in members; setup for an unfinished account. Existing demo buyer accounts keep their demo desk. |
| `/landing`                      | Public landing page, including its interactive sample receipts.                                                                                         |
| `/setup`                        | Passkey signup first, then company and inventory-source setup.                                                                                          |
| `/setup?mode=login`             | Sign in, then return to the member's workspace.                                                                                                         |
| `/?demo=1`                      | Public Acme Foods buy desk, starting with Open buys.                                                                                                    |
| `/?demo=1&procurement=…&view=…` | A saved demo purchase, recommendation, approval, or order. Older purchase links without the demo flag also work.                                        |
| `/?demo=1&procurement=…&tour=0` | Guided demo; closing a shared tour returns to Open buys.                                                                                                |
| `/prototype`                    | Earlier design prototype, kept for reference.                                                                                                           |

New company workspaces support buy links, bulk invoice/file imports, approved purchase orders, supplier confirmations, partial receiving, downloadable order records, and verified email alerts. Older sources and completed orders remain accessible through pagination. See [company purchasing and email setup](docs/company-ordering.md).

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
pnpm test:backend
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
