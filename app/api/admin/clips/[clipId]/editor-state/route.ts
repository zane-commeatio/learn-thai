import { ZodError } from "zod";
import { DrizzleAuditLogRepository } from "../../../../../../src/db/repositories/audit-log-repository";
import { DrizzleClipEditorStatesRepository } from "../../../../../../src/db/repositories/clip-editor-states-repository";
import { DrizzleClipsRepository } from "../../../../../../src/db/repositories/clips-repository";
import { DrizzleProcessingJobsRepository } from "../../../../../../src/db/repositories/processing-jobs-repository";
import {
  EditorStateUpdateInputSchema,
  getOrCreateClipEditorState,
  updateClipEditorState,
} from "../../../../../../src/admin/services/clip-editor-state";
import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../../lib/api-route";
import { getDb } from "../../../../../../lib/db";
import { getObjectBuffer } from "../../../../../../lib/storage";
import { invalidRequest, jsonError } from "../../../../../../src/contracts/api-error";

type RouteParams = {
  params: Promise<{
    clipId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const session = await requireAdminApiSession();
    const { clipId } = await params;
    const db = getDb();
    const state = await getOrCreateClipEditorState({
      clipEditorStatesRepository: new DrizzleClipEditorStatesRepository(db),
      processingJobsRepository: new DrizzleProcessingJobsRepository(db),
      auditLogRepository: new DrizzleAuditLogRepository(db),
      getObjectBuffer,
    }, {
      clipId,
      actorId: session.email,
    });

    return Response.json({ editorState: state });
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load editor state");
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAdminApiSession();
    const { clipId } = await params;
    const db = getDb();
    const clipsRepository = new DrizzleClipsRepository(db);
    const clip = await clipsRepository.getById(clipId);
    if (!clip) {
      return jsonError("not_found", "Clip not found", 404);
    }

    if (clip.ownerId !== session.email && clip.ownerId !== "admin") {
      return jsonError("forbidden", "Only the clip uploader can edit review content", 403);
    }

    const body = await request.json().catch(() => {
      throw new ZodError([]);
    });
    const parsed = EditorStateUpdateInputSchema.safeParse(body);
    if (!parsed.success) {
      return invalidRequest("Invalid request", parsed.error.flatten());
    }

    const state = await updateClipEditorState({
      clipEditorStatesRepository: new DrizzleClipEditorStatesRepository(db),
      processingJobsRepository: new DrizzleProcessingJobsRepository(db),
      auditLogRepository: new DrizzleAuditLogRepository(db),
      getObjectBuffer,
    }, {
      clipId,
      actorId: session.email,
      editor: parsed.data,
    });

    return Response.json({ editorState: state });
  } catch (error) {
    if (error instanceof ZodError) {
      return invalidRequest("Request body must be valid JSON");
    }

    return adminRouteErrorResponse(error, "Failed to update editor state");
  }
}
