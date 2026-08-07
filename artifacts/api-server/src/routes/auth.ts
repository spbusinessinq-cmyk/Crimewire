/**
 * Cookie-based admin authentication for Replit dev (api-server).
 * Works with the same cw_session cookie and JWT format as the EdgeOne cloud function.
 *
 * Secret resolution (via shared lib/session-key.ts):
 *   - Admin code:  ADMIN_CODE (EdgeOne canonical) → ADMIN_PASSWORD (existing Replit secret)
 *   - Session key: SESSION_SECRET → process-local random dev key + console.warn
 *
 * Never log, reflect, or expose any secret value.
 */

import { Router } from "express";
import { SignJWT } from "jose";
import { COOKIE_NAME, getAdminCode, getSessionKey } from "../lib/session-key";

const router = Router();

// ── JWT helpers ───────────────────────────────────────────────

const SESSION_HOURS = 8;

async function mintToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(getSessionKey());
}

const COOKIE_OPTS = {
  httpOnly: true,
  // Replit preview is served over HTTPS via the proxy — secure flag is correct.
  secure: true,
  sameSite: "strict" as const,
  maxAge: SESSION_HOURS * 60 * 60 * 1000,
  path: "/",
};

// ── Rate limiter (per IP, per process) ───────────────────────

const loginAttempts = new Map<string, { n: number; t: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.t > RATE_WINDOW_MS) {
    loginAttempts.set(ip, { n: 1, t: now });
    return false;
  }
  if (rec.n >= RATE_MAX) return true;
  rec.n++;
  return false;
}

// ── Routes ────────────────────────────────────────────────────

/** POST /api/auth/login */
router.post("/login", async (req, res) => {
  const ip =
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (checkRateLimit(ip)) {
    res.status(429).json({ error: "Too many login attempts. Please wait 15 minutes." });
    return;
  }

  const adminCode = getAdminCode();
  if (!adminCode) {
    res.status(503).json({ error: "Admin authentication is not configured." });
    return;
  }

  const { code } = (req.body ?? {}) as { code?: string };
  if (!code || code !== adminCode) {
    res.status(401).json({ error: "Access denied." });
    return;
  }

  try {
    const token = await mintToken();
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not create session." });
  }
});

/** POST /api/auth/logout */
router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

/** GET /api/auth/me */
router.get("/me", async (req, res) => {
  const { isAdminRequest } = await import("../lib/session-key");
  const ok = await isAdminRequest(req as any);
  if (!ok) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
  }
  res.json({ authenticated: ok });
});

export default router;
