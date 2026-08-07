import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tipsTable = pgTable("tips", {
  id: serial("id").primaryKey(),
  nameOrAlias: text("name_or_alias"),
  contactEmail: text("contact_email"),
  message: text("message").notNull(),
  provenance: text("provenance"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTipSchema = createInsertSchema(tipsTable).omit({ id: true, createdAt: true });
export type InsertTip = z.infer<typeof insertTipSchema>;
export type Tip = typeof tipsTable.$inferSelect;
