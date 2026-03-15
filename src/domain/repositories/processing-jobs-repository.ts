import type { PipelineStage, ProcessingState } from "../../contracts/pipeline";

export type ProcessingJobRecord = {
  id: string;
  clipId: string;
  state: ProcessingState;
  stage: PipelineStage;
  errorPayload: unknown | null;
  artifactRefs: unknown | null;
  lockToken: string | null;
  lockExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProcessingJobInput = {
  id: string;
  clipId: string;
  state: ProcessingState;
  stage: PipelineStage;
  errorPayload?: unknown | null;
};

export type UpdateProcessingJobInput = {
  id: string;
  state: ProcessingState;
  stage: PipelineStage;
  errorPayload?: unknown | null;
};

export type ClaimProcessingJobInput = {
  id: string;
  expectedStage: PipelineStage;
  lockToken: string;
  now: Date;
  leaseMs: number;
};

export type ReleaseProcessingJobClaimInput = {
  id: string;
  lockToken: string;
};

export type AdvanceToNextStageInput = {
  id: string;
  lockToken: string;
  currentStage: PipelineStage;
};

export type MarkProcessingJobFailedInput = {
  id: string;
  lockToken: string;
  errorPayload: unknown;
};

export type SaveProcessingJobArtifactsInput = {
  id: string;
  lockToken: string;
  artifactRefs: unknown;
};

export interface ProcessingJobsRepository {
  create(input: CreateProcessingJobInput): Promise<ProcessingJobRecord>;
  getById(id: string): Promise<ProcessingJobRecord | null>;
  getLatestByClipId(clipId: string): Promise<ProcessingJobRecord | null>;
  getActiveByClipId(clipId: string): Promise<ProcessingJobRecord | null>;
  updateStatusStageError(
    input: UpdateProcessingJobInput,
  ): Promise<ProcessingJobRecord | null>;
  claimForProcessing(input: ClaimProcessingJobInput): Promise<ProcessingJobRecord | null>;
  releaseClaim(input: ReleaseProcessingJobClaimInput): Promise<void>;
  saveArtifacts(input: SaveProcessingJobArtifactsInput): Promise<ProcessingJobRecord | null>;
  advanceToNextStage(input: AdvanceToNextStageInput): Promise<ProcessingJobRecord | null>;
  markFailed(input: MarkProcessingJobFailedInput): Promise<ProcessingJobRecord | null>;
}
