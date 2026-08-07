import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Reader Desk submissions. All moderated by default — status starts as 'pending'.
// Types: letter | spotlight | ask | art | puzzle_answer | wire_hunt | tip (general tip)
export const lettersTable = pgTable("letters", {
  id: serial("id").primaryKey(),
  // letter | spotlight | ask | art | puzzle_answer | wire_hunt | tip
  type: text("type").notNull(),
  nameOrAlias: text("name_or_alias"),
  contactEmail: text("contact_email"),
  body: text("body").notNull(),
  // Secondary context: puzzle answer key, art description, wire hunt answer, etc.
  extra: text("extra"),
  // QR / campaign source parameter value
  source: text("source"),
  // Reader consents to potential publication
  consentToPublish: boolean("consent_to_publish").notNull().default(false),
  // pending | approved | rejected | published
  status: text("status").notNull().default("pending"),
  // Admin notes — not shown to reader
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Letter = typeof lettersTable.$inferSelect;
export type InsertLetter = typeof lettersTable.$inferInsert;
