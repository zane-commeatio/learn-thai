import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ClipCurrentStatus from "../../components/clip-current-status";
import ClipHeader from "../../components/clip-header";
import JobHistoryTable from "../../components/job-history-table";
import PipelineStagesPanel from "../../components/pipeline-stages-panel";
import { buildClipDetailViewModel } from "./clip-detail-view-model";
import { clips, processingJobs } from "../../../../infra/db/schema";
import { requireAdminSession } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";

type RouteParams = {
  params: Promise<{
    clipId: string;
  }>;
};

export default async function AdminClipDetailPage({ params }: RouteParams) {
  await requireAdminSession();
  const { clipId } = await params;
  const db = getDb();

  const [clip] = await db.select().from(clips).where(eq(clips.id, clipId)).limit(1);
  if (!clip) {
    notFound();
  }

  const jobs = await db
    .select()
    .from(processingJobs)
    .where(eq(processingJobs.clipId, clipId))
    .orderBy(desc(processingJobs.updatedAt))
    .limit(50);

  const viewModel = buildClipDetailViewModel({ clip, jobs });

  return (
    <main className="mx-auto flex w-[min(1180px,94vw)] flex-col gap-6 py-10">
      <ClipHeader {...viewModel.header} />
      <ClipCurrentStatus status={viewModel.currentStatus} />
      <PipelineStagesPanel stages={viewModel.stages} />
      <JobHistoryTable jobs={viewModel.jobs} />
    </main>
  );
}
