import { describe, expect, it } from "vitest";
import {
  getRetryWarningMessage,
  reviewClipEditorState,
  seedClipEditorStateFromJob,
  shouldWarnBeforeRetry,
  updateClipEditorState,
} from "../../src/admin/services/clip-editor-state";
import type { EditorPayload } from "../../src/contracts/editor-payload";
import type {
  ClipEditorStateRecord,
  ClipEditorStatesRepository,
  SaveClipEditorStateInput,
} from "../../src/domain/repositories/clip-editor-states-repository";
import type { AuditLogRecord, AuditLogRepository } from "../../src/domain/repositories/audit-log-repository";
import type {
  AdvanceToNextStageInput,
  ClaimProcessingJobInput,
  CreateProcessingJobInput,
  MarkProcessingJobFailedInput,
  ProcessingJobRecord,
  ProcessingJobsRepository,
  ReleaseProcessingJobClaimInput,
  SaveProcessingJobArtifactsInput,
  UpdateProcessingJobInput,
} from "../../src/domain/repositories/processing-jobs-repository";

class InMemoryClipEditorStatesRepository implements ClipEditorStatesRepository {
  private readonly states = new Map<string, ClipEditorStateRecord>();

  async getByClipId(clipId: string): Promise<ClipEditorStateRecord | null> {
    return this.states.get(clipId) ?? null;
  }

  async save(input: SaveClipEditorStateInput): Promise<ClipEditorStateRecord> {
    const existing = this.states.get(input.clipId);
    const record: ClipEditorStateRecord = {
      clipId: input.clipId,
      sourceJobId: input.sourceJobId,
      payload: input.payload,
      reviewStatus: input.reviewStatus,
      hasManualChanges: input.hasManualChanges,
      lastReseededAt: input.lastReseededAt,
      updatedBy: input.updatedBy ?? null,
      createdAt: existing?.createdAt ?? input.lastReseededAt,
      updatedAt: input.lastReseededAt,
    };
    this.states.set(input.clipId, record);
    return record;
  }
}

class InMemoryProcessingJobsRepository implements ProcessingJobsRepository {
  constructor(private readonly jobs: ProcessingJobRecord[]) {}

  async create(_input: CreateProcessingJobInput): Promise<ProcessingJobRecord> {
    throw new Error("not implemented");
  }

  async getById(id: string): Promise<ProcessingJobRecord | null> {
    return this.jobs.find((job) => job.id === id) ?? null;
  }

  async getLatestByClipId(clipId: string): Promise<ProcessingJobRecord | null> {
    return this.jobs.find((job) => job.clipId === clipId) ?? null;
  }

  async getActiveByClipId(_clipId: string): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async updateStatusStageError(_input: UpdateProcessingJobInput): Promise<ProcessingJobRecord | null> {
    throw new Error("not implemented");
  }

  async claimForProcessing(_input: ClaimProcessingJobInput): Promise<ProcessingJobRecord | null> {
    throw new Error("not implemented");
  }

  async releaseClaim(_input: ReleaseProcessingJobClaimInput): Promise<void> {}

  async saveArtifacts(_input: SaveProcessingJobArtifactsInput): Promise<ProcessingJobRecord | null> {
    throw new Error("not implemented");
  }

  async advanceToNextStage(_input: AdvanceToNextStageInput): Promise<ProcessingJobRecord | null> {
    throw new Error("not implemented");
  }

  async markFailed(_input: MarkProcessingJobFailedInput): Promise<ProcessingJobRecord | null> {
    throw new Error("not implemented");
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
    const entry: AuditLogRecord = {
      id: input.id,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    };
    this.entries.push(entry);
    return entry;
  }
}

