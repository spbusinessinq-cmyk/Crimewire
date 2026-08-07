import { Router } from "express";
import { db, reportsTable, adminLogTable } from "@workspace/db";
import { eq, desc, inArray, and } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import { isAdminRequest } from "../lib/session-key";
import { z } from "zod";

const router = Router();

const ReportSchema = z.object({
  type: z.enum([
    "crime_brief", "incident_report", "breaking", "court_update",
    "arrest", "field_dispatch", "records_update", "community_safety",
    "follow_up", "correction_report",
  ]),
  status: z.enum([
    "draft", "needs_review", "scheduled", "published",
    "developing", "updated", "corrected", "archived",
  ]).default("draft"),
  headline: z.string().min(1, "Headline is required"),
  deck: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional().default("Los Angeles"),
  incidentDate: z.string().optional(),
  publishDate: z.string().optional(),
  byline: z.string().optional(),
  body: z.string().default(""),
  agenciesInvolved: z.string().optional(),
  caseNumber: z.string().optional(),
  reportNumber: z.string().optional(),
  sourceLinks: z.string().optional(),
  evidenceStatus: z.string().optional(),
  featuredImageUrl: z.string().optional(),
  internalNotes: z.string().optional(),
  relatedCaseFileId: z.coerce.number().int().positive().optional(),
  placement: z.string().optional().default("{}"),
  isDeveloping: z.boolean().optional().default(false),
  correctionNotice: z.string().optional(),
});

// Shared log helper
async function logAction(
  action: string,
  entityType: string,
  entityId: number,
  entityTitle: string,
  details?: object
) {
  await db.insert(adminLogTable).values({
    action,
    entityType,
    entityId,
    entityTitle,
    details: details ? JSON.stringify(details) : null,
  });
}

// GET /api/reports — public; returns published reports ordered newest first
router.get("/", async (req, res) => {
  const placement = (req.query as { placement?: string }).placement;

  let rows = await db
    .select()
    .from(reportsTable)
    .where(inArray(reportsTable.status, ["published", "developing", "updated", "corrected"]))
    .orderBy(desc(reportsTable.publishedAt));

  // Filter by placement if requested
  if (placement) {
    rows = rows.filter((r) => {
      try {
        const p = JSON.parse(r.placement || "{}");
        return !!p[placement];
      } catch {
        return false;
      }
    });
  }

  res.json(rows.map(formatReport));
});

// GET /api/reports/:id — public; single published report
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db.select().from(reportsTable).where(eq(reportsTable.id, id));
  if (!row) { res.status(404).json({ error: "Report not found" }); return; }

  const publicStatuses = ["published", "developing", "updated", "corrected"];
  const isAdmin = await isAdminRequest(req as any);

  if (!publicStatuses.includes(row.status) && !isAdmin) {
    res.status(404).json({ error: "Report not found" }); return;
  }

  res.json(formatReport(row, isAdmin ? true : false));
});

// GET /api/reports/all — admin; all reports
router.get("/all/list", adminAuth, async (req, res) => {
  const rows = await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt));
  res.json(rows.map((r) => formatReport(r, true)));
});

