---
name: Reports API Design
description: How the reports table and API work — placement, public vs admin routes, status workflow.
---

# Reports API Design

## Placement
- `placement` column is a JSON text string: `{"city_desk":true,"homepage":false,...}`
- Public GET `/api/reports` accepts `?placement=city_desk` query param and filters in-process
- Admin GET `/api/reports/all/list` returns all reports regardless of status

## Status workflow
- draft → needs_review → scheduled → published → developing / updated / corrected → archived
- Publishing: sets `publishedAt` timestamp on first publish only
- Archiving: soft-delete via DELETE endpoint (sets status=archived, not a real delete)
- Public endpoint: returns published | developing | updated | corrected only

## Update / Correction pattern
- PATCH with `updateSummary` → appends to `update_history` JSON array, sets status=updated
- PATCH with `correctionSummary` + `correctionNotice` → appends to `correction_history`, sets status=corrected
- `correctionNotice` is shown publicly on City Desk listing and report page

## Developing stories
- `isDeveloping: true` → shown with animated red dot on City Desk
- Updates via PATCH accumulate in `updateHistory` array shown as timeline on report page

**Why:** Placement as JSON avoids needing a junction table while keeping queries simple. Status enum drives both editorial workflow and public visibility.
