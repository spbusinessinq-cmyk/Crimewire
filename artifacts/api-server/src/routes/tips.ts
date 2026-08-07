import { Router } from "express";
import { db, tipsTable } from "@workspace/db";
import { CreateTipBody } from "@workspace/api-zod";

const router = Router();

// POST /api/tips
router.post("/", async (req, res) => {
  const result = CreateTipBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { nameOrAlias, contactEmail, message, provenance } = result.data;

  if (!message || message.trim().length < 10) {
    res.status(400).json({ error: "Message must be at least 10 characters" });
    return;
  }

  // Basic email check if provided
  if (contactEmail && (!contactEmail.includes("@") || !contactEmail.includes("."))) {
    res.status(400).json({ error: "Invalid contact email address" });
    return;
  }

  try {
    const [row] = await db
      .insert(tipsTable)
      .values({
        nameOrAlias: nameOrAlias ?? null,
        contactEmail: contactEmail ?? null,
        message: message.trim(),
        provenance: provenance ?? null,
      })
      .returning();

    res.status(201).json({
      id: row.id,
      nameOrAlias: row.nameOrAlias ?? null,
      contactEmail: row.contactEmail ?? null,
      message: row.message,
      provenance: row.provenance ?? null,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create tip");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/tips (admin only)
router.get("/", adminAuth, async (req, res) => {
  const rows = await db.select().from(tipsTable).orderBy(tipsTable.createdAt);
  res.json(
    rows.map((r) => ({
      id: r.id,
      nameOrAlias: r.nameOrAlias ?? null,
      contactEmail: r.contactEmail ?? null,
      message: r.message,
      provenance: r.provenance ?? null,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

function adminAuth(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    res
      .status(503)
      .json({ error: "Admin access not configured. Set ADMIN_PASSWORD environment secret." });
    return;
  }
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== adminPassword) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export default router;
