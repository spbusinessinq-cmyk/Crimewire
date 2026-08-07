import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

// Public Records Desk — FOIA/CPRA requests and document tracking.
// status: pending | submitted | partial | fulfilled | denied | withdrawn

export const recordsRequestsTable = pgTable("records_requests", {
  id: serial("id").primaryKey(),

  title: text("title").notNull(),
  agency: text("agency"),
  requestDate: timestamp("request_date"),
  responseDue: timestamp("response_due"),
  responseDate: timestamp("response_date"),

  // pending | submitted | partial | fulfilled | denied | withdrawn
  status: text("status").notNull().default("pending"),

  documentsReceived: text("documents_received"),  // description of what arrived
  publicVersionAvailable: boolean("public_version_available").notNull().default(false),

  internalNotes: text("internal_notes"),

  // Optional linkage to a case file
  relatedCaseId: integer("related_case_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RecordsRequest = typeof recordsRequestsTable.$inferSelect;
export type InsertRecordsRequest = typeof recordsRequestsTable.$inferInsert;
