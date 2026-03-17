import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../../../../lib/api-route";
import { getPosterImagePath } from "../../../../../../../../src/contracts/artifacts";
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
      getArtifactPath: getPosterImagePath,
      artifactNotFoundMessage: "Poster artifact not found",
      objectNotFoundMessage: "Poster object not found in storage",
    });
    if (content instanceof Response) {
      return content;
    }

    return toArtifactResponse(content, {
      contentType: "image/jpeg",
      cacheControl: "private, max-age=60",
    });
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load poster artifact");
  }
}
