---
name: EdgeOne migration
description: Architecture decisions and gotchas for the Crime Wire EdgeOne Makers deployment.
---

## Decision: deploy exclusively on EdgeOne, not Replit

The user has no Replit deployment. All production code targets EdgeOne Makers (Pages). The pnpm monorepo dev workflow stays intact for local development only.

## Directory structure (EdgeOne base dir: `artifacts/crime-wire/`)

- Cloud function: `cloud-functions/api/[[default]].js` — Express app, `export default app`, no `app.listen()`
- EdgeOne config: `edgeone.json` — build/install commands, output dir (`dist`), SPA rewrite, security headers
- Build output dir: `dist/` (NOT `dist/public/`)
- Lockfile: `package-lock.json` (npm, not pnpm) — must be committed so EdgeOne can run `npm ci`

## npm install gotcha

Running `npm install` inside `artifacts/crime-wire/` fails due to root workspace's husky prepare script. Use `--ignore-scripts` flag: `npm install --ignore-scripts --legacy-peer-deps`

## Storage: @edgeone/pages-blob

All data stored in Blob namespaces (cw-reports, cw-subs, cw-tips, etc.). Pattern: `all` key = JSON array; `seq` key = auto-increment ID; `cw-files` store for binary blobs. No PostgreSQL in production.

## Auth: cookie-based, no token in frontend state

- `POST /api/auth/login` accepts `{code}`, sets `cw_session` HttpOnly cookie (JWT, signed with SESSION_SECRET, 8h)
- `GET /api/auth/me` returns `{authenticated: bool}` — called on mount to restore session
- `POST /api/auth/logout` clears cookie
- Admin tabs receive NO token prop — credentials sent automatically via `credentials: "include"` on all fetch calls
- Rate limit: 5 attempts / 15 min / IP (in-memory, per function instance)

**Why:** EdgeOne Makers doesn't support Replit-style Bearer token auth flow. Cookie auth is stateless (JWT) but works naturally with HttpOnly cookies.

## Env vars (EdgeOne console only, never in files)

- `ADMIN_CODE` — required, the access code editors type at login
- `SESSION_SECRET` — required, must be ≥32 random chars (`openssl rand -hex 32`)
- `NODE_ENV=production` — recommended, controls secure cookie flags
- `VITE_EDITION_URL` — optional build-time var for QR code on homepage

## Public page hook removal

4 pages used `@workspace/api-client-react` TanStack Query hooks. All replaced with plain `useState(false)` loading state + direct `fetch('/api/...')`. Import line removed entirely. Package removed from package.json.

**Why:** @workspace/api-client-react is a pnpm workspace package — not resolvable by npm ci on EdgeOne.

## Build result

`npm run build` in `artifacts/crime-wire/` produces clean output: 1810 modules, ~622 KB JS, ~130 KB CSS. No TypeScript errors.
