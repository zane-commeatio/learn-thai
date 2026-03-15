import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../../../lib/admin-auth";
import { getPosterImagePath } from "../../../../../../../../src/contracts/artifacts";
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
    getArtifactPath: getPosterImagePath,
    artifactNotFoundMessage: "Poster artifact not found",
    objectNotFoundMessage: "Poster object not found in storage",
  });
  if (content instanceof NextResponse) {
    return content;
  }

  return toArtifactResponse(content, {
    contentType: "image/jpeg",
    cacheControl: "private, max-age=60",
  });
}