function makePayload(status: EditorPayload["review"]["status"] = "generated"): EditorPayload {
  return {
    clipId: "clip_1",
    sourceJobId: "job_1",
    createdAt: "2026-03-16T12:00:00.000Z",
    updatedAt: "2026-03-16T12:00:00.000Z",
    media: {
      normalizedVideoPath: "clips/clip_1/jobs/job_1/normalized.mp4",
      audioWavPath: "clips/clip_1/jobs/job_1/audio.wav",
      posterImagePath: "clips/clip_1/jobs/job_1/poster.jpg",
    },
    thumbnail: {
      imagePath: "clips/clip_1/jobs/job_1/poster.jpg",
      source: "generated",
    },
    segments: [
      {
        index: 0,
        text: "สวัสดีครับ",
        startMs: 0,
        endMs: 900,
        translation: {
          englishText: "Hello.",
          source: "generated",
        },
      },
    ],
    review: {
      status,
      hasManualChanges: status === "edited",
    },
  };
}

function makeJob(): ProcessingJobRecord {
  return {
    id: "job_1",
    clipId: "clip_1",
    state: "needs_review",
    stage: "finalize",
    errorPayload: null,
    artifactRefs: {
      finalize: {
        generatedPayloadPath: "clips/clip_1/jobs/job_1/generated-payload.json",
      },
    },
    lockToken: null,
    lockExpiresAt: null,
    createdAt: new Date("2026-03-16T12:00:00.000Z"),
    updatedAt: new Date("2026-03-16T12:05:00.000Z"),
  };
}

