import { Router } from "express";
import { db, adminLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { adminAuth } from "./adminAuth";

const router = Router();

// GET /api/admin-log — admin only; recent activity
router.get("/", adminAuth, async (req, res) => {
  const limit = Math.min(parseInt((req.query as { limit?: string }).limit || "100"), 500);

  const rows = await db
    .select()
    .from(adminLogTable)
    .orderBy(desc(adminLogTable.createdAt))
    .limit(limit);

  res.json(rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId ?? null,
    entityTitle: r.entityTitle ?? null,
    details: r.details ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
