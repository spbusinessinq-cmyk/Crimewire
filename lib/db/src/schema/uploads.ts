import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

// Media and records uploads. An upload NEVER becomes public by default —
// approved_for_publication must be explicitly set to true by an admin.
// visibility: internal_only | public | redacted_public

export const uploadsTable = pgTable("uploads", {
  id: serial("id").primaryKey(),

  // File identity
  filename: text("filename").notNull(),          // stored filename (safe, unique)
  originalName: text("original_name").notNull(), // user's original filename
  filePath: text("file_path").notNull(),         // relative path or URL
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),                // bytes

  // Editorial metadata
  title: text("title"),
  caption: text("caption"),
  source: text("source"),
  credit: text("credit"),                        // photographer / author / agency
  acquisitionDate: timestamp("acquisition_date"),

  // Linkage (optional — can link to report, case, or neither)
  relatedReportId: integer("related_report_id"),
  relatedCaseId: integer("related_case_id"),

  // Access control
  // internal_only: never shown publicly (default)
  // public: shown with caption/credit
  // redacted_public: redacted version available, admin-noted
  visibility: text("visibility").notNull().default("internal_only"),
  // Must be explicitly approved — never defaults to true
  approvedForPublication: boolean("approved_for_publication").notNull().default(false),

  internalNotes: text("internal_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Upload = typeof uploadsTable.$inferSelect;
export type InsertUpload = typeof uploadsTable.$inferInsert;
