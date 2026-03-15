import { z } from "zod";
import { ClipRightsStatusSchema, ClipSourceTypeSchema } from "./pipeline";

export const CreateClipRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    source_type: ClipSourceTypeSchema,
    rights_status: ClipRightsStatusSchema,
  })
  .strict();

export const CreateClipResponseSchema = z.object({
  clipId: z.string().uuid(),
});

export const UploadCompleteParamsSchema = z.object({
  clipId: z.string().uuid(),
});

export const UploadCompleteResponseSchema = z.object({
  jobId: z.string().uuid(),
});

export type CreateClipRequest = z.infer<typeof CreateClipRequestSchema>;
export type CreateClipResponse = z.infer<typeof CreateClipResponseSchema>;
export type UploadCompleteParams = z.infer<typeof UploadCompleteParamsSchema>;
export type UploadCompleteResponse = z.infer<typeof UploadCompleteResponseSchema>;
