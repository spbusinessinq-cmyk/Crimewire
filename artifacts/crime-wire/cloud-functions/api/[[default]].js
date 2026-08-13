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
  sameSite: "lax",
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

async function saveFile(fileKey, buffer, mimeType) {
  const store = getStore("cw-files");
  // Binary store.set() PUT to COS lacks Content-Type → COS rejects it.
  // Instead encode as base64 JSON using setJSON (proven to work).
  const b64 = Buffer.from(buffer).toString("base64");
  await store.setJSON(fileKey, { b64, mimeType, size: buffer.length });
}

async function getFile(fileKey) {
  const store = getStore("cw-files");
  const meta = await store.get(fileKey, { type: "json" });
  if (!meta) return null;
  // New format: { b64, mimeType, size }
  if (meta && typeof meta === "object" && meta.b64) {
    return Buffer.from(meta.b64, "base64");
  }
  // Legacy fallback: raw binary (pre-fix uploads)
  return store.get(fileKey, { type: "arrayBuffer" });
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
// ── Email helpers (Resend REST API — no extra dependency) ────
// Config via env: RESEND_API_KEY, EMAIL_FROM, EMAIL_NEWSROOM,
//                 EMAIL_REPLY_TO, SITE_URL
// =============================================================

function emailCfg() {
  return {
    apiKey:   process.env.RESEND_API_KEY   || null,
    from:     process.env.EMAIL_FROM       || null,
    newsroom: process.env.EMAIL_NEWSROOM   || null,
    replyTo:  process.env.EMAIL_REPLY_TO   || null,
    siteUrl:  process.env.SITE_URL         || "https://lacrimewire.online",
  };
}

function emailReady() {
  const c = emailCfg();
  return !!(c.apiKey && c.from);
}

/** Call Resend REST API. Returns { ok, data?, error? }. */
async function sendEmail({ to, subject, html, text }) {
  const c = emailCfg();
  if (!c.apiKey || !c.from) return { ok: false, error: "Email not configured (RESEND_API_KEY / EMAIL_FROM missing)" };
  const body = { from: c.from, to: Array.isArray(to) ? to : [to], subject, html };
  if (text) body.text = text;
  if (c.replyTo) body.reply_to = c.replyTo;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => resp.status.toString());
      return { ok: false, error: `Resend ${resp.status}: ${err}` };
    }
    return { ok: true, data: await resp.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** HMAC-SHA256 token for unsubscribe links — no stored state needed. */
async function unsubToken(email) {
  const secret = process.env.SESSION_SECRET || "fallback-secret";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email.toLowerCase().trim()));
  return Buffer.from(sig).toString("hex").slice(0, 40);
}

/** Append to the email delivery log (max 300 entries). */
async function logEmail(entry) {
  try {
    const store = getStore("cw-email-log");
    const log = (await store.get("log", { type: "json", consistency: "strong" })) ?? [];
    log.unshift({ ...entry, id: Date.now() });
    if (log.length > 300) log.length = 300;
    await store.setJSON("log", log);
  } catch (e) {
    console.error("logEmail failed:", e.message);
  }
}

