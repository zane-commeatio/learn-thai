import { z } from "zod";
import type { ProcessingJobQueueMessage } from "../../domain/queues/processing-jobs-queue";
import {
  processProcessingJobMessage,
  type ProcessProcessingJobDependencies,
} from "../runner/processing-job-runner";

const QueueMessageSchema = z.object({
  jobId: z.string().uuid(),
  clipId: z.string().uuid(),
  expectedStage: z.enum(["audio", "asr", "segment", "translate", "finalize"]),
});

export async function consumeProcessingJobsBatch(
  messages: ProcessingJobQueueMessage[],
  dependencies: ProcessProcessingJobDependencies,
): Promise<void> {
  await Promise.all(messages.map(async (message) => {
    const parsed = QueueMessageSchema.safeParse(message);
    if (!parsed.success) {
      return;
    }

    await processProcessingJobMessage(parsed.data, dependencies);
  }));
}
