import { Router } from "express";
import { db, issuesTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { adminAuth } from "./adminAuth";
import { z } from "zod";

const router = Router();

// PDF upload destination: crime-wire public/editions/ directory
const editionsDir = path.resolve(process.cwd(), "artifacts/crime-wire/public/editions");
fs.mkdirSync(editionsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, editionsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "-").toLowerCase();
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are accepted"));
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

const CreateIssueSchema = z.object({
  volume: z.coerce.number().int().positive().default(1),
  number: z.string().min(1),
  title: z.string().min(1),
  tagline: z.string().optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  pdfUrl: z.string().optional(),
  pageCount: z.coerce.number().int().positive().default(12),
  accessLevel: z.enum(["public", "press_club", "preview"]).default("public"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  publishDate: z.string().optional(),
});

// GET /api/issues — public; returns published and archived issues ordered by publishDate desc
router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(issuesTable)
    .where(inArray(issuesTable.status, ["published", "archived"]))
    .orderBy(desc(issuesTable.publishDate));

  res.json(rows.map(formatIssue));
});

// GET /api/issues/all — admin; returns all issues
router.get("/all", adminAuth, async (_req, res) => {
  const rows = await db.select().from(issuesTable).orderBy(desc(issuesTable.createdAt));
  res.json(rows.map(formatIssue));
});

// GET /api/issues/latest — public; returns the single current published issue
router.get("/latest", async (_req, res) => {
  const [row] = await db
    .select()
    .from(issuesTable)
    .where(eq(issuesTable.status, "published"))
    .orderBy(desc(issuesTable.publishDate))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "No published issue found" });
    return;
  }
  res.json(formatIssue(row));
});

// POST /api/issues — admin; create issue, optionally with PDF upload
router.post("/", adminAuth, upload.single("pdf"), async (req, res) => {
  const parsed = CreateIssueSchema.safeParse({
    ...req.body,
    pdfUrl: req.file ? `/editions/${req.file.filename}` : req.body.pdfUrl,
  });

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const data = parsed.data;

  try {
    // If publishing, archive any currently published issues
    if (data.status === "published") {
      await db
        .update(issuesTable)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(issuesTable.status, "published"));
    }

    const [row] = await db
      .insert(issuesTable)
      .values({
        volume: data.volume,
        number: data.number,
        title: data.title,
        tagline: data.tagline ?? null,
        headline: data.headline ?? null,
        description: data.description ?? null,
        pdfUrl: data.pdfUrl ?? null,
        pageCount: data.pageCount,
        accessLevel: data.accessLevel,
        status: data.status,
        publishDate: data.publishDate ? new Date(data.publishDate) : null,
      })
      .returning();

    res.status(201).json(formatIssue(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create issue");
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/issues/:id — admin; update issue metadata or status
router.patch("/:id", adminAuth, upload.single("pdf"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }

  const UpdateSchema = CreateIssueSchema.partial().extend({
    pdfUrl: z.string().optional(),
  });

  const body: Record<string, unknown> = { ...req.body };
  if (req.file) body.pdfUrl = `/editions/${req.file.filename}`;

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const data = parsed.data;

  try {
    // If publishing this issue, archive all other published issues
    if (data.status === "published") {
      await db
        .update(issuesTable)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(issuesTable.status, "published"));
    }

    const updateValues: Partial<typeof issuesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.volume !== undefined) updateValues.volume = data.volume;
    if (data.number !== undefined) updateValues.number = data.number;
    if (data.title !== undefined) updateValues.title = data.title;
    if ("tagline" in data) updateValues.tagline = data.tagline ?? null;
    if ("headline" in data) updateValues.headline = data.headline ?? null;
    if ("description" in data) updateValues.description = data.description ?? null;
    if ("pdfUrl" in data) updateValues.pdfUrl = data.pdfUrl ?? null;
    if (data.pageCount !== undefined) updateValues.pageCount = data.pageCount;
    if (data.accessLevel !== undefined) updateValues.accessLevel = data.accessLevel;
    if (data.status !== undefined) updateValues.status = data.status;
    if ("publishDate" in data)
      updateValues.publishDate = data.publishDate ? new Date(data.publishDate) : null;

    const [row] = await db
      .update(issuesTable)
      .set(updateValues)
      .where(eq(issuesTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    res.json(formatIssue(row));
  } catch (err) {
    req.log.error({ err }, "Failed to update issue");
    res.status(500).json({ error: "Server error" });
  }
});

function formatIssue(r: typeof issuesTable.$inferSelect) {
  return {
    id: r.id,
    volume: r.volume,
    number: r.number,
    title: r.title,
    tagline: r.tagline ?? null,
    headline: r.headline ?? null,
    description: r.description ?? null,
    pdfUrl: r.pdfUrl ?? null,
    pageCount: r.pageCount ?? 12,
    accessLevel: r.accessLevel,
    status: r.status,
    publishDate: r.publishDate ? r.publishDate.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export default router;
