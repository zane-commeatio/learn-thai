import { z } from "zod";

export const EditorPayloadSourceSchema = z.enum(["generated", "manual"]);

export const EditorPayloadTranslationSchema = z.object({
  englishText: z.string(),
  source: EditorPayloadSourceSchema,
});

export const EditorPayloadSegmentSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
  startMs: z.number().int().nonnegative().nullable(),
  endMs: z.number().int().nonnegative().nullable(),
  translation: EditorPayloadTranslationSchema,
});

export const EditorPayloadSchema = z.object({
  clipId: z.string().min(1),
  sourceJobId: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  media: z.object({
    normalizedVideoPath: z.string().nullable(),
    audioWavPath: z.string().nullable(),
    posterImagePath: z.string().nullable(),
  }),
  thumbnail: z.object({
    imagePath: z.string().nullable(),
    source: EditorPayloadSourceSchema,
  }),
  segments: z.array(EditorPayloadSegmentSchema),
  review: z.object({
    status: z.enum(["generated", "edited"]),
    hasManualChanges: z.boolean(),
  }),
});

export type EditorPayload = z.infer<typeof EditorPayloadSchema>;
export type EditorPayloadSegment = z.infer<typeof EditorPayloadSegmentSchema>;
