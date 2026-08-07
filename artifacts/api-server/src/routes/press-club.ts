import { Router } from "express";
import { db, pressClubTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import { z } from "zod";

const router = Router();

const CreatePressClubSchema = z.object({
  email: z.string().email("A valid email address is required"),
  name: z.string().optional(),
  // press_club | founding | print_waitlist
  tier: z.enum(["press_club", "founding", "print_waitlist"]),
  city: z.string().optional(),
  zip: z.string().optional().refine((v) => !v || /^\d{5}$/.test(v), "ZIP must be 5 digits"),
  mailingAddress: z.string().optional(),
  message: z.string().optional(),
  source: z.string().optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "You must consent to be contacted." }),
  }),
});

// POST /api/press-club — public signup
router.post("/", async (req, res) => {
  const parsed = CreatePressClubSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, name, tier, city, zip, mailingAddress, message, source, consent } = parsed.data;

  try {
    const [row] = await db
      .insert(pressClubTable)
      .values({
        email: email.toLowerCase().trim(),
        name: name ?? null,
        tier,
        city: city ?? null,
        zip: zip ?? null,
        mailingAddress: mailingAddress ?? null,
        message: message ?? null,
        source: source ?? null,
        consent,
        status: "active",
      })
      .returning();

    res.status(201).json({
      id: row.id,
      email: row.email,
      tier: row.tier,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === "23505") {
      res.status(409).json({ error: "This email is already registered." });
      return;
    }
    req.log.error({ err }, "Failed to create press club signup");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/press-club — admin only
router.get("/", adminAuth, async (req, res) => {
  const format = (req.query as { format?: string }).format;
  const rows = await db.select().from(pressClubTable).orderBy(desc(pressClubTable.createdAt));

  if (format === "csv") {
    const header = "id,email,name,tier,city,zip,status,createdAt\n";
    const body = rows
      .map(
        (r) =>
          `${r.id},"${r.email}","${r.name ?? ""}","${r.tier}","${r.city ?? ""}","${r.zip ?? ""}","${r.status}","${r.createdAt.toISOString()}"`
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="press-club.csv"');
    res.send(header + body);
    return;
  }

  res.json(rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? null,
    tier: r.tier,
    city: r.city ?? null,
    zip: r.zip ?? null,
    mailingAddress: r.mailingAddress ?? null,
    message: r.message ?? null,
    source: r.source ?? null,
    status: r.status,
    adminNote: r.adminNote ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

// PATCH /api/press-club/:id — admin; update status or admin note
router.patch("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const UpdateSchema = z.object({
    status: z.enum(["active", "unsubscribed", "waitlisted", "confirmed"]).optional(),
    adminNote: z.string().optional(),
  });

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [row] = await db
    .update(pressClubTable)
    .set(parsed.data)
    .where(eq(pressClubTable.id, id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.json({ id: row.id, status: row.status, adminNote: row.adminNote ?? null });
});

export default router;
