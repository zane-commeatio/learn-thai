import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../../../lib/admin-auth";
import { getEditedPayloadPath } from "../../../../../../../../src/contracts/artifacts";
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
    getArtifactPath: getEditedPayloadPath,
    artifactNotFoundMessage: "Edited payload artifact not found",
    objectNotFoundMessage: "Edited payload object not found in storage",
  });
  if (content instanceof NextResponse) {
    return content;
  }

  return toArtifactResponse(content, {
    contentType: "application/json",
    contentDisposition: `attachment; filename="${jobId}-edited-payload.json"`,
  });
}
