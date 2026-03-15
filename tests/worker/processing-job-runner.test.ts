import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AuditLogRepository, AuditLogRecord } from "../../src/domain/repositories/audit-log-repository";
import type {
  AdvanceToNextStageInput,
  ClaimProcessingJobInput,
  CreateProcessingJobInput,
  MarkProcessingJobFailedInput,
  ProcessingJobRecord,
  ProcessingJobsRepository,
  ReleaseProcessingJobClaimInput,
  UpdateProcessingJobInput,
} from "../../src/domain/repositories/processing-jobs-repository";
import { processProcessingJobMessage } from "../../src/worker/runner/processing-job-runner";

class InMemoryProcessingJobsRepository implements ProcessingJobsRepository {
  private readonly jobs = new Map<string, ProcessingJobRecord>();

  constructor(initialJobs: ProcessingJobRecord[]) {
    for (const job of initialJobs) {
      this.jobs.set(job.id, job);
    }
  }

  async create(input: CreateProcessingJobInput): Promise<ProcessingJobRecord> {
    const record: ProcessingJobRecord = {
      ...input,
      artifactRefs: null,
      errorPayload: input.errorPayload ?? null,
      lockToken: null,
      lockExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(record.id, record);
    return record;
  }

  async getById(id: string): Promise<ProcessingJobRecord | null> {
    return this.jobs.get(id) ?? null;
  }

  async getLatestByClipId(clipId: string): Promise<ProcessingJobRecord | null> {
    const matches = [...this.jobs.values()].filter((job) => job.clipId === clipId);
    return matches[matches.length - 1] ?? null;
  }

  async getActiveByClipId(clipId: string): Promise<ProcessingJobRecord | null> {
    const matches = [...this.jobs.values()].filter((job) => job.clipId === clipId && job.state === "processing");
    return matches[matches.length - 1] ?? null;
  }

  async updateStatusStageError(
    input: UpdateProcessingJobInput,
  ): Promise<ProcessingJobRecord | null> {
    const job = this.jobs.get(input.id);
    if (!job) {
      return null;
    }

    job.state = input.state;
    job.stage = input.stage;
    job.errorPayload = input.errorPayload ?? null;
    job.updatedAt = new Date();
    return job;
  }

  async claimForProcessing(input: ClaimProcessingJobInput): Promise<ProcessingJobRecord | null> {
    const job = this.jobs.get(input.id);
    if (!job) {
      return null;
    }

    if (job.state !== "processing") {
      return null;
    }

    if (job.stage !== input.expectedStage) {
      return null;
    }

    if (job.lockToken && job.lockExpiresAt && job.lockExpiresAt >= input.now) {
      return null;
    }

    job.lockToken = input.lockToken;
    job.lockExpiresAt = new Date(input.now.getTime() + input.leaseMs);
    return job;
  }

  async releaseClaim(input: ReleaseProcessingJobClaimInput): Promise<void> {
    const job = this.jobs.get(input.id);
    if (!job || job.lockToken !== input.lockToken) {
      return;
    }

    job.lockToken = null;
    job.lockExpiresAt = null;
  }

  async advanceToNextStage(
    input: AdvanceToNextStageInput,
  ): Promise<ProcessingJobRecord | null> {
    const job = this.jobs.get(input.id);
    if (!job || job.lockToken !== input.lockToken || job.stage !== input.currentStage) {
      return null;
    }

    const nextStage =
      input.currentStage === "audio" ? "asr"
        : input.currentStage === "asr" ? "segment"
        : input.currentStage === "segment" ? "translate"
        : input.currentStage === "translate" ? "finalize"
        : null;

    if (!nextStage) {
      return null;
    }

    job.stage = nextStage;
    return job;
  }

  async saveArtifacts(input: {
    id: string;
    lockToken: string;
    artifactRefs: unknown;
  }): Promise<ProcessingJobRecord | null> {
    const job = this.jobs.get(input.id);
    if (!job || job.lockToken !== input.lockToken) {
      return null;
    }

    job.artifactRefs = input.artifactRefs;
    return job;
  }

  async markFailed(input: MarkProcessingJobFailedInput): Promise<ProcessingJobRecord | null> {
    const job = this.jobs.get(input.id);
    if (!job || job.lockToken !== input.lockToken) {
      return null;
    }

    job.state = "failed";
    job.errorPayload = input.errorPayload;
    return job;
  }
}

class InMemoryAuditLogRepository implements AuditLogRepository {
  readonly entries: AuditLogRecord[] = [];

