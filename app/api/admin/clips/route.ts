import { listClips } from "../../../../src/admin/services/list-clips";
import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../lib/api-route";
import { getDb } from "../../../../lib/db";

export async function GET() {
  try {
    await requireAdminApiSession();
    return Response.json(await listClips({ db: getDb() }));
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load clips");
  }
}
