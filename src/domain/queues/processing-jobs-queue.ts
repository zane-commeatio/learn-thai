import type { PipelineStage } from "../../contracts/pipeline";

export type ProcessingJobQueueMessage = {
  jobId: string;
  clipId: string;
  expectedStage: PipelineStage;
};

export interface ProcessingJobsQueue {
  enqueue(message: ProcessingJobQueueMessage): Promise<void>;
}
