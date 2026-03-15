import { UploadCompleteParamsSchema } from "../../contracts/creator";
import { invalidRequest, jsonError } from "../../contracts/api-error";
import { InvalidRequestError, parseSchema } from "../../contracts/validation";
import type { ClipsRepository } from "../../domain/repositories/clips-repository";
import type { ProcessingJobsRepository } from "../../domain/repositories/processing-jobs-repository";
import type { ProcessingJobsQueue } from "../../domain/queues/processing-jobs-queue";

export type UploadCompleteRouteDependencies = {
  clipsRepository: ClipsRepository;
  processingJobsRepository: ProcessingJobsRepository;
  processingJobsQueue: ProcessingJobsQueue;
};

function toInvalidRequest(error: unknown): Response | null {
  if (error instanceof InvalidRequestError) {
    return invalidRequest(error.message, error.details);
  }

  return null;
}

export async function handleCreatorUploadComplete(
  clipIdParam: string,
  dependencies: UploadCompleteRouteDependencies,
): Promise<Response> {
  let params;
  try {
    params = parseSchema(UploadCompleteParamsSchema, { clipId: clipIdParam }, "Invalid path params");
  } catch (error) {
    const response = toInvalidRequest(error);
    if (response) {
      return response;
    }
    throw error;
  }

  const clip = await dependencies.clipsRepository.getById(params.clipId);
  if (!clip) {
    return jsonError("not_found", "Clip not found", 404);
  }

  const latestJob = await dependencies.processingJobsRepository.getLatestByClipId(params.clipId);
  if (latestJob) {
    return jsonError("conflict", "Upload has already been marked complete for this clip", 409);
  }

  const jobId = crypto.randomUUID();
  await dependencies.processingJobsRepository.create({
    id: jobId,
    clipId: params.clipId,
    state: "processing",
    stage: "audio",
    errorPayload: null,
  });

  await dependencies.processingJobsQueue.enqueue({
    jobId,
    clipId: params.clipId,
    expectedStage: "audio",
  });

  return Response.json(
    { jobId },
    {
      status: 202,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}
