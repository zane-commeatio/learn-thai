import { DrizzleAuditLogRepository } from "../../../../../../src/db/repositories/audit-log-repository";
import { DrizzleClipEditorStatesRepository } from "../../../../../../src/db/repositories/clip-editor-states-repository";
import { DrizzleProcessingJobsRepository } from "../../../../../../src/db/repositories/processing-jobs-repository";
import {
  ReviewDecisionInputSchema,
  reviewClipEditorState,
} from "../../../../../../src/admin/services/clip-editor-state";
import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../../lib/api-route";
import { getDb } from "../../../../../../lib/db";
import { getObjectBuffer } from "../../../../../../lib/storage";
import { invalidRequest } from "../../../../../../src/contracts/api-error";

type RouteParams = {
  params: Promise<{
    clipId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAdminApiSession();
    const { clipId } = await params;
    const db = getDb();
    const body = await request.json().catch(() => null);
    const parsed = ReviewDecisionInputSchema.safeParse(body);
    if (!parsed.success) {
      return invalidRequest("Invalid request", parsed.error.flatten());
    }

    const state = await reviewClipEditorState({
      clipEditorStatesRepository: new DrizzleClipEditorStatesRepository(db),
      processingJobsRepository: new DrizzleProcessingJobsRepository(db),
      auditLogRepository: new DrizzleAuditLogRepository(db),
      getObjectBuffer,
    }, {
      clipId,
      actorId: session.email,
      status: parsed.data.status,
    });

    return Response.json({ editorState: state });
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to update review state");
  }
}
