/**
 * Shared session-key helper for Replit dev api-server.
 * Both the auth router and the adminAuth middleware import from here
 * so they use the same process-local key in development.
 *
 * ADMIN_CODE || ADMIN_PASSWORD → admin access code (never logged)
 * SESSION_SECRET              → JWT signing key (mandatory in production)
 */

import crypto from "crypto";
import { jwtVerify } from "jose";

export const COOKIE_NAME = "cw_session";

let _devKey: Uint8Array | null = null;

/** Return the JWT signing key. Generates a random dev key when SESSION_SECRET
 *  is absent, with a one-time console warning. Fails closed in production. */
export function getSessionKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (s) return new TextEncoder().encode(s);

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }

  if (!_devKey) {
    _devKey = new Uint8Array(crypto.randomBytes(32));
    console.warn(
      "[auth] SESSION_SECRET is not set — using a temporary random dev key. " +
      "Sessions will not survive server restarts. " +
      "Set SESSION_SECRET in Replit Secrets for persistent sessions.",
    );
  }
  return _devKey;
}

/** Return the admin access code. Accepts ADMIN_CODE (EdgeOne) or
 *  ADMIN_PASSWORD (existing Replit secret). Returns undefined when absent. */
export function getAdminCode(): string | undefined {
  return process.env.ADMIN_CODE || process.env.ADMIN_PASSWORD;
}

/** Verify a cw_session JWT. Returns the payload on success, null on failure. */
export async function verifyCwSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSessionKey());
    if (payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Check whether the incoming request carries a valid admin session
 *  (cookie JWT preferred; Bearer token accepted as legacy fallback). */
export async function isAdminRequest(req: {
  cookies?: Record<string, string>;
  headers: { authorization?: string; cookie?: string };
}): Promise<boolean> {
  // 1. Cookie JWT (primary for cookie-auth frontend)
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    const payload = await verifyCwSession(cookieToken);
    if (payload) return true;
  }

  // 2. Bearer token (legacy fallback — keeps pre-migration admin scripts working)
  const adminCode = getAdminCode();
  if (adminCode) {
    const auth = (req.headers.authorization ?? "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (bearer && bearer === adminCode) return true;
  }

  return false;
}
