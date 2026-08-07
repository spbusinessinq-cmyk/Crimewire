import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Key-value store for editorial settings.
// Keys: newsroom_status | thursday_release_info | standard_byline | contact_email | tagline | edition_schedule
// Values are plain text. No secrets stored here — use environment variables for credentials.

export const newsroomSettingsTable = pgTable("newsroom_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NewsroomSetting = typeof newsroomSettingsTable.$inferSelect;
