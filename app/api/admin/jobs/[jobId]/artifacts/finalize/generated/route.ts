import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../../../../lib/api-route";
import { getGeneratedPayloadPath } from "../../../../../../../../src/contracts/artifacts";
import { readStoredJobArtifact, toArtifactResponse } from "../../_lib";

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
      getArtifactPath: getGeneratedPayloadPath,
      artifactNotFoundMessage: "Generated payload artifact not found",
      objectNotFoundMessage: "Generated payload object not found in storage",
    });
    if (content instanceof Response) {
      return content;
    }

    return toArtifactResponse(content, {
      contentType: "application/json",
      contentDisposition: `attachment; filename="${jobId}-generated-payload.json"`,
    });
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load generated payload artifact");
  }
}
