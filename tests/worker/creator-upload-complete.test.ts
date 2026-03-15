import { describe, expect, it } from "vitest";
import { handleRequest } from "../../src/worker/app";
import type {
  ClipRecord,
  ClipsRepository,
  CreateClipInput,
} from "../../src/domain/repositories/clips-repository";
import type {
  CreateProcessingJobInput,
  ProcessingJobRecord,
  ProcessingJobsRepository,
  UpdateProcessingJobInput,
} from "../../src/domain/repositories/processing-jobs-repository";
import type {
  ProcessingJobQueueMessage,
  ProcessingJobsQueue,
} from "../../src/domain/queues/processing-jobs-queue";

class InMemoryClipsRepository implements ClipsRepository {
  constructor(private readonly clips: Map<string, ClipRecord>) {}

  async create(input: CreateClipInput): Promise<ClipRecord> {
    const record: ClipRecord = {
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.clips.set(input.id, record);
    return record;
  }

  async getById(id: string): Promise<ClipRecord | null> {
    return this.clips.get(id) ?? null;
  }
}

class InMemoryProcessingJobsRepository implements ProcessingJobsRepository {
  readonly createdJobs: ProcessingJobRecord[] = [];

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
    this.createdJobs.push(record);
    return record;
  }

  async getById(id: string): Promise<ProcessingJobRecord | null> {
    return this.createdJobs.find((job) => job.id === id) ?? null;
  }

  async getLatestByClipId(clipId: string): Promise<ProcessingJobRecord | null> {
    const jobs = this.createdJobs.filter((job) => job.clipId === clipId);
    return jobs.length > 0 ? jobs[jobs.length - 1] : null;
  }

  async getActiveByClipId(clipId: string): Promise<ProcessingJobRecord | null> {
    const jobs = this.createdJobs.filter((job) => job.clipId === clipId && job.state === "processing");
    return jobs.length > 0 ? jobs[jobs.length - 1] : null;
  }

  async updateStatusStageError(
    input: UpdateProcessingJobInput,
  ): Promise<ProcessingJobRecord | null> {
    const found = this.createdJobs.find((job) => job.id === input.id);
    if (!found) {
      return null;
    }

    found.state = input.state;
    found.stage = input.stage;
    found.errorPayload = input.errorPayload ?? null;
    found.updatedAt = new Date();
    return found;
  }

  async claimForProcessing(): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async releaseClaim(): Promise<void> {
    return;
  }

  async saveArtifacts(): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async advanceToNextStage(): Promise<ProcessingJobRecord | null> {
    return null;
  }

  async markFailed(): Promise<ProcessingJobRecord | null> {
    return null;
  }
}

class InMemoryProcessingJobsQueue implements ProcessingJobsQueue {
  readonly messages: ProcessingJobQueueMessage[] = [];

  async enqueue(message: ProcessingJobQueueMessage): Promise<void> {
    this.messages.push(message);
  }
}

function makeDependencies(
  clipsRepository: ClipsRepository,
  processingJobsRepository: ProcessingJobsRepository,
  processingJobsQueue: ProcessingJobsQueue,
) {
  return {
    createClipsRepository: () => clipsRepository,
    createProcessingJobsRepository: () => processingJobsRepository,
    createProcessingJobsQueue: () => processingJobsQueue,
  };
}

describe("POST /api/creator/clips/{clipId}/upload-complete", () => {
  it("returns 202, creates processing job, and enqueues one message", async () => {
    const clipId = crypto.randomUUID();
    const clipsRepository = new InMemoryClipsRepository(new Map([[clipId, {
      id: clipId,
      title: "Market greetings",
      ownerId: "system",
      sourceType: "original",
      rightsStatus: "cleared",
      createdAt: new Date(),
      updatedAt: new Date(),
    }]]));
    const processingJobsRepository = new InMemoryProcessingJobsRepository();
    const processingJobsQueue = new InMemoryProcessingJobsQueue();

    const request = new Request(
      `https://example.com/api/creator/clips/${clipId}/upload-complete`,
      { method: "POST" },
    );

    const response = await handleRequest(
      request,
      {},
      makeDependencies(clipsRepository, processingJobsRepository, processingJobsQueue),
    );
    const body = (await response.json()) as { jobId: string };

    expect(response.status).toBe(202);
    expect(body.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(processingJobsRepository.createdJobs).toHaveLength(1);
    expect(processingJobsRepository.createdJobs[0]).toMatchObject({
      clipId,
      state: "processing",
      stage: "audio",
    });
    expect(processingJobsQueue.messages).toHaveLength(1);
    expect(processingJobsQueue.messages[0]).toEqual({
      clipId,
      jobId: body.jobId,
      expectedStage: "audio",
    });
  });

  it("returns 404 when clip does not exist", async () => {
    const clipId = crypto.randomUUID();
    const clipsRepository = new InMemoryClipsRepository(new Map());
    const processingJobsRepository = new InMemoryProcessingJobsRepository();
    const processingJobsQueue = new InMemoryProcessingJobsQueue();

    const request = new Request(
      `https://example.com/api/creator/clips/${clipId}/upload-complete`,
      { method: "POST" },
    );

    const response = await handleRequest(
      request,
      {},
      makeDependencies(clipsRepository, processingJobsRepository, processingJobsQueue),
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("not_found");
    expect(processingJobsRepository.createdJobs).toHaveLength(0);
    expect(processingJobsQueue.messages).toHaveLength(0);
  });

  it("returns 409 conflict for duplicate upload-complete requests", async () => {
    const clipId = crypto.randomUUID();
    const clipsRepository = new InMemoryClipsRepository(new Map([[clipId, {
      id: clipId,
      title: "Temple walk",
      ownerId: "system",
      sourceType: "licensed",
      rightsStatus: "cleared",
      createdAt: new Date(),
      updatedAt: new Date(),
    }]]));
    const processingJobsRepository = new InMemoryProcessingJobsRepository();
    const processingJobsQueue = new InMemoryProcessingJobsQueue();

    const request = new Request(
      `https://example.com/api/creator/clips/${clipId}/upload-complete`,
      { method: "POST" },
    );

    const firstResponse = await handleRequest(
      request,
      {},
      makeDependencies(clipsRepository, processingJobsRepository, processingJobsQueue),
    );
    expect(firstResponse.status).toBe(202);

    const secondResponse = await handleRequest(
      request,
      {},
      makeDependencies(clipsRepository, processingJobsRepository, processingJobsQueue),
    );
    const secondBody = (await secondResponse.json()) as { code: string };

    expect(secondResponse.status).toBe(409);
    expect(secondBody.code).toBe("conflict");
    expect(processingJobsRepository.createdJobs).toHaveLength(1);
    expect(processingJobsQueue.messages).toHaveLength(1);
  });

  it("returns 400 for invalid clip id path param", async () => {
    const clipsRepository = new InMemoryClipsRepository(new Map());
    const processingJobsRepository = new InMemoryProcessingJobsRepository();
    const processingJobsQueue = new InMemoryProcessingJobsQueue();

    const request = new Request(
      "https://example.com/api/creator/clips/not-a-uuid/upload-complete",
      { method: "POST" },
    );

    const response = await handleRequest(
      request,
      {},
      makeDependencies(clipsRepository, processingJobsRepository, processingJobsQueue),
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_request");
    expect(processingJobsRepository.createdJobs).toHaveLength(0);
    expect(processingJobsQueue.messages).toHaveLength(0);
  });
});
