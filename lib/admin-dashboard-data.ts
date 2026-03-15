import { desc, eq } from "drizzle-orm";
import { clips, processingJobs } from "../infra/db/schema";
import { getDb } from "./db";

export async function loadDashboardData() {
  const db = getDb();

  const [allClips, runningJobs] = await Promise.all([
    db.select().from(clips).orderBy(desc(clips.updatedAt)).limit(200),
    db.select().from(processingJobs)
      .where(eq(processingJobs.state, "processing"))
      .orderBy(desc(processingJobs.updatedAt))
      .limit(200),
  ]);

  return {
    clips: allClips,
    runningJobs,
  };
}
