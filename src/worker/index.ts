import { handleRequest } from "./app";
import { requireDatabaseUrl, type WorkerEnv } from "../config/env";
import { createDb } from "../db/client";
import { DrizzleAuditLogRepository } from "../db/repositories/audit-log-repository";
import { DrizzleProcessingJobsRepository } from "../db/repositories/processing-jobs-repository";
import { consumeProcessingJobsBatch } from "./queue/processing-jobs-consumer";

type QueueMessage = {
  body: unknown;
};

type QueueBatch = {
  messages: QueueMessage[];
};

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
  async queue(batch: QueueBatch, env: WorkerEnv): Promise<void> {
    const db = createDb(requireDatabaseUrl(env));
    const processingJobsRepository = new DrizzleProcessingJobsRepository(db);
    const auditLogRepository = new DrizzleAuditLogRepository(db);

    const messages = batch.messages
      .map((message) => message.body)
      .filter((message): message is {
        jobId: string;
        clipId: string;
        expectedStage: "audio" | "asr" | "segment" | "translate" | "finalize";
      } => {
        if (!message || typeof message !== "object") {
          return false;
        }

        const candidate = message as Record<string, unknown>;
        return (
          typeof candidate.jobId === "string"
          && typeof candidate.clipId === "string"
          && typeof candidate.expectedStage === "string"
          && ["audio", "asr", "segment", "translate", "finalize"].includes(
            candidate.expectedStage,
          )
        );
      });

    await consumeProcessingJobsBatch(messages, {
      processingJobsRepository,
      auditLogRepository,
    });
  },
};
