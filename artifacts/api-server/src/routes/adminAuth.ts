/**
 * Express middleware that gates admin-only routes.
 * Accepts a valid cw_session cookie (JWT) or a Bearer token matching
 * ADMIN_CODE / ADMIN_PASSWORD — whichever is configured.
 */

import type { Request, Response, NextFunction } from "express";
import { isAdminRequest, getAdminCode } from "../lib/session-key";

export async function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const adminCode = getAdminCode();
  if (!adminCode) {
    res.status(503).json({ error: "Admin authentication is not configured." });
    return;
  }

  const ok = await isAdminRequest(req as any);
  if (!ok) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
