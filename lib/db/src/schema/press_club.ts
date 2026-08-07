import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Covers Press Club interest, Founding Supporter waitlist, and Print Edition waitlist.
// Thursday Drop mailing-list signups live in the existing `subscriptions` table.
// No payment is taken. All tiers are interest/waitlist signups only.
export const pressClubTable = pgTable("press_club", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  // press_club | founding | print_waitlist
  tier: text("tier").notNull(),
  city: text("city"),
  zip: text("zip"),
  // Collected only for print_waitlist tier
  mailingAddress: text("mailing_address"),
  message: text("message"),
  // QR / campaign source parameter value
  source: text("source"),
  consent: boolean("consent").notNull().default(true),
  // active | unsubscribed | waitlisted | confirmed
  status: text("status").notNull().default("active"),
  // Admin notes — not shown to reader
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PressClub = typeof pressClubTable.$inferSelect;
export type InsertPressClub = typeof pressClubTable.$inferInsert;
