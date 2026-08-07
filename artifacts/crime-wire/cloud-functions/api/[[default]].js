// =============================================================
// RSR Crime Division — EdgeOne Node Cloud Function
// Mount: /api/* (Express export default, no app.listen)
// Auth: signed HttpOnly cookie (ADMIN_CODE + SESSION_SECRET)
// Storage: @edgeone/pages-blob — stores names cw-{type}
// =============================================================

import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { getStore } from "@edgeone/pages-blob";
import { SignJWT, jwtVerify } from "jose";

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Blob helpers ─────────────────────────────────────────────

/** Get all records from a store (JSON array keyed "all"). */
async function getAll(storeName) {
  const store = getStore(storeName);
  return (await store.get("all", { type: "json", consistency: "strong" })) ?? [];
}

/** Overwrite the full records array. */
async function saveAll(storeName, records) {
  const store = getStore(storeName);
  await store.setJSON("all", records);
}

/** Auto-increment sequence per store. */
async function nextId(storeName) {
  const store = getStore(storeName);
  const cur = (await store.get("seq", { consistency: "strong" })) ?? "0";
  const next = parseInt(cur, 10) + 1;
  await store.set("seq", String(next));
  return next;
}

const now = () => new Date().toISOString();

// ── JWT / Cookie auth ─────────────────────────────────────────

function jwtSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not configured");
  return new TextEncoder().encode(s);
}

async function mintToken() {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(jwtSecret());
}

async function verifyJwt(token) {
  const { payload } = await jwtVerify(token, jwtSecret());
  return payload;
}

const COOKIE_NAME = "cw_session";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== "development",
  sameSite: "strict",
  maxAge: 8 * 60 * 60 * 1000,
  path: "/",
};

async function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = await verifyJwt(token);
    if (payload.role !== "admin") throw new Error("not admin");
    req.adminPayload = payload;
    next();
  } catch {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

// ── Rate limiter (per function instance, good enough for single-editor) ──

const loginAttempts = new Map();
function checkRateLimit(ip) {
  const WINDOW = 15 * 60 * 1000;
  const MAX = 5;
  const t = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || t - rec.t > WINDOW) {
    loginAttempts.set(ip, { n: 1, t });
    return false;
  }
  if (rec.n >= MAX) return true;
  rec.n++;
  return false;
}

// ── Multer memory storage (no disk) ───────────────────────────

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── File store helpers ─────────────────────────────────────────

async function saveFile(path, buffer, mimeType) {
  const store = getStore("cw-files");
  await store.set(path, buffer, { metadata: { mimeType } });
}

async function getFile(path) {
  const store = getStore("cw-files");
  return store.get(path, { type: "arrayBuffer" });
}

function safeName(original) {
  return original.replace(/[^a-zA-Z0-9.\-_]/g, "-").toLowerCase();
}

// ── Admin audit log ────────────────────────────────────────────

async function logAction(action, entityType, entityId, entityTitle, details) {
  try {
    const store = getStore("cw-adminlog");
    const log = (await store.get("log", { type: "json", consistency: "strong" })) ?? [];
    log.unshift({
      id: Date.now(),
      action,
      entityType,
      entityId,
      entityTitle,
      details: details ?? null,
      createdAt: now(),
    });
    if (log.length > 500) log.length = 500;
    await store.setJSON("log", log);
  } catch (e) {
    console.error("logAction failed:", e.message);
  }
}

// =============================================================
// ── Auth routes ──────────────────────────────────────────────
// =============================================================

app.post("/auth/login", async (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many login attempts. Please wait 15 minutes." });
  }

  const { code } = req.body ?? {};
  const adminCode = process.env.ADMIN_CODE;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!adminCode || !sessionSecret) {
    return res.status(503).json({
      error: "Admin auth not configured. Set ADMIN_CODE and SESSION_SECRET in EdgeOne environment.",
    });
  }

  if (!code || code !== adminCode) {
    return res.status(401).json({ error: "Invalid access code." });
  }

  try {
    const token = await mintToken();
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Could not create session." });
  }
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

