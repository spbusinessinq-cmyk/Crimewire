import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

// Admin-managed issue records. Issue numbering is always a text label — never auto-incremented.
export const issuesTable = pgTable("issues", {
  id: serial("id").primaryKey(),
  volume: integer("volume").notNull().default(1),
  // Admin-controlled display label, e.g. "No. 1", "No. 2", "Special Edition"
  number: text("number").notNull(),
  title: text("title").notNull(),
  tagline: text("tagline"),
  headline: text("headline"),
  description: text("description"),
  // Relative path or URL to the PDF, e.g. /editions/issue-001.pdf
  pdfUrl: text("pdf_url"),
  // Derived from PDF if possible; admin can override. Default 12 for Crime Wire.
  pageCount: integer("page_count").default(12),
  // public | press_club | preview
  accessLevel: text("access_level").notNull().default("public"),
  // draft | published | archived
  status: text("status").notNull().default("draft"),
  publishDate: timestamp("publish_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Issue = typeof issuesTable.$inferSelect;
export type InsertIssue = typeof issuesTable.$inferInsert;