/** Branded HTML email shell. */
function emailHtml(bodyHtml, footerHtml) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;padding:0;background:#f0ede8;font-family:Georgia,serif;color:#111}
.wrap{max-width:600px;margin:0 auto;background:#fff;border:1px solid #111}
.hd{background:#000;color:#fff;padding:22px 28px 18px}
.hd-eye{font:700 10px/1 Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#888;margin-bottom:8px}
.hd-name{font:700 30px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:-.02em}
.hd-sub{font:400 11px/1 Arial,sans-serif;color:#777;margin-top:8px;letter-spacing:.12em;text-transform:uppercase}
.bd{padding:28px 32px}
.bd h2{font:700 18px/1.1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #000;padding-bottom:10px;margin:0 0 18px}
.bd p{font-size:15px;line-height:1.65;margin:0 0 15px}
.bd .rule{border:none;border-top:1px solid #ddd;margin:20px 0}
.ft{background:#111;color:#666;padding:18px 28px;font:400 11px/1.6 Arial,sans-serif}
.ft a{color:#999}
.cta-btn{display:inline-block;background:#000;color:#fff;padding:12px 24px;text-decoration:none;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.1em;margin:16px 0}
</style></head>
<body><div class="wrap">
<div class="hd">
  <div class="hd-eye">RSR Crime Division</div>
  <div class="hd-name">Los Angeles<br>Crime Wire</div>
  <div class="hd-sub">Independent Crime &amp; Investigative Weekly</div>
</div>
<div class="bd">${bodyHtml}</div>
<div class="ft">${footerHtml}</div>
</div></body></html>`;
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
  // Accept ADMIN_CODE (EdgeOne canonical) or ADMIN_PASSWORD (legacy Replit secret name).
  const adminCode = process.env.ADMIN_CODE || process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!adminCode) {
    return res.status(503).json({ error: "Admin authentication is not configured." });
  }
  if (!sessionSecret) {
    return res.status(503).json({ error: "Admin authentication is not configured." });
  }

  if (!code || code !== adminCode) {
    return res.status(401).json({ error: "Access denied." });
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
  const hasAdminCode = !!(process.env.ADMIN_CODE || process.env.ADMIN_PASSWORD);
  const hasSessionSecret = !!process.env.SESSION_SECRET;
  const c = emailCfg();
  const emailStatus = !c.apiKey && !c.from ? "not_configured"
    : c.apiKey && c.from ? "ready"
    : "partial";
  res.json({
    ok: hasAdminCode && hasSessionSecret,
    service: "RSR Crime Division",
    runtime: "EdgeOne Cloud Function",
    config: {
      auth: hasAdminCode && hasSessionSecret ? "ready" : "missing_secrets",
      email: emailStatus,
      emailMissing: [
        !c.apiKey && "RESEND_API_KEY",
        !c.from   && "EMAIL_FROM",
      ].filter(Boolean),
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
    // Deduplication — case-insensitive email check before any write
    const all = await getAll("cw-subs");
    const normalised = email.trim().toLowerCase();
    if (all.some((r) => r.email.trim().toLowerCase() === normalised)) {
      return res.status(409).json({ error: "Email already subscribed" });
    }
    const id = await nextId("cw-subs");
    const record = {
      id,
      email: email.trim(),
      name: name?.trim() || null,
      zip: zip?.trim() || null,
      editionType,
      consent: true,
      consentDate: now(),
      status: "active",
      createdAt: now(),
    };
    all.push(record);
    await saveAll("cw-subs", all);

    // Fire-and-forget welcome email — signup never fails if email fails
    if (emailReady()) {
      (async () => {
        try {
          const { siteUrl } = emailCfg();
          const tok = await unsubToken(record.email);
          const unsubUrl = `${siteUrl}/api/unsubscribe?email=${encodeURIComponent(record.email)}&token=${tok}`;
          const editionLabel = record.editionType === "digital" ? "Digital edition (email)"
            : record.editionType === "mailed" ? "Mailed copy — print waitlist"
            : "Digital + mailed waitlist";
          const html = emailHtml(
            `<h2>You're on the list.</h2>
             <p>Thank you${record.name ? `, ${record.name}` : ""} — you're confirmed for <strong>The Thursday Drop</strong>, Los Angeles Crime Wire's free digital edition delivered every Thursday.</p>
             <p><strong>Edition:</strong> ${editionLabel}</p>
             <p>We report on active Los Angeles crime, court records, the running Black Dahlia case file, and investigative journalism. Your first issue arrives this Thursday.</p>
             <hr class="rule">
             <p style="font-size:13px;color:#555;font-style:italic;">Victim first. Facts second. Theories last.</p>`,
            `Los Angeles Crime Wire &middot; <a href="${siteUrl}">${siteUrl}</a><br>
             <a href="${unsubUrl}">Unsubscribe</a> &middot; You consented on ${record.consentDate?.split("T")[0] ?? "signup"}`
          );
          const result = await sendEmail({ to: record.email, subject: "You're confirmed — The Thursday Drop", html });
          await logEmail({ type: "welcome", to: record.email, subject: "You're confirmed — The Thursday Drop", ok: result.ok, error: result.error ?? null, timestamp: now() });
        } catch (e) { console.error("welcome email failed:", e.message); }
      })();
    }

    // Return minimal confirmation — do not echo email back in body
    return res.status(201).json({ id, createdAt: record.createdAt });
  } catch (e) {
    console.error("POST /subscriptions:", e);
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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

    // Fire-and-forget newsroom notification
    if (emailReady() && emailCfg().newsroom) {
      (async () => {
        try {
          const { newsroom, siteUrl } = emailCfg();
          const html = emailHtml(
            `<h2>New Tip Received</h2>
             <p><strong>From:</strong> ${record.name ?? "Anonymous"}</p>
             ${record.contactEmail ? `<p><strong>Contact:</strong> ${record.contactEmail}</p>` : ""}
             ${record.source ? `<p><strong>Source note:</strong> ${record.source}</p>` : ""}
             <hr class="rule">
             <p style="white-space:pre-wrap">${record.message}</p>
             <hr class="rule">
             <p><a href="${siteUrl}/admin">Review in Admin →</a></p>`,
            `RSR Crime Division — Admin Notification`
          );
          const result = await sendEmail({ to: newsroom, subject: `[Crime Wire] New tip — ${record.name ?? "Anonymous"}`, html });
          await logEmail({ type: "notification", category: "tip", to: newsroom, ok: result.ok, error: result.error ?? null, timestamp: now() });
        } catch (e) { console.error("tip notification failed:", e.message); }
      })();
    }

    return res.status(201).json({ id, createdAt: record.createdAt });
  } catch (e) {
    console.error("POST /tips:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

app.get("/tips", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-tips"));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// =============================================================
// ── Issues (Crime Wire editions) ─────────────────────────────
// =============================================================

const issueUpload = memUpload.fields([
  { name: "pdf",   maxCount: 1 },
  { name: "cover", maxCount: 1 },
]);

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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

app.get("/issues/all", requireAdmin, async (_req, res) => {
  try {
    const all = await getAll("cw-issues");
    return res.json(all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

app.get("/issues/latest", async (_req, res) => {
  try {
    const all = await getAll("cw-issues");
    const published = all
      .filter((r) => r.status === "published")
      .sort((a, b) => {
        // Sort by publishDate descending; use id as tiebreaker so the newest
        // record wins even when two issues share the same publish date.
        const da = new Date(a.publishDate ?? a.createdAt);
        const db = new Date(b.publishDate ?? b.createdAt);
        const diff = db - da;
        return diff !== 0 ? diff : (b.id ?? 0) - (a.id ?? 0);
      });
    if (!published.length) return res.status(404).json({ error: "No published issue found" });
    return res.json(published[0]);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

app.post("/issues", requireAdmin, (req, res) => {
  issueUpload(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message || "Upload error" });

      const body = req.body ?? {};
      let pdfUrl = body.pdfUrl ?? null;

      const pdfFile = req.files?.pdf?.[0];
      if (pdfFile) {
        const filename = `${Date.now()}-${safeName(pdfFile.originalname)}`;
        await saveFile(`editions/${filename}`, pdfFile.buffer, pdfFile.mimetype);
        pdfUrl = `/api/files/editions/${filename}`;
      }

      let coverImageUrl = body.coverImageUrl ?? null;
      const coverFile = req.files?.cover?.[0];
      if (coverFile) {
        const filename = `${Date.now()}-cover-${safeName(coverFile.originalname)}`;
        await saveFile(`editions/${filename}`, coverFile.buffer, coverFile.mimetype);
        coverImageUrl = `/api/files/editions/${filename}`;
      }

      const id = await nextId("cw-issues");
      const record = {
        id,
        volume: parseInt(body.volume, 10) || 1,
        number: body.number,
        title: body.title,
        tagline: body.tagline ?? null,
        headline: body.headline ?? null,
        deck: body.deck ?? null,
        caseLabel: body.caseLabel ?? null,
        description: body.description ?? null,
        pdfUrl,
        coverImageUrl,
        pageCount: parseInt(body.pageCount, 10) || 12,
        accessLevel: body.accessLevel ?? "public",
        status: body.status ?? "draft",
        publishDate: body.publishDate ?? null,
        dropDate: body.dropDate ?? null,
        countdownEnabled: body.countdownEnabled !== "false",
        publicStatus: body.publicStatus ?? null,
        readCtaLabel: body.readCtaLabel ?? null,
        readCtaUrl: body.readCtaUrl ?? null,
        downloadCtaLabel: body.downloadCtaLabel ?? null,
        downloadCtaUrl: body.downloadCtaUrl ?? null,
        joinCtaLabel: body.joinCtaLabel ?? null,
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
      return res.status(500).json({ error: e.message || "Server error" });
    }
  });
});

app.patch("/issues/:id", requireAdmin, (req, res) => {
  issueUpload(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message || "Upload error" });

      const id = parseInt(req.params.id, 10);
      const all = await getAll("cw-issues");
      const idx = all.findIndex((r) => r.id === id);
      if (idx === -1) return res.status(404).json({ error: "Not found" });

      const body = req.body ?? {};
      const rec = all[idx];

      const pdfFile2 = req.files?.pdf?.[0];
      if (pdfFile2) {
        const filename = `${Date.now()}-${safeName(pdfFile2.originalname)}`;
        await saveFile(`editions/${filename}`, pdfFile2.buffer, pdfFile2.mimetype);
        rec.pdfUrl = `/api/files/editions/${filename}`;
      }

      const coverFile2 = req.files?.cover?.[0];
      if (coverFile2) {
        const filename = `${Date.now()}-cover-${safeName(coverFile2.originalname)}`;
        await saveFile(`editions/${filename}`, coverFile2.buffer, coverFile2.mimetype);
        rec.coverImageUrl = `/api/files/editions/${filename}`;
      }

      const fields = [
        "volume", "number", "title", "tagline", "headline", "deck", "caseLabel",
        "description", "pdfUrl", "coverImageUrl", "pageCount", "accessLevel",
        "status", "publishDate", "dropDate", "publicStatus",
        "readCtaLabel", "readCtaUrl", "downloadCtaLabel", "downloadCtaUrl", "joinCtaLabel",
      ];
      for (const f of fields) {
        if (body[f] !== undefined) rec[f] = body[f];
      }
      if (body.countdownEnabled !== undefined) {
        rec.countdownEnabled = body.countdownEnabled !== "false" && body.countdownEnabled !== false;
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
      return res.status(500).json({ error: e.message || "Server error" });
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

    // Fire-and-forget newsroom notification
    if (emailReady() && emailCfg().newsroom) {
      (async () => {
        try {
          const { newsroom, siteUrl } = emailCfg();
          const html = emailHtml(
            `<h2>New Press Club Application</h2>
             <p><strong>Name:</strong> ${record.name ?? "—"}</p>
             <p><strong>Email:</strong> ${record.email}</p>
             <p><strong>Tier:</strong> ${record.tier}</p>
             ${record.city ? `<p><strong>City:</strong> ${record.city}${record.zip ? `, ${record.zip}` : ""}</p>` : ""}
             ${record.message ? `<hr class="rule"><p style="white-space:pre-wrap">${record.message}</p>` : ""}
             <hr class="rule">
             <p><a href="${siteUrl}/admin">Review in Admin →</a></p>`,
            `RSR Crime Division — Admin Notification`
          );
          const result = await sendEmail({ to: newsroom, subject: `[Crime Wire] Press Club — ${record.name ?? record.email} (${record.tier})`, html });
          await logEmail({ type: "notification", category: "press-club", to: newsroom, ok: result.ok, error: result.error ?? null, timestamp: now() });
        } catch (e) { console.error("press-club notification failed:", e.message); }
      })();
    }

    return res.status(201).json({ id, email, tier, createdAt: record.createdAt });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

app.get("/corrections/all", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-corrections"));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

app.get("/reports/all/list", requireAdmin, async (_req, res) => {
  try {
    const all = await getAll("cw-reports");
    return res.json(all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// =============================================================
// ── Uploads (media / records) ─────────────────────────────────
// =============================================================

const fileUpload = memUpload.single("file");

app.post("/uploads", requireAdmin, (req, res) => {
  fileUpload(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message || "Upload error" });
      if (!req.file) return res.status(400).json({ error: "File is required" });

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
      return res.status(500).json({ error: e.message || "Server error" });
    }
  });
});

app.get("/uploads", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-uploads"));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// ── File serving (editions + uploads) ─────────────────────────

app.get("/files/editions/:filename", async (req, res) => {
  try {
    const buf = await getFile(`editions/${req.params.filename}`);
    if (!buf) return res.status(404).json({ error: "File not found" });
    const isDownload = req.query.download === "1" || req.query.download === "true";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${isDownload ? "attachment" : "inline"}; filename="${req.params.filename}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(buf);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

app.get("/case-files/all", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-casefiles"));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// =============================================================
// ── Records Requests (FOIA/CPRA tracking) ─────────────────────
// =============================================================

app.get("/records-requests", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-recsreqs"));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// =============================================================
// ── Advertisers ────────────────────────────────────────────────
// =============================================================

app.get("/advertisers", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getAll("cw-advertisers"));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// =============================================================
// ── Settings ───────────────────────────────────────────────────
// =============================================================

const ALLOWED_KEYS = new Set([
  "newsroom_status", "publication_name", "editor_name",
  "contact_email", "mailing_address", "social_twitter",
  "social_instagram", "edition_url", "subscription_note",
  // Added for AdminSettings editorial fields:
  "thursday_release_info", "standard_byline", "tagline",
  "edition_schedule", "city_desk_notice", "records_desk_notice", "homepage_notice",
]);

app.get("/settings", requireAdmin, async (_req, res) => {
  try {
    const store = getStore("cw-settings");
    const settings = (await store.get("all", { type: "json" })) ?? {};
    return res.json(settings);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
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
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// =============================================================
// ── Unsubscribe (public, token-gated) ────────────────────────
// =============================================================

app.get("/unsubscribe", async (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) {
    return res.status(400).send("<h2>Invalid unsubscribe link.</h2>");
  }
  const expected = await unsubToken(String(email)).catch(() => null);
  if (!expected || token !== expected) {
    return res.status(400).send("<h2>Invalid or expired unsubscribe link.</h2>");
  }
  try {
    const all = await getAll("cw-subs");
    const idx = all.findIndex((r) => r.email.toLowerCase().trim() === String(email).toLowerCase().trim());
    if (idx === -1) {
      return res.send(`<!DOCTYPE html><html><body style="font-family:Georgia;max-width:480px;margin:60px auto;padding:20px;"><h2 style="font-family:Arial;text-transform:uppercase;">Already removed.</h2><p>That address is not on our list.</p></body></html>`);
    }
    all[idx].status = "unsubscribed";
    all[idx].unsubscribedAt = now();
    await saveAll("cw-subs", all);
    return res.send(`<!DOCTYPE html><html><head><title>Unsubscribed</title></head><body style="font-family:Georgia;max-width:480px;margin:60px auto;padding:20px;border-top:4px solid #000;"><p style="font:700 10px/1 Arial;letter-spacing:.2em;text-transform:uppercase;color:#888;margin-bottom:16px;">RSR Crime Division</p><h2 style="font-family:Arial;text-transform:uppercase;margin-bottom:12px;">You've been removed.</h2><p>You've been unsubscribed from The Thursday Drop and will receive no further editions.</p><p style="color:#888;font-size:13px;margin-top:24px;">— Los Angeles Crime Wire</p></body></html>`);
  } catch (e) {
    return res.status(500).send("<h2>An error occurred. Please try again.</h2>");
  }
});

// =============================================================
// ── Admin — Email dispatch ────────────────────────────────────
// =============================================================

/** GET /admin/email/recipients — count of digital-eligible active subscribers */
app.get("/admin/email/recipients", requireAdmin, async (_req, res) => {
  try {
    const allSubs = await getAll("cw-subs");
    const active = allSubs.filter((s) => s.status === "active");
    const eligible = active.filter((s) => s.editionType === "digital" || s.editionType === "both");
    const skipped  = active.filter((s) => s.editionType === "mailed").length;
    return res.json({ eligible: eligible.length, total: active.length, skipped });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

/** GET /admin/email/status — config check + recent delivery log */
app.get("/admin/email/status", requireAdmin, async (_req, res) => {
  const c = emailCfg();
  const missing = [
    !c.apiKey   && "RESEND_API_KEY",
    !c.from     && "EMAIL_FROM",
  ].filter(Boolean);
  const optional = [
    !c.newsroom && "EMAIL_NEWSROOM",
    !c.replyTo  && "EMAIL_REPLY_TO",
    !c.siteUrl  && "SITE_URL",
  ].filter(Boolean);

  let recentLog = [];
  try {
    const store = getStore("cw-email-log");
    recentLog = (await store.get("log", { type: "json" })) ?? [];
  } catch { /* non-fatal */ }

  return res.json({
    configured: missing.length === 0,
    missing,
    optional,
    siteUrl: c.siteUrl,
    hasNewsroom: !!c.newsroom,
    recentLog: recentLog.slice(0, 30),
  });
});

/** POST /admin/email/test — send a test message to one address */
app.post("/admin/email/test", requireAdmin, async (req, res) => {
  const { to } = req.body ?? {};
  if (!to) return res.status(400).json({ error: "to address required" });
  if (!emailReady()) return res.status(503).json({ error: "Email not configured — set RESEND_API_KEY and EMAIL_FROM" });
  const subject = `[Crime Wire] Test email — ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}`;
  const html = emailHtml(
    `<h2>Test Delivery</h2>
     <p>This is a test email from the Crime Wire admin panel. Delivery is confirmed.</p>
     <p style="font-size:13px;color:#555;">Sent: ${now()} UTC</p>`,
    `RSR Crime Division — Los Angeles Crime Wire`
  );
  const result = await sendEmail({ to, subject, html });
  await logEmail({ type: "test", to, subject, ok: result.ok, error: result.error ?? null, timestamp: now() });
  if (!result.ok) return res.status(502).json({ error: result.error || "Delivery failed" });
  return res.json({ ok: true, timestamp: now() });
});

/** POST /admin/email/send-issue — dispatch Thursday Drop to digital-eligible subscribers */
app.post("/admin/email/send-issue", requireAdmin, async (req, res) => {
  const { subject, preview, message, issueId, confirmSend } = req.body ?? {};
  if (!subject) return res.status(400).json({ error: "subject is required" });
  if (!confirmSend) return res.status(400).json({ error: "confirmSend must be true — this protects against accidental duplicate sends" });
  if (!emailReady()) return res.status(503).json({ error: "Email not configured — set RESEND_API_KEY and EMAIL_FROM" });

  // Look up the issue record if issueId provided
  let issueRec = null;
  if (issueId) {
    try {
      const allIssues = await getAll("cw-issues");
      issueRec = allIssues.find((r) => r.id === parseInt(String(issueId), 10)) ?? null;
    } catch { /* non-fatal */ }
  }

  // Idempotency guard: per-issue-id if issue is known; otherwise 6-hour subject guard
  try {
    const logStore = getStore("cw-email-log");
    const prevLog = (await logStore.get("log", { type: "json" })) ?? [];
    if (issueRec) {
      const dup = prevLog.find((e) => e.type === "campaign" && e.issueId === issueRec.id);
      if (dup) return res.status(409).json({
        error: `Issue "${issueRec.title}" was already dispatched on ${dup.timestamp}. Each issue can only be sent once.`,
        duplicate: true,
      });
    } else {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const recent = prevLog.find((e) => e.type === "campaign" && e.subject === subject && e.timestamp > sixHoursAgo);
      if (recent) return res.status(409).json({
        error: `This subject line was already dispatched at ${recent.timestamp}. Change the subject or wait 6 hours to re-send.`,
        duplicate: true,
      });
    }
  } catch { /* non-fatal */ }

  // Only send to subscribers who want the digital edition (digital or both)
  const allSubs = await getAll("cw-subs");
  const activeSubs = allSubs.filter((s) =>
    s.status === "active" && (s.editionType === "digital" || s.editionType === "both")
  );
  const skippedMailedOnly = allSubs.filter((s) =>
    s.status === "active" && s.editionType === "mailed"
  ).length;
  if (activeSubs.length === 0) return res.status(400).json({ error: "No digital-eligible active subscribers found" });

  const { siteUrl } = emailCfg();

  // Build issue-aware URLs (make relative paths absolute)
  function absUrl(url) {
    if (!url) return null;
    return url.startsWith("/") ? `${siteUrl}${url}` : url;
  }
  const readUrl  = absUrl(issueRec?.readCtaUrl || issueRec?.pdfUrl) || `${siteUrl}/crime-wire`;
  const dlUrl    = absUrl(issueRec?.downloadCtaUrl || (issueRec?.pdfUrl ? `${issueRec.pdfUrl}?download=1` : null));
  const issueDate = issueRec?.publishDate
    ? new Date(issueRec.publishDate + (issueRec.publishDate.length === 10 ? "T12:00:00" : ""))
        .toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;

  let sent = 0, failed = 0;
  const errors = [];

  for (const sub of activeSubs) {
    try {
      const tok = await unsubToken(sub.email);
      const unsubUrl = `${siteUrl}/api/unsubscribe?email=${encodeURIComponent(sub.email)}&token=${tok}`;

      const issueHeader = issueRec ? `
        <div style="border-bottom:2px solid #000;padding-bottom:14px;margin-bottom:20px;">
          <p style="font:700 10px/1 Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#888;margin:0 0 6px">
            Vol. ${issueRec.volume ?? "I"} &middot; ${issueRec.number ?? ""}
          </p>
          <p style="font:700 22px/1.1 Arial,sans-serif;text-transform:uppercase;margin:0 0 4px">${issueRec.title ?? ""}</p>
          ${issueDate ? `<p style="font:400 12px/1 Arial,sans-serif;color:#555;margin:0">${issueDate}</p>` : ""}
        </div>` : "";

      const bodyHtml = `
        ${issueHeader}
        <h2>${subject}</h2>
        ${preview ? `<p style="font-size:15px;font-style:italic;color:#444;margin:0 0 16px">${preview}</p>` : ""}
        ${message ? `<p style="font-size:15px;line-height:1.65;margin:0 0 16px">${message}</p>` : ""}
        ${!message && !preview ? `<p>This week's Los Angeles Crime Wire is now available. Thank you for reading.</p>` : ""}
        <p style="text-align:center;margin:28px 0;">
          <a href="${readUrl}" class="cta-btn">Read This Week's Edition &rarr;</a>
        </p>
        ${dlUrl ? `<p style="text-align:center;margin:0 0 24px;">
          <a href="${dlUrl}" style="font:700 11px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#000;text-decoration:underline;">&darr; Download PDF</a>
        </p>` : ""}
        <hr class="rule">
        <p style="font-size:13px;color:#555;font-style:italic;">Victim first. Facts second. Theories last.</p>`;

      const html = emailHtml(
        bodyHtml,
        `Los Angeles Crime Wire &middot; <a href="${siteUrl}">${siteUrl}</a><br>
         <a href="${unsubUrl}">Unsubscribe</a> &middot; You're receiving this because you signed up for the Thursday Drop.`
      );

      const result = await sendEmail({ to: sub.email, subject, html });
      if (result.ok) { sent++; } else { failed++; errors.push({ email: sub.email, error: result.error }); }
      // Brief pause to respect Resend rate limits
      await new Promise((r) => setTimeout(r, 60));
    } catch (e) {
      failed++;
      errors.push({ email: sub.email, error: e.message });
    }
  }

  await logEmail({
    type: "campaign",
    subject,
    preview: preview ?? null,
    message: message ?? null,
    issueId: issueRec?.id ?? null,
    issueTitle: issueRec?.title ?? null,
    readUrl: readUrl ?? null,
    total: activeSubs.length,
    skipped: skippedMailedOnly,
    sent,
    failed,
    errors: errors.slice(0, 10),
    timestamp: now(),
    sentBy: "admin",
  });

  return res.json({ ok: true, sent, failed, skipped: skippedMailedOnly, total: activeSubs.length, timestamp: now() });
});

/** GET /admin/email/log — full delivery log */
app.get("/admin/email/log", requireAdmin, async (req, res) => {
  try {
    const store = getStore("cw-email-log");
    const log = (await store.get("log", { type: "json" })) ?? [];
    const limit = Math.min(parseInt(req.query.limit ?? "50", 10), 200);
    return res.json(log.slice(0, limit));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// =============================================================
// ── First-run seed (public editions only) ────────────────────
// Seeds only when the issues store is completely empty.
// Safe to call on every deploy — idempotent by design.
// Run once after first EdgeOne deployment via:
//   curl -X POST https://lacrimewire.online/api/admin/seed \
//        -H "Cookie: cw_session=<your-admin-token>"
// =============================================================

app.post("/admin/seed", requireAdmin, async (_req, res) => {
  try {
    const existing = await getAll("cw-issues");
    if (existing.length > 0) {
      return res.json({
        seeded: false,
        message: "Issues store already has data — seed skipped.",
        count: existing.length,
      });
    }
    const ts = now();
    const seeds = [
      {
        id: 1,
        volume: 1,
        number: "No. 1",
        title: "The Missing Exit",
        tagline: "The Biltmore Hotel and the last confirmed location in the Black Dahlia movement record.",
        headline: "The Missing Exit",
        description:
          "The Biltmore Hotel and the last confirmed location in the Black Dahlia movement record.",
        pdfUrl: "/editions/edition-001-the-missing-exit.pdf",
        pageCount: 12,
        accessLevel: "public",
        status: "archived",
        publishDate: "2026-07-24T00:00:00.000Z",
        createdAt: ts,
      },
      {
        id: 2,
        volume: 1,
        number: "No. 2",
        title: "August 5, 2026",
        tagline: "Los Angeles Crime Wire — Second Edition.",
        headline: null,
        description: "Los Angeles Crime Wire — Second Edition.",
        pdfUrl: "/editions/edition-002-august-5-2026.pdf",
        pageCount: 12,
        accessLevel: "public",
        status: "published",
        publishDate: "2026-08-05T00:00:00.000Z",
        createdAt: ts,
      },
    ];
    // Set sequence counter to match highest seeded ID
    const seqStore = getStore("cw-issues");
    await seqStore.set("seq", String(seeds.length));
    await saveAll("cw-issues", seeds);
    return res.json({ seeded: true, message: "Seeded 2 public editions.", count: seeds.length });
  } catch (e) {
    console.error("POST /admin/seed:", e);
    return res.status(500).json({ error: "Seed failed: " + e.message });
  }
});

// =============================================================
// ── Comics ────────────────────────────────────────────────────
// =============================================================

const comicUpload = memUpload.single("artwork");

// Public: published strips only, sorted by series then episode desc
app.get("/comics", async (_req, res) => {
  try {
    const all = await getAll("cw-comics");
    const published = all
      .filter((c) => c.status === "published")
      .sort((a, b) => {
        if (a.series !== b.series) return a.series.localeCompare(b.series);
        return (b.episode ?? 0) - (a.episode ?? 0);
      });
    return res.json(published);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// Admin: all comics
app.get("/admin/comics", requireAdmin, async (_req, res) => {
  try {
    const all = await getAll("cw-comics");
    all.sort((a, b) => {
      if (a.series !== b.series) return a.series.localeCompare(b.series);
      return (b.episode ?? 0) - (a.episode ?? 0);
    });
    return res.json(all);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// Admin: create comic
app.post("/admin/comics", requireAdmin, (req, res) => {
  comicUpload(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message || "Upload error" });

      const body = req.body ?? {};
      let artworkUrl = body.artworkUrl || null;

      if (req.file) {
        const filename = `${Date.now()}-${safeName(req.file.originalname)}`;
        await saveFile(`comics/${filename}`, req.file.buffer, req.file.mimetype);
        artworkUrl = `/api/files/comics/${filename}`;
      }

      const id = await nextId("cw-comics");
      const all = await getAll("cw-comics");
      const record = {
        id,
        series: body.series ?? "ink-and-alibi",
        episode: body.episode ? parseInt(body.episode, 10) : null,
        title: body.title || null,
        artworkUrl,
        caption: body.caption || null,
        transcript: body.transcript || null,
        publishDate: body.publishDate || null,
        status: body.status ?? "draft",
        sortOrder: body.sortOrder ? parseInt(body.sortOrder, 10) : id,
        createdAt: now(),
        updatedAt: now(),
      };
      all.unshift(record);
      await saveAll("cw-comics", all);
      await logAction("create", "comic", id, `${record.series} #${record.episode}: ${record.title}`);
      return res.status(201).json(record);
    } catch (e) {
      console.error("POST /admin/comics:", e);
      return res.status(500).json({ error: e.message || "Server error" });
    }
  });
});

// Admin: update comic
app.patch("/admin/comics/:id", requireAdmin, (req, res) => {
  comicUpload(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message || "Upload error" });

      const id = parseInt(req.params.id, 10);
      const all = await getAll("cw-comics");
      const idx = all.findIndex((c) => c.id === id);
      if (idx === -1) return res.status(404).json({ error: "Not found" });

      const body = req.body ?? {};

      if (req.file) {
        const filename = `${Date.now()}-${safeName(req.file.originalname)}`;
        await saveFile(`comics/${filename}`, req.file.buffer, req.file.mimetype);
        all[idx].artworkUrl = `/api/files/comics/${filename}`;
      } else if (body.artworkUrl !== undefined) {
        all[idx].artworkUrl = body.artworkUrl || null;
      }

      const strFields = ["series", "title", "caption", "transcript", "publishDate", "status"];
      const intFields = ["episode", "sortOrder"];
      for (const f of strFields) {
        if (body[f] !== undefined) all[idx][f] = body[f] || null;
      }
      for (const f of intFields) {
        if (body[f] !== undefined) all[idx][f] = body[f] ? parseInt(body[f], 10) : null;
      }
      all[idx].updatedAt = now();
      await saveAll("cw-comics", all);
      await logAction("update", "comic", id, `${all[idx].series} #${all[idx].episode}: ${all[idx].title}`);
      return res.json(all[idx]);
    } catch (e) {
      console.error("PATCH /admin/comics/:id:", e);
      return res.status(500).json({ error: e.message || "Server error" });
    }
  });
});

// Admin: delete comic (hard delete)
app.delete("/admin/comics/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const all = await getAll("cw-comics");
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    await logAction("delete", "comic", id, `${all[idx].series} #${all[idx].episode}`);
    all.splice(idx, 1);
    await saveAll("cw-comics", all);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// Public file serving for comics artwork (timestamp-prefixed, effectively unguessable)
app.get("/files/comics/:filename", async (req, res) => {
  try {
    const buf = await getFile(`comics/${req.params.filename}`);
    if (!buf) return res.status(404).json({ error: "File not found" });
    const name = req.params.filename.toLowerCase();
    const mime = name.endsWith(".png") ? "image/png"
      : name.endsWith(".gif") ? "image/gif"
      : name.endsWith(".webp") ? "image/webp"
      : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(Buffer.from(buf));
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

// =============================================================
// ── Blob storage diagnostic (admin only) ──────────────────────
// =============================================================

app.get("/admin/blob-test", requireAdmin, async (_req, res) => {
  const results = {};
  // Test write+read round-trip on cw-files
  try {
    const store = getStore("cw-files");
    const testKey = "__health__";
    const testPayload = { ok: true, ts: Date.now() };
    await store.setJSON(testKey, testPayload);
    const readBack = await store.get(testKey, { type: "json" });
    results.cwFiles = { ok: true, roundTrip: readBack?.ok === true };
  } catch (e) {
    results.cwFiles = { ok: false, error: e.message };
  }
  // Test cw-issues read
  try {
    const issues = await getAll("cw-issues");
    results.issueCount = issues.length;
  } catch (e) {
    results.issueCount = { error: e.message };
  }
  return res.json(results);
});

// =============================================================
// ── Catch-all: 404 for unknown API routes ─────────────────────
// =============================================================

app.use((_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// MUST export — do NOT call app.listen()
export default app;
