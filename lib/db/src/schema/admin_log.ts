import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

// Administrator activity history for important actions.
// Never deleted. Used for accountability, not debugging.
// action: publish | unpublish | correct | delete | archive | create | update | access_change | approve | reject

export const adminLogTable = pgTable("admin_log", {
  id: serial("id").primaryKey(),

  // Action taken
  action: text("action").notNull(),

  // What was acted on
  entityType: text("entity_type").notNull(), // report | issue | case_file | upload | correction | advertiser | subscriber
  entityId: integer("entity_id"),
  entityTitle: text("entity_title"),

  // Additional context as JSON — e.g. old/new status, affected fields
  details: text("details"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminLog = typeof adminLogTable.$inferSelect;
export type InsertAdminLog = typeof adminLogTable.$inferInsert;
