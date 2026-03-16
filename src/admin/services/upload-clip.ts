import type { enqueueProcessingJob } from "../../../lib/queue";
import type { putObject } from "../../../lib/storage";
import type { ClipsRepository } from "../../domain/repositories/clips-repository";
import type { ProcessingJobsRepository } from "../../domain/repositories/processing-jobs-repository";
import { AdminServiceError } from "./errors";

const SOURCE_OBJECT_NAME = "source";
const MIN_TITLE_LENGTH = 2;

export type UploadClipInput = {
  ownerId: string;
  title: string;
  fileName: string;
  fileType: string;
  fileBytes: Buffer;
};

export type UploadClipResult = {
  clipId: string;
  jobId: string;
  message: string;
};

export type UploadClipDependencies = {
  clipsRepository: ClipsRepository;
  processingJobsRepository: ProcessingJobsRepository;
  putObject: typeof putObject;
  enqueueProcessingJob: typeof enqueueProcessingJob;
  createId?: () => string;
};

export async function uploadClip(
  dependencies: UploadClipDependencies,
  input: UploadClipInput,
): Promise<UploadClipResult> {
  const title = input.title.trim();
  if (title.length < MIN_TITLE_LENGTH) {
    throw new AdminServiceError(
      "invalid_request",
      "Title must be at least 2 characters",
    );
  }

  if (input.fileBytes.length === 0) {
    throw new AdminServiceError("invalid_request", "A media file is required");
  }

  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const clipId = createId();
  const jobId = createId();
  const sourceKey = `clips/${clipId}/${SOURCE_OBJECT_NAME}`;

  try {
    await dependencies.putObject({
      key: sourceKey,
      body: input.fileBytes,
      contentType: input.fileType || "application/octet-stream",
    });

    await dependencies.clipsRepository.create({
      id: clipId,
      title,
      ownerId: input.ownerId,
      sourceType: "original",
      rightsStatus: "cleared",
    });

    await dependencies.processingJobsRepository.create({
      id: jobId,
      clipId,
      state: "processing",
      stage: "audio",
      errorPayload: null,
    });

    await dependencies.enqueueProcessingJob({
      jobId,
      clipId,
      expectedStage: "audio",
    });
  } catch (error) {
    throw new AdminServiceError(
      "processing_failed",
      error instanceof Error ? error.message : "Failed to upload clip",
    );
  }

  return {
    clipId,
    jobId,
    message: "Upload accepted and queued for processing",
  };
}
