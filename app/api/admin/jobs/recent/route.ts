import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { clipEditorStates, processingJobs } from "../../../../../infra/db/schema";
import { getDb } from "../../../../../lib/db";

export async function GET() {
  const db = getDb();
  const rows = await db
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

  return NextResponse.json({ jobs: rows });
}
