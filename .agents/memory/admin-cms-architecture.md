---
name: Admin CMS Architecture
description: How the Admin Desk is structured — shell + sub-component pattern, auth flow, navigation.
---

# Admin CMS Architecture

## Structure
- `artifacts/crime-wire/src/pages/admin.tsx` — shell only: login gate, tab nav (desktop/tablet/mobile), renders sub-components
- `artifacts/crime-wire/src/pages/admin/` — one file per tab section
- `artifacts/crime-wire/src/pages/admin/shared.tsx` — all shared utilities: `api()`, `apiForm()`, `Badge`, `Btn`, `Field`, `Spinner`, CSS class constants, `fmtDate`, `fmtDateTime`, `downloadCsv`

## Auth pattern
- Password held in React state in admin.tsx; passed as `token` prop to each sub-component
- All API calls use `Authorization: Bearer ${token}` header
- Auth verified server-side on every request via `adminAuth` middleware

## Tab IDs
dashboard | reports | case-files | uploads | crime-wire | reader-inbox | mailing-list | advertisers | corrections | settings

## Navigation
- Desktop: full tab bar in header
- Tablet (md): short label tab bar
- Mobile: hamburger → slide-out drawer
- `onNavigate(tabId)` prop on Dashboard for quick action buttons

**Why:** Breaking admin into separate files keeps each component under ~300 lines and avoids one giant file becoming unworkable.

**How to apply:** Add new admin sections as a new file in `admin/` dir, import it in `admin.tsx`, add to TABS array and the render block.
