import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const auditLogActionEnum = pgEnum("audit_log_action", [
  "upload",
  "edit",
  "publish",
  "rollback",
  "delete",
  "retry",
  "legal_delist",
  "legal_reinstate",
  "legal_hold",
  "legal_remove",
]);

export const auditLogTargetTypeEnum = pgEnum("audit_log_target_type", [
  "clip",
  "clip_version",
  "segment",
  "token",
  "group",
  "meaning",
  "gloss",
  "job",
]);

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  action: auditLogActionEnum("action").notNull(),
  targetType: auditLogTargetTypeEnum("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
