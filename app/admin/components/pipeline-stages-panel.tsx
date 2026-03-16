import Link from "next/link";
import type { EditorPayload } from "../../../src/contracts/editor-payload";
import type { ClipStageViewModel } from "../clips/[clipId]/clip-detail-view-model";
import AudioStageWidget from "./audio-stage-widget";
import FinalizeStageWidget from "./finalize-stage-widget";
import JobStageBadge from "./job-stage-badge";
import JobStateBadge from "./job-state-badge";
import RetryJobButton from "./retry-job-button";
import StageArtifactViewer from "./stage-artifact-viewer";

type PipelineStagesPanelProps = {
  stages: ClipStageViewModel[];
  finalizePayload?: EditorPayload | null;
  retryWarningMessage?: string | null;
};

function renderStageContent(stage: ClipStageViewModel, finalizePayload?: EditorPayload | null) {
  if (stage.content.kind === "audio") {
    return (
      <AudioStageWidget
        posterUrl={stage.content.posterUrl}
        normalizedVideoUrl={stage.content.normalizedVideoUrl}
        wavUrl={stage.content.wavUrl}
      />
    );
  }

  if (stage.content.kind === "asr") {
    return (
      <div className="space-y-2">
        <StageArtifactViewer
          kind="asr"
          artifactUrl={stage.downloads[0]?.href ?? null}
          transcriptPreview={stage.content.transcriptPreview}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Segments: {stage.content.segmentCount ?? "-"}</span>
          <span>Words: {stage.content.wordCount ?? "-"}</span>
          <span>Language: {stage.content.language ?? "auto"}</span>
        </div>
      </div>
    );
  }

  if (stage.content.kind === "segment") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Total segments: {stage.content.segmentCount ?? "-"}</span>
        </div>
        <StageArtifactViewer kind="segment" artifactUrl={stage.downloads[0]?.href ?? null} preview={stage.content.preview} />
      </div>
    );
  }

  if (stage.content.kind === "translate") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Total translations: {stage.content.translationCount ?? "-"}</span>
        </div>
        <StageArtifactViewer kind="translate" artifactUrl={stage.downloads[0]?.href ?? null} preview={stage.content.preview} />
      </div>
    );
  }

  if (stage.content.kind === "finalize") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Total segments: {stage.content.segmentCount ?? "-"}</span>
          <span>Total translations: {stage.content.translationCount ?? "-"}</span>
          <span>Thumbnail: {stage.content.thumbnailPath ? "ready" : "pending"}</span>
        </div>
        <FinalizeStageWidget
          artifactUrl={stage.content.artifactUrl}
          normalizedVideoUrl={stage.content.normalizedVideoUrl}
          posterUrl={stage.content.posterUrl}
          payload={finalizePayload}
        />
      </div>
    );
  }

  return <p className="text-slate-600">{stage.content.message}</p>;
}

export default function PipelineStagesPanel({ stages, finalizePayload, retryWarningMessage }: PipelineStagesPanelProps) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
      <h2 className="text-xl font-semibold text-ink">Pipeline Stages</h2>
      <p className="mt-1 text-sm text-slate-500">Follow each step from raw clip to publish-ready learning content.</p>
      <div className="mt-5 grid gap-4">
        {stages.map((stage) => (
          <article key={stage.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <JobStageBadge stage={stage.key} />
              <JobStateBadge state={stage.progress} />
            </div>
            <p className="mt-3 text-sm text-slate-600">{stage.description}</p>
            <p className="mt-1 text-xs text-slate-500">What to check: {stage.checkLine}</p>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
              {renderStageContent(stage, finalizePayload)}
              </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {stage.downloads.map((download) => (
                download.href ? (
                  <Link
                    key={download.label}
                    href={download.href}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    {download.label}
                  </Link>
                ) : (
                  <button
                    key={download.label}
                    type="button"
                    disabled
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500"
                  >
                    {download.pendingLabel}
                  </button>
                )
              ))}

              {stage.retryJobId ? <RetryJobButton jobId={stage.retryJobId} warningMessage={retryWarningMessage} /> : null}

              {stage.showLockedAction ? (
                <button
                  type="button"
                  disabled
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500"
                >
                  Actions unlock with this stage
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
