import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Public corrections log. Corrections are published with both the original error
// and the corrected information. No silent edits; no deletes.
export const correctionsTable = pgTable("corrections", {
  id: serial("id").primaryKey(),
  // Human-readable issue label, e.g. "Vol. 1, No. 2 — August 5, 2026"
  issueLabel: text("issue_label"),
  // Newspaper page/section, e.g. "Page 1 — Front Page", "Page 6 — Paper Trail"
  section: text("section"),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  // Admin note about nature of error — not shown publicly
  adminNote: text("admin_note"),
  // null = draft (not public); non-null = published and visible
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Correction = typeof correctionsTable.$inferSelect;
export type InsertCorrection = typeof correctionsTable.$inferInsert;
