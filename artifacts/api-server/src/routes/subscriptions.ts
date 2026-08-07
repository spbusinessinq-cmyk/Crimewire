import { Router } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { CreateSubscriptionBody } from "@workspace/api-zod";

const router = Router();

// POST /api/subscriptions
router.post("/", async (req, res) => {
  const result = CreateSubscriptionBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, name, zip, editionType, consent } = result.data;

  if (!consent) {
    res.status(400).json({ error: "You must consent to receive emails" });
    return;
  }

  // Basic email pattern check (since OpenAPI spec uses plain string type)
  if (!email.includes("@") || !email.includes(".")) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  // Basic ZIP validation (5 digits if provided)
  if (zip && !/^\d{5}$/.test(zip)) {
    res.status(400).json({ error: "ZIP code must be 5 digits" });
    return;
  }

  try {
    const [row] = await db
      .insert(subscriptionsTable)
      .values({
        email: email.toLowerCase().trim(),
        name: name ?? null,
        zip: zip ?? null,
        editionType,
        consent,
      })
      .returning();

    res.status(201).json({
      id: row.id,
      email: row.email,
      name: row.name ?? null,
      zip: row.zip ?? null,
      editionType: row.editionType,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === "23505") {
      res.status(409).json({ error: "This email is already subscribed." });
      return;
    }
    req.log.error({ err }, "Failed to create subscription");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/subscriptions (admin only)
router.get("/", adminAuth, async (req, res) => {
  const format = (req.query as { format?: string }).format;
  const rows = await db.select().from(subscriptionsTable).orderBy(subscriptionsTable.createdAt);

  if (format === "csv") {
    const header = "id,email,name,zip,editionType,createdAt\n";
    const body = rows
      .map(
        (r) =>
          `${r.id},"${r.email}","${r.name ?? ""}","${r.zip ?? ""}","${r.editionType}","${r.createdAt.toISOString()}"`
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="subscriptions.csv"');
    res.send(header + body);
    return;
  }

  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name ?? null,
      zip: r.zip ?? null,
      editionType: r.editionType,
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
