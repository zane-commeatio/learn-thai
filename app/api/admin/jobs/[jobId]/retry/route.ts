import { retryJob } from "../../../../../../src/admin/services/retry-job";
import { DrizzleAuditLogRepository } from "../../../../../../src/db/repositories/audit-log-repository";
import { DrizzleProcessingJobsRepository } from "../../../../../../src/db/repositories/processing-jobs-repository";
import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../../lib/api-route";
import { getDb } from "../../../../../../lib/db";
import { enqueueProcessingJob } from "../../../../../../lib/queue";

type RouteParams = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(_: Request, { params }: RouteParams) {
  try {
    const session = await requireAdminApiSession();
    const { jobId } = await params;
    const db = getDb();
    const processingJobsRepository = new DrizzleProcessingJobsRepository(db);
    const auditLogRepository = new DrizzleAuditLogRepository(db);
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

    return Response.json(result, { status: 202 });
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to retry job");
  }
}
