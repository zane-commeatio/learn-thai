import { Queue } from "bullmq";
import type { ProcessingJobQueueMessage } from "../src/domain/queues/processing-jobs-queue";
import { getRedisConnectionOptions } from "./redis";

const QUEUE_NAME = process.env.PROCESSING_QUEUE_NAME?.trim() || "processing-jobs";

let cachedQueue: Queue<ProcessingJobQueueMessage> | undefined;

export function getProcessingQueue(): Queue<ProcessingJobQueueMessage> {
  if (cachedQueue) {
    return cachedQueue;
  }

  cachedQueue = new Queue<ProcessingJobQueueMessage>(QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      removeOnComplete: 500,
      removeOnFail: 1000,
      attempts: 1,
    },
  });

  return cachedQueue;
}

export async function enqueueProcessingJob(message: ProcessingJobQueueMessage): Promise<void> {
  await getProcessingQueue().add("process-job", message, {
    jobId: message.jobId,
  });
}

export function getProcessingQueueName(): string {
  return QUEUE_NAME;
}
