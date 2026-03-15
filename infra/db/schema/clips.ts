import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const clipSourceTypeEnum = pgEnum("clip_source_type", [
  "original",
  "licensed",
  "public_domain",
  "user_submitted",
]);

export const clipRightsStatusEnum = pgEnum("clip_rights_status", [
  "unknown",
  "cleared",
  "restricted",
  "takedown",
]);

export const clips = pgTable("clips", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  ownerId: text("owner_id").notNull(),
  sourceType: clipSourceTypeEnum("source_type").notNull(),
  rightsStatus: clipRightsStatusEnum("rights_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
