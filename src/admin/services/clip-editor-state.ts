import { z } from "zod";
import { getGeneratedPayloadPath } from "../../contracts/artifacts";
import {
  EditorPayloadSchema,
  EditorPayloadSegmentSchema,
  EditorPayloadSourceSchema,
  type ClipReviewStatus,
  type EditorPayload,
} from "../../contracts/editor-payload";
import type { ClipEditorStatesRepository } from "../../domain/repositories/clip-editor-states-repository";
import type { ProcessingJobsRepository } from "../../domain/repositories/processing-jobs-repository";
import type { AuditLogRepository } from "../../domain/repositories/audit-log-repository";
import type { getObjectBuffer } from "../../../lib/storage";
import { AdminServiceError } from "./errors";

export const EditorStateUpdateInputSchema = z.object({
  segments: z.array(EditorPayloadSegmentSchema),
  thumbnail: z.object({
    imagePath: z.string().nullable(),
    source: EditorPayloadSourceSchema,
  }),
});

export const ReviewDecisionInputSchema = z.object({
  status: z.enum(["approved", "rejected", "needs_fixes"]),
});

type ClipEditorStateServiceDependencies = {
  clipEditorStatesRepository: ClipEditorStatesRepository;
  processingJobsRepository: ProcessingJobsRepository;
  auditLogRepository?: AuditLogRepository;
  getObjectBuffer: typeof getObjectBuffer;
  createId?: () => string;
  now?: () => Date;
};

function normalizeEditorUpdate(current: EditorPayload, editor: z.infer<typeof EditorStateUpdateInputSchema>) {
  const normalizedThumbnail = {
    ...editor.thumbnail,
    source: current.thumbnail.imagePath === editor.thumbnail.imagePath ? editor.thumbnail.source : "manual",
  } satisfies typeof editor.thumbnail;

  const currentSegmentsByIndex = new Map(current.segments.map((segment) => [segment.index, segment]));
  const normalizedSegments = editor.segments.map((segment) => {
    const currentSegment = currentSegmentsByIndex.get(segment.index);
    if (!currentSegment || currentSegment.translation.englishText === segment.translation.englishText) {
      return segment;
    }

    return {
      ...segment,
      translation: {
        ...segment.translation,
        source: "manual",
      },
    } satisfies typeof segment;
  });

  return {
    thumbnail: normalizedThumbnail,
    segments: normalizedSegments,
  };
}

function normalizeSeedPayload(payload: EditorPayload, input: { sourceJobId: string; now: Date }): EditorPayload {
  return EditorPayloadSchema.parse({
    ...payload,
    sourceJobId: input.sourceJobId,
    updatedAt: input.now.toISOString(),
    review: {
      status: "generated",
      hasManualChanges: false,
    },
  });
}

async function loadSeedPayload(getObjectBufferImpl: typeof getObjectBuffer, generatedPayloadPath: string): Promise<EditorPayload> {
  const buffer = await getObjectBufferImpl(generatedPayloadPath);
  if (!buffer) {
    throw new AdminServiceError("not_found", "Generated finalize payload not found");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new AdminServiceError("processing_failed", "Generated finalize payload is not valid JSON");
  }

  return EditorPayloadSchema.parse(payload);
}

async function appendAuditLog(
  dependencies: ClipEditorStateServiceDependencies,
  input: { actorId: string; action: "edit" | "publish" | "retry"; clipId: string; metadata: Record<string, unknown> },
) {
  if (!dependencies.auditLogRepository) {
    return;
  }

  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  await dependencies.auditLogRepository.append({
    id: createId(),
    actorId: input.actorId,
    action: input.action,
    targetType: "clip",
    targetId: input.clipId,
    metadata: input.metadata,
  });
}

export async function seedClipEditorStateFromJob(
  dependencies: ClipEditorStateServiceDependencies,
  input: {
    clipId: string;
    sourceJobId: string;
    generatedPayloadPath: string;
    actorId: string;
  },
) {
  const now = dependencies.now?.() ?? new Date();
  const payload = normalizeSeedPayload(
    await loadSeedPayload(dependencies.getObjectBuffer, input.generatedPayloadPath),
    { sourceJobId: input.sourceJobId, now },
  );

  const saved = await dependencies.clipEditorStatesRepository.save({
    clipId: input.clipId,
    sourceJobId: input.sourceJobId,
    payload,
    reviewStatus: "generated",
    hasManualChanges: false,
    lastReseededAt: now,
    updatedBy: input.actorId,
  });

  await appendAuditLog(dependencies, {
    actorId: input.actorId,
    action: "edit",
    clipId: input.clipId,
    metadata: {
      event: "editor_state_reseeded",
      sourceJobId: input.sourceJobId,
      reviewStatus: "generated",
    },
  });

  return saved;
}

