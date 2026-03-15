import {
  loadConfig,
  requireDatabaseUrl,
  requireProcessingJobsQueue,
  type WorkerEnv,
} from "../config/env";
import { createDb } from "../db/client";
import { DrizzleClipsRepository } from "../db/repositories/clips-repository";
import { DrizzleProcessingJobsRepository } from "../db/repositories/processing-jobs-repository";
import type { ClipsRepository } from "../domain/repositories/clips-repository";
import type { ProcessingJobsRepository } from "../domain/repositories/processing-jobs-repository";
import type { ProcessingJobsQueue } from "../domain/queues/processing-jobs-queue";
import { jsonError } from "../contracts/api-error";
import { handleCreatorCreateClip } from "./routes/creator-create-clip";
import { handleCreatorUploadComplete } from "./routes/creator-upload-complete";
import { handleMobileHealth } from "./routes/mobile-health";
import { CloudflareProcessingJobsQueue } from "./queues/processing-jobs";

function notFound(): Response {
  return jsonError("not_found", "Not Found", 404);
}

type AppDependencies = {
  createClipsRepository?: (env: WorkerEnv) => ClipsRepository;
  createProcessingJobsRepository?: (env: WorkerEnv) => ProcessingJobsRepository;
  createProcessingJobsQueue?: (env: WorkerEnv) => ProcessingJobsQueue;
};

function createClipsRepository(env: WorkerEnv): ClipsRepository {
  const db = createDb(requireDatabaseUrl(env));
  return new DrizzleClipsRepository(db);
}

function createProcessingJobsRepository(env: WorkerEnv): ProcessingJobsRepository {
  const db = createDb(requireDatabaseUrl(env));
  return new DrizzleProcessingJobsRepository(db);
}

function createProcessingJobsQueue(env: WorkerEnv): ProcessingJobsQueue {
  const queue = requireProcessingJobsQueue(env);
  return new CloudflareProcessingJobsQueue(queue);
}

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  dependencies: AppDependencies = {},
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/mobile/health") {
    return handleMobileHealth(loadConfig(env));
  }

  if (request.method === "POST" && url.pathname === "/api/creator/clips") {
    const clipsRepository = dependencies.createClipsRepository?.(env) ?? createClipsRepository(env);
    return handleCreatorCreateClip(request, { clipsRepository });
  }

  const uploadCompleteMatch = /^\/api\/creator\/clips\/([^/]+)\/upload-complete$/.exec(url.pathname);
  if (request.method === "POST" && uploadCompleteMatch) {
    const clipsRepository = dependencies.createClipsRepository?.(env) ?? createClipsRepository(env);
    const processingJobsRepository = dependencies.createProcessingJobsRepository?.(env)
      ?? createProcessingJobsRepository(env);
    const processingJobsQueue = dependencies.createProcessingJobsQueue?.(env)
      ?? createProcessingJobsQueue(env);

    return handleCreatorUploadComplete(uploadCompleteMatch[1], {
      clipsRepository,
      processingJobsRepository,
      processingJobsQueue,
    });
  }

  return notFound();
}
