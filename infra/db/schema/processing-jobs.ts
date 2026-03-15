import { pgEnum, pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { clips } from "./clips";

export const processingJobStateEnum = pgEnum("processing_job_state", [
  "uploaded",
  "processing",
  "needs_review",
  "failed",
  "manual_intervention",
]);

export const processingJobStageEnum = pgEnum("processing_job_stage", [
  "audio",
  "asr",
  "segment",
  "translate",
  "finalize",
]);

export const processingJobs = pgTable("processing_jobs", {
  id: text("id").primaryKey(),
  clipId: text("clip_id")
    .notNull()
    .references(() => clips.id, { onDelete: "cascade" }),
  state: processingJobStateEnum("state").notNull(),
  stage: processingJobStageEnum("stage").notNull(),
  artifactRefs: jsonb("artifact_refs"),
  errorPayload: jsonb("error_payload"),
  lockToken: text("lock_token"),
  lockExpiresAt: timestamp("lock_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
