import { Router } from "express";
import { db, advertisersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { adminAuth } from "./adminAuth";
import { z } from "zod";

const router = Router();

const AdvertiserSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  placementDesc: z.string().optional(),
  campaignStartDate: z.string().optional(),
  campaignEndDate: z.string().optional(),
  destinationUrl: z.string().optional(),
  campaignSource: z.string().optional(),
  disclosureLabel: z.enum(["ADVERTISEMENT", "PAID_COMIC", "SPONSORED"]).default("ADVERTISEMENT"),
  approvalStatus: z.enum(["pending", "approved", "active", "paused", "completed", "rejected"]).default("pending"),
  assetsDescription: z.string().optional(),
  active: z.boolean().default(false),
  internalNotes: z.string().optional(),
});

// GET /api/advertisers — admin only
router.get("/", adminAuth, async (_req, res) => {
  const rows = await db.select().from(advertisersTable).orderBy(desc(advertisersTable.createdAt));
  res.json(rows.map(fmt));
});

// POST /api/advertisers — admin only
router.post("/", adminAuth, async (req, res) => {
  const parsed = AdvertiserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const d = parsed.data;
  const [row] = await db.insert(advertisersTable).values({
    businessName: d.businessName,
    contactName: d.contactName ?? null,
    contactEmail: d.contactEmail || null,
    placementDesc: d.placementDesc ?? null,
    campaignStartDate: d.campaignStartDate ? new Date(d.campaignStartDate) : null,
    campaignEndDate: d.campaignEndDate ? new Date(d.campaignEndDate) : null,
    destinationUrl: d.destinationUrl ?? null,
    campaignSource: d.campaignSource ?? null,
    disclosureLabel: d.disclosureLabel,
    approvalStatus: d.approvalStatus,
    assetsDescription: d.assetsDescription ?? null,
    active: d.active,
    internalNotes: d.internalNotes ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

// PATCH /api/advertisers/:id — admin only
router.patch("/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = AdvertiserSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const d = parsed.data;
  const updateValues: Partial<typeof advertisersTable.$inferInsert> = { updatedAt: new Date() };
  if ("businessName" in d && d.businessName) updateValues.businessName = d.businessName;
  if ("contactName" in d) updateValues.contactName = d.contactName ?? null;
  if ("contactEmail" in d) updateValues.contactEmail = d.contactEmail || null;
  if ("placementDesc" in d) updateValues.placementDesc = d.placementDesc ?? null;
  if ("campaignStartDate" in d) updateValues.campaignStartDate = d.campaignStartDate ? new Date(d.campaignStartDate) : null;
  if ("campaignEndDate" in d) updateValues.campaignEndDate = d.campaignEndDate ? new Date(d.campaignEndDate) : null;
  if ("destinationUrl" in d) updateValues.destinationUrl = d.destinationUrl ?? null;
  if ("campaignSource" in d) updateValues.campaignSource = d.campaignSource ?? null;
  if ("disclosureLabel" in d && d.disclosureLabel) updateValues.disclosureLabel = d.disclosureLabel;
  if ("approvalStatus" in d && d.approvalStatus) updateValues.approvalStatus = d.approvalStatus;
  if ("assetsDescription" in d) updateValues.assetsDescription = d.assetsDescription ?? null;
  if (typeof d.active === "boolean") updateValues.active = d.active;
  if ("internalNotes" in d) updateValues.internalNotes = d.internalNotes ?? null;

  const [row] = await db.update(advertisersTable).set(updateValues).where(eq(advertisersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Advertiser not found" }); return; }
  res.json(fmt(row));
});

function fmt(r: typeof advertisersTable.$inferSelect) {
  return {
    id: r.id,
    businessName: r.businessName,
    contactName: r.contactName ?? null,
    contactEmail: r.contactEmail ?? null,
    placementDesc: r.placementDesc ?? null,
    campaignStartDate: r.campaignStartDate?.toISOString() ?? null,
    campaignEndDate: r.campaignEndDate?.toISOString() ?? null,
    destinationUrl: r.destinationUrl ?? null,
    campaignSource: r.campaignSource ?? null,
    disclosureLabel: r.disclosureLabel,
    approvalStatus: r.approvalStatus,
    assetsDescription: r.assetsDescription ?? null,
    active: r.active,
    internalNotes: r.internalNotes ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export default router;
