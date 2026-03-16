import { getAdminArtifactUrls, parseAdminArtifactRefs } from "../../lib/artifact-refs";
import {
  formatJobUpdatedAt,
  getJobFailureMessage,
  getJobFailureTooltip,
  isRetryableJobState,
} from "../../lib/job-presenters";
import type { ProcessingJobArtifactRefs } from "../../../../src/contracts/artifacts";

const STAGES = ["audio", "asr", "segment", "translate", "finalize"] as const;

type StageKey = (typeof STAGES)[number];

const STAGE_DESCRIPTIONS: Record<StageKey, string> = {
  audio: "Clean up the clip audio so downstream steps run smoothly.",
  asr: "Create a first-pass transcript from the spoken Thai.",
  segment: "Break the transcript into natural, time-aligned lines.",
  translate: "Translate each Thai segment into natural English.",
  finalize: "Prepare this clip for final QA and publishing.",
};

const STAGE_CHECK_LINES: Record<StageKey, string> = {
  audio: "Check that normalized video, poster, and WAV artifacts are all available.",
  asr: "Check that the transcript preview matches the spoken Thai well enough for review.",
  segment: "Check that phrase boundaries and timing look natural for reading and playback.",
  translate: "Check that each segment-level English translation is natural and faithful.",
  finalize: "Check that this clip is fully review-ready without unresolved blockers.",
};

export type StageProgress =
  | "not_started"
  | "pending"
  | "queued"
  | "in_progress"
  | "completed"
  | "needs_review"
  | "failed"
  | "manual_intervention";

type ClipRecord = {
  id: string;
  title: string;
  sourceType: string;
  rightsStatus: string;
};

type JobRecord = {
  id: string;
  state: string;
  stage: string;
  updatedAt: Date;
  errorPayload: unknown | null;
  artifactRefs: unknown | null;
};

type StageContent =
  | {
    kind: "audio";
    posterUrl: string | null;
    normalizedVideoUrl: string | null;
    wavUrl: string | null;
  }
  | {
    kind: "asr";
    transcriptPreview: string | null;
    segmentCount: number | null;
    wordCount: number | null;
    language: string | null;
  }
  | {
    kind: "segment";
    segmentCount: number | null;
    preview: ProcessingJobArtifactRefs["segment"]["preview"];
  }
  | {
    kind: "translate";
    translationCount: number | null;
    preview: ProcessingJobArtifactRefs["translate"]["preview"];
  }
  | {
    kind: "finalize";
    segmentCount: number | null;
    translationCount: number | null;
    thumbnailPath: string | null;
    artifactUrl: string | null;
    normalizedVideoUrl: string | null;
    posterUrl: string | null;
  }
  | {
    kind: "placeholder";
    message: string;
  };

export type ClipStageViewModel = {
  key: StageKey;
  progress: StageProgress;
  description: string;
  checkLine: string;
  content: StageContent;
  downloads: Array<{
    label: string;
    href: string | null;
    pendingLabel: string;
  }>;
  retryJobId: string | null;
  showLockedAction: boolean;
};

export type ClipDetailViewModel = {
  header: {
    clipId: string;
    title: string;
    sourceType: string;
    rightsStatus: string;
  };
  currentStatus: {
    jobId: string;
    state: string;
    stage: string;
    updatedAtLabel: string;
    failureTooltip: string | null;
    failureMessage: string | null;
    canRetry: boolean;
  } | null;
  reviewChecklist: {
    isReviewReady: boolean;
    summary: string;
    items: Array<{
      key: string;
      label: string;
      status: "pass" | "fail";
      detail: string;
    }>;
    humanChecks: string[];
    gaps: string[];
  };
  stages: ClipStageViewModel[];
  jobs: Array<{
    id: string;
    state: string;
    stage: string;
    updatedAtLabel: string;
    failureTooltip: string | null;
    canRetry: boolean;
  }>;
};

function getStageProgress(stage: StageKey, latestJob?: { stage: string; state: string } | null): StageProgress {
  if (!latestJob) {
    return "not_started";
  }

  const targetIndex = STAGES.indexOf(stage);
  const currentIndex = STAGES.indexOf(latestJob.stage as StageKey);

  if (currentIndex < 0) {
    return "pending";
  }
  if (targetIndex < currentIndex) {
    return "completed";
  }
  if (targetIndex > currentIndex) {
    return "pending";
  }
  if (latestJob.state === "processing") {
    return "in_progress";
  }
  if (latestJob.state === "uploaded") {
    return "queued";
  }
  if (latestJob.state === "needs_review") {
    return "needs_review";
  }
  if (latestJob.state === "failed") {
    return "failed";
  }
  if (latestJob.state === "manual_intervention") {
    return "manual_intervention";
  }

  return "completed";
}

