import type { ProcessingJobRecord } from "../../domain/repositories/processing-jobs-repository";

export type AsrStageArtifactRefs = {
  asrJsonPath: string;
  transcriptPreview: string;
  segmentCount: number;
  wordCount: number;
  language: string | null;
};

export interface AsrTranscriptionStageAdapter {
  run(job: ProcessingJobRecord, input: { audioWavPath: string }): Promise<AsrStageArtifactRefs>;
}

export class DefaultAsrTranscriptionStageAdapter
  implements AsrTranscriptionStageAdapter {
  async run(job: ProcessingJobRecord): Promise<AsrStageArtifactRefs> {
    const error = new Error(`asr stage not implemented for job ${job.id}`) as Error & { code: string };
    error.code = "stage_not_implemented";
    throw error;
  }
}
