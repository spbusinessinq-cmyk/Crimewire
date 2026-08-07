import { Router } from "express";
import { db, lettersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import { z } from "zod";

const router = Router();

const CreateLetterSchema = z.object({
  type: z.enum(["letter", "spotlight", "ask", "art", "puzzle_answer", "wire_hunt", "tip"]),
  nameOrAlias: z.string().optional(),
  contactEmail: z
    .string()
    .email("Valid email required")
    .optional()
    .or(z.literal("")),
  body: z.string().min(5, "Submission must be at least 5 characters"),
  extra: z.string().optional(),
  source: z.string().optional(),
  consentToPublish: z.boolean().default(false),
});

// POST /api/letters — public; any reader desk submission
router.post("/", async (req, res) => {
  const parsed = CreateLetterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { type, nameOrAlias, contactEmail, body, extra, source, consentToPublish } = parsed.data;

  try {
    const [row] = await db
      .insert(lettersTable)
      .values({
        type,
        nameOrAlias: nameOrAlias ?? null,
        contactEmail: contactEmail || null,
        body: body.trim(),
        extra: extra ?? null,
        source: source ?? null,
        consentToPublish,
        status: "pending",
      })
      .returning();

    res.status(201).json({
      id: row.id,
      type: row.type,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create letter");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/letters — admin; all submissions
router.get("/", adminAuth, async (req, res) => {
  const typeFilter = (req.query as { type?: string }).type;
  let query = db.select().from(lettersTable).orderBy(desc(lettersTable.createdAt)).$dynamic();

  if (typeFilter) {
    query = query.where(eq(lettersTable.type, typeFilter));
  }

  const rows = await query;
  res.json(
    rows.map((r) => ({
      id: r.id,
      type: r.type,
      nameOrAlias: r.nameOrAlias ?? null,
      contactEmail: r.contactEmail ?? null,
      body: r.body,
      extra: r.extra ?? null,
      source: r.source ?? null,
      consentToPublish: r.consentToPublish,
      status: r.status,
      adminNote: r.adminNote ?? null,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

// PATCH /api/letters/:id — admin; update status or admin note
router.patch("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const UpdateSchema = z.object({
    status: z.enum(["pending", "approved", "rejected", "published"]).optional(),
    adminNote: z.string().optional(),
  });

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [row] = await db
    .update(lettersTable)
    .set(parsed.data)
    .where(eq(lettersTable.id, id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.json({ id: row.id, status: row.status, adminNote: row.adminNote ?? null });
});

export default router;
