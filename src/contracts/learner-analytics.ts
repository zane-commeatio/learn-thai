import { z } from "zod";

export const LearnerEventNameSchema = z.enum([
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

export const LearnerAnalyticsEventSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  name: LearnerEventNameSchema,
  clipId: z.string().trim().min(1).max(255).nullable().optional(),
  clipVersion: z.number().int().nonnegative().nullable().optional(),
  feedPosition: z.number().int().nonnegative().nullable().optional(),
  playbackMs: z.number().int().nonnegative().nullable().optional(),
});

export type LearnerEventName = z.infer<typeof LearnerEventNameSchema>;
export type LearnerAnalyticsEvent = z.infer<typeof LearnerAnalyticsEventSchema>;
