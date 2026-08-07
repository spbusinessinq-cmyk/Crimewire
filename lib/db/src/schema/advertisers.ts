import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Advertiser management. Paid content MUST display ADVERTISEMENT or PAID COMIC.
// approval_status: pending | approved | active | paused | completed | rejected

export const advertisersTable = pgTable("advertisers", {
  id: serial("id").primaryKey(),

  businessName: text("business_name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),

  placementDesc: text("placement_desc"),          // where/how ad appears
  campaignStartDate: timestamp("campaign_start_date"),
  campaignEndDate: timestamp("campaign_end_date"),

  destinationUrl: text("destination_url"),
  campaignSource: text("campaign_source"),         // ?src= tracking param value

  // Required disclosure label — must be shown on all paid content
  // ADVERTISEMENT | PAID_COMIC | SPONSORED
  disclosureLabel: text("disclosure_label").notNull().default("ADVERTISEMENT"),

  // pending | approved | active | paused | completed | rejected
  approvalStatus: text("approval_status").notNull().default("pending"),

  assetsDescription: text("assets_description"),   // description of supplied materials
  active: boolean("active").notNull().default(false),

  internalNotes: text("internal_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Advertiser = typeof advertisersTable.$inferSelect;
export type InsertAdvertiser = typeof advertisersTable.$inferInsert;
