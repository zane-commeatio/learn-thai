import { z } from "zod";

export const PipelineStageSchema = z.enum([
  "audio",
  "asr",
  "segment",
  "translate",
  "finalize",
]);

export const ProcessingStateSchema = z.enum([
  "uploaded",
  "processing",
  "needs_review",
  "failed",
  "manual_intervention",
]);

export const ClipSourceTypeSchema = z.enum([
  "original",
  "licensed",
  "public_domain",
  "user_submitted",
]);

export const ClipRightsStatusSchema = z.enum([
  "unknown",
  "cleared",
  "restricted",
  "takedown",
]);

export const ClipSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  ownerId: z.string().min(1),
  sourceType: ClipSourceTypeSchema,
  rightsStatus: ClipRightsStatusSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ProcessingJobSchema = z.object({
  id: z.string().min(1),
  clipId: z.string().min(1),
  state: ProcessingStateSchema,
  stage: PipelineStageSchema,
  errorPayload: z.unknown().nullable().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type PipelineStage = z.infer<typeof PipelineStageSchema>;
export type ProcessingState = z.infer<typeof ProcessingStateSchema>;
export type ClipSourceType = z.infer<typeof ClipSourceTypeSchema>;
export type ClipRightsStatus = z.infer<typeof ClipRightsStatusSchema>;
export type Clip = z.infer<typeof ClipSchema>;
export type ProcessingJob = z.infer<typeof ProcessingJobSchema>;