describe("clip editor state services", () => {
  it("saves uploader edits and lets admin approve", async () => {
    const clipEditorStatesRepository = new InMemoryClipEditorStatesRepository();
    const auditLogRepository = new InMemoryAuditLogRepository();
    const processingJobsRepository = new InMemoryProcessingJobsRepository([makeJob()]);
    const now = new Date("2026-03-16T13:00:00.000Z");

    await seedClipEditorStateFromJob({
      clipEditorStatesRepository,
      processingJobsRepository,
      auditLogRepository,
      getObjectBuffer: async () => Buffer.from(JSON.stringify(makePayload()), "utf8"),
      now: () => now,
      createId: () => "audit_1",
    }, {
      clipId: "clip_1",
      sourceJobId: "job_1",
      generatedPayloadPath: "clips/clip_1/jobs/job_1/generated-payload.json",
      actorId: "owner@example.com",
    });

    const edited = await updateClipEditorState({
      clipEditorStatesRepository,
      processingJobsRepository,
      auditLogRepository,
      getObjectBuffer: async () => null,
      now: () => new Date("2026-03-16T13:05:00.000Z"),
      createId: () => "audit_2",
    }, {
      clipId: "clip_1",
      actorId: "owner@example.com",
      editor: {
        thumbnail: {
          imagePath: "clips/clip_1/manual-poster.jpg",
          source: "manual",
        },
        segments: [
          {
            index: 0,
            text: "สวัสดีค่ะ",
            startMs: 10,
            endMs: 950,
            translation: {
              englishText: "Hi there.",
              source: "manual",
            },
          },
        ],
      },
    });

    const approved = await reviewClipEditorState({
      clipEditorStatesRepository,
      processingJobsRepository,
      auditLogRepository,
      getObjectBuffer: async () => null,
      now: () => new Date("2026-03-16T13:10:00.000Z"),
      createId: () => "audit_3",
    }, {
      clipId: "clip_1",
      actorId: "admin@example.com",
      status: "approved",
    });

    expect(edited.reviewStatus).toBe("edited");
    expect(edited.hasManualChanges).toBe(true);
    expect(edited.payload.segments[0]?.translation.englishText).toBe("Hi there.");
    expect(edited.payload.segments[0]?.translation.source).toBe("manual");
    expect(edited.payload.thumbnail.source).toBe("manual");
    expect(approved.reviewStatus).toBe("approved");
    expect(approved.payload.review.status).toBe("approved");
    expect(auditLogRepository.entries).toHaveLength(3);
  });

  it("forces edited translation and thumbnail sources to manual", async () => {
    const clipEditorStatesRepository = new InMemoryClipEditorStatesRepository();
    const processingJobsRepository = new InMemoryProcessingJobsRepository([makeJob()]);

    await seedClipEditorStateFromJob({
      clipEditorStatesRepository,
      processingJobsRepository,
      getObjectBuffer: async () => Buffer.from(JSON.stringify(makePayload()), "utf8"),
      now: () => new Date("2026-03-16T13:00:00.000Z"),
    }, {
      clipId: "clip_1",
      sourceJobId: "job_1",
      generatedPayloadPath: "clips/clip_1/jobs/job_1/generated-payload.json",
      actorId: "owner@example.com",
    });

    const edited = await updateClipEditorState({
      clipEditorStatesRepository,
      processingJobsRepository,
      getObjectBuffer: async () => null,
      now: () => new Date("2026-03-16T13:05:00.000Z"),
    }, {
      clipId: "clip_1",
      actorId: "owner@example.com",
      editor: {
        thumbnail: {
          imagePath: "clips/clip_1/manual-poster.jpg",
          source: "generated",
        },
        segments: [
          {
            index: 0,
            text: "สวัสดีครับ",
            startMs: 0,
            endMs: 900,
            translation: {
              englishText: "Hello there.",
              source: "generated",
            },
          },
        ],
      },
    });

    expect(edited.payload.thumbnail.source).toBe("manual");
    expect(edited.payload.segments[0]?.translation.source).toBe("manual");
  });

  it("keeps generated sources when content is unchanged", async () => {
    const clipEditorStatesRepository = new InMemoryClipEditorStatesRepository();
    const processingJobsRepository = new InMemoryProcessingJobsRepository([makeJob()]);

    await seedClipEditorStateFromJob({
      clipEditorStatesRepository,
      processingJobsRepository,
      getObjectBuffer: async () => Buffer.from(JSON.stringify(makePayload()), "utf8"),
      now: () => new Date("2026-03-16T13:00:00.000Z"),
    }, {
      clipId: "clip_1",
      sourceJobId: "job_1",
      generatedPayloadPath: "clips/clip_1/jobs/job_1/generated-payload.json",
      actorId: "owner@example.com",
    });

    const edited = await updateClipEditorState({
      clipEditorStatesRepository,
      processingJobsRepository,
      getObjectBuffer: async () => null,
      now: () => new Date("2026-03-16T13:05:00.000Z"),
    }, {
      clipId: "clip_1",
      actorId: "owner@example.com",
      editor: {
        thumbnail: {
          imagePath: "clips/clip_1/jobs/job_1/poster.jpg",
          source: "generated",
        },
        segments: [
          {
            index: 0,
            text: "สวัสดีครับ",
            startMs: 0,
            endMs: 900,
            translation: {
              englishText: "Hello.",
              source: "generated",
            },
          },
        ],
      },
    });

    expect(edited.payload.thumbnail.source).toBe("generated");
    expect(edited.payload.segments[0]?.translation.source).toBe("generated");
  });

  it("reseeds approved clips back to generated after a rerun", async () => {
    const clipEditorStatesRepository = new InMemoryClipEditorStatesRepository();
    const processingJobsRepository = new InMemoryProcessingJobsRepository([makeJob()]);

    await clipEditorStatesRepository.save({
      clipId: "clip_1",
      sourceJobId: "job_old",
      payload: {
        ...makePayload("approved"),
        sourceJobId: "job_old",
        review: {
          status: "approved",
          hasManualChanges: true,
        },
      },
      reviewStatus: "approved",
      hasManualChanges: true,
      lastReseededAt: new Date("2026-03-16T12:00:00.000Z"),
      updatedBy: "admin@example.com",
    });

    const reseeded = await seedClipEditorStateFromJob({
      clipEditorStatesRepository,
      processingJobsRepository,
      getObjectBuffer: async () => Buffer.from(JSON.stringify(makePayload("edited")), "utf8"),
      now: () => new Date("2026-03-16T14:00:00.000Z"),
    }, {
      clipId: "clip_1",
      sourceJobId: "job_2",
      generatedPayloadPath: "clips/clip_1/jobs/job_2/generated-payload.json",
      actorId: "system",
    });

    expect(reseeded.sourceJobId).toBe("job_2");
    expect(reseeded.reviewStatus).toBe("generated");
    expect(reseeded.hasManualChanges).toBe(false);
    expect(reseeded.payload.review).toEqual({
      status: "generated",
      hasManualChanges: false,
    });
  });

  it("warns before retry when review work would be replaced", () => {
    expect(shouldWarnBeforeRetry({ reviewStatus: "generated", hasManualChanges: false })).toBe(false);
    expect(shouldWarnBeforeRetry({ reviewStatus: "edited", hasManualChanges: true })).toBe(true);
    expect(getRetryWarningMessage({ reviewStatus: "approved", hasManualChanges: true })).toContain("reseed the editor state");
  });

  it("rejects segments with inverted timing", async () => {
    const clipEditorStatesRepository = new InMemoryClipEditorStatesRepository();
    const processingJobsRepository = new InMemoryProcessingJobsRepository([makeJob()]);

    await seedClipEditorStateFromJob({
      clipEditorStatesRepository,
      processingJobsRepository,
      getObjectBuffer: async () => Buffer.from(JSON.stringify(makePayload()), "utf8"),
      now: () => new Date("2026-03-16T13:00:00.000Z"),
    }, {
      clipId: "clip_1",
      sourceJobId: "job_1",
      generatedPayloadPath: "clips/clip_1/jobs/job_1/generated-payload.json",
      actorId: "owner@example.com",
    });

    await expect(updateClipEditorState({
      clipEditorStatesRepository,
      processingJobsRepository,
      getObjectBuffer: async () => null,
      now: () => new Date("2026-03-16T13:05:00.000Z"),
    }, {
      clipId: "clip_1",
      actorId: "owner@example.com",
      editor: {
        thumbnail: {
          imagePath: "clips/clip_1/jobs/job_1/poster.jpg",
          source: "generated",
        },
        segments: [
          {
            index: 0,
            text: "สวัสดีครับ",
            startMs: 900,
            endMs: 100,
            translation: {
              englishText: "Hello.",
              source: "generated",
            },
          },
        ],
      },
    })).rejects.toMatchObject({
      code: "invalid_request",
      message: "Segment 0 start time must be earlier than end time",
    });
  });

  it("rejects segments that overlap the previous segment", async () => {
    const clipEditorStatesRepository = new InMemoryClipEditorStatesRepository();
    const processingJobsRepository = new InMemoryProcessingJobsRepository([makeJob()]);

    await seedClipEditorStateFromJob({
      clipEditorStatesRepository,
      processingJobsRepository,
      getObjectBuffer: async () => Buffer.from(JSON.stringify({
        ...makePayload(),
        segments: [
          {
            index: 0,
            text: "สวัสดีครับ",
            startMs: 0,
            endMs: 900,
            translation: {
              englishText: "Hello.",
              source: "generated",
            },
          },
          {
            index: 1,
            text: "ขอบคุณครับ",
            startMs: 900,
            endMs: 1_500,
            translation: {
              englishText: "Thank you.",
              source: "generated",
            },
          },
        ],
      }), "utf8"),
      now: () => new Date("2026-03-16T13:00:00.000Z"),
    }, {
      clipId: "clip_1",
      sourceJobId: "job_1",
      generatedPayloadPath: "clips/clip_1/jobs/job_1/generated-payload.json",
      actorId: "owner@example.com",
    });

    await expect(updateClipEditorState({
      clipEditorStatesRepository,
      processingJobsRepository,
      getObjectBuffer: async () => null,
      now: () => new Date("2026-03-16T13:05:00.000Z"),
    }, {
      clipId: "clip_1",
      actorId: "owner@example.com",
      editor: {
        thumbnail: {
          imagePath: "clips/clip_1/jobs/job_1/poster.jpg",
          source: "generated",
        },
        segments: [
          {
            index: 0,
            text: "สวัสดีครับ",
            startMs: 0,
            endMs: 900,
            translation: {
              englishText: "Hello.",
              source: "generated",
            },
          },
          {
            index: 1,
            text: "ขอบคุณครับ",
            startMs: 850,
            endMs: 1_500,
            translation: {
              englishText: "Thank you.",
              source: "generated",
            },
          },
        ],
      },
    })).rejects.toMatchObject({
      code: "invalid_request",
      message: "Segment 1 starts before the previous segment ends",
    });
  });
});