  async append(input: {
    id: string;
    actorId?: string | null;
    action: AuditLogRecord["action"];
    targetType: AuditLogRecord["targetType"];
    targetId: string;
    metadata?: unknown;
  }): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      id: input.id,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    };
    this.entries.push(record);
    return record;
  }
}

function makeJob(jobId: string, clipId: string): ProcessingJobRecord {
  return {
    id: jobId,
    clipId,
    state: "processing",
    stage: "audio",
    errorPayload: null,
    artifactRefs: null,
    lockToken: null,
    lockExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeAudioArtifacts(jobId: string, clipId: string) {
  return {
    normalizedVideoPath: `clips/${clipId}/jobs/${jobId}/normalized.mp4`,
    posterImagePath: `clips/${clipId}/jobs/${jobId}/poster.jpg`,
    audioWavPath: `clips/${clipId}/jobs/${jobId}/audio.wav`,
  };
}

function makeAsrArtifacts(jobId: string, clipId: string) {
  return {
    asrJsonPath: `clips/${clipId}/jobs/${jobId}/asr.json`,
    transcriptPreview: "sawasdee",
    segmentCount: 3,
    wordCount: 10,
    language: "th",
  };
}

function makeSegmentArtifacts(jobId: string, clipId: string) {
  return {
    segmentJsonPath: `clips/${clipId}/jobs/${jobId}/segments.json`,
    segmentCount: 2,
    preview: [
      {
        index: 0,
        text: "sa-wat-dee",
        startMs: 0,
        endMs: 950,
      },
    ],
  };
}

function makeTranslateArtifacts(jobId: string, clipId: string) {
  return {
    translationJsonPath: `clips/${clipId}/jobs/${jobId}/translations.json`,
    translationCount: 2,
    preview: [
      { segmentIndex: 0, sourceText: "sa-wat-dee", englishText: "Hello." },
      { segmentIndex: 1, sourceText: "khop khun", englishText: "Thank you." },
    ],
  };
}

function makeFinalizeArtifacts(jobId: string, clipId: string) {
  return {
    generatedPayloadPath: `clips/${clipId}/jobs/${jobId}/generated-payload.json`,
    editedPayloadPath: `clips/${clipId}/jobs/${jobId}/edited-payload.json`,
    segmentCount: 2,
    translationCount: 2,
    thumbnailPath: `clips/${clipId}/jobs/${jobId}/poster.jpg`,
  };
}

describe("processing job runner", () => {
  it("processes duplicate delivery only once", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const jobsRepo = new InMemoryProcessingJobsRepository([makeJob(jobId, clipId)]);
    const auditRepo = new InMemoryAuditLogRepository();

    await Promise.all([
      processProcessingJobMessage({ jobId, clipId, expectedStage: "audio" }, {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        audioStageAdapter: {
          async run() {
            return makeAudioArtifacts(jobId, clipId);
          },
        },
      }),
      processProcessingJobMessage({ jobId, clipId, expectedStage: "audio" }, {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        audioStageAdapter: {
          async run() {
            return makeAudioArtifacts(jobId, clipId);
          },
        },
      }),
    ]);

    const job = await jobsRepo.getById(jobId);
    const startEntries = auditRepo.entries.filter(
      (entry) => (entry.metadata as { event?: string })?.event === "job_start",
    );
    const stageChangeEntries = auditRepo.entries.filter(
      (entry) => (entry.metadata as { event?: string })?.event === "job_stage_change",
    );

    expect(job?.stage).toBe("asr");
    expect(job?.artifactRefs).toEqual(makeAudioArtifacts(jobId, clipId));
    expect(startEntries).toHaveLength(1);
    expect(stageChangeEntries).toHaveLength(1);
  });

  it("processes asr stage and advances to segment", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const job = makeJob(jobId, clipId);
    job.stage = "asr";
    job.artifactRefs = makeAudioArtifacts(jobId, clipId);

    const jobsRepo = new InMemoryProcessingJobsRepository([job]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "asr" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        asrStageAdapter: {
          async run(_claimed, input) {
            expect(input.audioWavPath).toBe(`clips/${clipId}/jobs/${jobId}/audio.wav`);
            return makeAsrArtifacts(jobId, clipId);
          },
        },
      },
    );

    const updated = await jobsRepo.getById(jobId);
    expect(updated?.stage).toBe("segment");
    expect(updated?.artifactRefs).toEqual({
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
    });
  });

  it("processes segment stage and advances to translate", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const job = makeJob(jobId, clipId);
    job.stage = "segment";
    job.artifactRefs = {
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
    };

    const jobsRepo = new InMemoryProcessingJobsRepository([job]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "segment" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        segmentStageAdapter: {
          async run(_claimed, input) {
            expect(input.asrJsonPath).toBe(`clips/${clipId}/jobs/${jobId}/asr.json`);
            return makeSegmentArtifacts(jobId, clipId);
          },
        },
      },
    );

    const updated = await jobsRepo.getById(jobId);
    expect(updated?.stage).toBe("translate");
    expect(updated?.artifactRefs).toEqual({
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
      segment: makeSegmentArtifacts(jobId, clipId),
    });
  });

  it("processes translate stage and advances to finalize", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const job = makeJob(jobId, clipId);
    job.stage = "translate";
    job.artifactRefs = {
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
      segment: makeSegmentArtifacts(jobId, clipId),
    };

    const jobsRepo = new InMemoryProcessingJobsRepository([job]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "translate" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        translationStageAdapter: {
          async run(_claimed, input) {
            expect(input.segmentJsonPath).toBe(`clips/${clipId}/jobs/${jobId}/segments.json`);
            return makeTranslateArtifacts(jobId, clipId);
          },
        },
      },
    );

    const updated = await jobsRepo.getById(jobId);
    expect(updated?.stage).toBe("finalize");
    expect(updated?.artifactRefs).toEqual({
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
      segment: makeSegmentArtifacts(jobId, clipId),
      translate: makeTranslateArtifacts(jobId, clipId),
    });
  });

  it("marks job failed and writes failure audit on executor error", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const jobsRepo = new InMemoryProcessingJobsRepository([makeJob(jobId, clipId)]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "audio" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        audioStageAdapter: {
          async run(): Promise<never> {
            throw new Error("boom");
          },
        },
      },
    );

    const job = await jobsRepo.getById(jobId);
    const failEntry = auditRepo.entries.find(
      (entry) => (entry.metadata as { event?: string })?.event === "job_fail",
    );

    expect(job?.state).toBe("failed");
    expect((job?.errorPayload as { code?: string })?.code).toBe("audio_stage_failed");
    expect(failEntry).toBeDefined();
  });

  it("processes finalize stage and marks the job needs review", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const job = makeJob(jobId, clipId);
    job.stage = "finalize";
    job.artifactRefs = {
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
      segment: makeSegmentArtifacts(jobId, clipId),
      translate: makeTranslateArtifacts(jobId, clipId),
    };

    const jobsRepo = new InMemoryProcessingJobsRepository([job]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "finalize" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        finalizeStageAdapter: {
          async run(_claimed, input) {
            expect(input.segmentJsonPath).toBe(`clips/${clipId}/jobs/${jobId}/segments.json`);
            expect(input.translationJsonPath).toBe(`clips/${clipId}/jobs/${jobId}/translations.json`);
            expect(input.posterImagePath).toBe(`clips/${clipId}/jobs/${jobId}/poster.jpg`);
            return makeFinalizeArtifacts(jobId, clipId);
          },
        },
      },
    );

    const updated = await jobsRepo.getById(jobId);
    const completeEntry = auditRepo.entries.find(
      (entry) => (entry.metadata as { event?: string })?.event === "job_complete",
    );

    expect(updated?.stage).toBe("finalize");
    expect(updated?.state).toBe("needs_review");
    expect(updated?.errorPayload).toBeNull();
    expect(updated?.artifactRefs).toEqual({
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
      segment: makeSegmentArtifacts(jobId, clipId),
      translate: makeTranslateArtifacts(jobId, clipId),
      finalize: makeFinalizeArtifacts(jobId, clipId),
    });
    expect(completeEntry).toBeDefined();
  });

  it("marks asr stage failure with asr error code", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const job = makeJob(jobId, clipId);
    job.stage = "asr";
    job.artifactRefs = makeAudioArtifacts(jobId, clipId);

    const jobsRepo = new InMemoryProcessingJobsRepository([job]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "asr" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        asrStageAdapter: {
          async run(): Promise<never> {
            throw new Error("asr failed");
          },
        },
      },
    );

    const updated = await jobsRepo.getById(jobId);
    expect(updated?.state).toBe("failed");
    expect((updated?.errorPayload as { code?: string })?.code).toBe("asr_stage_failed");
  });

  it("preserves asr_invalid_output when asr contract validation fails", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const job = makeJob(jobId, clipId);
    job.stage = "asr";
    job.artifactRefs = makeAudioArtifacts(jobId, clipId);

    const jobsRepo = new InMemoryProcessingJobsRepository([job]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "asr" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        asrStageAdapter: {
          async run(): Promise<never> {
            const error = new Error("ASR output missing raw.segments") as Error & { code: string };
            error.code = "asr_invalid_output";
            throw error;
          },
        },
      },
    );

    const updated = await jobsRepo.getById(jobId);
    expect(updated?.state).toBe("failed");
    expect((updated?.errorPayload as { code?: string })?.code).toBe("asr_invalid_output");
  });

  it("marks segment stage failure with segment error code", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const job = makeJob(jobId, clipId);
    job.stage = "segment";
    job.artifactRefs = {
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
    };

    const jobsRepo = new InMemoryProcessingJobsRepository([job]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "segment" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        segmentStageAdapter: {
          async run(): Promise<never> {
            throw new Error("segment failed");
          },
        },
      },
    );

    const updated = await jobsRepo.getById(jobId);
    expect(updated?.state).toBe("failed");
    expect((updated?.errorPayload as { code?: string })?.code).toBe("segment_stage_failed");
  });

  it("marks translate stage failure with translate error code", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const job = makeJob(jobId, clipId);
    job.stage = "translate";
    job.artifactRefs = {
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
      segment: makeSegmentArtifacts(jobId, clipId),
    };

    const jobsRepo = new InMemoryProcessingJobsRepository([job]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "translate" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        translationStageAdapter: {
          async run(): Promise<never> {
            throw new Error("translate failed");
          },
        },
      },
    );

    const updated = await jobsRepo.getById(jobId);
    expect(updated?.state).toBe("failed");
    expect((updated?.errorPayload as { code?: string })?.code).toBe("translate_stage_failed");
  });

  it("marks finalize stage failure with finalize error code", async () => {
    const jobId = randomUUID();
    const clipId = randomUUID();
    const job = makeJob(jobId, clipId);
    job.stage = "finalize";
    job.artifactRefs = {
      ...makeAudioArtifacts(jobId, clipId),
      asr: makeAsrArtifacts(jobId, clipId),
      segment: makeSegmentArtifacts(jobId, clipId),
      translate: makeTranslateArtifacts(jobId, clipId),
    };

    const jobsRepo = new InMemoryProcessingJobsRepository([job]);
    const auditRepo = new InMemoryAuditLogRepository();

    await processProcessingJobMessage(
      { jobId, clipId, expectedStage: "finalize" },
      {
        processingJobsRepository: jobsRepo,
        auditLogRepository: auditRepo,
        finalizeStageAdapter: {
          async run(): Promise<never> {
            throw new Error("finalize failed");
          },
        },
      },
    );

    const updated = await jobsRepo.getById(jobId);
    expect(updated?.state).toBe("failed");
    expect((updated?.errorPayload as { code?: string })?.code).toBe("finalize_stage_failed");
  });
});
