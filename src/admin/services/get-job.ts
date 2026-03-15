import type { ProcessingJobRecord, ProcessingJobsRepository } from "../../domain/repositories/processing-jobs-repository";
import { AdminServiceError } from "./errors";

export type GetJobDependencies = {
  processingJobsRepository: ProcessingJobsRepository;
};

export type GetJobResult = {
  job: ProcessingJobRecord;
};

export async function getJob(
  dependencies: GetJobDependencies,
  jobId: string,
): Promise<GetJobResult> {
  const job = await dependencies.processingJobsRepository.getById(jobId);

  if (!job) {
    throw new AdminServiceError("not_found", "Job not found");
  }

  return { job };
}
