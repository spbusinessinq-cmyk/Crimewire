# RSR Crime Division — EdgeOne Deployment Guide

## What This Is

The Crime Division app (Los Angeles Crime Wire) is configured to deploy on **Tencent EdgeOne Makers** (Pages). It uses:

- **Frontend:** React 19 + Vite 7, builds to `dist/`
- **API:** Node.js Cloud Function at `functions/api/[[default]].js` — handles all `/api/*` routes
- **Storage:** `@edgeone/pages-blob` — replaces Replit PostgreSQL; all data lives in EdgeOne Blob namespaces
- **Auth:** Signed HttpOnly cookie (`cw_session`) — no credentials in the frontend bundle

---

## EdgeOne Console Settings

When importing the repository, configure the **project settings** as follows:

| Setting | Value |
|---------|-------|
| **Base directory** | `artifacts/crime-wire` |
| **Install command** | `npm ci` |
| **Build command** | `npm run build` |
| **Output directory** | `dist` |
| **Node.js version** | `20.18.0` |

> The `edgeone.json` file in `artifacts/crime-wire/` defines these same settings and can override the console values.

---

## Required Environment Variables

Set these in the **EdgeOne project environment variables** panel. Never put them in code or the repository.

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_CODE` | **Yes** | The admin access code. Editors type this on the Bureau Login screen. Choose a strong, unique value — it is your only server-side authentication gate. |
| `SESSION_SECRET` | **Yes** | Secret used to sign session JWTs. Must be at least 32 random characters. Generate with: `openssl rand -hex 32` |
| `NODE_ENV` | Recommended | Set to `production`. Controls secure cookie flags. |

> **Security note:** `ADMIN_CODE` and `SESSION_SECRET` are read only on the server. They never appear in the compiled frontend, API responses, logs, or repository.

### Optional / as-needed

| Variable | Description |
|----------|-------------|
| `VITE_EDITION_URL` | Public URL of the current print edition PDF (used for QR code on the homepage). Set in EdgeOne as a **build-time** variable (prefix `VITE_`). |

---

## Blob Storage

Data is stored in `@edgeone/pages-blob` namespaces — no database setup required. The first successful API call to each namespace auto-creates it.

| Namespace | Contents |
|-----------|----------|
| `cw-reports` | City reports (full editorial workflow) |
| `cw-issues` | Crime Wire edition metadata |
| `cw-subs` | Email newsletter subscribers |
| `cw-pressclub` | Press Club + Print Waitlist |
| `cw-tips` | Reader tips |
| `cw-letters` | Reader letters / submissions |
| `cw-corrections` | Published corrections |
| `cw-casefiles` | Investigative case files |
| `cw-uploads` | Upload metadata records |
| `cw-recsreqs` | FOIA/CPRA request tracking |
| `cw-advertisers` | Advertiser records |
| `cw-adminlog` | Immutable admin audit log (capped at 500 entries) |
| `cw-settings` | Newsroom key-value settings |
| `cw-files` | Binary files: `editions/{filename}` and `uploads/{filename}` |

Storage is initialized empty on first deploy. **Do not copy** subscriber lists, uploaded evidence, or development test data into production.

---

## API Routes

All routes are served under `/api/`. Same-origin — no CORS required.

### Auth (no auth required)
- `POST /api/auth/login` — submit access code, receive `cw_session` cookie
- `POST /api/auth/logout` — clear session cookie
- `GET /api/auth/me` — check if session is active (`{ authenticated: true/false }`)

### Public
- `GET /api/healthz` — non-secret health check
- `POST /api/subscriptions` — newsletter signup
- `POST /api/tips` — tip submission
- `POST /api/letters` — reader letter / submission
- `POST /api/press-club` — Press Club / waitlist signup
- `GET /api/reports` — published reports (filterable by `?placement=`)
- `GET /api/reports/:id` — single report (public fields only)
- `GET /api/issues` — published/archived Crime Wire editions
- `GET /api/issues/latest` — most recent published issue
- `GET /api/corrections` — published corrections
- `GET /api/case-files` — public case files
- `GET /api/case-files/:id` — single public case file with linked reports
- `GET /api/files/editions/:filename` — stream edition PDF
- `GET /api/files/uploads/:filename` — stream approved public upload

### Admin (requires `cw_session` cookie)
All admin routes return 401 if the cookie is missing or expired.

---

## Admin Auth Security

- Sessions are JWT-signed with `SESSION_SECRET`, valid for **8 hours**
- Cookies are `HttpOnly`, `Secure`, `SameSite=Strict` — inaccessible to JavaScript
- Failed logins are rate-limited to **5 attempts per 15 minutes per IP** (per function instance)
- The access code is compared server-side only and never reflected in responses or logs

---

## SPA Routing

The `edgeone.json` `rewrites` rule sends all non-API, non-asset paths to `index.html`. This supports React Router (wouter) routes like `/city-desk`, `/admin`, `/case-files`, `/report/:id`, etc.

---

## Existing Static Edition PDFs

PDF editions already committed to `artifacts/crime-wire/public/editions/` are served as static files from `dist/editions/` by EdgeOne's CDN — no change needed. New editions uploaded via the Admin Desk are stored in Blob and served via `/api/files/editions/:filename`.

---

## Development (Replit)

The pnpm monorepo and Replit workflows continue to work for local development:

```bash
pnpm --filter @workspace/crime-wire run dev      # Frontend dev server
pnpm --filter @workspace/api-server run dev      # Express API (PostgreSQL, Bearer auth)
```

The EdgeOne cloud function (`functions/api/`) is production-only. In development, the existing Express API (`artifacts/api-server/`) serves requests.

---

## Deploying an Update

1. Make changes in Replit
2. Commit and push to `main` on GitHub (manually)
3. EdgeOne automatically rebuilds and deploys

There is no Replit deployment step.
