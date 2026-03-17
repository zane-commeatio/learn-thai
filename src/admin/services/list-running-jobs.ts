import { and, desc, eq } from "drizzle-orm";
import { processingJobs } from "../../../infra/db/schema";
import type { Database } from "../../db/client";

export type ListRunningJobsDependencies = {
  db: Database;
};

export type ListRunningJobsResult = {
  jobs: Array<typeof processingJobs.$inferSelect>;
};

export async function listRunningJobs(
  dependencies: ListRunningJobsDependencies,
): Promise<ListRunningJobsResult> {
  const jobs = await dependencies.db
    .select()
    .from(processingJobs)
    .where(and(eq(processingJobs.state, "processing")))
    .orderBy(desc(processingJobs.updatedAt))
    .limit(200);

  return { jobs };
}
