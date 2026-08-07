import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

// Editorial workflow states
// draft | needs_review | scheduled | published | developing | updated | corrected | archived
// Placement is stored as JSON text: { homepage, city_desk, courts_records, records_desk, featured, crime_wire_queue }
// Evidence status: documented | corroborated | reported | oral_history | open | disputed | unverified | inference

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),

  // Report classification
  // crime_brief | incident_report | breaking | court_update | arrest | field_dispatch
  // records_update | community_safety | follow_up | correction_report
  type: text("type").notNull(),

  // Editorial workflow state
  status: text("status").notNull().default("draft"),

  // Core editorial fields
  headline: text("headline").notNull(),
  deck: text("deck"),                        // short summary line
  neighborhood: text("neighborhood"),
  city: text("city").default("Los Angeles"),
  incidentDate: timestamp("incident_date"),
  publishDate: timestamp("publish_date"),
  byline: text("byline"),

  // Body — plain text / markdown
  body: text("body").notNull().default(""),

  // Factual sourcing
  agenciesInvolved: text("agencies_involved"),   // comma-separated or JSON
  caseNumber: text("case_number"),
  reportNumber: text("report_number"),
  sourceLinks: text("source_links"),              // JSON array [{label, url}]
  evidenceStatus: text("evidence_status"),        // single label for lead classification

  // Media
  featuredImageUrl: text("featured_image_url"),

  // Internal — never shown publicly
  internalNotes: text("internal_notes"),

  // Linkage
  relatedCaseFileId: integer("related_case_file_id"),

  // Placement flags — JSON: {homepage:bool, city_desk:bool, courts_records:bool, records_desk:bool, featured:bool, crime_wire_queue:bool}
  placement: text("placement").default("{}"),

  // Developing story support
  isDeveloping: boolean("is_developing").notNull().default(false),
  // JSON array [{timestamp, summary, editor}]
  updateHistory: text("update_history").default("[]"),

  // Correction record
  correctionNotice: text("correction_notice"),   // shown publicly when status = corrected
  // JSON array [{timestamp, summary, editor, original, corrected}]
  correctionHistory: text("correction_history").default("[]"),

  // Timestamps
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Report = typeof reportsTable.$inferSelect;
export type InsertReport = typeof reportsTable.$inferInsert;
