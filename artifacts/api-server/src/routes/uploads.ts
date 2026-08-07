import { Router } from "express";
import { db, uploadsTable, adminLogTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";

const router = Router();

// Uploads directory — shared with crime-wire public for now
const uploadsDir = path.resolve(process.cwd(), "artifacts/crime-wire/public/uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "audio/mpeg", "audio/mp4", "audio/wav",
  "video/mp4", "video/webm",
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "-").toLowerCase();
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Accepted: images, PDFs, audio, video.`));
  },
  limits: { fileSize: MAX_FILE_SIZE },
});

const MetadataSchema = z.object({
  title: z.string().optional(),
  caption: z.string().optional(),
  source: z.string().optional(),
  credit: z.string().optional(),
  acquisitionDate: z.string().optional(),
  relatedReportId: z.coerce.number().int().positive().optional(),
  relatedCaseId: z.coerce.number().int().positive().optional(),
  visibility: z.enum(["internal_only", "public", "redacted_public"]).default("internal_only"),
  internalNotes: z.string().optional(),
});

// POST /api/uploads — admin; upload file + metadata
router.post("/", adminAuth, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "File too large. Maximum size is 100 MB." });
      } else {
        res.status(400).json({ error: err.message });
      }
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file provided. Include a file field in the form data." });
    return;
  }

  const parsed = MetadataSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid metadata" });
    return;
  }

  const d = parsed.data;

  try {
    const [row] = await db.insert(uploadsTable).values({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      title: d.title ?? null,
      caption: d.caption ?? null,
      source: d.source ?? null,
      credit: d.credit ?? null,
      acquisitionDate: d.acquisitionDate ? new Date(d.acquisitionDate) : null,
      relatedReportId: d.relatedReportId ?? null,
      relatedCaseId: d.relatedCaseId ?? null,
      visibility: d.visibility,
      approvedForPublication: false, // Always starts internal — must be explicitly approved
      internalNotes: d.internalNotes ?? null,
    }).returning();

    await db.insert(adminLogTable).values({
      action: "upload",
      entityType: "upload",
      entityId: row.id,
      entityTitle: row.originalName,
      details: JSON.stringify({ visibility: row.visibility, mimeType: row.mimeType }),
    });

    res.status(201).json(formatUpload(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create upload record");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/uploads — admin; list all uploads
router.get("/", adminAuth, async (req, res) => {
  const reportId = (req.query as { reportId?: string }).reportId;
  const caseId = (req.query as { caseId?: string }).caseId;

  let rows = await db.select().from(uploadsTable).orderBy(desc(uploadsTable.createdAt));

  if (reportId) rows = rows.filter(r => r.relatedReportId === parseInt(reportId));
  if (caseId) rows = rows.filter(r => r.relatedCaseId === parseInt(caseId));

  res.json(rows.map((r) => formatUpload(r)));
});

// PATCH /api/uploads/:id — admin; update metadata or approval
router.patch("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const UpdateSchema = MetadataSchema.partial().extend({
    approvedForPublication: z.boolean().optional(),
  });

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const d = parsed.data;
  const updateValues: Partial<typeof uploadsTable.$inferInsert> = {};

  if ("title" in d) updateValues.title = d.title ?? null;
  if ("caption" in d) updateValues.caption = d.caption ?? null;
  if ("source" in d) updateValues.source = d.source ?? null;
  if ("credit" in d) updateValues.credit = d.credit ?? null;
  if ("visibility" in d && d.visibility) updateValues.visibility = d.visibility;
  if ("internalNotes" in d) updateValues.internalNotes = d.internalNotes ?? null;
  if ("relatedReportId" in d) updateValues.relatedReportId = d.relatedReportId ?? null;
  if ("relatedCaseId" in d) updateValues.relatedCaseId = d.relatedCaseId ?? null;
  if (typeof d.approvedForPublication === "boolean") {
    updateValues.approvedForPublication = d.approvedForPublication;
  }

  const [row] = await db.update(uploadsTable).set(updateValues).where(eq(uploadsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Upload not found" }); return; }

  if (typeof d.approvedForPublication === "boolean") {
    await db.insert(adminLogTable).values({
      action: d.approvedForPublication ? "approve" : "access_change",
      entityType: "upload",
      entityId: row.id,
      entityTitle: row.originalName,
      details: JSON.stringify({ approvedForPublication: d.approvedForPublication }),
    });
  }

  res.json(formatUpload(row));
});

// DELETE /api/uploads/:id — admin; remove record (does not delete file from disk)
router.delete("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db.delete(uploadsTable).where(eq(uploadsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Upload not found" }); return; }

  res.json({ ok: true });
});

function formatUpload(r: typeof uploadsTable.$inferSelect) {
  return {
    id: r.id,
    filename: r.filename,
    originalName: r.originalName,
    filePath: r.filePath,
    mimeType: r.mimeType ?? null,
    fileSize: r.fileSize ?? null,
    title: r.title ?? null,
    caption: r.caption ?? null,
    source: r.source ?? null,
    credit: r.credit ?? null,
    acquisitionDate: r.acquisitionDate?.toISOString() ?? null,
    relatedReportId: r.relatedReportId ?? null,
    relatedCaseId: r.relatedCaseId ?? null,
    visibility: r.visibility,
    approvedForPublication: r.approvedForPublication,
    internalNotes: r.internalNotes ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
