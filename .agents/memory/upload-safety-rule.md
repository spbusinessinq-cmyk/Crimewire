---
name: Upload Safety Rule
description: Uploads never auto-publish — both visibility AND approved_for_publication must be explicitly set.
---

# Upload Safety Rule

## Rule
An uploaded file is NEVER publicly visible by default. Two conditions must both be true for a file to be public:
1. `visibility` must be set to `"public"` (not `"internal_only"` or `"redacted_public"`)
2. `approvedForPublication` must be explicitly set to `true` via a PATCH request

## Implementation
- `approvedForPublication` defaults to `false` on insert (hardcoded in route, not schema default)
- The upload form UI does not expose the `public` visibility option at upload time — only `internal_only` or `redacted_public`
- The admin edit UI shows a prominent "Approved for Publication" checkbox

**Why:** Prevents accidental publication of sensitive records, scans, or evidence that was uploaded for internal review.

**How to apply:** Any new upload flow must preserve these defaults. Never set approvedForPublication=true automatically.