export async function getOrCreateClipEditorState(
  dependencies: ClipEditorStateServiceDependencies,
  input: { clipId: string; actorId: string },
) {
  const existing = await dependencies.clipEditorStatesRepository.getByClipId(input.clipId);
  if (existing) {
    return existing;
  }

  const latestJob = await dependencies.processingJobsRepository.getLatestByClipId(input.clipId);
  if (!latestJob) {
    return null;
  }

  const generatedPayloadPath = getGeneratedPayloadPath(latestJob.artifactRefs);
  if (!generatedPayloadPath) {
    return null;
  }

  return seedClipEditorStateFromJob(dependencies, {
    clipId: input.clipId,
    sourceJobId: latestJob.id,
    generatedPayloadPath,
    actorId: input.actorId,
  });
}

export async function updateClipEditorState(
  dependencies: ClipEditorStateServiceDependencies,
  input: {
    clipId: string;
    actorId: string;
    editor: z.infer<typeof EditorStateUpdateInputSchema>;
  },
) {
  const current = await getOrCreateClipEditorState(dependencies, {
    clipId: input.clipId,
    actorId: input.actorId,
  });
  if (!current) {
    throw new AdminServiceError("not_found", "Editor state not found for this clip");
  }

  const now = dependencies.now?.() ?? new Date();
  const normalizedEditor = normalizeEditorUpdate(current.payload, input.editor);
  const payload = EditorPayloadSchema.parse({
    ...current.payload,
    updatedAt: now.toISOString(),
    thumbnail: normalizedEditor.thumbnail,
    segments: normalizedEditor.segments,
    review: {
      status: "edited",
      hasManualChanges: true,
    },
  });

  const saved = await dependencies.clipEditorStatesRepository.save({
    clipId: current.clipId,
    sourceJobId: current.sourceJobId,
    payload,
    reviewStatus: "edited",
    hasManualChanges: true,
    lastReseededAt: current.lastReseededAt,
    updatedBy: input.actorId,
  });

  await appendAuditLog(dependencies, {
    actorId: input.actorId,
    action: "edit",
    clipId: input.clipId,
    metadata: {
      event: "editor_state_updated",
      reviewStatus: "edited",
      sourceJobId: current.sourceJobId,
    },
  });

  return saved;
}

export async function reviewClipEditorState(
  dependencies: ClipEditorStateServiceDependencies,
  input: {
    clipId: string;
    actorId: string;
    status: Extract<ClipReviewStatus, "approved" | "rejected" | "needs_fixes">;
  },
) {
  const current = await getOrCreateClipEditorState(dependencies, {
    clipId: input.clipId,
    actorId: input.actorId,
  });
  if (!current) {
    throw new AdminServiceError("not_found", "Editor state not found for this clip");
  }

  const now = dependencies.now?.() ?? new Date();
  const payload = EditorPayloadSchema.parse({
    ...current.payload,
    updatedAt: now.toISOString(),
    review: {
      status: input.status,
      hasManualChanges: current.hasManualChanges,
    },
  });

  const saved = await dependencies.clipEditorStatesRepository.save({
    clipId: current.clipId,
    sourceJobId: current.sourceJobId,
    payload,
    reviewStatus: input.status,
    hasManualChanges: current.hasManualChanges,
    lastReseededAt: current.lastReseededAt,
    updatedBy: input.actorId,
  });

  await appendAuditLog(dependencies, {
    actorId: input.actorId,
    action: "publish",
    clipId: input.clipId,
    metadata: {
      event: "review_status_changed",
      reviewStatus: input.status,
      sourceJobId: current.sourceJobId,
    },
  });

  return saved;
}

export function shouldWarnBeforeRetry(input: { reviewStatus: ClipReviewStatus; hasManualChanges: boolean } | null): boolean {
  if (!input) {
    return false;
  }

  return input.reviewStatus !== "generated" || input.hasManualChanges;
}

export function getRetryWarningMessage(input: { reviewStatus: ClipReviewStatus; hasManualChanges: boolean } | null): string | null {
  if (!shouldWarnBeforeRetry(input)) {
    return null;
  }

  return "This clip already has saved review work. Retrying will start a new processing job and reseed the editor state when finalize completes, replacing manual edits and resetting the review status to generated.";
}
