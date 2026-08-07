# Los Angeles Crime Wire

An independent weekly crime and investigative newspaper from RSR Crime Division. Published every Thursday. This site is the digital home of the paper — subscription signup, the Black Dahlia front-page lead (BDH-002), reader tips desk, and a private admin area.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at /api)
- `pnpm --filter @workspace/crime-wire run dev` — run the Crime Wire frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)
- Required secret: `ADMIN_PASSWORD` — protects the /admin area (Bearer token)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7, Tailwind CSS v4, wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod v3 (server uses @workspace/api-zod generated schemas)
- API codegen: Orval (from OpenAPI spec in lib/api-spec/openapi.yaml)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/subscriptions.ts` — subscriptions table schema
- `lib/db/src/schema/tips.ts` — reader tips table schema
- `artifacts/api-server/src/routes/subscriptions.ts` — POST/GET /api/subscriptions
- `artifacts/api-server/src/routes/tips.ts` — POST/GET /api/tips
- `artifacts/crime-wire/src/` — frontend source (React components, pages, CSS)
- Admin area: `/admin` route in the frontend, password-gated via Bearer token

## Architecture decisions

- Admin auth is a simple Bearer token checked against ADMIN_PASSWORD env secret. No JWT, no sessions — the admin area is owner-only.
- Email validation is done in the route handler (not Zod schema) because Orval/Zod v3 doesn't support `format: email` in the OpenAPI spec without generating Zod v4 API calls.
- Duplicate email returns HTTP 409 (detected by Postgres unique constraint, error code 23505).
- Mailed copy is explicitly a waitlist — no payment processing built in.
- CSV export for subscriptions is served directly from the API with Content-Disposition attachment header.

## Product

- Landing page for the Crime Wire weekly newspaper
- BDH-002 Black Dahlia investigation front page lead ("The Missing Exit")
- Thursday Drop subscription form (digital edition, mailed copy waitlist, or both)
- Reader Desk tip submission form
- 10-section weekly paper structure explained
- Admin area at /admin: review and export subscriptions and tips

## User preferences

- The Black Dahlia content (BDH-002) stays front page
- Nostalgia/authentic 1940s tabloid aesthetic is the core visual identity
- "Wanna read more? Scan this code" — QR code prominently featured
- Pure white paper, pure black ink — no cream, no gradients, no rounded SaaS cards

## Gotchas

- After OpenAPI spec changes, always run codegen before touching any route or frontend code
- The Zod v3 catalog entry means `format: email` → `zod.email()` fails typecheck. Use plain `type: string` and validate in the route handler instead.
- Use `zod` (not `zod/v4`) in api-server routes — zod/v4 is not in the server's dependencies
- DB schema changes: run `pnpm --filter @workspace/db run push` then `pnpm run typecheck:libs` before leaf artifact checks

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
