import type { ProcessingJobRecord } from "../../domain/repositories/processing-jobs-repository";

export type SegmentTranslation = {
  segmentIndex: number;
  sourceText: string;
  englishText: string;
};

export type TranslationStageArtifactRefs = {
  translationJsonPath: string;
  translationCount: number;
  preview: SegmentTranslation[];
};

export interface TranslationStageAdapter {
  run(job: ProcessingJobRecord, input: { segmentJsonPath: string }): Promise<TranslationStageArtifactRefs>;
}

export class DefaultTranslationStageAdapter implements TranslationStageAdapter {
  async run(job: ProcessingJobRecord): Promise<TranslationStageArtifactRefs> {
    const error = new Error(`translate stage not implemented for job ${job.id}`) as Error & { code: string };
    error.code = "stage_not_implemented";
    throw error;
  }
}
