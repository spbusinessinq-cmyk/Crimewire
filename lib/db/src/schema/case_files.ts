import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Permanent investigative containers. Multiple reports can link to one case file.
// is_public controls whether the case file page is visible on the public site.
// status: open | cold | closed | referred | active_investigation

export const caseFilesTable = pgTable("case_files", {
  id: serial("id").primaryKey(),

  // e.g. BDH-002, LAPD-2026-001. Admin-assigned. Unique.
  identifier: text("identifier").notNull().unique(),
  title: text("title").notNull(),

  // Case status
  status: text("status").notNull().default("open"),

  // Public-facing content
  summary: text("summary"),        // narrative overview, shown publicly when is_public = true
  chronology: text("chronology"),  // timeline text, shown publicly when is_public = true

  // Internal only
  investigativeNotes: text("investigative_notes"),

  // Whether the case file page is publicly accessible
  isPublic: boolean("is_public").notNull().default(false),

  internalNotes: text("internal_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CaseFile = typeof caseFilesTable.$inferSelect;
export type InsertCaseFile = typeof caseFilesTable.$inferInsert;
