import { NextResponse } from "next/server";
import {
  getAdminServiceErrorStatus,
  isAdminServiceError,
} from "../../../../../src/admin/services/errors";
import { getJob } from "../../../../../src/admin/services/get-job";
import { DrizzleProcessingJobsRepository } from "../../../../../src/db/repositories/processing-jobs-repository";
import { getDb } from "../../../../../lib/db";

type RouteParams = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const { jobId } = await params;
  const db = getDb();
  const processingJobsRepository = new DrizzleProcessingJobsRepository(db);

  try {
    const result = await getJob({ processingJobsRepository }, jobId);
    return NextResponse.json(result);
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

    return NextResponse.json(
      {
        code: "processing_failed",
        message: error instanceof Error ? error.message : "Failed to load job",
      },
      { status: 500 },
    );
  }
}
