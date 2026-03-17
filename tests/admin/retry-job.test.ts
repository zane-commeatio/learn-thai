import { describe, expect, it } from "vitest";
import { retryJob } from "../../src/admin/services/retry-job";
import type { AuditLogRecord, AuditLogRepository } from "../../src/domain/repositories/audit-log-repository";
import type {
  CreateProcessingJobInput,
  ProcessingJobRecord,
  ProcessingJobsRepository,
  UpdateProcessingJobInput,
  ClaimProcessingJobInput,
  ReleaseProcessingJobClaimInput,
  SaveProcessingJobArtifactsInput,
  AdvanceToNextStageInput,
  MarkProcessingJobFailedInput,
} from "../../src/domain/repositories/processing-jobs-repository";

class InMemoryProcessingJobsRepository implements ProcessingJobsRepository {
  readonly jobs = new Map<string, ProcessingJobRecord>();

  constructor(initialJobs: ProcessingJobRecord[]) {
    for (const job of initialJobs) {
      this.jobs.set(job.id, job);
    }
  }

  async create(input: CreateProcessingJobInput): Promise<ProcessingJobRecord> {
    const job: ProcessingJobRecord = {
      ...input,
      artifactRefs: null,
      errorPayload: input.errorPayload ?? null,
      lockToken: null,
      lockExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(input.id, job);
    return job;
  }

  async getById(id: string): Promise<ProcessingJobRecord | null> {
    return this.jobs.get(id) ?? null;
  }

  async getLatestByClipId(): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async getActiveByClipId(): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async deleteById(id: string): Promise<void> {
    this.jobs.delete(id);
  }

  async updateStatusStageError(_input: UpdateProcessingJobInput): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async claimForProcessing(_input: ClaimProcessingJobInput): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async releaseClaim(_input: ReleaseProcessingJobClaimInput): Promise<void> {}

  async saveArtifacts(_input: SaveProcessingJobArtifactsInput): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async advanceToNextStage(_input: AdvanceToNextStageInput): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async markFailed(_input: MarkProcessingJobFailedInput): Promise<ProcessingJobRecord | null> {
    return null;
  }
}

class ThrowingAuditLogRepository implements AuditLogRepository {
  async append(): Promise<AuditLogRecord> {
    throw new Error("audit unavailable");
  }
}

describe("retryJob", () => {
  it("removes the retry job if audit logging fails before enqueue", async () => {
    const sourceJob: ProcessingJobRecord = {
      id: "job_failed",
      clipId: "clip_1",
      state: "failed",
      stage: "translate",
      artifactRefs: null,
      errorPayload: { message: "boom" },
      lockToken: null,
      lockExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const processingJobsRepository = new InMemoryProcessingJobsRepository([sourceJob]);

    await expect(retryJob({
      processingJobsRepository,
      auditLogRepository: new ThrowingAuditLogRepository(),
      enqueueProcessingJob: async () => undefined,
      createId: (() => {
        const ids = ["job_retry", "audit_1"];
        return () => ids.shift() ?? "extra_id";
      })(),
    }, {
      jobId: sourceJob.id,
      actorId: "admin@example.com",
    })).rejects.toMatchObject({
      code: "processing_failed",
      message: "audit unavailable",
    });

    expect(processingJobsRepository.jobs.has("job_retry")).toBe(false);
    expect(processingJobsRepository.jobs.has(sourceJob.id)).toBe(true);
  });
});
