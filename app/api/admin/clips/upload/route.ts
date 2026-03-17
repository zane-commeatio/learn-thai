import { DrizzleClipsRepository } from "../../../../../src/db/repositories/clips-repository";
import { DrizzleProcessingJobsRepository } from "../../../../../src/db/repositories/processing-jobs-repository";
import { uploadClip } from "../../../../../src/admin/services/upload-clip";
import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../lib/api-route";
import { getDb } from "../../../../../lib/db";
import { enqueueProcessingJob } from "../../../../../lib/queue";
import { deleteObject, putObject } from "../../../../../lib/storage";
import { invalidRequest } from "../../../../../src/contracts/api-error";

export async function POST(request: Request) {
  try {
    const session = await requireAdminApiSession();
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("UPLOAD_MISSING_FILE");
    }

    const db = getDb();
    const clipsRepository = new DrizzleClipsRepository(db);
    const processingJobsRepository = new DrizzleProcessingJobsRepository(db);

    const result = await uploadClip(
      {
        clipsRepository,
        processingJobsRepository,
        putObject,
        deleteObject,
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

    return Response.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "UPLOAD_MISSING_FILE") {
      return invalidRequest("A media file is required");
    }

    return adminRouteErrorResponse(error, "Failed to upload clip");
  }
}
