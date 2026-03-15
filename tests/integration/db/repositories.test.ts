import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { createDb } from "../../../src/db/client";
import { DrizzleAuditLogRepository } from "../../../src/db/repositories/audit-log-repository";
import { DrizzleClipsRepository } from "../../../src/db/repositories/clips-repository";
import { DrizzleProcessingJobsRepository } from "../../../src/db/repositories/processing-jobs-repository";

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

function describeDatabaseTarget(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.host || "unknown-host";
    const dbName = parsed.pathname.replace(/^\//, "") || "unknown-db";
    return `${host}/${dbName}`;
  } catch {
    return "invalid TEST_DATABASE_URL";
  }
}

function uniqueId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function eventuallyGetClip(
  clipsRepo: DrizzleClipsRepository,
  clipId: string,
): Promise<Awaited<ReturnType<DrizzleClipsRepository["getById"]>> | null> {
  for (let i = 0; i < 10; i += 1) {
    const clip = await clipsRepo.getById(clipId);
    if (clip) {
      return clip;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
}

if (!databaseUrl || !hasLockColumns) {
  describe.skip("db repositories", () => {
    it("requires TEST_DATABASE_URL and migrated lock columns", () => {
      expect(true).toBe(true);
    });
  });
} else {
  console.info(
    `[integration] using TEST_DATABASE_URL (${describeDatabaseTarget(databaseUrl)})`,
  );

  describe("db repositories", () => {
    const db = createDb(databaseUrl);
    const clipsRepo = new DrizzleClipsRepository(db);
    const jobsRepo = new DrizzleProcessingJobsRepository(db);
    const auditRepo = new DrizzleAuditLogRepository(db);

    it("creates and reads clips", async () => {
      const clipId = uniqueId("clip");

      const created = await clipsRepo.create({
        id: clipId,
        title: "Thai morning market",
        ownerId: "owner_1",
        sourceType: "original",
        rightsStatus: "unknown",
      });
      const fetched = await eventuallyGetClip(clipsRepo, clipId);

      expect(created.id).toBe(clipId);
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe("Thai morning market");
      expect(fetched?.sourceType).toBe("original");
      expect(fetched?.rightsStatus).toBe("unknown");
    });

    it("creates, reads, and updates processing jobs", async () => {
      const clipId = uniqueId("clip");
      const olderJobId = uniqueId("job");
      const newerJobId = uniqueId("job");

      await clipsRepo.create({
        id: clipId,
        title: "Evening temple walk",
        ownerId: "owner_1",
        sourceType: "licensed",
        rightsStatus: "cleared",
      });

      await jobsRepo.create({
        id: olderJobId,
        clipId,
        state: "processing",
        stage: "audio",
      });

      await jobsRepo.create({
        id: newerJobId,
        clipId,
        state: "processing",
        stage: "asr",
      });

      const latest = await jobsRepo.getLatestByClipId(clipId);
      expect(latest).not.toBeNull();
      expect(latest?.id).toBe(newerJobId);

      const updated = await jobsRepo.updateStatusStageError({
        id: newerJobId,
        state: "failed",
        stage: "asr",
        errorPayload: { code: "provider_timeout" },
      });

      expect(updated?.state).toBe("failed");
      expect(updated?.errorPayload).toEqual({ code: "provider_timeout" });
    });

    it("appends audit log entries", async () => {
      const entry = await auditRepo.append({
        id: uniqueId("audit"),
        actorId: "system",
        action: "upload",
        targetType: "job",
        targetId: uniqueId("job"),
        metadata: { stage: "audio" },
      });

      expect(entry.action).toBe("upload");
      expect(entry.targetType).toBe("job");
      expect(entry.metadata).toEqual({ stage: "audio" });
    });
  });
}
