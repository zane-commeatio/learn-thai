import { Job, Worker } from "bullmq";
import { config as loadEnv } from "dotenv";
import { createDb } from "../db/client";
import { DrizzleAuditLogRepository } from "../db/repositories/audit-log-repository";
import { DrizzleProcessingJobsRepository } from "../db/repositories/processing-jobs-repository";
import type { ProcessingJobQueueMessage } from "../domain/queues/processing-jobs-queue";
import { processProcessingJobMessage } from "../worker/runner/processing-job-runner";
import { getRedisConnectionOptions } from "../../lib/redis";
import { getProcessingQueueName } from "../../lib/queue";
import { NodeAudioNormalizationStageAdapter } from "./audio-stage-adapter";
import { NodeAsrTranscriptionStageAdapter } from "./asr-stage-adapter";
import { NodeSegmentShapingStageAdapter } from "./segment-stage-adapter";
import { NodeTranslationStageAdapter, OpenRouterTranslationBackend } from "./translation-stage-adapter";
import { NodeFinalizeStageAdapter } from "./finalize-stage-adapter";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const databaseUrl = required("DATABASE_URL");
const concurrency = Number(process.env.PROCESSING_WORKER_CONCURRENCY ?? "2");

const db = createDb(databaseUrl);
const processingJobsRepository = new DrizzleProcessingJobsRepository(db);
const auditLogRepository = new DrizzleAuditLogRepository(db);
const audioStageAdapter = new NodeAudioNormalizationStageAdapter();
const asrStageAdapter = new NodeAsrTranscriptionStageAdapter();
const segmentStageAdapter = new NodeSegmentShapingStageAdapter();
const translationStageAdapter = new NodeTranslationStageAdapter(new OpenRouterTranslationBackend());
const finalizeStageAdapter = new NodeFinalizeStageAdapter();

const queueWorker = new Worker<ProcessingJobQueueMessage>(
  getProcessingQueueName(),
  async (job: Job<ProcessingJobQueueMessage>) => {
    let expectedStage = job.data.expectedStage;

    for (let i = 0; i < 8; i += 1) {
      await processProcessingJobMessage({
        ...job.data,
        expectedStage,
      }, {
        processingJobsRepository,
        auditLogRepository,
        audioStageAdapter,
        asrStageAdapter,
        segmentStageAdapter,
        translationStageAdapter,
        finalizeStageAdapter,
      });

      const updated = await processingJobsRepository.getById(job.data.jobId);
      if (!updated || updated.state !== "processing" || updated.stage === expectedStage) {
        break;
      }

      expectedStage = updated.stage;
    }
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency,
  },
);

queueWorker.on("completed", (job: Job<ProcessingJobQueueMessage>) => {
  console.log(JSON.stringify({ event: "job_completed", jobId: job.id }));
});

queueWorker.on("failed", (job: Job<ProcessingJobQueueMessage> | undefined, error: Error) => {
  console.error(JSON.stringify({
    event: "job_failed",
    jobId: job?.id ?? null,
    message: error.message,
  }));
});

console.log(JSON.stringify({
  event: "worker_started",
  queue: getProcessingQueueName(),
  concurrency,
}));

async function shutdown() {
  await queueWorker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
