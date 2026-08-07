import { Router } from "express";
import { db, newsroomSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import { z } from "zod";

const router = Router();

const ALLOWED_KEYS = new Set([
  "newsroom_status",
  "thursday_release_info",
  "standard_byline",
  "contact_email",
  "tagline",
  "edition_schedule",
  "city_desk_notice",
  "records_desk_notice",
  "homepage_notice",
]);

// GET /api/settings — admin; all settings
router.get("/", adminAuth, async (_req, res) => {
  const rows = await db.select().from(newsroomSettingsTable);
  const settings: Record<string, string | null> = {};
  for (const row of rows) {
    settings[row.key] = row.value ?? null;
  }
  res.json(settings);
});

// PUT /api/settings — admin; upsert a setting
router.put("/", adminAuth, async (req, res) => {
  const parsed = z.object({
    key: z.string().min(1),
    value: z.string().nullable(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "key and value are required" });
    return;
  }

  const { key, value } = parsed.data;

  if (!ALLOWED_KEYS.has(key)) {
    res.status(400).json({ error: `Unknown setting key: ${key}. Allowed: ${[...ALLOWED_KEYS].join(", ")}` });
    return;
  }

  // Upsert
  const existing = await db.select().from(newsroomSettingsTable).where(eq(newsroomSettingsTable.key, key));
  if (existing.length > 0) {
    await db.update(newsroomSettingsTable)
      .set({ value: value ?? null, updatedAt: new Date() })
      .where(eq(newsroomSettingsTable.key, key));
  } else {
    await db.insert(newsroomSettingsTable).values({ key, value: value ?? null });
  }

  res.json({ key, value });
});

export default router;
