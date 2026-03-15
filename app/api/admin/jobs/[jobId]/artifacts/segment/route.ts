import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../../lib/admin-auth";
import { getSegmentJsonPath } from "../../../../../../../src/contracts/artifacts";
import { readStoredJobArtifact, toArtifactResponse } from "../_lib";

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
    getArtifactPath: getSegmentJsonPath,
    artifactNotFoundMessage: "Segment artifact not found",
    objectNotFoundMessage: "Segment object not found in storage",
  });
  if (content instanceof NextResponse) {
    return content;
  }

  return toArtifactResponse(content, {
    contentType: "application/json",
    contentDisposition: `attachment; filename="${jobId}-segments.json"`,
  });
}
