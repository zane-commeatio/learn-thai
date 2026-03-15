"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDurationMs } from "../lib/job-presenters";
import type { SegmentPreview, TranslationPreview } from "../../../src/contracts/artifacts";
import type { EditorPayload } from "../../../src/contracts/editor-payload";

const INITIAL_SEGMENTS = 5;
const INITIAL_TRANSLATIONS = 5;
const TRANSCRIPT_COLLAPSED_MAX_HEIGHT = "max-h-24";

type AsrArtifactPayload = {
  transcript?: string;
};

type SegmentArtifactPayload = {
  segments?: SegmentPreview[];
};

type TranslationArtifactPayload = {
  translations?: TranslationPreview[];
};

type ArtifactState = {
  transcript: string | null;
  segments: SegmentPreview[] | null;
  translations: TranslationPreview[] | null;
  editorPayload: EditorPayload | null;
  error: string | null;
};

type StageArtifactViewerProps =
  | {
    kind: "asr";
    artifactUrl: string | null;
    transcriptPreview: string | null;
  }
  | {
    kind: "segment";
    artifactUrl: string | null;
    preview: SegmentPreview[];
  }
  | {
    kind: "translate";
    artifactUrl: string | null;
    preview: TranslationPreview[];
  }
  | {
    kind: "editor";
    artifactUrl: string | null;
  };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load full artifact";
}

