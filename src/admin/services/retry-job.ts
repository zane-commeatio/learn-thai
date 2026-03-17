import type { enqueueProcessingJob } from "../../../lib/queue";
import type { AuditLogRepository } from "../../domain/repositories/audit-log-repository";
import type { ProcessingJobsRepository } from "../../domain/repositories/processing-jobs-repository";
import { AdminServiceError } from "./errors";

export type RetryJobInput = {
  jobId: string;
  actorId: string;
};

export type RetryJobResult = {
  jobId: string;
  clipId: string;
  retriedFromJobId: string;
  message: string;
};

export type RetryJobDependencies = {
  processingJobsRepository: ProcessingJobsRepository;
  auditLogRepository: AuditLogRepository;
  enqueueProcessingJob: typeof enqueueProcessingJob;
  createId?: () => string;
};

export async function retryJob(
  dependencies: RetryJobDependencies,
  input: RetryJobInput,
): Promise<RetryJobResult> {
  const sourceJob = await dependencies.processingJobsRepository.getById(input.jobId);
  if (!sourceJob) {
    throw new AdminServiceError("not_found", "Job not found");
  }

  if (sourceJob.state !== "failed" && sourceJob.state !== "manual_intervention") {
    throw new AdminServiceError(
      "invalid_state",
      "Only failed or manual intervention jobs can be retried",
    );
  }

  const activeJob = await dependencies.processingJobsRepository.getActiveByClipId(sourceJob.clipId);
  if (activeJob) {
    throw new AdminServiceError(
      "conflict",
      "A processing job is already running for this clip",
      { activeJobId: activeJob.id },
    );
  }

  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const retryJobId = createId();
  let createdRetryJob = false;

  try {
    await dependencies.processingJobsRepository.create({
      id: retryJobId,
      clipId: sourceJob.clipId,
      state: "processing",
      stage: "audio",
      errorPayload: null,
    });
    createdRetryJob = true;

    await dependencies.auditLogRepository.append({
      id: createId(),
      actorId: input.actorId,
      action: "retry",
      targetType: "job",
      targetId: retryJobId,
      metadata: {
        event: "manual_retry",
        retriedFromJobId: sourceJob.id,
        restartStage: "audio",
      },
    });

    await dependencies.enqueueProcessingJob({
      jobId: retryJobId,
      clipId: sourceJob.clipId,
      expectedStage: "audio",
    });
  } catch (error) {
    if (createdRetryJob) {
      await dependencies.processingJobsRepository.deleteById(retryJobId).catch(() => undefined);
    }

    throw new AdminServiceError(
      "processing_failed",
      error instanceof Error ? error.message : "Failed to retry job",
    );
  }

  return {
    jobId: retryJobId,
    clipId: sourceJob.clipId,
    retriedFromJobId: sourceJob.id,
    message: "Retry started from audio stage",
  };
}
