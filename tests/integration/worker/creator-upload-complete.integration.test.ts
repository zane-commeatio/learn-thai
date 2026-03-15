import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { createDb } from "../../../src/db/client";
import { DrizzleClipsRepository } from "../../../src/db/repositories/clips-repository";
import { DrizzleProcessingJobsRepository } from "../../../src/db/repositories/processing-jobs-repository";
import type { ProcessingJobQueueMessage } from "../../../src/domain/queues/processing-jobs-queue";
import { handleRequest } from "../../../src/worker/app";

const databaseUrl = process.env.TEST_DATABASE_URL;

async function hasProcessingJobLockColumns(url: string): Promise<boolean> {
  const sql = neon(url);
  const rows = await sql`
    select count(*)::int as count
    from information_schema.columns
    where table_name = 'processing_jobs'
      and column_name in ('lock_token', 'lock_expires_at', 'artifact_refs')
  `;

  const count = Number(rows[0]?.count ?? 0);
  return count === 3;
}

const hasLockColumns = databaseUrl ? await hasProcessingJobLockColumns(databaseUrl) : false;

class QueueSpy {
  readonly messages: ProcessingJobQueueMessage[] = [];

  async enqueue(message: ProcessingJobQueueMessage): Promise<void> {
    this.messages.push(message);
  }
}

async function eventuallyGetClip(
  clipsRepository: DrizzleClipsRepository,
  clipId: string,
) {
  for (let i = 0; i < 15; i += 1) {
    const clip = await clipsRepository.getById(clipId);
    if (clip) {
      return clip;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

async function eventuallyGetJob(
  processingJobsRepository: DrizzleProcessingJobsRepository,
  jobId: string,
) {
  for (let i = 0; i < 15; i += 1) {
    const job = await processingJobsRepository.getById(jobId);
    if (job) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

if (!databaseUrl || !hasLockColumns) {
  describe.skip("POST /api/creator/clips/{clipId}/upload-complete integration", () => {
    it("requires TEST_DATABASE_URL and migrated lock columns", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("POST /api/creator/clips/{clipId}/upload-complete integration", () => {
    const db = createDb(databaseUrl);
    const clipsRepository = new DrizzleClipsRepository(db);
    const processingJobsRepository = new DrizzleProcessingJobsRepository(db);

    it("creates one processing job row and enqueues one message", async () => {
      const clipId = crypto.randomUUID();
      await clipsRepository.create({
        id: clipId,
        title: "Floating market",
        ownerId: "system",
        sourceType: "original",
        rightsStatus: "cleared",
      });
      const readyClip = await eventuallyGetClip(clipsRepository, clipId);
      expect(readyClip).not.toBeNull();

      const queueSpy = new QueueSpy();
      const request = new Request(
        `https://example.com/api/creator/clips/${clipId}/upload-complete`,
        { method: "POST" },
      );

      const response = await handleRequest(
        request,
        {},
        {
          createClipsRepository: () => clipsRepository,
          createProcessingJobsRepository: () => processingJobsRepository,
          createProcessingJobsQueue: () => queueSpy,
        },
      );

      const body = (await response.json()) as { jobId: string };
      const createdJob = await eventuallyGetJob(processingJobsRepository, body.jobId);

      expect(response.status).toBe(202);
      expect(createdJob).not.toBeNull();
      expect(createdJob?.clipId).toBe(clipId);
      expect(createdJob?.state).toBe("processing");
      expect(createdJob?.stage).toBe("audio");
      expect(queueSpy.messages).toEqual([{ clipId, jobId: body.jobId, expectedStage: "audio" }]);
    }, 15000);

    it("returns 409 conflict on duplicate request and does not enqueue again", async () => {
      const clipId = crypto.randomUUID();
      await clipsRepository.create({
        id: clipId,
        title: "Canal commute",
        ownerId: "system",
        sourceType: "licensed",
        rightsStatus: "cleared",
      });
      const readyClip = await eventuallyGetClip(clipsRepository, clipId);
      expect(readyClip).not.toBeNull();

      const queueSpy = new QueueSpy();
      const request = new Request(
        `https://example.com/api/creator/clips/${clipId}/upload-complete`,
        { method: "POST" },
      );

      const firstResponse = await handleRequest(
        request,
        {},
        {
          createClipsRepository: () => clipsRepository,
          createProcessingJobsRepository: () => processingJobsRepository,
          createProcessingJobsQueue: () => queueSpy,
        },
      );
      expect(firstResponse.status).toBe(202);

      const secondResponse = await handleRequest(
        request,
        {},
        {
          createClipsRepository: () => clipsRepository,
          createProcessingJobsRepository: () => processingJobsRepository,
          createProcessingJobsQueue: () => queueSpy,
        },
      );

      const secondBody = (await secondResponse.json()) as { code: string };
      const latestJob = await processingJobsRepository.getLatestByClipId(clipId);

      expect(secondResponse.status).toBe(409);
      expect(secondBody.code).toBe("conflict");
      expect(latestJob).not.toBeNull();
      expect(queueSpy.messages).toHaveLength(1);
    }, 15000);
  });
}
