import { NextResponse } from "next/server";
import { DrizzleAuditLogRepository } from "../../../../../../src/db/repositories/audit-log-repository";
import { DrizzleClipEditorStatesRepository } from "../../../../../../src/db/repositories/clip-editor-states-repository";
import { DrizzleProcessingJobsRepository } from "../../../../../../src/db/repositories/processing-jobs-repository";
import {
  ReviewDecisionInputSchema,
  reviewClipEditorState,
} from "../../../../../../src/admin/services/clip-editor-state";
import {
  getAdminServiceErrorStatus,
  isAdminServiceError,
} from "../../../../../../src/admin/services/errors";
import { requireAdminSession } from "../../../../../../lib/admin-auth";
import { getDb } from "../../../../../../lib/db";
import { getObjectBuffer } from "../../../../../../lib/storage";

type RouteParams = {
  params: Promise<{
    clipId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireAdminSession();
  const { clipId } = await params;
  const db = getDb();

  try {
    const body = await request.json();
    const { status } = ReviewDecisionInputSchema.parse(body);

    const state = await reviewClipEditorState({
      clipEditorStatesRepository: new DrizzleClipEditorStatesRepository(db),
      processingJobsRepository: new DrizzleProcessingJobsRepository(db),
      auditLogRepository: new DrizzleAuditLogRepository(db),
      getObjectBuffer,
    }, {
      clipId,
      actorId: session.email,
      status,
    });

    return NextResponse.json({ editorState: state });
  } catch (error) {
    if (isAdminServiceError(error)) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: getAdminServiceErrorStatus(error) });
    }

    return NextResponse.json({ code: "processing_failed", message: error instanceof Error ? error.message : "Failed to update review state" }, { status: 500 });
  }
}
