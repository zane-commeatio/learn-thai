import type { ProcessingJobsQueue, ProcessingJobQueueMessage } from "../../domain/queues/processing-jobs-queue";

type QueueBinding = {
  send(message: ProcessingJobQueueMessage): Promise<void>;
};

export class CloudflareProcessingJobsQueue implements ProcessingJobsQueue {
  constructor(private readonly queue: QueueBinding) {}

  async enqueue(message: ProcessingJobQueueMessage): Promise<void> {
    await this.queue.send(message);
  }
}
