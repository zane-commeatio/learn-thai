import {
  adminRouteErrorResponse,
  requireAdminApiSession,
} from "../../../../../../../../lib/api-route";
import { getAudioWavPath } from "../../../../../../../../src/contracts/artifacts";
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
      getArtifactPath: getAudioWavPath,
      artifactNotFoundMessage: "WAV artifact not found",
      objectNotFoundMessage: "WAV object not found in storage",
    });
    if (content instanceof Response) {
      return content;
    }

    return toArtifactResponse(content, {
      contentType: "audio/wav",
      cacheControl: "private, max-age=60",
    });
  } catch (error) {
    return adminRouteErrorResponse(error, "Failed to load WAV artifact");
  }
}
