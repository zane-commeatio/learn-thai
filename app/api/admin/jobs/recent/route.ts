import { listRecentJobs } from "../../../../../src/admin/services/list-recent-jobs";
import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../lib/api-route";
import { getDb } from "../../../../../lib/db";

export async function GET() {
  try {
    await requireAdminApiSession();
    return Response.json(await listRecentJobs({ db: getDb() }));
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load recent jobs");
  }
}
