import { listRunningJobs } from "../../../../../src/admin/services/list-running-jobs";
import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../lib/api-route";
import { getDb } from "../../../../../lib/db";

export async function GET() {
  try {
    await requireAdminApiSession();
    return Response.json(await listRunningJobs({ db: getDb() }));
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load running jobs");
  }
}
