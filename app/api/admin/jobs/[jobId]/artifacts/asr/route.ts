import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../../../lib/api-route";
import { getAsrJsonPath } from "../../../../../../../src/contracts/artifacts";
import { readStoredJobArtifact, toArtifactResponse } from "../_lib";

type RouteParams = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  try {
    await requireAdminApiSession();
    const { jobId } = await params;
    const content = await readStoredJobArtifact({
      jobId,
      getArtifactPath: getAsrJsonPath,
      artifactNotFoundMessage: "ASR artifact not found",
      objectNotFoundMessage: "ASR object not found in storage",
    });
    if (content instanceof Response) {
      return content;
    }

    return toArtifactResponse(content, {
      contentType: "application/json",
      contentDisposition: `attachment; filename="${jobId}-asr.json"`,
    });
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load ASR artifact");
  }
}
