import type { enqueueProcessingJob } from "../../../lib/queue";
import type { deleteObject, putObject } from "../../../lib/storage";
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
  deleteObject: typeof deleteObject;
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
  let storedSourceObject = false;
  let createdClip = false;
  let createdProcessingJob = false;

  try {
    await dependencies.putObject({
      key: sourceKey,
      body: input.fileBytes,
      contentType: input.fileType || "application/octet-stream",
    });
    storedSourceObject = true;

    await dependencies.clipsRepository.create({
      id: clipId,
      title,
      ownerId: input.ownerId,
      sourceType: "original",
      rightsStatus: "cleared",
    });
    createdClip = true;

    await dependencies.processingJobsRepository.create({
      id: jobId,
      clipId,
      state: "processing",
      stage: "audio",
      errorPayload: null,
    });
    createdProcessingJob = true;

    await dependencies.enqueueProcessingJob({
      jobId,
      clipId,
      expectedStage: "audio",
    });
  } catch (error) {
    await rollbackUploadClip(dependencies, {
      clipId,
      jobId,
      sourceKey,
      storedSourceObject,
      createdClip,
      createdProcessingJob,
    });

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

async function rollbackUploadClip(
  dependencies: UploadClipDependencies,
  input: {
    clipId: string;
    jobId: string;
    sourceKey: string;
    storedSourceObject: boolean;
    createdClip: boolean;
    createdProcessingJob: boolean;
  },
): Promise<void> {
  const cleanupOperations: Array<Promise<void>> = [];

  if (input.createdProcessingJob) {
    cleanupOperations.push(dependencies.processingJobsRepository.deleteById(input.jobId));
  }

  if (input.createdClip) {
    cleanupOperations.push(dependencies.clipsRepository.deleteById(input.clipId));
  }

  if (input.storedSourceObject) {
    cleanupOperations.push(dependencies.deleteObject(input.sourceKey));
  }

  const cleanupResults = await Promise.allSettled(cleanupOperations);
  const cleanupFailure = cleanupResults.find((result) => result.status === "rejected");
  if (cleanupFailure) {
    throw cleanupFailure.reason;
  }
}
