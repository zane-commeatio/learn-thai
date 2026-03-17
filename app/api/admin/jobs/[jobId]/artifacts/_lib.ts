import { eq } from "drizzle-orm";
import { processingJobs } from "../../../../../../infra/db/schema";
import { jsonError } from "../../../../../../src/contracts/api-error";
import { getDb } from "../../../../../../lib/db";
import { getObjectBuffer } from "../../../../../../lib/storage";

type ReadStoredJobArtifactInput = {
  jobId: string;
  getArtifactPath: (value: unknown) => string | null;
  artifactNotFoundMessage: string;
  objectNotFoundMessage: string;
};

export async function readStoredJobArtifact(input: ReadStoredJobArtifactInput): Promise<Buffer | Response> {
  const db = getDb();
  const [row] = await db.select().from(processingJobs).where(eq(processingJobs.id, input.jobId)).limit(1);
  if (!row) {
    return jsonError("not_found", "Job not found", 404);
  }

  const artifactPath = input.getArtifactPath(row.artifactRefs);
  if (!artifactPath) {
    return jsonError("not_found", input.artifactNotFoundMessage, 404);
  }

  const content = await getObjectBuffer(artifactPath);
  if (!content) {
    return jsonError("not_found", input.objectNotFoundMessage, 404);
  }

  return content;
}

export function toArtifactResponse(content: Buffer, init: {
  contentType: string;
  contentDisposition?: string;
  cacheControl?: string;
}): Response {
  const headers: Record<string, string> = {
    "content-type": init.contentType,
  };

  if (init.contentDisposition) {
    headers["content-disposition"] = init.contentDisposition;
  }

  if (init.cacheControl) {
    headers["cache-control"] = init.cacheControl;
  }

  return new Response(new Uint8Array(content), {
    status: 200,
    headers,
  });
}
