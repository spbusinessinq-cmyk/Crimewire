import { Router } from "express";
import { db, comicsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";

// ── Artwork storage: crime-wire public/comics/ served as /api/files/comics/ ──
const comicsDir = path.resolve(process.cwd(), "artifacts/crime-wire/public/comics");
fs.mkdirSync(comicsDir, { recursive: true });

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, comicsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "-").toLowerCase();
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only images (JPEG, PNG, WebP, GIF) are accepted for comic artwork."));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

const SERIES = ["ink-and-alibi", "morning-joe"] as const;
const STATUSES = ["draft", "published", "archived"] as const;

// ── Public router — mounted at /api/comics ─────────────────────────────────
export const comicsPublicRouter = Router();

// GET /api/comics — published strips, sorted by series then episode desc
comicsPublicRouter.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(comicsTable)
    .where(eq(comicsTable.status, "published"))
    .orderBy(desc(comicsTable.episode));

  const sorted = rows
    .map(formatComic)
    .sort((a, b) => {
      if (a.series !== b.series) return a.series.localeCompare(b.series);
      return (b.episode ?? 0) - (a.episode ?? 0);
    });

  res.json(sorted);
});

// GET /api/files/comics/:filename — artwork file serving (public)
comicsPublicRouter.get("/files/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(comicsDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

// ── Admin router — mounted at /api/admin/comics ────────────────────────────
export const comicsAdminRouter = Router();

// GET /api/admin/comics — all strips
comicsAdminRouter.get("/", adminAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(comicsTable)
    .orderBy(desc(comicsTable.episode));

  const sorted = rows
    .map(formatComic)
    .sort((a, b) => {
      if (a.series !== b.series) return a.series.localeCompare(b.series);
      return (b.episode ?? 0) - (a.episode ?? 0);
    });

  res.json(sorted);
});

// POST /api/admin/comics — create strip (multipart with optional artwork)
comicsAdminRouter.post("/", adminAuth, (req, res) => {
  upload.single("artwork")(req, res, async (err) => {
    if (err instanceof multer.MulterError || (err && err.message)) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    try {
      const body = req.body ?? {};
      const parsed = z.object({
        series: z.enum(SERIES).default("ink-and-alibi"),
        episode: z.coerce.number().int().positive().optional(),
        title: z.string().optional(),
        artworkUrl: z.string().optional(),
        caption: z.string().optional(),
        transcript: z.string().optional(),
        publishDate: z.string().optional(),
        status: z.enum(STATUSES).default("draft"),
        sortOrder: z.coerce.number().int().optional(),
      }).safeParse(body);

      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
        return;
      }

      let artworkUrl = parsed.data.artworkUrl ?? null;
      if (req.file) {
        artworkUrl = `/api/files/comics/${req.file.filename}`;
      }

      const [row] = await db
        .insert(comicsTable)
        .values({
          series: parsed.data.series,
          episode: parsed.data.episode ?? null,
          title: parsed.data.title || null,
          artworkUrl,
          caption: parsed.data.caption || null,
          transcript: parsed.data.transcript || null,
          publishDate: parsed.data.publishDate ? new Date(parsed.data.publishDate) : null,
          status: parsed.data.status,
          sortOrder: parsed.data.sortOrder ?? null,
        })
        .returning();

      res.status(201).json(formatComic(row));
    } catch (err) {
      req.log.error({ err }, "Failed to create comic");
      res.status(500).json({ error: "Server error" });
    }
  });
});

// PATCH /api/admin/comics/:id — update strip
comicsAdminRouter.patch("/:id", adminAuth, (req, res) => {
  upload.single("artwork")(req, res, async (err) => {
    if (err instanceof multer.MulterError || (err && err.message)) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    try {
      const body = req.body ?? {};
      const parsed = z.object({
        series: z.enum(SERIES).optional(),
        episode: z.coerce.number().int().positive().optional().nullable(),
        title: z.string().optional().nullable(),
        artworkUrl: z.string().optional().nullable(),
        caption: z.string().optional().nullable(),
        transcript: z.string().optional().nullable(),
        publishDate: z.string().optional().nullable(),
        status: z.enum(STATUSES).optional(),
        sortOrder: z.coerce.number().int().optional().nullable(),
      }).safeParse(body);

      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
        return;
      }

      const data = parsed.data;
      const values: Partial<typeof comicsTable.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (req.file) {
        values.artworkUrl = `/api/files/comics/${req.file.filename}`;
      } else if ("artworkUrl" in data) {
        values.artworkUrl = data.artworkUrl ?? null;
      }

      if (data.series !== undefined) values.series = data.series;
      if ("episode" in data) values.episode = data.episode ?? null;
      if ("title" in data) values.title = data.title ?? null;
      if ("caption" in data) values.caption = data.caption ?? null;
      if ("transcript" in data) values.transcript = data.transcript ?? null;
      if ("publishDate" in data) {
        values.publishDate = data.publishDate ? new Date(data.publishDate) : null;
      }
      if (data.status !== undefined) values.status = data.status;
      if ("sortOrder" in data) values.sortOrder = data.sortOrder ?? null;

      const [row] = await db
        .update(comicsTable)
        .set(values)
        .where(eq(comicsTable.id, id))
        .returning();

      if (!row) { res.status(404).json({ error: "Comic not found" }); return; }
      res.json(formatComic(row));
    } catch (err) {
      req.log.error({ err }, "Failed to update comic");
      res.status(500).json({ error: "Server error" });
    }
  });
});

// DELETE /api/admin/comics/:id — hard delete
comicsAdminRouter.delete("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .delete(comicsTable)
    .where(eq(comicsTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Comic not found" }); return; }
  res.json({ ok: true });
});

// ── Shared helpers ─────────────────────────────────────────────────────────
function formatComic(r: typeof comicsTable.$inferSelect) {
  return {
    id: r.id,
    series: r.series,
    episode: r.episode ?? null,
    title: r.title ?? null,
    artworkUrl: r.artworkUrl ?? null,
    caption: r.caption ?? null,
    transcript: r.transcript ?? null,
    publishDate: r.publishDate ? r.publishDate.toISOString() : null,
    status: r.status,
    sortOrder: r.sortOrder ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
