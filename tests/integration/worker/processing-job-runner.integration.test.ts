import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { and, eq } from "drizzle-orm";
import { auditLog } from "../../../infra/db/schema";
import { createDb } from "../../../src/db/client";
import { DrizzleAuditLogRepository } from "../../../src/db/repositories/audit-log-repository";
import { DrizzleClipsRepository } from "../../../src/db/repositories/clips-repository";
import { DrizzleProcessingJobsRepository } from "../../../src/db/repositories/processing-jobs-repository";
import { processProcessingJobMessage } from "../../../src/worker/runner/processing-job-runner";

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

if (!databaseUrl || !hasLockColumns) {
  describe.skip("processing job runner integration", () => {
    it("requires TEST_DATABASE_URL and migrated lock columns", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("processing job runner integration", () => {
    const db = createDb(databaseUrl);
    const clipsRepository = new DrizzleClipsRepository(db);
    const processingJobsRepository = new DrizzleProcessingJobsRepository(db);
    const auditLogRepository = new DrizzleAuditLogRepository(db);

    it("handles duplicate delivery with single claim and monotonic stage update", async () => {
      const clipId = crypto.randomUUID();
      const jobId = crypto.randomUUID();

      await clipsRepository.create({
        id: clipId,
        title: "Runner duplicate simulation",
        ownerId: "system",
        sourceType: "original",
        rightsStatus: "cleared",
      });

      await processingJobsRepository.create({
        id: jobId,
        clipId,
        state: "processing",
        stage: "audio",
      });

      await Promise.all([
        processProcessingJobMessage(
          { jobId, clipId, expectedStage: "audio" },
          { processingJobsRepository, auditLogRepository },
        ),
        processProcessingJobMessage(
          { jobId, clipId, expectedStage: "audio" },
          { processingJobsRepository, auditLogRepository },
        ),
      ]);

      const job = await processingJobsRepository.getById(jobId);
      const logs = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.targetType, "job"), eq(auditLog.targetId, jobId)));

      const starts = logs.filter(
        (entry) => ((entry.metadata ?? {}) as { event?: string }).event === "job_start",
      );
      const stageChanges = logs.filter(
        (entry) => ((entry.metadata ?? {}) as { event?: string }).event === "job_stage_change",
      );
      const stageOutcomeSuccess = logs.filter(
        (entry) => {
          const metadata = (entry.metadata ?? {}) as {
            event?: string;
            outcome?: string;
            durationMs?: number;
          };

          return metadata.event === "stage_outcome" && metadata.outcome === "success"
            && typeof metadata.durationMs === "number";
        },
      );

      expect(job).not.toBeNull();
      expect(job?.stage).toBe("asr");
      expect(job?.artifactRefs).toEqual({
        normalizedVideoPath: `clips/${clipId}/jobs/${jobId}/normalized.mp4`,
        posterImagePath: `clips/${clipId}/jobs/${jobId}/poster.jpg`,
        audioWavPath: `clips/${clipId}/jobs/${jobId}/audio.wav`,
      });
      expect(starts).toHaveLength(1);
      expect(stageChanges).toHaveLength(1);
      expect(stageOutcomeSuccess).toHaveLength(1);
    }, 15000);

    it("marks failed and logs failure outcome when audio stage errors", async () => {
      const clipId = crypto.randomUUID();
      const jobId = crypto.randomUUID();

      await clipsRepository.create({
        id: clipId,
        title: "Runner failure simulation",
        ownerId: "system",
        sourceType: "original",
        rightsStatus: "cleared",
      });

      await processingJobsRepository.create({
        id: jobId,
        clipId,
        state: "processing",
        stage: "audio",
      });

      await processProcessingJobMessage(
        { jobId, clipId, expectedStage: "audio" },
        {
          processingJobsRepository,
          auditLogRepository,
          audioStageAdapter: {
            async run(): Promise<never> {
              throw new Error("audio adapter failure");
            },
          },
        },
      );

      const job = await processingJobsRepository.getById(jobId);
      const logs = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.targetType, "job"), eq(auditLog.targetId, jobId)));

      const failedOutcome = logs.filter(
        (entry) => {
          const metadata = (entry.metadata ?? {}) as {
            event?: string;
            outcome?: string;
            durationMs?: number;
          };

          return metadata.event === "stage_outcome" && metadata.outcome === "failed"
            && typeof metadata.durationMs === "number";
        },
      );

      expect(job?.state).toBe("failed");
      expect((job?.errorPayload as { code?: string })?.code).toBe("audio_stage_failed");
      expect(failedOutcome).toHaveLength(1);
    }, 15000);
  });
}
