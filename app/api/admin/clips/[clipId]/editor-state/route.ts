import { NextResponse } from "next/server";
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

export async function GET(_: Request, { params }: RouteParams) {
  const session = await requireAdminSession();
  const { clipId } = await params;
  const db = getDb();

  try {
    const state = await getOrCreateClipEditorState({
      clipEditorStatesRepository: new DrizzleClipEditorStatesRepository(db),
      processingJobsRepository: new DrizzleProcessingJobsRepository(db),
      auditLogRepository: new DrizzleAuditLogRepository(db),
      getObjectBuffer,
    }, {
      clipId,
      actorId: session.email,
    });

    return NextResponse.json({ editorState: state });
  } catch (error) {
    if (isAdminServiceError(error)) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: getAdminServiceErrorStatus(error) });
    }

    return NextResponse.json({ code: "processing_failed", message: error instanceof Error ? error.message : "Failed to load editor state" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireAdminSession();
  const { clipId } = await params;
  const db = getDb();
  const clipsRepository = new DrizzleClipsRepository(db);

  try {
    const clip = await clipsRepository.getById(clipId);
    if (!clip) {
      return NextResponse.json({ code: "not_found", message: "Clip not found" }, { status: 404 });
    }

    if (clip.ownerId !== session.email && clip.ownerId !== "admin") {
      return NextResponse.json({ code: "forbidden", message: "Only the clip uploader can edit review content" }, { status: 403 });
    }

    const body = await request.json();
    const editor = EditorStateUpdateInputSchema.parse(body);
    const state = await updateClipEditorState({
      clipEditorStatesRepository: new DrizzleClipEditorStatesRepository(db),
      processingJobsRepository: new DrizzleProcessingJobsRepository(db),
      auditLogRepository: new DrizzleAuditLogRepository(db),
      getObjectBuffer,
    }, {
      clipId,
      actorId: session.email,
      editor,
    });

    return NextResponse.json({ editorState: state });
  } catch (error) {
    if (isAdminServiceError(error)) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: getAdminServiceErrorStatus(error) });
    }

    return NextResponse.json({ code: "processing_failed", message: error instanceof Error ? error.message : "Failed to update editor state" }, { status: 500 });
  }
}