app.get("/auth/me", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.json({ authenticated: false });
  try {
    await verifyJwt(token);
    return res.json({ authenticated: true });
  } catch {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.json({ authenticated: false });
  }
});

// =============================================================
// ── Health ────────────────────────────────────────────────────
// =============================================================

app.get("/healthz", (_req, res) => {
  const hasAdminCode = !!process.env.ADMIN_CODE;
  const hasSessionSecret = !!process.env.SESSION_SECRET;
  res.json({
    ok: hasAdminCode && hasSessionSecret,
    service: "RSR Crime Division",
    runtime: "EdgeOne Cloud Function",
    config: {
      auth: hasAdminCode && hasSessionSecret ? "ready" : "missing_secrets",
    },
  });
});

// =============================================================
// ── Subscriptions ─────────────────────────────────────────────
// =============================================================

app.post("/subscriptions", async (req, res) => {
  const { email, name, zip, editionType, consent } = req.body ?? {};
  if (!email || !consent || !editionType) {
    return res.status(400).json({ error: "email, editionType, and consent are required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }
  try {
    const id = await nextId("cw-subs");
    const record = {
      id,
      email,
      name: name ?? null,
      zip: zip ?? null,
      editionType,
      status: "active",
      createdAt: now(),
    };
    const all = await getAll("cw-subs");
    all.push(record);
    await saveAll("cw-subs", all);
    return res.status(201).json(record);
  } catch (e) {
    console.error("POST /subscriptions:", e);
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/subscriptions", requireAdmin, async (req, res) => {
  try {
    const all = await getAll("cw-subs");
    if (req.query.format === "csv") {
      const csv = [
        "id,email,name,zip,editionType,status,createdAt",
        ...all.map(
          (r) =>
            `${r.id},"${r.email}","${r.name ?? ""}","${r.zip ?? ""}","${r.editionType}","${r.status}","${r.createdAt}"`
        ),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="subscriptions.csv"');
      return res.send(csv);
    }
    return res.json(all);
  } catch (e) {
    console.error("GET /subscriptions:", e);
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Tips ──────────────────────────────────────────────────────
// =============================================================

app.post("/tips", async (req, res) => {
  const { message, contactEmail, source, name } = req.body ?? {};
  if (!message || message.length < 10) {
    return res.status(400).json({ error: "Message must be at least 10 characters" });
  }
  try {
    const id = await nextId("cw-tips");
    const record = {
      id,
      message,
      contactEmail: contactEmail ?? null,
      source: source ?? null,
      name: name ?? null,
      status: "new",
      adminNote: null,
      createdAt: now(),
    };
    const all = await getAll("cw-tips");
    all.unshift(record);
    await saveAll("cw-tips", all);
    return res.status(201).json({ id, createdAt: record.createdAt });
  } catch (e) {
    console.error("POST /tips:", e);
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/tips", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-tips"));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.patch("/tips/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-tips");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const { status, adminNote } = req.body ?? {};
    if (status !== undefined) all[idx].status = status;
    if (adminNote !== undefined) all[idx].adminNote = adminNote;
    await saveAll("cw-tips", all);
    return res.json(all[idx]);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Issues (Crime Wire editions) ─────────────────────────────
// =============================================================

const issueUpload = memUpload.single("pdf");

function fmtIssue(r) { return r; }

app.get("/issues", async (_req, res) => {
  try {
    const all = await getAll("cw-issues");
    return res.json(
      all
        .filter((r) => ["published", "archived"].includes(r.status))
        .sort((a, b) => new Date(b.publishDate ?? b.createdAt) - new Date(a.publishDate ?? a.createdAt))
    );
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/issues/all", requireAdmin, async (_req, res) => {
  try {
    const all = await getAll("cw-issues");
    return res.json(all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/issues/latest", async (_req, res) => {
  try {
    const all = await getAll("cw-issues");
    const published = all
      .filter((r) => r.status === "published")
      .sort((a, b) => new Date(b.publishDate ?? b.createdAt) - new Date(a.publishDate ?? a.createdAt));
    if (!published.length) return res.status(404).json({ error: "No published issue found" });
    return res.json(published[0]);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.post("/issues", requireAdmin, (req, res) => {
  issueUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const body = req.body ?? {};
      let pdfUrl = body.pdfUrl ?? null;

      if (req.file) {
        const filename = `${Date.now()}-${safeName(req.file.originalname)}`;
        await saveFile(`editions/${filename}`, req.file.buffer, req.file.mimetype);
        pdfUrl = `/api/files/editions/${filename}`;
      }

      const id = await nextId("cw-issues");
      const record = {
        id,
        volume: parseInt(body.volume, 10) || 1,
        number: body.number,
        title: body.title,
        tagline: body.tagline ?? null,
        headline: body.headline ?? null,
        description: body.description ?? null,
        pdfUrl,
        pageCount: parseInt(body.pageCount, 10) || 12,
        accessLevel: body.accessLevel ?? "public",
        status: body.status ?? "draft",
        publishDate: body.publishDate ?? null,
        createdAt: now(),
        updatedAt: now(),
      };

      const all = await getAll("cw-issues");

      if (record.status === "published") {
        for (const r of all) {
          if (r.status === "published") r.status = "archived";
        }
      }

      all.push(record);
      await saveAll("cw-issues", all);
      await logAction("create", "issue", id, `${record.number}: ${record.title}`);
      return res.status(201).json(fmtIssue(record));
    } catch (e) {
      console.error("POST /issues:", e);
      return res.status(500).json({ error: "Storage error" });
    }
  });
});

app.patch("/issues/:id", requireAdmin, (req, res) => {
  issueUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const id = parseInt(req.params.id, 10);
      const all = await getAll("cw-issues");
      const idx = all.findIndex((r) => r.id === id);
      if (idx === -1) return res.status(404).json({ error: "Not found" });

      const body = req.body ?? {};
      const rec = all[idx];

      if (req.file) {
        const filename = `${Date.now()}-${safeName(req.file.originalname)}`;
        await saveFile(`editions/${filename}`, req.file.buffer, req.file.mimetype);
        rec.pdfUrl = `/api/files/editions/${filename}`;
      }

      const fields = ["volume", "number", "title", "tagline", "headline", "description",
                      "pdfUrl", "pageCount", "accessLevel", "status", "publishDate"];
      for (const f of fields) {
        if (body[f] !== undefined) rec[f] = body[f];
      }
      rec.updatedAt = now();

      if (rec.status === "published") {
        for (let i = 0; i < all.length; i++) {
          if (i !== idx && all[i].status === "published") all[i].status = "archived";
        }
      }

      all[idx] = rec;
      await saveAll("cw-issues", all);
      await logAction("update", "issue", id, `${rec.number}: ${rec.title}`);
      return res.json(fmtIssue(rec));
    } catch (e) {
      console.error("PATCH /issues/:id:", e);
      return res.status(500).json({ error: "Storage error" });
    }
  });
});

// =============================================================
// ── Press Club / Print Waitlist ───────────────────────────────
// =============================================================

app.post("/press-club", async (req, res) => {
  const { email, name, tier, city, zip, mailingAddress, message, source, consent } = req.body ?? {};
  if (!email || !consent || !tier) {
    return res.status(400).json({ error: "email, tier, and consent are required" });
  }
  try {
    const id = await nextId("cw-pressclub");
    const record = {
      id, email, name: name ?? null, tier,
      city: city ?? null, zip: zip ?? null,
      mailingAddress: mailingAddress ?? null,
      message: message ?? null, source: source ?? null,
      status: "active", adminNote: null,
      createdAt: now(),
    };
    const all = await getAll("cw-pressclub");
    all.push(record);
    await saveAll("cw-pressclub", all);
    return res.status(201).json({ id, email, tier, createdAt: record.createdAt });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/press-club", requireAdmin, async (req, res) => {
  try {
    const all = await getAll("cw-pressclub");
    if (req.query.format === "csv") {
      const csv = [
        "id,email,name,tier,city,zip,status,createdAt",
        ...all.map(
          (r) =>
            `${r.id},"${r.email}","${r.name ?? ""}","${r.tier}","${r.city ?? ""}","${r.zip ?? ""}","${r.status}","${r.createdAt}"`
        ),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="press-club.csv"');
      return res.send(csv);
    }
    return res.json(all);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.patch("/press-club/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-pressclub");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const { status, adminNote } = req.body ?? {};
    if (status !== undefined) all[idx].status = status;
    if (adminNote !== undefined) all[idx].adminNote = adminNote;
    await saveAll("cw-pressclub", all);
    return res.json({ id, status: all[idx].status, adminNote: all[idx].adminNote });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Letters (Reader Inbox) ────────────────────────────────────
// =============================================================

app.post("/letters", async (req, res) => {
  const { name, email, message, subject, letterType, issueRef, section, contactMethod } = req.body ?? {};
  if (!message || message.length < 5) {
    return res.status(400).json({ error: "Message is required" });
  }
  try {
    const id = await nextId("cw-letters");
    const record = {
      id, name: name ?? null, email: email ?? null,
      message, subject: subject ?? null,
      letterType: letterType ?? "letter",
      issueRef: issueRef ?? null, section: section ?? null,
      contactMethod: contactMethod ?? null,
      status: "new", adminNote: null, privateNote: null,
      createdAt: now(), updatedAt: now(),
    };
    const all = await getAll("cw-letters");
    all.unshift(record);
    await saveAll("cw-letters", all);
    return res.status(201).json(record);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/letters", requireAdmin, async (req, res) => {
  try {
    const all = await getAll("cw-letters");
    const { status, type } = req.query;
    let filtered = all;
    if (status) filtered = filtered.filter((r) => r.status === status);
    if (type) filtered = filtered.filter((r) => r.letterType === type);
    return res.json(filtered);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.patch("/letters/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-letters");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const { status, adminNote, privateNote } = req.body ?? {};
    if (status !== undefined) all[idx].status = status;
    if (adminNote !== undefined) all[idx].adminNote = adminNote;
    if (privateNote !== undefined) all[idx].privateNote = privateNote;
    all[idx].updatedAt = now();
    await saveAll("cw-letters", all);
    return res.json(all[idx]);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Corrections ────────────────────────────────────────────────
// =============================================================

function fmtCorrection(r) { return r; }

app.get("/corrections", async (_req, res) => {
  try {
    const all = await getAll("cw-corrections");
    return res.json(all.filter((r) => r.publishedAt).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/corrections/all", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-corrections"));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.post("/corrections", requireAdmin, async (req, res) => {
  try {
    const { issueLabel, section, originalText, correctedText, adminNote, publish } = req.body ?? {};
    if (!originalText || !correctedText) {
      return res.status(400).json({ error: "originalText and correctedText are required" });
    }
    const id = await nextId("cw-corrections");
    const record = {
      id,
      issueLabel: issueLabel ?? null, section: section ?? null,
      originalText, correctedText,
      adminNote: adminNote ?? null,
      publishedAt: publish ? now() : null,
      createdAt: now(), updatedAt: now(),
    };
    const all = await getAll("cw-corrections");
    all.unshift(record);
    await saveAll("cw-corrections", all);
    await logAction("create", "correction", id, issueLabel ?? "Correction");
    return res.status(201).json(fmtCorrection(record));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.patch("/corrections/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-corrections");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const fields = ["issueLabel", "section", "originalText", "correctedText", "adminNote"];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) all[idx][f] = req.body[f];
    }
    if (req.body?.publish === true) all[idx].publishedAt = now();
    if (req.body?.publish === false) all[idx].publishedAt = null;
    all[idx].updatedAt = now();
    await saveAll("cw-corrections", all);
    await logAction("update", "correction", id, all[idx].issueLabel ?? "Correction");
    return res.json(fmtCorrection(all[idx]));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Reports ────────────────────────────────────────────────────
// =============================================================

const PUBLIC_STATUSES = ["published", "developing", "updated", "corrected"];

function publicFields(r) {
  const { internalNotes, ...pub } = r;
  return pub;
}

app.get("/reports", async (req, res) => {
  try {
    const all = await getAll("cw-reports");
    const placement = req.query.placement;
    let results = all.filter((r) => PUBLIC_STATUSES.includes(r.status));
    if (placement) {
      results = results.filter((r) => {
        try { return JSON.parse(r.placement ?? "{}")?.[placement] === true; }
        catch { return false; }
      });
    }
    results.sort((a, b) => new Date(b.publishedAt ?? b.createdAt) - new Date(a.publishedAt ?? a.createdAt));
    return res.json(results.map(publicFields));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/reports/all/list", requireAdmin, async (_req, res) => {
  try {
    const all = await getAll("cw-reports");
    return res.json(all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/reports/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-reports");
    const rec = all.find((r) => r.id === id);
    if (!rec) return res.status(404).json({ error: "Report not found" });

    const isAdmin = await (async () => {
      try {
        const tok = req.cookies?.[COOKIE_NAME];
        if (!tok) return false;
        const p = await verifyJwt(tok);
        return p.role === "admin";
      } catch { return false; }
    })();

    if (!PUBLIC_STATUSES.includes(rec.status) && !isAdmin) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.json(isAdmin ? rec : publicFields(rec));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.post("/reports", requireAdmin, async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.headline) return res.status(400).json({ error: "Headline is required" });
    const id = await nextId("cw-reports");
    const record = {
      id,
      type: body.type ?? "crime_brief",
      status: body.status ?? "draft",
      headline: body.headline,
      deck: body.deck ?? null,
      neighborhood: body.neighborhood ?? null,
      city: body.city ?? "Los Angeles",
      incidentDate: body.incidentDate ?? null,
      publishDate: body.publishDate ?? null,
      byline: body.byline ?? null,
      body: body.body ?? "",
      agenciesInvolved: body.agenciesInvolved ?? null,
      caseNumber: body.caseNumber ?? null,
      reportNumber: body.reportNumber ?? null,
      sourceLinks: body.sourceLinks ?? null,
      evidenceStatus: body.evidenceStatus ?? null,
      featuredImageUrl: body.featuredImageUrl ?? null,
      internalNotes: body.internalNotes ?? null,
      relatedCaseFileId: body.relatedCaseFileId ?? null,
      placement: body.placement ?? "{}",
      isDeveloping: body.isDeveloping ?? false,
      correctionNotice: null,
      updateHistory: "[]",
      correctionHistory: "[]",
      publishedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };

    if (["published", "developing"].includes(record.status)) {
      record.publishedAt = now();
    }

    const all = await getAll("cw-reports");
    all.push(record);
    await saveAll("cw-reports", all);
    await logAction("create", "report", id, record.headline);
    return res.status(201).json(record);
  } catch (e) {
    console.error("POST /reports:", e);
    return res.status(500).json({ error: "Storage error" });
  }
});

app.patch("/reports/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-reports");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const body = req.body ?? {};
    const rec = all[idx];

    const simpleFields = [
      "type", "status", "headline", "deck", "neighborhood", "city",
      "incidentDate", "publishDate", "byline", "body", "agenciesInvolved",
      "caseNumber", "reportNumber", "sourceLinks", "evidenceStatus",
      "featuredImageUrl", "internalNotes", "relatedCaseFileId",
      "placement", "isDeveloping", "correctionNotice",
    ];
    for (const f of simpleFields) {
      if (body[f] !== undefined) rec[f] = body[f];
    }

    // Handle update history
    if (body.updateSummary) {
      const hist = JSON.parse(rec.updateHistory ?? "[]");
      hist.push({ timestamp: now(), summary: body.updateSummary, editor: "admin" });
      rec.updateHistory = JSON.stringify(hist);
      if (!["developing", "corrected"].includes(rec.status)) rec.status = "updated";
    }

    // Handle correction
    if (body.correctionSummary) {
      const hist = JSON.parse(rec.correctionHistory ?? "[]");
      hist.push({ timestamp: now(), summary: body.correctionSummary });
      rec.correctionHistory = JSON.stringify(hist);
      rec.status = "corrected";
    }

    // Set publishedAt on first publish
    if (["published", "developing"].includes(rec.status) && !rec.publishedAt) {
      rec.publishedAt = now();
    }

    rec.updatedAt = now();
    all[idx] = rec;
    await saveAll("cw-reports", all);
    await logAction("update", "report", id, rec.headline);
    return res.json(rec);
  } catch (e) {
    console.error("PATCH /reports/:id:", e);
    return res.status(500).json({ error: "Storage error" });
  }
});

app.delete("/reports/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-reports");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    all[idx].status = "archived";
    all[idx].updatedAt = now();
    await saveAll("cw-reports", all);
    await logAction("delete", "report", id, all[idx].headline);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Uploads (media / records) ─────────────────────────────────
// =============================================================

const fileUpload = memUpload.single("file");

app.post("/uploads", requireAdmin, (req, res) => {
  fileUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "File is required" });
    try {
      const body = req.body ?? {};
      const filename = `${Date.now()}-${safeName(req.file.originalname)}`;
      await saveFile(`uploads/${filename}`, req.file.buffer, req.file.mimetype);

      const id = await nextId("cw-uploads");
      const record = {
        id,
        filename,
        originalName: req.file.originalname,
        filePath: `/api/files/uploads/${filename}`,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        title: body.title ?? null,
        caption: body.caption ?? null,
        source: body.source ?? null,
        credit: body.credit ?? null,
        acquisitionDate: body.acquisitionDate ?? null,
        relatedReportId: body.relatedReportId ? parseInt(body.relatedReportId, 10) : null,
        relatedCaseId: body.relatedCaseId ? parseInt(body.relatedCaseId, 10) : null,
        visibility: body.visibility ?? "internal_only",
        approvedForPublication: false, // always false on creation
        internalNotes: body.internalNotes ?? null,
        createdAt: now(),
        updatedAt: now(),
      };

      const all = await getAll("cw-uploads");
      all.unshift(record);
      await saveAll("cw-uploads", all);
      await logAction("upload", "upload", id, filename);
      return res.status(201).json(record);
    } catch (e) {
      console.error("POST /uploads:", e);
      return res.status(500).json({ error: "Storage error" });
    }
  });
});

app.get("/uploads", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-uploads"));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.patch("/uploads/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-uploads");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const fields = ["title", "caption", "source", "credit", "acquisitionDate",
                    "relatedReportId", "relatedCaseId", "visibility",
                    "approvedForPublication", "internalNotes"];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) all[idx][f] = req.body[f];
    }
    all[idx].updatedAt = now();
    await saveAll("cw-uploads", all);
    await logAction("update", "upload", id, all[idx].filename);
    return res.json(all[idx]);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.delete("/uploads/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-uploads");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    await logAction("delete", "upload", id, all[idx].filename);
    all.splice(idx, 1);
    await saveAll("cw-uploads", all);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// ── File serving (editions + uploads) ─────────────────────────

app.get("/files/editions/:filename", async (req, res) => {
  try {
    const buf = await getFile(`editions/${req.params.filename}`);
    if (!buf) return res.status(404).json({ error: "File not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${req.params.filename}"`);
    return res.send(Buffer.from(buf));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/files/uploads/:filename", async (req, res) => {
  try {
    const uploads = await getAll("cw-uploads");
    const record = uploads.find((r) => r.filename === req.params.filename);

    // Private unless approved for publication
    const isAdmin = await (async () => {
      try {
        const tok = req.cookies?.[COOKIE_NAME];
        if (!tok) return false;
        const p = await verifyJwt(tok);
        return p.role === "admin";
      } catch { return false; }
    })();

    if (!isAdmin && (!record?.approvedForPublication || record?.visibility !== "public")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const buf = await getFile(`uploads/${req.params.filename}`);
    if (!buf) return res.status(404).json({ error: "File not found" });
    const mime = record?.mimeType ?? "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="${req.params.filename}"`);
    return res.send(Buffer.from(buf));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Case Files ─────────────────────────────────────────────────
// =============================================================

app.get("/case-files", async (_req, res) => {
  try {
    const all = await getAll("cw-casefiles");
    return res.json(all.filter((r) => r.isPublic));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/case-files/all", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-casefiles"));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/case-files/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-casefiles");
    const rec = all.find((r) => r.id === id);
    if (!rec) return res.status(404).json({ error: "Not found" });

    const isAdmin = await (async () => {
      try {
        const tok = req.cookies?.[COOKIE_NAME];
        if (!tok) return false;
        const p = await verifyJwt(tok);
        return p.role === "admin";
      } catch { return false; }
    })();

    if (!rec.isPublic && !isAdmin) {
      return res.status(404).json({ error: "Not found" });
    }

    // Attach linked reports (summaries)
    const reports = await getAll("cw-reports");
    const linked = reports
      .filter((r) => r.relatedCaseFileId === id && PUBLIC_STATUSES.includes(r.status))
      .map(publicFields);

    return res.json({ ...rec, linkedReports: linked });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.post("/case-files", requireAdmin, async (req, res) => {
  try {
    const { identifier, title, description, isPublic, status, summary, investigativeNotes } = req.body ?? {};
    if (!identifier || !title) {
      return res.status(400).json({ error: "identifier and title are required" });
    }
    const id = await nextId("cw-casefiles");
    const record = {
      id, identifier, title,
      description: description ?? null,
      summary: summary ?? null,
      investigativeNotes: investigativeNotes ?? null,
      isPublic: isPublic ?? false,
      status: status ?? "open",
      createdAt: now(), updatedAt: now(),
    };
    const all = await getAll("cw-casefiles");
    all.push(record);
    await saveAll("cw-casefiles", all);
    await logAction("create", "case_file", id, `${identifier} — ${title}`);
    return res.status(201).json(record);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.patch("/case-files/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-casefiles");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const fields = ["identifier", "title", "description", "summary",
                    "investigativeNotes", "isPublic", "status"];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) all[idx][f] = req.body[f];
    }
    all[idx].updatedAt = now();
    await saveAll("cw-casefiles", all);
    await logAction("update", "case_file", id, `${all[idx].identifier} — ${all[idx].title}`);
    return res.json(all[idx]);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Records Requests (FOIA/CPRA tracking) ─────────────────────
// =============================================================

app.get("/records-requests", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-recsreqs"));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.post("/records-requests", requireAdmin, async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await nextId("cw-recsreqs");
    const record = {
      id,
      requestType: body.requestType ?? "cpra",
      requesterName: body.requesterName ?? null,
      requesterContact: body.requesterContact ?? null,
      agency: body.agency ?? null,
      description: body.description ?? null,
      dateSubmitted: body.dateSubmitted ?? null,
      responseDue: body.responseDue ?? null,
      status: body.status ?? "pending",
      adminNote: body.adminNote ?? null,
      publicVersionAvailable: body.publicVersionAvailable ?? false,
      createdAt: now(), updatedAt: now(),
    };
    const all = await getAll("cw-recsreqs");
    all.unshift(record);
    await saveAll("cw-recsreqs", all);
    await logAction("create", "records_request", id, record.agency ?? "Request");
    return res.status(201).json(record);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.patch("/records-requests/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-recsreqs");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const fields = ["requestType", "requesterName", "requesterContact", "agency",
                    "description", "dateSubmitted", "responseDue", "status",
                    "adminNote", "publicVersionAvailable"];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) all[idx][f] = req.body[f];
    }
    all[idx].updatedAt = now();
    await saveAll("cw-recsreqs", all);
    return res.json(all[idx]);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Advertisers ────────────────────────────────────────────────
// =============================================================

app.get("/advertisers", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-advertisers"));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.post("/advertisers", requireAdmin, async (req, res) => {
  try {
    const { name, contactName, contactEmail, disclosureLabel } = req.body ?? {};
    if (!name || !disclosureLabel) {
      return res.status(400).json({ error: "name and disclosureLabel are required" });
    }
    const id = await nextId("cw-advertisers");
    const record = {
      id, name, contactName: contactName ?? null,
      contactEmail: contactEmail ?? null,
      disclosureLabel,
      placement: req.body.placement ?? null,
      campaignStart: req.body.campaignStart ?? null,
      campaignEnd: req.body.campaignEnd ?? null,
      status: req.body.status ?? "active",
      notes: req.body.notes ?? null,
      createdAt: now(), updatedAt: now(),
    };
    const all = await getAll("cw-advertisers");
    all.push(record);
    await saveAll("cw-advertisers", all);
    await logAction("create", "advertiser", id, name);
    return res.status(201).json(record);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.patch("/advertisers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-advertisers");
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const fields = ["name", "contactName", "contactEmail", "disclosureLabel",
                    "placement", "campaignStart", "campaignEnd", "status", "notes"];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) all[idx][f] = req.body[f];
    }
    all[idx].updatedAt = now();
    await saveAll("cw-advertisers", all);
    await logAction("update", "advertiser", id, all[idx].name);
    return res.json(all[idx]);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Admin Log ──────────────────────────────────────────────────
// =============================================================

app.get("/admin-log", requireAdmin, async (req, res) => {
  try {
    const store = getStore("cw-adminlog");
    const log = (await store.get("log", { type: "json" })) ?? [];
    const limit = Math.min(parseInt(req.query.limit ?? "100", 10), 500);
    return res.json(log.slice(0, limit));
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Settings ───────────────────────────────────────────────────
// =============================================================

const ALLOWED_KEYS = new Set([
  "newsroom_status", "publication_name", "editor_name",
  "contact_email", "mailing_address", "social_twitter",
  "social_instagram", "edition_url", "subscription_note",
]);

app.get("/settings", requireAdmin, async (_req, res) => {
  try {
    const store = getStore("cw-settings");
    const settings = (await store.get("all", { type: "json" })) ?? {};
    return res.json(settings);
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.put("/settings", requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body ?? {};
    if (!key || !ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ error: `Invalid key. Allowed: ${[...ALLOWED_KEYS].join(", ")}` });
    }
    const store = getStore("cw-settings");
    const settings = (await store.get("all", { type: "json", consistency: "strong" })) ?? {};
    if (value === null || value === undefined) {
      delete settings[key];
    } else {
      settings[key] = value;
    }
    await store.setJSON("all", settings);
    return res.json({ key, value: settings[key] ?? null });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

// =============================================================
// ── Catch-all: 404 for unknown API routes ─────────────────────
// =============================================================

app.use((_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// MUST export — do NOT call app.listen()
export default app;
