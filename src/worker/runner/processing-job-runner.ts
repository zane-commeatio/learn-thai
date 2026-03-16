import { getNextStage } from "../../contracts/state-machine";
import {
  getAsrJsonPath,
  getAudioWavPath,
  getPosterImagePath,
  getSegmentJsonPath,
  getTranslationJsonPath,
  getNormalizedVideoPath,
} from "../../contracts/artifacts";
import type { ProcessingJobQueueMessage } from "../../domain/queues/processing-jobs-queue";
import { randomUUID } from "node:crypto";
import type { AuditLogRepository } from "../../domain/repositories/audit-log-repository";
import type { ClipEditorStatesRepository } from "../../domain/repositories/clip-editor-states-repository";
import type {
  ProcessingJobsRepository,
} from "../../domain/repositories/processing-jobs-repository";
import { seedClipEditorStateFromJob } from "../../admin/services/clip-editor-state";
import type { getObjectBuffer } from "../../../lib/storage";
import {
  DefaultAudioNormalizationStageAdapter,
  type AudioNormalizationStageAdapter,
} from "../stages/audio-normalization";
import {
  DefaultAsrTranscriptionStageAdapter,
  type AsrTranscriptionStageAdapter,
} from "../stages/asr-transcription";
import {
  DefaultSegmentShapingStageAdapter,
  type SegmentShapingStageAdapter,
} from "../stages/segment-shaping";
import {
  DefaultTranslationStageAdapter,
  type TranslationStageAdapter,
} from "../stages/translation";
import {
  DefaultFinalizeStageAdapter,
  type FinalizeStageAdapter,
} from "../stages/finalize";

export type ProcessProcessingJobDependencies = {
  processingJobsRepository: ProcessingJobsRepository;
  auditLogRepository: AuditLogRepository;
  clipEditorStatesRepository?: ClipEditorStatesRepository;
  getObjectBuffer?: typeof getObjectBuffer;
  audioStageAdapter?: AudioNormalizationStageAdapter;
  asrStageAdapter?: AsrTranscriptionStageAdapter;
  segmentStageAdapter?: SegmentShapingStageAdapter;
  translationStageAdapter?: TranslationStageAdapter;
  finalizeStageAdapter?: FinalizeStageAdapter;
  now?: () => Date;
  leaseMs?: number;
};

const DEFAULT_LEASE_MS = 30_000;

class StageNotImplementedError extends Error {
  readonly code = "stage_not_implemented";

  constructor(stage: string) {
    super(`${stage} stage not implemented`);
  }
}

function getErrorCode(stage: string, error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return code;
    }
  }

  if (stage === "audio") {
    return "audio_stage_failed";
  }
  if (stage === "asr") {
    return "asr_stage_failed";
  }
  if (stage === "segment") {
    return "segment_stage_failed";
  }
  if (stage === "translate") {
    return "translate_stage_failed";
  }
  if (stage === "finalize") {
    return "finalize_stage_failed";
  }

  return "processing_runner_error";
}