function buildStageDownloads(stage: StageKey, artifactUrls: ReturnType<typeof getAdminArtifactUrls>) {
  if (stage === "asr") {
    return [{ label: "Download ASR JSON", href: artifactUrls.asrUrl, pendingLabel: "Download ASR JSON (not ready)" }];
  }
  if (stage === "segment") {
    return [{ label: "Download segments JSON", href: artifactUrls.segmentUrl, pendingLabel: "Download segments JSON (not ready)" }];
  }
  if (stage === "translate") {
    return [{ label: "Download translations JSON", href: artifactUrls.translateUrl, pendingLabel: "Download translations JSON (not ready)" }];
  }
  if (stage === "finalize") {
    return [
      {
        label: "Download generated payload",
        href: artifactUrls.generatedPayloadUrl,
        pendingLabel: "Download generated payload (not ready)",
      },
      {
        label: "Download edited payload",
        href: artifactUrls.editedPayloadUrl,
        pendingLabel: "Download edited payload (not ready)",
      },
    ];
  }

  return [];
}

function buildStageContent(stage: StageKey, artifacts: ProcessingJobArtifactRefs, artifactUrls: ReturnType<typeof getAdminArtifactUrls>): StageContent {
  if (stage === "audio") {
    return {
      kind: "audio",
      posterUrl: artifactUrls.posterUrl,
      normalizedVideoUrl: artifactUrls.normalizedVideoUrl,
      wavUrl: artifactUrls.wavUrl,
    };
  }
  if (stage === "asr") {
    return {
      kind: "asr",
      transcriptPreview: artifacts.asr.transcriptPreview,
      segmentCount: artifacts.asr.segmentCount,
      wordCount: artifacts.asr.wordCount,
      language: artifacts.asr.language,
    };
  }
  if (stage === "segment") {
    return {
      kind: "segment",
      segmentCount: artifacts.segment.segmentCount,
      preview: artifacts.segment.preview,
    };
  }
  if (stage === "translate") {
    return {
      kind: "translate",
      translationCount: artifacts.translate.translationCount,
      preview: artifacts.translate.preview,
    };
  }
  if (stage === "finalize") {
    return {
      kind: "finalize",
      segmentCount: artifacts.finalize.segmentCount,
      translationCount: artifacts.finalize.translationCount,
      thumbnailPath: artifacts.finalize.thumbnailPath,
      artifactUrl: artifactUrls.editedPayloadUrl,
      normalizedVideoUrl: artifactUrls.normalizedVideoUrl,
      posterUrl: artifactUrls.posterUrl,
    };
  }

  return {
    kind: "placeholder",
    message: `This stage widget will be enabled after the current stage-by-stage rollout reaches ${stage}.`,
  };
}

