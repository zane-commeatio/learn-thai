import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const learnerEventNameEnum = pgEnum("learner_event_name", [
  "feed_loaded",
  "clip_impression",
  "clip_play_started",
  "clip_play_completed",
  "clip_replay",
  "transcript_revealed",
  "transcript_hidden",
  "slow_hold_started",
  "slow_hold_ended",
  "clip_load_failed",
]);

export const learnerEvents = pgTable("learner_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  name: learnerEventNameEnum("name").notNull(),
  clipId: text("clip_id"),
  clipVersion: integer("clip_version"),
  feedPosition: integer("feed_position"),
  playbackMs: integer("playback_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