export async function processProcessingJobMessage(
  message: ProcessingJobQueueMessage,
  dependencies: ProcessProcessingJobDependencies,
): Promise<void> {
  const now = dependencies.now?.() ?? new Date();
  const lockToken = randomUUID();
  const leaseMs = dependencies.leaseMs ?? DEFAULT_LEASE_MS;

  const claimed = await dependencies.processingJobsRepository.claimForProcessing({
    id: message.jobId,
    expectedStage: message.expectedStage,
    lockToken,
    now,
    leaseMs,
  });

  if (!claimed) {
    return;
  }

  const startedAt = Date.now();

  try {
    let finalizeGeneratedPayloadPath: string | null = null;

    await dependencies.auditLogRepository.append({
      id: randomUUID(),
      actorId: "system",
      action: "upload",
      targetType: "job",
      targetId: claimed.id,
      metadata: { event: "job_start", stage: claimed.stage },
    });

    if (claimed.stage === "audio") {
      const adapter = dependencies.audioStageAdapter ?? new DefaultAudioNormalizationStageAdapter();
      const artifactRefs = await adapter.run(claimed);

      await dependencies.processingJobsRepository.saveArtifacts({
        id: claimed.id,
        lockToken,
        artifactRefs,
      });
    } else if (claimed.stage === "asr") {
      const audioArtifacts = claimed.artifactRefs;
      if (!audioArtifacts || typeof audioArtifacts !== "object") {
        throw new Error("ASR stage requires audio artifacts from the audio stage");
      }

      const audioWavPath = getAudioWavPath(audioArtifacts);
      if (typeof audioWavPath !== "string" || audioWavPath.trim().length === 0) {
        throw new Error("ASR stage requires artifactRefs.audioWavPath");
      }

      const adapter = dependencies.asrStageAdapter ?? new DefaultAsrTranscriptionStageAdapter();
      const asrArtifacts = await adapter.run(claimed, { audioWavPath });

      await dependencies.processingJobsRepository.saveArtifacts({
        id: claimed.id,
        lockToken,
        artifactRefs: {
          ...audioArtifacts,
          asr: asrArtifacts,
        },
      });
    } else if (claimed.stage === "segment") {
      const allArtifacts = claimed.artifactRefs;
      if (!allArtifacts || typeof allArtifacts !== "object") {
        throw new Error("Segment stage requires artifacts from previous stages");
      }

      const asrJsonPath = getAsrJsonPath(allArtifacts);
      if (typeof asrJsonPath !== "string" || asrJsonPath.trim().length === 0) {
        throw new Error("Segment stage requires artifactRefs.asr.asrJsonPath");
      }

      const adapter = dependencies.segmentStageAdapter ?? new DefaultSegmentShapingStageAdapter();
      const segmentArtifacts = await adapter.run(claimed, { asrJsonPath });

      await dependencies.processingJobsRepository.saveArtifacts({
        id: claimed.id,
        lockToken,
        artifactRefs: {
          ...allArtifacts,
          segment: segmentArtifacts,
        },
      });
    } else if (claimed.stage === "translate") {
      const allArtifacts = claimed.artifactRefs;
      if (!allArtifacts || typeof allArtifacts !== "object") {
        throw new Error("Translate stage requires artifacts from previous stages");
      }

      const segmentJsonPath = getSegmentJsonPath(allArtifacts);
      if (typeof segmentJsonPath !== "string" || segmentJsonPath.trim().length === 0) {
        throw new Error("Translate stage requires artifactRefs.segment.segmentJsonPath");
      }

      const adapter = dependencies.translationStageAdapter ?? new DefaultTranslationStageAdapter();
      const translationArtifacts = await adapter.run(claimed, { segmentJsonPath });

      await dependencies.processingJobsRepository.saveArtifacts({
        id: claimed.id,
        lockToken,
        artifactRefs: {
          ...allArtifacts,
          translate: translationArtifacts,
        },
      });
    } else if (claimed.stage === "finalize") {
      const allArtifacts = claimed.artifactRefs;
      if (!allArtifacts || typeof allArtifacts !== "object") {
        throw new Error("Finalize stage requires artifacts from previous stages");
      }

      const segmentJsonPath = getSegmentJsonPath(allArtifacts);
      if (typeof segmentJsonPath !== "string" || segmentJsonPath.trim().length === 0) {
        throw new Error("Finalize stage requires artifactRefs.segment.segmentJsonPath");
      }

      const translationJsonPath = getTranslationJsonPath(allArtifacts);
      if (typeof translationJsonPath !== "string" || translationJsonPath.trim().length === 0) {
        throw new Error("Finalize stage requires artifactRefs.translate.translationJsonPath");
      }

      const adapter = dependencies.finalizeStageAdapter ?? new DefaultFinalizeStageAdapter();
      const finalizeArtifacts = await adapter.run(claimed, {
        segmentJsonPath,
        translationJsonPath,
        normalizedVideoPath: getNormalizedVideoPath(allArtifacts),
        audioWavPath: getAudioWavPath(allArtifacts),
        posterImagePath: getPosterImagePath(allArtifacts),
      });

      await dependencies.processingJobsRepository.saveArtifacts({
        id: claimed.id,
        lockToken,
        artifactRefs: {
          ...allArtifacts,
          finalize: finalizeArtifacts,
        },
      });

      finalizeGeneratedPayloadPath = finalizeArtifacts.generatedPayloadPath;
    } else {
      throw new StageNotImplementedError(claimed.stage);
    }

    const durationMs = Date.now() - startedAt;
    await dependencies.auditLogRepository.append({
      id: randomUUID(),
      actorId: "system",
      action: "edit",
      targetType: "job",
      targetId: claimed.id,
      metadata: {
        event: "stage_outcome",
        stage: claimed.stage,
        outcome: "success",
        durationMs,
      },
    });

    const nextStage = getNextStage(claimed.stage);
    if (nextStage) {
      const advanced = await dependencies.processingJobsRepository.advanceToNextStage({
        id: claimed.id,
        lockToken,
        currentStage: claimed.stage,
      });

      if (advanced) {
        await dependencies.auditLogRepository.append({
          id: randomUUID(),
          actorId: "system",
          action: "edit",
          targetType: "job",
          targetId: claimed.id,
          metadata: {
            event: "job_stage_change",
            fromStage: claimed.stage,
            toStage: advanced.stage,
          },
        });
      }

      return;
    }

    if (finalizeGeneratedPayloadPath && dependencies.clipEditorStatesRepository && dependencies.getObjectBuffer) {
      await seedClipEditorStateFromJob({
        clipEditorStatesRepository: dependencies.clipEditorStatesRepository,
        processingJobsRepository: dependencies.processingJobsRepository,
        auditLogRepository: dependencies.auditLogRepository,
        getObjectBuffer: dependencies.getObjectBuffer,
      }, {
        clipId: claimed.clipId,
        sourceJobId: claimed.id,
        generatedPayloadPath: finalizeGeneratedPayloadPath,
        actorId: "system",
      });
    }

    await dependencies.auditLogRepository.append({
      id: randomUUID(),
      actorId: "system",
      action: "publish",
      targetType: "job",
      targetId: claimed.id,
      metadata: { event: "job_complete", stage: claimed.stage },
    });

    await dependencies.processingJobsRepository.updateStatusStageError({
      id: claimed.id,
      state: "needs_review",
      stage: claimed.stage,
      errorPayload: null,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorCode = getErrorCode(claimed.stage, error);

    await dependencies.processingJobsRepository.markFailed({
      id: claimed.id,
      lockToken,
      errorPayload: {
        code: errorCode,
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });

    await dependencies.auditLogRepository.append({
      id: randomUUID(),
      actorId: "system",
      action: "retry",
      targetType: "job",
      targetId: claimed.id,
      metadata: {
        event: "stage_outcome",
        stage: claimed.stage,
        outcome: "failed",
        durationMs,
        errorCode,
      },
    });

    await dependencies.auditLogRepository.append({
      id: randomUUID(),
      actorId: "system",
      action: "retry",
      targetType: "job",
      targetId: claimed.id,
      metadata: { event: "job_fail" },
    });
  } finally {
    await dependencies.processingJobsRepository.releaseClaim({
      id: claimed.id,
      lockToken,
    });
  }
}
