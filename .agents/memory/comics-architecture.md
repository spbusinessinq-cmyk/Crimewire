---
name: Comics architecture
description: How The Funnies comic system works — public page, admin manager, API routes, DB table, and file serving in both dev and production.
---

# Comics Architecture

## Two-environment setup
- **Production (EdgeOne):** comics routes in `artifacts/crime-wire/cloud-functions/api/[[default]].js`; artwork stored in blob via `saveFile("comics/{filename}", ...)`, served at `/api/files/comics/:filename`
- **Local dev (api-server):** comics routes in `artifacts/api-server/src/routes/comics.ts`; artwork stored on disk at `artifacts/crime-wire/public/comics/`, served at `/api/files/comics/:filename` via express router

## DB schema (local dev only)
- Table: `comics` in `lib/db/src/schema/comics.ts`
- Fields: `id`, `series`, `episode`, `title`, `artworkUrl`, `caption`, `transcript`, `publishDate`, `status`, `sortOrder`, `createdAt`, `updatedAt`
- Push migration: `cd lib/db && pnpm run push`
- Exported from `lib/db/src/schema/index.ts`

## API route paths
- `GET /api/comics` — public, published strips only
- `GET /api/admin/comics` — admin all strips
- `POST /api/admin/comics` — create (multipart, `artwork` field)
- `PATCH /api/admin/comics/:id` — update (multipart)
- `DELETE /api/admin/comics/:id` — hard delete
- `GET /api/files/comics/:filename` — artwork serving

**Why:** AdminComics.tsx calls `api("/admin/comics")` paths; cloud function uses `/admin/comics` pattern; api-server mounts `comicsAdminRouter` at `/admin/comics` and `comicsPublicRouter` at `/comics`.

## Series keys
- `"ink-and-alibi"` — strips sorted desc by episode; idx=0 is newest/current
- `"morning-joe"` — same ordering

## Front-end
- Public page: `artifacts/crime-wire/src/pages/cw-the-funnies.tsx` — route `/crime-wire/the-funnies`
- Admin tab: `artifacts/crime-wire/src/pages/admin/AdminComics.tsx` — tab id `"comics"` labeled "The Funnies"
- Launch card shown when a series has zero published strips (not a blank or 404)
- Lightbox: click artwork, Escape to close, `role="dialog" aria-modal="true"`

## File URL format
Artwork URL stored as `/api/files/comics/{timestamp}-{safename}.ext` — same path in both dev and production.
