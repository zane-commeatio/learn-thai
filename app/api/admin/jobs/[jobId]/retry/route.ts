import { NextResponse } from "next/server";
import {
  getAdminServiceErrorStatus,
  isAdminServiceError,
} from "../../../../../../src/admin/services/errors";
import { retryJob } from "../../../../../../src/admin/services/retry-job";
import { DrizzleAuditLogRepository } from "../../../../../../src/db/repositories/audit-log-repository";
import { DrizzleProcessingJobsRepository } from "../../../../../../src/db/repositories/processing-jobs-repository";
import { requireAdminSession } from "../../../../../../lib/admin-auth";
import { getDb } from "../../../../../../lib/db";
import { enqueueProcessingJob } from "../../../../../../lib/queue";

type RouteParams = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(_: Request, { params }: RouteParams) {
  const session = await requireAdminSession();
  const { jobId } = await params;
  const db = getDb();
  const processingJobsRepository = new DrizzleProcessingJobsRepository(db);
  const auditLogRepository = new DrizzleAuditLogRepository(db);

  try {
    const result = await retryJob(
      {
        processingJobsRepository,
        auditLogRepository,
        enqueueProcessingJob,
      },
      {
        jobId,
        actorId: session.email,
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

    return NextResponse.json(
      {
        code: "processing_failed",
        message: error instanceof Error ? error.message : "Failed to retry job",
      },
      { status: 500 },
    );
  }
}