export default function StageArtifactViewer(props: StageArtifactViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [artifactState, setArtifactState] = useState<ArtifactState>({
    transcript: null,
    segments: null,
    translations: null,
    editorPayload: null,
    error: null,
  });

  useEffect(() => {
    if (!props.artifactUrl) {
      return undefined;
    }
    const artifactUrl: string = props.artifactUrl;

    const controller = new AbortController();

    async function loadArtifact() {
      try {
        const response = await fetch(artifactUrl, {
          signal: controller.signal,
          headers: {
            accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Artifact request failed with ${response.status}`);
        }

        if (props.kind === "asr") {
          const payload = await response.json() as AsrArtifactPayload;
          setArtifactState({
            transcript: typeof payload.transcript === "string" ? payload.transcript : null,
            segments: null,
            translations: null,
            editorPayload: null,
            error: null,
          });
          return;
        }

        if (props.kind === "segment") {
          const payload = await response.json() as SegmentArtifactPayload;
          setArtifactState({
            transcript: null,
            segments: Array.isArray(payload.segments) ? payload.segments : null,
            translations: null,
            editorPayload: null,
            error: null,
          });
          return;
        }

        if (props.kind === "translate") {
          const payload = await response.json() as TranslationArtifactPayload;
          setArtifactState({
            transcript: null,
            segments: null,
            translations: Array.isArray(payload.translations) ? payload.translations : null,
            editorPayload: null,
            error: null,
          });
          return;
        }

        if (props.kind === "editor") {
          const payload = await response.json() as EditorPayload;
          setArtifactState({
            transcript: null,
            segments: null,
            translations: null,
            editorPayload: payload,
            error: null,
          });
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setArtifactState((current) => ({
          ...current,
          error: getErrorMessage(error),
        }));
      }
    }

    void loadArtifact();

    return () => {
      controller.abort();
    };
  }, [props]);

  const content = useMemo(() => {
    if (props.kind === "asr") {
      return {
        transcript: artifactState.transcript ?? props.transcriptPreview,
      };
    }

    if (props.kind === "segment") {
      return {
        items: artifactState.segments ?? props.preview,
      };
    }

    if (props.kind === "translate") {
      return {
        items: artifactState.translations ?? props.preview,
      };
    }

    if (props.kind === "editor") {
      return {
        payload: artifactState.editorPayload,
      };
    }

    return {
      items: [],
    };
  }, [artifactState.segments, artifactState.transcript, artifactState.translations, props]);

  if (props.kind === "asr") {
    const transcript = content.transcript?.trim() ?? "";
    const canExpand = transcript.length > 220;

    return (
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Transcript</p>
        {transcript ? (
          <div
            className={`rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap ${isExpanded ? "" : TRANSCRIPT_COLLAPSED_MAX_HEIGHT} overflow-hidden`}
          >
            {transcript}
          </div>
        ) : (
          <p className="text-slate-600">No transcript is available yet.</p>
        )}
        {artifactState.error ? <p className="text-xs text-amber-600">Showing available transcript only.</p> : null}
        {canExpand ? (
          <button
            type="button"
            onClick={() => {
              setIsExpanded((current) => !current);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>
    );
  }

  if (props.kind === "segment") {
    const items = content.items as SegmentPreview[];
    const visibleItems = isExpanded ? items : items.slice(0, INITIAL_SEGMENTS);

    return (
      <div className="space-y-2">
        {visibleItems.length > 0 ? (
          <div className="space-y-2">
            {visibleItems.map((segment) => (
              <div key={`${segment.index}-${segment.startMs ?? "x"}`} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">
                  #{segment.index + 1} {formatDurationMs(segment.startMs)} - {formatDurationMs(segment.endMs)}
                </p>
                <p className="mt-1 text-sm text-slate-700">{segment.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600">No segments are available yet.</p>
        )}
        {artifactState.error ? <p className="text-xs text-amber-600">Showing available segments only.</p> : null}
        {items.length > INITIAL_SEGMENTS ? (
          <button
            type="button"
            onClick={() => {
              setIsExpanded((current) => !current);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {isExpanded ? "Show less" : `Show more (${items.length - INITIAL_SEGMENTS} more)`}
          </button>
        ) : null}
      </div>
    );
  }

  if (props.kind === "translate") {
    const items = content.items as TranslationPreview[];
    const visibleItems = isExpanded ? items : items.slice(0, INITIAL_TRANSLATIONS);

    return (
      <div className="space-y-2">
        {visibleItems.length > 0 ? (
          <div className="space-y-2">
            {visibleItems.map((translation) => (
              <div key={translation.segmentIndex} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Segment #{translation.segmentIndex + 1}</p>
                <p className="mt-1 text-sm text-slate-700">{translation.sourceText}</p>
                <p className="mt-2 text-sm font-medium text-cyan-800">{translation.englishText}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600">No translations are available yet.</p>
        )}
        {artifactState.error ? <p className="text-xs text-amber-600">Showing available translations only.</p> : null}
        {items.length > INITIAL_TRANSLATIONS ? (
          <button
            type="button"
            onClick={() => {
              setIsExpanded((current) => !current);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {isExpanded ? "Show less" : `Show more (${items.length - INITIAL_TRANSLATIONS} more)`}
          </button>
        ) : null}
      </div>
    );
  }

  if (props.kind === "editor") {
    const payload = content.payload as EditorPayload | null;
    const items = payload?.segments ?? [];
    const visibleItems = isExpanded ? items : items.slice(0, INITIAL_TRANSLATIONS);

    return (
      <div className="space-y-2">
        {payload ? (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>Segments: {payload.segments.length}</span>
              <span>Manual changes: {payload.review.hasManualChanges ? "yes" : "no"}</span>
              <span>Thumbnail: {payload.thumbnail.source}</span>
            </div>
            <div className="space-y-2">
              {visibleItems.map((segment) => (
                <div key={segment.index} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">
                    Segment #{segment.index + 1} {formatDurationMs(segment.startMs)} - {formatDurationMs(segment.endMs)}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{segment.text}</p>
                  <p className="mt-2 text-sm font-medium text-amber-800">{segment.translation.englishText}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-slate-600">No finalized payload is available yet.</p>
        )}
        {artifactState.error ? <p className="text-xs text-amber-600">Showing available editor details only.</p> : null}
        {items.length > INITIAL_TRANSLATIONS ? (
          <button
            type="button"
            onClick={() => {
              setIsExpanded((current) => !current);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {isExpanded ? "Show less" : `Show more (${items.length - INITIAL_TRANSLATIONS} more)`}
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}
