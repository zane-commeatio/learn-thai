import { desc, eq } from "drizzle-orm";
import { clipEditorStates, processingJobs } from "../../../infra/db/schema";
import type { Database } from "../../db/client";

export type ListRecentJobsDependencies = {
  db: Database;
};

export type ListRecentJobsResult = {
  jobs: Array<{
    id: string;
    clipId: string;
    state: typeof processingJobs.$inferSelect.state;
    stage: typeof processingJobs.$inferSelect.stage;
    artifactRefs: typeof processingJobs.$inferSelect.artifactRefs;
    errorPayload: typeof processingJobs.$inferSelect.errorPayload;
    lockToken: string | null;
    lockExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    reviewStatus: typeof clipEditorStates.$inferSelect.reviewStatus | null;
    hasManualChanges: boolean | null;
  }>;
};

export async function listRecentJobs(
  dependencies: ListRecentJobsDependencies,
): Promise<ListRecentJobsResult> {
  const jobs = await dependencies.db
    .select({
      id: processingJobs.id,
      clipId: processingJobs.clipId,
      state: processingJobs.state,
      stage: processingJobs.stage,
      artifactRefs: processingJobs.artifactRefs,
      errorPayload: processingJobs.errorPayload,
      lockToken: processingJobs.lockToken,
      lockExpiresAt: processingJobs.lockExpiresAt,
      createdAt: processingJobs.createdAt,
      updatedAt: processingJobs.updatedAt,
      reviewStatus: clipEditorStates.reviewStatus,
      hasManualChanges: clipEditorStates.hasManualChanges,
    })
    .from(processingJobs)
    .leftJoin(clipEditorStates, eq(clipEditorStates.clipId, processingJobs.clipId))
    .orderBy(desc(processingJobs.updatedAt))
    .limit(20);

  return { jobs };
}
