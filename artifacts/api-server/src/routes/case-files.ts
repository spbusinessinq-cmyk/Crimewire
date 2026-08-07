import { Router } from "express";
import { db, caseFilesTable, reportsTable, adminLogTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import { isAdminRequest } from "../lib/session-key";
import { z } from "zod";

const router = Router();

const CaseFileSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
  title: z.string().min(1, "Title is required"),
  status: z.enum(["open", "cold", "closed", "referred", "active_investigation"]).default("open"),
  summary: z.string().optional(),
  chronology: z.string().optional(),
  investigativeNotes: z.string().optional(),
  isPublic: z.boolean().default(false),
  internalNotes: z.string().optional(),
});

// GET /api/case-files — public; returns public case files only
router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(caseFilesTable)
    .where(eq(caseFilesTable.isPublic, true))
    .orderBy(desc(caseFilesTable.updatedAt));

  res.json(rows.map((r) => formatCaseFile(r, false)));
});

// GET /api/case-files/all — admin; all case files
router.get("/all", adminAuth, async (_req, res) => {
  const rows = await db.select().from(caseFilesTable).orderBy(desc(caseFilesTable.updatedAt));
  res.json(rows.map((r) => formatCaseFile(r, true)));
});

// GET /api/case-files/:id — public or admin
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const isAdmin = await isAdminRequest(req as any);

  const [row] = await db.select().from(caseFilesTable).where(eq(caseFilesTable.id, id));
  if (!row) { res.status(404).json({ error: "Case file not found" }); return; }
  if (!row.isPublic && !isAdmin) { res.status(404).json({ error: "Case file not found" }); return; }

  // Also fetch linked reports
  const linkedReports = await db
    .select({
      id: reportsTable.id,
      headline: reportsTable.headline,
      status: reportsTable.status,
      type: reportsTable.type,
      publishedAt: reportsTable.publishedAt,
    })
    .from(reportsTable)
    .where(eq(reportsTable.relatedCaseFileId, id));

  res.json({ ...formatCaseFile(row, !!isAdmin), linkedReports });
});

// POST /api/case-files — admin
router.post("/", adminAuth, async (req, res) => {
  const parsed = CaseFileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const [row] = await db.insert(caseFilesTable).values({
      ...parsed.data,
      summary: parsed.data.summary ?? null,
      chronology: parsed.data.chronology ?? null,
      investigativeNotes: parsed.data.investigativeNotes ?? null,
      internalNotes: parsed.data.internalNotes ?? null,
    }).returning();

    await db.insert(adminLogTable).values({
      action: "create",
      entityType: "case_file",
      entityId: row.id,
      entityTitle: `${row.identifier} — ${row.title}`,
    });

    res.status(201).json(formatCaseFile(row, true));
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === "23505") {
      res.status(409).json({ error: "A case file with that identifier already exists." });
      return;
    }
    req.log.error({ err }, "Failed to create case file");
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/case-files/:id — admin
router.patch("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = CaseFileSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const updateValues: Partial<typeof caseFilesTable.$inferInsert> = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  const [row] = await db.update(caseFilesTable).set(updateValues).where(eq(caseFilesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Case file not found" }); return; }

  await db.insert(adminLogTable).values({
    action: "update",
    entityType: "case_file",
    entityId: row.id,
    entityTitle: `${row.identifier} — ${row.title}`,
  });

  res.json(formatCaseFile(row, true));
});

function formatCaseFile(r: typeof caseFilesTable.$inferSelect, includeInternal: boolean) {
  const base: Record<string, unknown> = {
    id: r.id,
    identifier: r.identifier,
    title: r.title,
    status: r.status,
    summary: r.summary ?? null,
    chronology: r.chronology ?? null,
    isPublic: r.isPublic,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
  if (includeInternal) {
    base.investigativeNotes = r.investigativeNotes ?? null;
    base.internalNotes = r.internalNotes ?? null;
  }
  return base;
}

export default router;