function buildReviewChecklist(input: {
  clip: ClipRecord;
  latestJob: JobRecord | null;
  artifacts: ProcessingJobArtifactRefs;
}): ClipDetailViewModel["reviewChecklist"] {
  const { clip, latestJob, artifacts } = input;
  const hasMediaArtifacts = !!artifacts.normalizedVideoPath && !!artifacts.posterImagePath && !!artifacts.audioWavPath;
  const hasTranscriptArtifacts = !!artifacts.asr.asrJsonPath
    && !!artifacts.asr.transcriptPreview
    && (artifacts.asr.segmentCount ?? 0) > 0;
  const hasSegmentArtifacts = !!artifacts.segment.segmentJsonPath
    && (artifacts.segment.segmentCount ?? 0) > 0
    && artifacts.segment.preview.length > 0;
  const hasTranslationArtifacts = !!artifacts.translate.translationJsonPath
    && (artifacts.translate.translationCount ?? 0) > 0
    && artifacts.translate.preview.length > 0;
  const hasFinalizeArtifacts = !!artifacts.finalize.generatedPayloadPath
    && !!artifacts.finalize.editedPayloadPath
    && !!artifacts.finalize.thumbnailPath
    && (artifacts.finalize.segmentCount ?? 0) > 0
    && (artifacts.finalize.translationCount ?? 0) > 0;
  const isLatestJobReadyForReview = latestJob?.state === "needs_review" && latestJob.stage === "finalize";

  const items: ClipDetailViewModel["reviewChecklist"]["items"] = [
    {
      key: "rights",
      label: "Rights status is cleared",
      status: clip.rightsStatus === "cleared" ? "pass" : "fail",
      detail: clip.rightsStatus === "cleared"
        ? "The clip row is marked cleared, which is the only rights gate currently stored in the repo."
        : `The clip row is marked ${clip.rightsStatus}, so this clip is not ready for a trusted review baseline.`,
    },
    {
      key: "media",
      label: "Normalized media artifacts exist",
      status: hasMediaArtifacts ? "pass" : "fail",
      detail: hasMediaArtifacts
        ? "Normalized video, poster, and WAV artifacts are present for operator playback and inspection."
        : "One or more core media artifacts are missing, so operators cannot fully verify the clip output.",
    },
    {
      key: "transcript",
      label: "Transcript artifact exists with preview data",
      status: hasTranscriptArtifacts ? "pass" : "fail",
      detail: hasTranscriptArtifacts
        ? "ASR JSON exists and exposes transcript and count metadata for review."
        : "ASR output is incomplete or missing enough metadata to trust transcript review.",
    },
    {
      key: "segments",
      label: "Segment timing artifact exists",
      status: hasSegmentArtifacts ? "pass" : "fail",
      detail: hasSegmentArtifacts
        ? "Segment JSON exists and the admin view has preview rows with timing."
        : "Segment output is missing, empty, or lacks enough preview data for timing review.",
    },
    {
      key: "translations",
      label: "Translation artifact exists",
      status: hasTranslationArtifacts ? "pass" : "fail",
      detail: hasTranslationArtifacts
        ? "Translation JSON exists and the admin view has segment-level English preview rows."
        : "Translation output is missing, empty, or lacks enough preview data for review.",
    },
    {
      key: "finalize",
      label: "Finalize payload is ready for operator QA",
      status: hasFinalizeArtifacts && isLatestJobReadyForReview ? "pass" : "fail",
      detail: hasFinalizeArtifacts && isLatestJobReadyForReview
        ? "Generated and edited payloads exist, thumbnail metadata is present, and the latest job is parked at finalize review."
        : "Finalize artifacts are missing or the latest job has not reached the expected needs_review/finalize state.",
    },
  ];

  const failedCount = items.filter((item) => item.status === "fail").length;

  return {
    isReviewReady: failedCount === 0,
    summary: failedCount === 0
      ? "System checks passed. Human review is still required before any publish work starts."
      : `${failedCount} system check${failedCount === 1 ? "" : "s"} still failing. Fix these before relying on this clip as publish-ready input.`,
    items,
    humanChecks: [
      "Listen to the clip and confirm the Thai transcript matches the spoken audio.",
      "Scrub the video and confirm segment boundaries and subtitle timing feel natural.",
      "Read each English line for faithfulness and natural phrasing, not literal word salad.",
      "Check the thumbnail and clip preview for obvious visual or subtitle presentation issues.",
    ],
    gaps: [
      "The review editor persists edits and status now, but there is still no publish/version history or rollback workflow.",
      "Retrying a clip will reseed the editor state from the newest finalize output, so prior manual edits are intentionally replaced.",
      "Rights are only tracked as a coarse clip flag; there is no rights confidence, attribution record, or legal hold workflow in the active schema.",
    ],
  };
}

export function buildClipDetailViewModel(input: { clip: ClipRecord; jobs: JobRecord[] }): ClipDetailViewModel {
  const latestJob = input.jobs[0] ?? null;
  const latestArtifacts = parseAdminArtifactRefs(latestJob?.artifactRefs ?? null);
  const artifactUrls = getAdminArtifactUrls(latestJob?.id ?? null, latestArtifacts);

  return {
    header: {
      clipId: input.clip.id,
      title: input.clip.title,
      sourceType: input.clip.sourceType,
      rightsStatus: input.clip.rightsStatus,
    },
    currentStatus: latestJob
      ? {
        jobId: latestJob.id,
        state: latestJob.state,
        stage: latestJob.stage,
        updatedAtLabel: formatJobUpdatedAt(latestJob.updatedAt),
        failureTooltip: latestJob.state === "failed" ? getJobFailureTooltip(latestJob.errorPayload) : null,
        failureMessage: latestJob.state === "failed" ? getJobFailureMessage(latestJob.errorPayload) : null,
        canRetry: isRetryableJobState(latestJob.state),
      }
      : null,
    reviewChecklist: buildReviewChecklist({
      clip: input.clip,
      latestJob,
      artifacts: latestArtifacts,
    }),
    stages: STAGES.map((stage) => {
      const progress = getStageProgress(stage, latestJob ? { stage: latestJob.stage, state: latestJob.state } : null);
      const downloads = buildStageDownloads(stage, artifactUrls);

      return {
        key: stage,
        progress,
        description: STAGE_DESCRIPTIONS[stage],
        checkLine: STAGE_CHECK_LINES[stage],
        content: buildStageContent(stage, latestArtifacts, artifactUrls),
        downloads,
        retryJobId: latestJob && isRetryableJobState(progress) ? latestJob.id : null,
        showLockedAction: !isRetryableJobState(progress)
          && stage !== "asr"
          && stage !== "segment"
          && stage !== "translate"
          && stage !== "finalize",
      };
    }),
    jobs: input.jobs.map((job) => ({
      id: job.id,
      state: job.state,
      stage: job.stage,
      updatedAtLabel: formatJobUpdatedAt(job.updatedAt),
      failureTooltip: job.state === "failed" ? getJobFailureTooltip(job.errorPayload) : null,
      canRetry: isRetryableJobState(job.state),
    })),
  };
}
