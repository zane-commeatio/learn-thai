import type { ProcessingJobRecord } from "../../domain/repositories/processing-jobs-repository";

export type AudioStageArtifactRefs = {
  normalizedVideoPath: string;
  posterImagePath: string;
  audioWavPath: string;
};

export interface AudioNormalizationStageAdapter {
  run(job: ProcessingJobRecord): Promise<AudioStageArtifactRefs>;
}

export class DefaultAudioNormalizationStageAdapter
  implements AudioNormalizationStageAdapter {
  async run(job: ProcessingJobRecord): Promise<AudioStageArtifactRefs> {
    const error = new Error(`audio stage not implemented for job ${job.id}`) as Error & { code: string };
    error.code = "stage_not_implemented";
    throw error;
  }
}
