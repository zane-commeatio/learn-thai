import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../../../lib/admin-auth";
import { getGeneratedPayloadPath } from "../../../../../../../../src/contracts/artifacts";
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
    getArtifactPath: getGeneratedPayloadPath,
    artifactNotFoundMessage: "Generated payload artifact not found",
    objectNotFoundMessage: "Generated payload object not found in storage",
  });
  if (content instanceof NextResponse) {
    return content;
  }

  return toArtifactResponse(content, {
    contentType: "application/json",
    contentDisposition: `attachment; filename="${jobId}-generated-payload.json"`,
  });
}
