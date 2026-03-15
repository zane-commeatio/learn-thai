import type { ProcessingJobRecord } from "../../domain/repositories/processing-jobs-repository";

export type TranscriptSegment = {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
};

export type SegmentStageArtifactRefs = {
  segmentJsonPath: string;
  segmentCount: number;
  preview: TranscriptSegment[];
};

export interface SegmentShapingStageAdapter {
  run(job: ProcessingJobRecord, input: { asrJsonPath: string }): Promise<SegmentStageArtifactRefs>;
}

export class DefaultSegmentShapingStageAdapter implements SegmentShapingStageAdapter {
  async run(job: ProcessingJobRecord): Promise<SegmentStageArtifactRefs> {
    const error = new Error(`segment stage not implemented for job ${job.id}`) as Error & { code: string };
    error.code = "stage_not_implemented";
    throw error;
  }
}
