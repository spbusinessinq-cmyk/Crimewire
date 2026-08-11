import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

// Comic strips for The Funnies section. Two series: "ink-and-alibi" and "morning-joe".
export const comicsTable = pgTable("comics", {
  id: serial("id").primaryKey(),
  series: text("series").notNull(),          // "ink-and-alibi" | "morning-joe"
  episode: integer("episode"),               // week number
  title: text("title"),
  artworkUrl: text("artwork_url"),           // served path e.g. /api/files/comics/...
  caption: text("caption"),
  transcript: text("transcript"),            // accessible alt text / transcript
  publishDate: timestamp("publish_date"),
  status: text("status").notNull().default("draft"), // draft | published | archived
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Comic = typeof comicsTable.$inferSelect;
export type InsertComic = typeof comicsTable.$inferInsert;
