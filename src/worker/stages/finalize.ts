import type { ProcessingJobRecord } from "../../domain/repositories/processing-jobs-repository";

export type FinalizeStageArtifactRefs = {
  generatedPayloadPath: string;
  editedPayloadPath: string;
  segmentCount: number;
  translationCount: number;
  thumbnailPath: string | null;
};

export interface FinalizeStageAdapter {
  run(
    job: ProcessingJobRecord,
    input: {
      segmentJsonPath: string;
      translationJsonPath: string;
      normalizedVideoPath: string | null;
      audioWavPath: string | null;
      posterImagePath: string | null;
    },
  ): Promise<FinalizeStageArtifactRefs>;
}

export class DefaultFinalizeStageAdapter implements FinalizeStageAdapter {
  async run(job: ProcessingJobRecord): Promise<FinalizeStageArtifactRefs> {
    const error = new Error(`finalize stage not implemented for job ${job.id}`) as Error & { code: string };
    error.code = "stage_not_implemented";
    throw error;
  }
}
