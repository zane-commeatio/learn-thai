import type { EditorPayload } from "../../../src/contracts/editor-payload";
import { boolean, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { clips } from "./clips";
import { processingJobs } from "./processing-jobs";

export const clipReviewStatusEnum = pgEnum("clip_review_status", [
  "generated",
  "edited",
  "approved",
  "rejected",
  "needs_fixes",
]);

export const clipEditorStates = pgTable("clip_editor_states", {
  clipId: text("clip_id")
    .primaryKey()
    .references(() => clips.id, { onDelete: "cascade" }),
  sourceJobId: text("source_job_id")
    .notNull()
    .references(() => processingJobs.id, { onDelete: "cascade" }),
  payload: jsonb("payload").$type<EditorPayload>().notNull(),
  reviewStatus: clipReviewStatusEnum("review_status").notNull(),
  hasManualChanges: boolean("has_manual_changes").notNull().default(false),
  lastReseededAt: timestamp("last_reseeded_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
