import { NextResponse } from "next/server";
import { DrizzleClipsRepository } from "../../../../../src/db/repositories/clips-repository";
import { DrizzleProcessingJobsRepository } from "../../../../../src/db/repositories/processing-jobs-repository";
import {
  getAdminServiceErrorStatus,
  isAdminServiceError,
} from "../../../../../src/admin/services/errors";
import { uploadClip } from "../../../../../src/admin/services/upload-clip";
import { requireAdminSession } from "../../../../../lib/admin-auth";
import { getDb } from "../../../../../lib/db";
import { enqueueProcessingJob } from "../../../../../lib/queue";
import { putObject } from "../../../../../lib/storage";

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const file = formData.get("file");

    if (title.length < 2) {
      return NextResponse.json({ code: "invalid_request", message: "Title must be at least 2 characters" }, { status: 400 });
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ code: "invalid_request", message: "A media file is required" }, { status: 400 });
    }

    const db = getDb();
    const clipsRepository = new DrizzleClipsRepository(db);
    const processingJobsRepository = new DrizzleProcessingJobsRepository(db);

    const result = await uploadClip(
      {
        clipsRepository,
        processingJobsRepository,
        putObject,
        enqueueProcessingJob,
      },
      {
        ownerId: session.email,
        title,
        fileName: file.name,
        fileType: file.type,
        fileBytes: Buffer.from(await file.arrayBuffer()),
      },
    );

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (isAdminServiceError(error)) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          ...(error.details ?? {}),
        },
        { status: getAdminServiceErrorStatus(error) },
      );
    }

    return NextResponse.json({
      code: "processing_failed",
      message: error instanceof Error ? error.message : "Failed to upload clip",
    }, { status: 500 });
  }
}
