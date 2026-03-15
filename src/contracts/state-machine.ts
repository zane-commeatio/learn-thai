import type { PipelineStage, ProcessingState } from "./pipeline";

const LEGAL_STAGE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  audio: ["asr"],
  asr: ["segment"],
  segment: ["translate"],
  translate: ["finalize"],
  finalize: [],
};

const LEGAL_STATE_TRANSITIONS: Record<ProcessingState, ProcessingState[]> = {
  uploaded: ["processing"],
  processing: ["needs_review", "failed", "manual_intervention"],
  needs_review: [],
  failed: [],
  manual_intervention: [],
};

export function isValidStageTransition(
  from: PipelineStage,
  to: PipelineStage,
): boolean {
  return LEGAL_STAGE_TRANSITIONS[from].includes(to);
}

export function getNextStage(stage: PipelineStage): PipelineStage | null {
  const [next] = LEGAL_STAGE_TRANSITIONS[stage];
  return next ?? null;
}

export function isValidStateTransition(
  from: ProcessingState,
  to: ProcessingState,
): boolean {
  return LEGAL_STATE_TRANSITIONS[from].includes(to);
}