// POST /api/reports — admin; create report
router.post("/", adminAuth, async (req, res) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const d = parsed.data;
  const now = new Date();

  try {
    const values: typeof reportsTable.$inferInsert = {
      type: d.type,
      status: d.status,
      headline: d.headline,
      deck: d.deck ?? null,
      neighborhood: d.neighborhood ?? null,
      city: d.city ?? "Los Angeles",
      incidentDate: d.incidentDate ? new Date(d.incidentDate) : null,
      publishDate: d.publishDate ? new Date(d.publishDate) : null,
      byline: d.byline ?? null,
      body: d.body,
      agenciesInvolved: d.agenciesInvolved ?? null,
      caseNumber: d.caseNumber ?? null,
      reportNumber: d.reportNumber ?? null,
      sourceLinks: d.sourceLinks ?? null,
      evidenceStatus: d.evidenceStatus ?? null,
      featuredImageUrl: d.featuredImageUrl ?? null,
      internalNotes: d.internalNotes ?? null,
      relatedCaseFileId: d.relatedCaseFileId ?? null,
      placement: d.placement ?? "{}",
      isDeveloping: d.isDeveloping ?? false,
      correctionNotice: d.correctionNotice ?? null,
      publishedAt: d.status === "published" ? now : null,
      updatedAt: now,
    };

    const [row] = await db.insert(reportsTable).values(values).returning();
    await logAction("create", "report", row.id, row.headline, { status: row.status });
    res.status(201).json(formatReport(row, true));
  } catch (err) {
    req.log.error({ err }, "Failed to create report");
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/reports/:id — admin; update report
router.patch("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const UpdateSchema = ReportSchema.partial().extend({
    updateSummary: z.string().optional(),  // adds an entry to update_history
    correctionSummary: z.string().optional(),
  });

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [existing] = await db.select().from(reportsTable).where(eq(reportsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Report not found" }); return; }

  const d = parsed.data;
  const now = new Date();

  // Build update_history if status changes to updated or a summary provided
  let updateHistory = existing.updateHistory || "[]";
  if (d.updateSummary || (d.status === "updated" && existing.status !== "updated")) {
    const history = JSON.parse(updateHistory);
    history.push({ timestamp: now.toISOString(), summary: d.updateSummary || "Updated", editor: "admin" });
    updateHistory = JSON.stringify(history);
  }

  // Build correction_history
  let correctionHistory = existing.correctionHistory || "[]";
  if (d.correctionSummary || d.status === "corrected") {
    const history = JSON.parse(correctionHistory);
    history.push({ timestamp: now.toISOString(), summary: d.correctionSummary || "Corrected", editor: "admin" });
    correctionHistory = JSON.stringify(history);
  }

  const updateValues: Partial<typeof reportsTable.$inferInsert> = {
    updatedAt: now,
    updateHistory,
    correctionHistory,
  };

  if ("type" in d && d.type) updateValues.type = d.type;
  if ("status" in d && d.status) {
    updateValues.status = d.status;
    if (d.status === "published" && !existing.publishedAt) updateValues.publishedAt = now;
    if (d.status === "archived" || d.status === "draft") updateValues.publishedAt = existing.publishedAt;
  }
  if ("headline" in d && d.headline) updateValues.headline = d.headline;
  if ("deck" in d) updateValues.deck = d.deck ?? null;
  if ("neighborhood" in d) updateValues.neighborhood = d.neighborhood ?? null;
  if ("city" in d) updateValues.city = d.city ?? null;
  if ("incidentDate" in d) updateValues.incidentDate = d.incidentDate ? new Date(d.incidentDate) : null;
  if ("publishDate" in d) updateValues.publishDate = d.publishDate ? new Date(d.publishDate) : null;
  if ("byline" in d) updateValues.byline = d.byline ?? null;
  if ("body" in d && d.body !== undefined) updateValues.body = d.body;
  if ("agenciesInvolved" in d) updateValues.agenciesInvolved = d.agenciesInvolved ?? null;
  if ("caseNumber" in d) updateValues.caseNumber = d.caseNumber ?? null;
  if ("reportNumber" in d) updateValues.reportNumber = d.reportNumber ?? null;
  if ("sourceLinks" in d) updateValues.sourceLinks = d.sourceLinks ?? null;
  if ("evidenceStatus" in d) updateValues.evidenceStatus = d.evidenceStatus ?? null;
  if ("featuredImageUrl" in d) updateValues.featuredImageUrl = d.featuredImageUrl ?? null;
  if ("internalNotes" in d) updateValues.internalNotes = d.internalNotes ?? null;
  if ("relatedCaseFileId" in d) updateValues.relatedCaseFileId = d.relatedCaseFileId ?? null;
  if ("placement" in d) updateValues.placement = d.placement ?? "{}";
  if ("isDeveloping" in d) updateValues.isDeveloping = d.isDeveloping ?? false;
  if ("correctionNotice" in d) updateValues.correctionNotice = d.correctionNotice ?? null;

  const [row] = await db.update(reportsTable).set(updateValues).where(eq(reportsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Report not found" }); return; }

  await logAction("update", "report", row.id, row.headline, {
    oldStatus: existing.status,
    newStatus: row.status,
  });

  res.json(formatReport(row, true));
});

// DELETE /api/reports/:id — admin; soft-delete by archiving
router.delete("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .update(reportsTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(reportsTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Report not found" }); return; }
  await logAction("archive", "report", row.id, row.headline);
  res.json({ ok: true });
});

function formatReport(r: typeof reportsTable.$inferSelect, includeInternal = false) {
  const base: Record<string, unknown> = {
    id: r.id,
    type: r.type,
    status: r.status,
    headline: r.headline,
    deck: r.deck ?? null,
    neighborhood: r.neighborhood ?? null,
    city: r.city ?? "Los Angeles",
    incidentDate: r.incidentDate?.toISOString() ?? null,
    publishDate: r.publishDate?.toISOString() ?? null,
    byline: r.byline ?? null,
    body: r.body,
    agenciesInvolved: r.agenciesInvolved ?? null,
    caseNumber: r.caseNumber ?? null,
    reportNumber: r.reportNumber ?? null,
    sourceLinks: r.sourceLinks ?? null,
    evidenceStatus: r.evidenceStatus ?? null,
    featuredImageUrl: r.featuredImageUrl ?? null,
    relatedCaseFileId: r.relatedCaseFileId ?? null,
    placement: r.placement ?? "{}",
    isDeveloping: r.isDeveloping,
    updateHistory: r.updateHistory ?? "[]",
    correctionNotice: r.correctionNotice ?? null,
    correctionHistory: r.correctionHistory ?? "[]",
    publishedAt: r.publishedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
  if (includeInternal) {
    base.internalNotes = r.internalNotes ?? null;
  }
  return base;
}

export default router;
