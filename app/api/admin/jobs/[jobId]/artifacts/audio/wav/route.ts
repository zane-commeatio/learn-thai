import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../../../lib/admin-auth";
import { getAudioWavPath } from "../../../../../../../../src/contracts/artifacts";
import { readStoredJobArtifact, toArtifactResponse } from "../../_lib";

type RouteParams = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  await requireAdminSession();
  const { jobId } = await params;
  const content = await readStoredJobArtifact({
    jobId,
    getArtifactPath: getAudioWavPath,
    artifactNotFoundMessage: "WAV artifact not found",
    objectNotFoundMessage: "WAV object not found in storage",
  });
  if (content instanceof NextResponse) {
    return content;
  }

  return toArtifactResponse(content, {
    contentType: "audio/wav",
    cacheControl: "private, max-age=60",
  });
}
