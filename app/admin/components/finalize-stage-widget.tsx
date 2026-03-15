"use client";

import { useEffect, useMemo, useState } from "react";
import type { EditorPayload, EditorPayloadSegment } from "../../../src/contracts/editor-payload";

type FinalizeStageWidgetProps = {
  artifactUrl: string | null;
  normalizedVideoUrl: string | null;
  posterUrl: string | null;
};

type PayloadState = {
  payload: EditorPayload | null;
  error: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load edited payload";
}

function getCurrentSegment(segments: EditorPayloadSegment[], currentMs: number) {
  for (const segment of segments) {
    if (segment.startMs === null || segment.endMs === null) {
      continue;
    }

    if (currentMs >= segment.startMs && currentMs < segment.endMs) {
      return segment;
    }
  }

  return null;
}

export default function FinalizeStageWidget({
  artifactUrl,
  normalizedVideoUrl,
  posterUrl,
}: FinalizeStageWidgetProps) {
  const [payloadState, setPayloadState] = useState<PayloadState>({
    payload: null,
    error: null,
  });
  const [currentMs, setCurrentMs] = useState(0);

  useEffect(() => {
    if (!artifactUrl) {
      setPayloadState({ payload: null, error: null });
      return undefined;
    }

    const url: string = artifactUrl;

    const controller = new AbortController();

    async function loadArtifact() {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Artifact request failed with ${response.status}`);
        }

        const payload = await response.json() as EditorPayload;
        setPayloadState({ payload, error: null });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPayloadState({ payload: null, error: getErrorMessage(error) });
      }
    }

    void loadArtifact();

    return () => {
      controller.abort();
    };
  }, [artifactUrl]);

  useEffect(() => {
    setCurrentMs(0);
  }, [normalizedVideoUrl, artifactUrl]);

  const segments = useMemo(() => {
    const items = payloadState.payload?.segments ?? [];
    return [...items].sort((left, right) => {
      const leftStart = left.startMs ?? Number.MAX_SAFE_INTEGER;
      const rightStart = right.startMs ?? Number.MAX_SAFE_INTEGER;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }

      return left.index - right.index;
    });
  }, [payloadState.payload]);

  const currentSegment = useMemo(() => getCurrentSegment(segments, currentMs), [segments, currentMs]);

  const hasVideo = !!normalizedVideoUrl;
  const hasPayload = !!payloadState.payload;

  if (!hasVideo && !hasPayload) {
    return <p className="text-slate-600">No finalized clip preview is available yet.</p>;
  }

  return (
    <div className="space-y-3">
      {hasVideo ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Clip preview</p>
          <video
            controls
            preload="metadata"
            src={normalizedVideoUrl ?? undefined}
            poster={posterUrl ?? undefined}
            className="w-full max-w-2xl rounded-lg border border-slate-200 bg-black"
            onTimeUpdate={(event) => {
              setCurrentMs(Math.floor(event.currentTarget.currentTime * 1000));
            }}
            onSeeked={(event) => {
              setCurrentMs(Math.floor(event.currentTarget.currentTime * 1000));
            }}
            onLoadedMetadata={(event) => {
              setCurrentMs(Math.floor(event.currentTarget.currentTime * 1000));
            }}
          />
        </div>
      ) : (
        <p className="text-slate-600">Video preview is not available for this finalized payload.</p>
      )}

      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Live subtitles</p>
        {currentSegment ? (
          <div className="mt-2 space-y-2">
            <p className="text-lg font-medium leading-relaxed text-slate-900">{currentSegment.text || "-"}</p>
            <p className="text-sm leading-relaxed text-cyan-900">{currentSegment.translation.englishText || "-"}</p>
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-slate-600">No subtitle line for the current frame.</p>
            <p className="text-xs text-slate-500">Play or scrub the clip to inspect Thai and English subtitle timing.</p>
          </div>
        )}
      </div>

      {payloadState.error ? <p className="text-xs text-amber-600">{payloadState.error}</p> : null}
    </div>
  );
}
