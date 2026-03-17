import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../../../../lib/api-route";
import { getEditedPayloadPath } from "../../../../../../../../src/contracts/artifacts";
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
      getArtifactPath: getEditedPayloadPath,
      artifactNotFoundMessage: "Edited payload artifact not found",
      objectNotFoundMessage: "Edited payload object not found in storage",
    });
    if (content instanceof Response) {
      return content;
    }

    return toArtifactResponse(content, {
      contentType: "application/json",
      contentDisposition: `attachment; filename="${jobId}-edited-payload.json"`,
    });
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load edited payload artifact");
  }
}
