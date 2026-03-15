import type { ProcessingJobQueueMessage } from "../domain/queues/processing-jobs-queue";

type ProcessingJobsQueueBinding = {
  send(message: ProcessingJobQueueMessage): Promise<void>;
};

export type WorkerEnv = {
  API_VERSION?: string;
  DATABASE_URL?: string;
  PROCESSING_JOBS_QUEUE?: ProcessingJobsQueueBinding;
};

export type RuntimeConfig = {
  apiVersion: string;
};

const DEFAULT_API_VERSION = "v1";

function readOptionalEnv(env: WorkerEnv): RuntimeConfig {
  const apiVersion = env.API_VERSION?.trim() || DEFAULT_API_VERSION;
  return { apiVersion };
}

export function loadConfig(env: WorkerEnv): RuntimeConfig {
  return readOptionalEnv(env);
}

export function readDatabaseUrl(env: WorkerEnv): string | null {
  const databaseUrl = env.DATABASE_URL?.trim();
  return databaseUrl ? databaseUrl : null;
}

export function requireDatabaseUrl(env: WorkerEnv): string {
  const databaseUrl = readDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return databaseUrl;
}

export function requireProcessingJobsQueue(env: WorkerEnv): ProcessingJobsQueueBinding {
  if (!env.PROCESSING_JOBS_QUEUE) {
    throw new Error("PROCESSING_JOBS_QUEUE is required");
  }

  return env.PROCESSING_JOBS_QUEUE;
}
