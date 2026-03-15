import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { processingJobs } from "../../../../../../infra/db/schema";
import { getDb } from "../../../../../../lib/db";
import { getObjectBuffer } from "../../../../../../lib/storage";

type ReadStoredJobArtifactInput = {
  jobId: string;
  getArtifactPath: (value: unknown) => string | null;
  artifactNotFoundMessage: string;
  objectNotFoundMessage: string;
};

export async function readStoredJobArtifact(input: ReadStoredJobArtifactInput): Promise<Buffer | NextResponse> {
  const db = getDb();
  const [row] = await db.select().from(processingJobs).where(eq(processingJobs.id, input.jobId)).limit(1);
  if (!row) {
    return NextResponse.json({ code: "not_found", message: "Job not found" }, { status: 404 });
  }

  const artifactPath = input.getArtifactPath(row.artifactRefs);
  if (!artifactPath) {
    return NextResponse.json({ code: "not_found", message: input.artifactNotFoundMessage }, { status: 404 });
  }

  const content = await getObjectBuffer(artifactPath);
  if (!content) {
    return NextResponse.json({ code: "not_found", message: input.objectNotFoundMessage }, { status: 404 });
  }

  return content;
}

export function toArtifactResponse(content: Buffer, init: {
  contentType: string;
  contentDisposition?: string;
  cacheControl?: string;
}): NextResponse {
  const headers: Record<string, string> = {
    "content-type": init.contentType,
  };

  if (init.contentDisposition) {
    headers["content-disposition"] = init.contentDisposition;
  }

  if (init.cacheControl) {
    headers["cache-control"] = init.cacheControl;
  }

  return new NextResponse(new Uint8Array(content), {
    status: 200,
    headers,
  });
}
