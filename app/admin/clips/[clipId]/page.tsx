import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ClipCurrentStatus from "../../components/clip-current-status";
import ClipHeader from "../../components/clip-header";
import JobHistoryTable from "../../components/job-history-table";
import PipelineStagesPanel from "../../components/pipeline-stages-panel";
import ReviewEditorPanel from "../../components/review-editor-panel";
import ReviewChecklistPanel from "../../components/review-checklist-panel";
import { buildClipDetailViewModel } from "./clip-detail-view-model";
import {
  getOrCreateClipEditorState,
  getRetryWarningMessage,
} from "../../../../src/admin/services/clip-editor-state";
import { DrizzleAuditLogRepository } from "../../../../src/db/repositories/audit-log-repository";
import { DrizzleClipEditorStatesRepository } from "../../../../src/db/repositories/clip-editor-states-repository";
import { DrizzleProcessingJobsRepository } from "../../../../src/db/repositories/processing-jobs-repository";
import { clips, processingJobs } from "../../../../infra/db/schema";
import { requireAdminSession } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { getObjectBuffer } from "../../../../lib/storage";

type RouteParams = {
  params: Promise<{
    clipId: string;
  }>;
};

export default async function AdminClipDetailPage({ params }: RouteParams) {
  const session = await requireAdminSession();
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
  const editorState = await getOrCreateClipEditorState({
    clipEditorStatesRepository: new DrizzleClipEditorStatesRepository(db),
    processingJobsRepository: new DrizzleProcessingJobsRepository(db),
    auditLogRepository: new DrizzleAuditLogRepository(db),
    getObjectBuffer,
  }, {
    clipId,
    actorId: session.email,
  });
  const retryWarningMessage = getRetryWarningMessage(editorState ? {
    reviewStatus: editorState.reviewStatus,
    hasManualChanges: editorState.hasManualChanges,
  } : null);
  const canEdit = clip.ownerId === session.email || clip.ownerId === "admin";

  return (
    <main className="mx-auto flex w-[min(1180px,94vw)] flex-col gap-6 py-10">
      <ClipHeader {...viewModel.header} />
      <ClipCurrentStatus status={viewModel.currentStatus} retryWarningMessage={retryWarningMessage} />
      <ReviewEditorPanel
        clipId={clipId}
        clipOwnerId={clip.ownerId}
        currentUserEmail={session.email}
        canEdit={canEdit}
        canReview
        initialEditorState={editorState ? {
          clipId: editorState.clipId,
          sourceJobId: editorState.sourceJobId,
          payload: editorState.payload,
          reviewStatus: editorState.reviewStatus,
          hasManualChanges: editorState.hasManualChanges,
          lastReseededAt: editorState.lastReseededAt.toISOString(),
          updatedBy: editorState.updatedBy,
        } : null}
      />
      <ReviewChecklistPanel checklist={viewModel.reviewChecklist} />
      <PipelineStagesPanel stages={viewModel.stages} finalizePayload={editorState?.payload ?? null} retryWarningMessage={retryWarningMessage} />
      <JobHistoryTable jobs={viewModel.jobs} retryWarningMessage={retryWarningMessage} />
    </main>
  );
}
