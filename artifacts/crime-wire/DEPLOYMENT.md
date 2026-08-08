# Los Angeles Crime Wire — EdgeOne Deployment Guide

Production site: **https://lacrimewire.online**

---

## Build settings (set once in EdgeOne console)

| Field | Value |
|---|---|
| Root / Base directory | `artifacts/crime-wire` |
| Install command | `pnpm install --frozen-lockfile --prod=false` |
| Build command | `pnpm run build` |
| Output directory | `dist` |
| Node version | any pnpm-9-compatible Node (18+) |

---

## Environment variables (set in EdgeOne → Settings → Environment)

| Variable | Purpose |
|---|---|
| `ADMIN_CODE` | Admin access code (e.g. your 4-digit code). Never hardcode. |
| `SESSION_SECRET` | Random string, 32+ chars, signs admin JWT cookies. Never hardcode. |

The function also accepts `ADMIN_PASSWORD` as a fallback for `ADMIN_CODE`.

---

## Custom domain

Add `lacrimewire.online` in EdgeOne → Domains.
EdgeOne provisions the TLS certificate automatically.
No extra edgeone.json changes needed for the domain.

---

## First deploy — run the seed

After the first successful deploy, seed the two public editions once:

1. Log in at `https://lacrimewire.online/admin` with your admin code.
2. Open browser DevTools → Network → copy your `cw_session` cookie value.
3. From any terminal:

```bash
curl -X POST https://lacrimewire.online/api/admin/seed \
     -H "Cookie: cw_session=PASTE_TOKEN_HERE"
```

Expected response: `{"seeded":true,"message":"Seeded 2 public editions.","count":2}`

Running it again is safe — it returns `seeded: false` if data already exists.

---

## Thursday Drop subscriber export

Admin → Mailing List, or:

```bash
curl https://lacrimewire.online/api/subscriptions?format=csv \
     -H "Cookie: cw_session=PASTE_TOKEN_HERE"
```

---

## Storage (EdgeOne Blob)

All data is stored in EdgeOne Blob — no separate database.
Stores: `cw-subs`, `cw-tips`, `cw-issues`, `cw-pressclub`, `cw-letters`,
`cw-corrections`, `cw-reports`, `cw-uploads`, `cw-casefiles`,
`cw-recsreqs`, `cw-advertisers`, `cw-files`, `cw-adminlog`, `cw-settings`.

Data survives cold starts, redeploys, and function restarts automatically.

---

## Edition PDFs

Static PDFs committed to `public/editions/` are served at `/editions/*.pdf`
by EdgeOne's static layer — no function call needed.

PDFs uploaded through the admin UI are stored in EdgeOne Blob (`cw-files`)
and served via `/api/files/editions/<filename>`.

---

## Health check

```bash
curl https://lacrimewire.online/api/healthz
```

Returns `{"ok":true,...}` when `ADMIN_CODE` and `SESSION_SECRET` are both set.
Returns `{"ok":false,...}` if either secret is missing.
