---
name: DB Schema Conventions
description: Zod import quirk and drizzle-orm import patterns for this project.
---

# DB Schema Conventions

## Zod imports
- Schema files (`lib/db/src/schema/`) use `import { z } from "zod/v4"` 
- Route handlers (`artifacts/api-server/src/routes/`) use `import { z } from "zod"` (plain — direct dep of api-server)
- OpenAPI-generated hooks use `@workspace/api-zod`

## Drizzle ORM imports
- `inArray`, `eq`, `desc`, `and`, etc. all imported from `"drizzle-orm"` at the top of the file
- Do NOT use dynamic `await import("drizzle-orm")` inside route handlers — import at top level

## DB push
- Run: `pnpm --filter @workspace/db run push` after schema changes
- Drizzle uses `pg` driver; connection via `DATABASE_URL` env var

**Why:** Zod v4 is installed as a subpath export in lib/db but api-server has a direct `"zod"` dependency pointing to v4. Mixing import paths causes type errors.
