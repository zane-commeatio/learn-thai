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
