import { Router } from "express";
import { db, recordsRequestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import { z } from "zod";

const router = Router();

const RecordSchema = z.object({
  title: z.string().min(1, "Title is required"),
  agency: z.string().optional(),
  requestDate: z.string().optional(),
  responseDue: z.string().optional(),
  responseDate: z.string().optional(),
  status: z.enum(["pending", "submitted", "partial", "fulfilled", "denied", "withdrawn"]).default("pending"),
  documentsReceived: z.string().optional(),
  publicVersionAvailable: z.boolean().default(false),
  internalNotes: z.string().optional(),
  relatedCaseId: z.coerce.number().int().positive().optional(),
});

// GET /api/records-requests — admin only
router.get("/", adminAuth, async (_req, res) => {
  const rows = await db.select().from(recordsRequestsTable).orderBy(desc(recordsRequestsTable.createdAt));
  res.json(rows.map(fmt));
});

// POST /api/records-requests — admin only
router.post("/", adminAuth, async (req, res) => {
  const parsed = RecordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const d = parsed.data;
  const [row] = await db.insert(recordsRequestsTable).values({
    title: d.title,
    agency: d.agency ?? null,
    requestDate: d.requestDate ? new Date(d.requestDate) : null,
    responseDue: d.responseDue ? new Date(d.responseDue) : null,
    responseDate: d.responseDate ? new Date(d.responseDate) : null,
    status: d.status,
    documentsReceived: d.documentsReceived ?? null,
    publicVersionAvailable: d.publicVersionAvailable,
    internalNotes: d.internalNotes ?? null,
    relatedCaseId: d.relatedCaseId ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

// PATCH /api/records-requests/:id — admin only
router.patch("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = RecordSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const d = parsed.data;
  const updateValues: Partial<typeof recordsRequestsTable.$inferInsert> = { updatedAt: new Date() };
  if ("title" in d && d.title) updateValues.title = d.title;
  if ("agency" in d) updateValues.agency = d.agency ?? null;
  if ("requestDate" in d) updateValues.requestDate = d.requestDate ? new Date(d.requestDate) : null;
  if ("responseDue" in d) updateValues.responseDue = d.responseDue ? new Date(d.responseDue) : null;
  if ("responseDate" in d) updateValues.responseDate = d.responseDate ? new Date(d.responseDate) : null;
  if ("status" in d && d.status) updateValues.status = d.status;
  if ("documentsReceived" in d) updateValues.documentsReceived = d.documentsReceived ?? null;
  if ("publicVersionAvailable" in d && typeof d.publicVersionAvailable === "boolean") updateValues.publicVersionAvailable = d.publicVersionAvailable;
  if ("internalNotes" in d) updateValues.internalNotes = d.internalNotes ?? null;
  if ("relatedCaseId" in d) updateValues.relatedCaseId = d.relatedCaseId ?? null;

  const [row] = await db.update(recordsRequestsTable).set(updateValues).where(eq(recordsRequestsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Record not found" }); return; }
  res.json(fmt(row));
});

function fmt(r: typeof recordsRequestsTable.$inferSelect) {
  return {
    id: r.id,
    title: r.title,
    agency: r.agency ?? null,
    requestDate: r.requestDate?.toISOString() ?? null,
    responseDue: r.responseDue?.toISOString() ?? null,
    responseDate: r.responseDate?.toISOString() ?? null,
    status: r.status,
    documentsReceived: r.documentsReceived ?? null,
    publicVersionAvailable: r.publicVersionAvailable,
    internalNotes: r.internalNotes ?? null,
    relatedCaseId: r.relatedCaseId ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export default router;
