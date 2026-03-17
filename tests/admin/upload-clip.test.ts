import { describe, expect, it } from "vitest";
import { uploadClip } from "../../src/admin/services/upload-clip";
import type { ClipRecord, ClipsRepository, CreateClipInput } from "../../src/domain/repositories/clips-repository";
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

class InMemoryClipsRepository implements ClipsRepository {
  readonly clips = new Map<string, ClipRecord>();

  async create(input: CreateClipInput): Promise<ClipRecord> {
    const clip: ClipRecord = {
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.clips.set(input.id, clip);
    return clip;
  }

  async getById(id: string): Promise<ClipRecord | null> {
    return this.clips.get(id) ?? null;
  }

  async deleteById(id: string): Promise<void> {
    this.clips.delete(id);
  }
}

class InMemoryProcessingJobsRepository implements ProcessingJobsRepository {
  readonly jobs = new Map<string, ProcessingJobRecord>();

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

describe("uploadClip", () => {
  it("rolls back stored objects and rows when queue enqueue fails", async () => {
    const clipsRepository = new InMemoryClipsRepository();
    const processingJobsRepository = new InMemoryProcessingJobsRepository();
    const deletedKeys: string[] = [];

    await expect(uploadClip({
      clipsRepository,
      processingJobsRepository,
      putObject: async () => undefined,
      deleteObject: async (key) => {
        deletedKeys.push(key);
      },
      enqueueProcessingJob: async () => {
        throw new Error("queue unavailable");
      },
      createId: (() => {
        const ids = ["clip_1", "job_1"];
        return () => ids.shift() ?? "extra_id";
      })(),
    }, {
      ownerId: "admin@example.com",
      title: "Thai news clip",
      fileName: "clip.mp4",
      fileType: "video/mp4",
      fileBytes: Buffer.from("video"),
    })).rejects.toMatchObject({
      code: "processing_failed",
      message: "queue unavailable",
    });

    expect(clipsRepository.clips.size).toBe(0);
    expect(processingJobsRepository.jobs.size).toBe(0);
    expect(deletedKeys).toEqual(["clips/clip_1/source"]);
  });
});
