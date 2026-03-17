import { getJob } from "../../../../../src/admin/services/get-job";
import { DrizzleProcessingJobsRepository } from "../../../../../src/db/repositories/processing-jobs-repository";
import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../lib/api-route";
import { getDb } from "../../../../../lib/db";

type RouteParams = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  try {
    await requireAdminApiSession();
    const { jobId } = await params;
    const db = getDb();
    const processingJobsRepository = new DrizzleProcessingJobsRepository(db);
    const result = await getJob({ processingJobsRepository }, jobId);
    return Response.json(result);
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load job");
  }
}
