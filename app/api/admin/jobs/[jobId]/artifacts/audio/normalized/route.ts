import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../../../lib/admin-auth";
import { getNormalizedVideoPath } from "../../../../../../../../src/contracts/artifacts";
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
    getArtifactPath: getNormalizedVideoPath,
    artifactNotFoundMessage: "Normalized video artifact not found",
    objectNotFoundMessage: "Normalized video object not found in storage",
  });
  if (content instanceof NextResponse) {
    return content;
  }

  return toArtifactResponse(content, {
    contentType: "video/mp4",
    cacheControl: "private, max-age=60",
  });
}
