import { Router } from "express";
import { db, correctionsTable } from "@workspace/db";
import { isNotNull, desc, eq } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import { z } from "zod";

const router = Router();

// GET /api/corrections — public; returns published corrections only
router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(correctionsTable)
    .where(isNotNull(correctionsTable.publishedAt))
    .orderBy(desc(correctionsTable.publishedAt));

  res.json(rows.map(formatCorrection));
});

// GET /api/corrections/all — admin; returns all corrections including drafts
router.get("/all", adminAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(correctionsTable)
    .orderBy(desc(correctionsTable.createdAt));

  res.json(rows.map(formatCorrection));
});

// POST /api/corrections — admin; create a correction
router.post("/", adminAuth, async (req, res) => {
  const CreateSchema = z.object({
    issueLabel: z.string().optional(),
    section: z.string().optional(),
    originalText: z.string().min(1, "Original text is required"),
    correctedText: z.string().min(1, "Corrected text is required"),
    adminNote: z.string().optional(),
    publish: z.boolean().default(false),
  });

  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { issueLabel, section, originalText, correctedText, adminNote, publish } = parsed.data;

  try {
    const [row] = await db
      .insert(correctionsTable)
      .values({
        issueLabel: issueLabel ?? null,
        section: section ?? null,
        originalText: originalText.trim(),
        correctedText: correctedText.trim(),
        adminNote: adminNote ?? null,
        publishedAt: publish ? new Date() : null,
      })
      .returning();

    res.status(201).json(formatCorrection(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create correction");
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/corrections/:id — admin; update or publish
router.patch("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const UpdateSchema = z.object({
    issueLabel: z.string().optional(),
    section: z.string().optional(),
    originalText: z.string().optional(),
    correctedText: z.string().optional(),
    adminNote: z.string().optional(),
    publish: z.boolean().optional(),
  });

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const updateValues: Partial<typeof correctionsTable.$inferInsert> = {};
  const data = parsed.data;
  if ("issueLabel" in data) updateValues.issueLabel = data.issueLabel ?? null;
  if ("section" in data) updateValues.section = data.section ?? null;
  if (data.originalText) updateValues.originalText = data.originalText;
  if (data.correctedText) updateValues.correctedText = data.correctedText;
  if ("adminNote" in data) updateValues.adminNote = data.adminNote ?? null;
  if (data.publish === true) updateValues.publishedAt = new Date();
  else if (data.publish === false) updateValues.publishedAt = null;

  const [row] = await db
    .update(correctionsTable)
    .set(updateValues)
    .where(eq(correctionsTable.id, id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Correction not found" });
    return;
  }
  res.json(formatCorrection(row));
});

function formatCorrection(r: typeof correctionsTable.$inferSelect) {
  return {
    id: r.id,
    issueLabel: r.issueLabel ?? null,
    section: r.section ?? null,
    originalText: r.originalText,
    correctedText: r.correctedText,
    adminNote: r.adminNote ?? null,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
