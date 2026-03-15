import { desc, inArray } from "drizzle-orm";
import { clips, processingJobs } from "../../../infra/db/schema";
import type { Database } from "../../db/client";
import type { ListClipsResult } from "./types";

export type ListClipsDependencies = {
  db: Database;
};

export async function listClips(
  dependencies: ListClipsDependencies,
): Promise<ListClipsResult> {
  const rows = await dependencies.db
    .select()
    .from(clips)
    .orderBy(desc(clips.updatedAt))
    .limit(200);
  const clipIds = rows.map((row) => row.id);

  if (clipIds.length === 0) {
    return { clips: [] };
  }

  const jobs = await dependencies.db
    .select({
      id: processingJobs.id,
      clipId: processingJobs.clipId,
      state: processingJobs.state,
      stage: processingJobs.stage,
      updatedAt: processingJobs.updatedAt,
    })
    .from(processingJobs)
    .where(inArray(processingJobs.clipId, clipIds))
    .orderBy(desc(processingJobs.updatedAt));

  const latestJobByClipId = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) {
    if (!latestJobByClipId.has(job.clipId)) {
      latestJobByClipId.set(job.clipId, job);
    }
  }

  return {
    clips: rows.map((clip) => ({
      ...clip,
      latestJob: latestJobByClipId.get(clip.id) ?? null,
    })),
  };
}
