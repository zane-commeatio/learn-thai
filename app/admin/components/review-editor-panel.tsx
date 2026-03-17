"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ClipReviewStatus, EditorPayload } from "../../../src/contracts/editor-payload";

type EditorStateView = {
  clipId: string;
  sourceJobId: string;
  payload: EditorPayload;
  reviewStatus: ClipReviewStatus;
  hasManualChanges: boolean;
  lastReseededAt: string;
  updatedBy: string | null;
};

type ReviewEditorPanelProps = {
  clipId: string;
  clipOwnerId: string;
  currentUserEmail: string;
  canEdit: boolean;
  canReview: boolean;
  initialEditorState: EditorStateView | null;
};

type SegmentDraft = EditorPayload["segments"][number];

function toManualSource<T extends { source: EditorPayload["thumbnail"]["source"] }>(value: T): T {
  if (value.source === "manual") {
    return value;
  }

  return {
    ...value,
    source: "manual",
  };
}

function formatStatus(status: ClipReviewStatus) {
  return status.replaceAll("_", " ");
}

function getStatusClasses(status: ClipReviewStatus) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "needs_fixes") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function formatDurationMs(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "--:--.---";
  }

  const minutes = Math.floor(value / 60_000);
  const seconds = Math.floor((value % 60_000) / 1_000);
  const milliseconds = Math.floor(value % 1_000);

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

function getCurrentSegmentIndex(segments: SegmentDraft[], currentMs: number) {
  return segments.findIndex((segment) => {
    if (segment.startMs === null || segment.endMs === null) {
      return false;
    }

    return currentMs >= segment.startMs && currentMs < segment.endMs;
  });
}

export default function ReviewEditorPanel({
  clipId,
  clipOwnerId,
  currentUserEmail,
  canEdit,
  canReview,
  initialEditorState,
}: ReviewEditorPanelProps) {
  const router = useRouter();
  const [editorState, setEditorState] = useState(initialEditorState);
  const [segments, setSegments] = useState<SegmentDraft[]>(() => initialEditorState?.payload.segments ?? []);
  const [thumbnailPath, setThumbnailPath] = useState(initialEditorState?.payload.thumbnail.imagePath ?? "");
  const [thumbnailSource, setThumbnailSource] = useState<EditorPayload["thumbnail"]["source"]>(
    initialEditorState?.payload.thumbnail.source ?? "generated",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [decisionPending, setDecisionPending] = useState<ClipReviewStatus | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackTarget, setPlaybackTarget] = useState<{ segmentIndex: number; endMs: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const lastReseededLabel = useMemo(() => {
    if (!editorState?.lastReseededAt) {
      return null;
    }

    return new Date(editorState.lastReseededAt).toLocaleString();
  }, [editorState?.lastReseededAt]);

  const normalizedVideoUrl = useMemo(() => {
    if (!editorState?.payload.media.normalizedVideoPath) {
      return null;
    }

    return `/api/admin/jobs/${editorState.sourceJobId}/artifacts/audio/normalized`;
  }, [editorState]);

  const wavUrl = useMemo(() => {
    if (!editorState?.payload.media.audioWavPath) {
      return null;
    }

    return `/api/admin/jobs/${editorState.sourceJobId}/artifacts/audio/wav`;
  }, [editorState]);

  const posterUrl = useMemo(() => {
    if (!editorState?.payload.media.posterImagePath) {
      return null;
    }

    return `/api/admin/jobs/${editorState.sourceJobId}/artifacts/audio/poster`;
  }, [editorState]);

  const activeSegmentIndex = useMemo(() => getCurrentSegmentIndex(segments, currentMs), [segments, currentMs]);
  const activeSegment = activeSegmentIndex >= 0 ? segments[activeSegmentIndex] ?? null : null;
  const hasVideo = !!normalizedVideoUrl;
  const hasWav = !!wavUrl;
  const hasPlaybackMedia = hasVideo || hasWav;

  useEffect(() => {
    setCurrentMs(0);
    setDurationMs(0);
    setPlaybackTarget(null);
  }, [editorState?.sourceJobId]);

  useEffect(() => {
    if (!playbackTarget) {
      return;
    }

    if (currentMs < playbackTarget.endMs) {
      return;
    }

    videoRef.current?.pause();
    audioRef.current?.pause();
    setPlaybackTarget(null);
  }, [currentMs, playbackTarget]);

  if (!editorState) {
    return (
      <section className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
        <h2 className="text-xl font-semibold text-ink">Review Editor</h2>
        <p className="mt-3 text-sm text-slate-500">The editor unlocks after the latest processing job reaches finalize and writes a generated review payload.</p>
      </section>
    );
  }

  async function refreshFromServer() {
    const response = await fetch(`/api/admin/clips/${clipId}/editor-state`, { cache: "no-store" });
    const payload = await response.json() as { editorState?: EditorStateView; message?: string };
    if (!response.ok || !payload.editorState) {
      throw new Error(payload.message ?? "Failed to refresh editor state");
    }

    setEditorState(payload.editorState);
    setSegments(payload.editorState.payload.segments);
    setThumbnailPath(payload.editorState.payload.thumbnail.imagePath ?? "");
    setThumbnailSource(payload.editorState.payload.thumbnail.source);
  }

  async function saveEdits() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/clips/${clipId}/editor-state`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          segments,
          thumbnail: {
            imagePath: thumbnailPath.trim() || null,
            source: thumbnailSource,
          },
        }),
      });

      const payload = await response.json() as { editorState?: EditorStateView; message?: string };
      if (!response.ok || !payload.editorState) {
        throw new Error(payload.message ?? "Failed to save review edits");
      }

      setEditorState(payload.editorState);
      toast.success("Review edits saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save review edits");
    } finally {
      setIsSaving(false);
    }
  }

  async function setReviewDecision(status: Extract<ClipReviewStatus, "approved" | "rejected" | "needs_fixes">) {
    setDecisionPending(status);
    try {
      const response = await fetch(`/api/admin/clips/${clipId}/review-decision`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json() as { editorState?: EditorStateView; message?: string };
      if (!response.ok || !payload.editorState) {
        throw new Error(payload.message ?? "Failed to update review status");
      }

      setEditorState(payload.editorState);
      toast.success(`Review marked ${formatStatus(status)}.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update review status");
    } finally {
      setDecisionPending(null);
    }
  }

  function updateThumbnailPath(nextThumbnailPath: string) {
    setThumbnailPath(nextThumbnailPath);
    setThumbnailSource((currentSource) => (currentSource === "manual" ? currentSource : "manual"));
  }

  function updateSegment(index: number, updater: (segment: SegmentDraft) => SegmentDraft) {
    setSegments((currentSegments) => {
      const next = [...currentSegments];
      const segment = currentSegments[index];
      if (!segment) {
        return currentSegments;
      }

      next[index] = updater(segment);
      return next;
    });
  }

  function getMediaElement() {
    return videoRef.current ?? audioRef.current;
  }

  function syncPlayerState(element: HTMLMediaElement) {
    setCurrentMs(Math.floor(element.currentTime * 1_000));
    setDurationMs(Number.isFinite(element.duration) ? Math.floor(element.duration * 1_000) : 0);
  }

  function seekToMs(nextMs: number) {
    const media = getMediaElement();
    if (!media) {
      return;
    }

    const maxMs = durationMs > 0 ? durationMs : nextMs;
    const safeMs = Math.min(Math.max(nextMs, 0), maxMs);
    media.currentTime = safeMs / 1_000;
    setCurrentMs(Math.floor(media.currentTime * 1_000));
  }

  async function playFromMs(startMs: number) {
    const media = getMediaElement();
    if (!media) {
      return;
    }

    media.currentTime = Math.max(startMs, 0) / 1_000;
    setCurrentMs(Math.floor(media.currentTime * 1_000));
    await media.play();
  }

  async function playSegment(index: number) {
    const segment = segments[index];
    if (!segment || segment.startMs === null || segment.endMs === null) {
      toast.error("Add both start and end times before playing a segment.");
      return;
    }

    setPlaybackTarget({
      segmentIndex: segment.index,
      endMs: segment.endMs,
    });

    try {
      await playFromMs(segment.startMs);
    } catch {
      setPlaybackTarget(null);
      toast.error("Playback could not start.");
    }
  }

  function getPreviousEndMs(index: number) {
    if (index <= 0) {
      return 0;
    }

    return segments[index - 1]?.endMs ?? 0;
  }

  function getNextStartMs(index: number) {
    return segments[index + 1]?.startMs ?? null;
  }

  function clampStartMs(index: number, nextStartMs: number | null) {
    const segment = segments[index];
    if (!segment || nextStartMs === null) {
      return nextStartMs;
    }

    const minMs = getPreviousEndMs(index);
    const maxMs = segment.endMs === null ? getNextStartMs(index) ?? Number.MAX_SAFE_INTEGER : segment.endMs - 1;
    return Math.max(minMs, Math.min(nextStartMs, maxMs));
  }

  function clampEndMs(index: number, nextEndMs: number | null) {
    const segment = segments[index];
    if (!segment || nextEndMs === null) {
      return nextEndMs;
    }

    const minMs = segment.startMs === null ? getPreviousEndMs(index) : segment.startMs + 1;
    const nextSegmentStartMs = getNextStartMs(index);
    const maxMs = nextSegmentStartMs === null ? Number.MAX_SAFE_INTEGER : nextSegmentStartMs;
    return Math.max(minMs, Math.min(nextEndMs, maxMs));
  }

  function setSegmentBoundary(index: number, boundary: "startMs" | "endMs", value: number | null) {
    updateSegment(index, (currentSegment) => ({
      ...currentSegment,
      [boundary]: boundary === "startMs"
        ? clampStartMs(index, value)
        : clampEndMs(index, value),
    }));
  }

  function nudgeSegmentBoundary(index: number, boundary: "startMs" | "endMs", deltaMs: number) {
    const segment = segments[index];
    const currentValue = segment?.[boundary] ?? null;
    const baseMs = currentValue ?? currentMs;
    setSegmentBoundary(index, boundary, Math.max(baseMs + deltaMs, 0));
  }

  async function togglePlayback() {
    const media = getMediaElement();
    if (!media) {
      return;
    }

    if (media.paused) {
      try {
        await media.play();
      } catch {
        toast.error("Playback could not start.");
      }
      return;
    }

    media.pause();
    setPlaybackTarget(null);
  }

  return (
    <section className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Review Editor</h2>
          <p className="mt-1 text-sm text-slate-500">Uploader edits the review payload. Admin signs off on the latest seeded content.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClasses(editorState.reviewStatus)}`}>
          {formatStatus(editorState.reviewStatus)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
        <p>Uploader: <span className="font-medium text-slate-900">{clipOwnerId}</span></p>
        <p>Current user: <span className="font-medium text-slate-900">{currentUserEmail}</span></p>
        <p>Seeded from job: <span className="font-medium text-slate-900">{editorState.sourceJobId}</span></p>
        <p>Last reseed: <span className="font-medium text-slate-900">{lastReseededLabel ?? "-"}</span></p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{editorState.hasManualChanges ? "Manual edits saved" : "No manual edits yet"}</span>
        <span>Updated by {editorState.updatedBy ?? "system"}</span>
        <button
          type="button"
          onClick={() => {
            void refreshFromServer().catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : "Failed to refresh editor state");
            });
          }}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Refresh state
        </button>
      </div>

      <div className="mt-5 space-y-5">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Thumbnail</h3>
            <p className="text-xs text-slate-600">
              Source <span className="rounded-full border border-slate-300 bg-white px-2 py-1 font-medium text-slate-900">{thumbnailSource}</span>
            </p>
          </div>
          <input
            value={thumbnailPath}
            onChange={(event) => updateThumbnailPath(event.target.value)}
            disabled={!canEdit || isSaving}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            placeholder="clips/clip_id/jobs/job_id/poster.jpg"
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Segments</h3>
          {hasPlaybackMedia ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Playback assist</p>
                  <p className="mt-1 text-sm text-slate-600">Scrub once, then set boundaries from the current playhead or preview a single segment.</p>
                </div>
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
                  <p>Playhead {formatDurationMs(currentMs)}</p>
                  <p>{activeSegment ? `Active segment ${activeSegment.index + 1}` : "No active segment"}</p>
                </div>
              </div>

              {hasVideo ? (
                <video
                  ref={videoRef}
                  controls
                  preload="metadata"
                  src={normalizedVideoUrl ?? undefined}
                  poster={posterUrl ?? undefined}
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-black"
                  onTimeUpdate={(event) => {
                    syncPlayerState(event.currentTarget);
                  }}
                  onSeeked={(event) => {
                    syncPlayerState(event.currentTarget);
                  }}
                  onLoadedMetadata={(event) => {
                    syncPlayerState(event.currentTarget);
                  }}
                  onPause={() => {
                    setPlaybackTarget(null);
                  }}
                />
              ) : hasWav ? (
                <audio
                  ref={audioRef}
                  controls
                  preload="metadata"
                  src={wavUrl ?? undefined}
                  className="mt-4 w-full"
                  onTimeUpdate={(event) => {
                    syncPlayerState(event.currentTarget);
                  }}
                  onSeeked={(event) => {
                    syncPlayerState(event.currentTarget);
                  }}
                  onLoadedMetadata={(event) => {
                    syncPlayerState(event.currentTarget);
                  }}
                  onPause={() => {
                    setPlaybackTarget(null);
                  }}
                />
              ) : null}

              <div className="mt-4 space-y-3">
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Scrub timeline</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(durationMs, 1)}
                    step={50}
                    value={Math.min(currentMs, Math.max(durationMs, 1))}
                    onChange={(event) => {
                      setPlaybackTarget(null);
                      seekToMs(Number(event.target.value));
                    }}
                    className="w-full accent-cyan-700"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      void togglePlayback();
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Play or pause
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaybackTarget(null);
                      seekToMs(currentMs - 500);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    -0.5s
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaybackTarget(null);
                      seekToMs(currentMs + 500);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    +0.5s
                  </button>
                  <span className="text-slate-500">Duration {formatDurationMs(durationMs || null)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
              No playback artifact is available for this payload yet, so timing edits fall back to raw values.
            </div>
          )}

          <div className="mt-4 space-y-4">
            {segments.map((segment, index) => (
              <div
                key={segment.index}
                className={`rounded-2xl border bg-white p-4 transition ${activeSegmentIndex === index ? "border-cyan-300 ring-2 ring-cyan-100" : "border-slate-200"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Segment {segment.index + 1}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDurationMs(segment.startMs)} - {formatDurationMs(segment.endMs)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeSegmentIndex === index ? (
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-800">Live</span>
                    ) : null}
                    <p className="text-xs text-slate-600">
                      Translation source <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 font-medium text-slate-900">{segment.translation.source}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    disabled={!hasPlaybackMedia || segment.startMs === null}
                    onClick={() => {
                      setPlaybackTarget(null);
                      seekToMs(segment.startMs ?? 0);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Jump to start
                  </button>
                  <button
                    type="button"
                    disabled={!hasPlaybackMedia || segment.endMs === null}
                    onClick={() => {
                      setPlaybackTarget(null);
                      seekToMs(segment.endMs ?? 0);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Jump to end
                  </button>
                  <button
                    type="button"
                    disabled={!hasPlaybackMedia || segment.startMs === null || segment.endMs === null}
                    onClick={() => {
                      void playSegment(index);
                    }}
                    className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-1.5 font-semibold text-cyan-900 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Play segment
                  </button>
                  <button
                    type="button"
                    disabled={!hasPlaybackMedia || !canEdit || isSaving}
                    onClick={() => {
                      setSegmentBoundary(index, "startMs", currentMs);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Set start to playhead
                  </button>
                  <button
                    type="button"
                    disabled={!hasPlaybackMedia || !canEdit || isSaving}
                    onClick={() => {
                      setSegmentBoundary(index, "endMs", currentMs);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Set end to playhead
                  </button>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Thai text</span>
                    <textarea
                      value={segment.text}
                      onChange={(event) => {
                        updateSegment(index, (currentSegment) => ({
                          ...currentSegment,
                          text: event.target.value,
                        }));
                      }}
                      disabled={!canEdit || isSaving}
                      className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">English text</span>
                    <textarea
                      value={segment.translation.englishText}
                      onChange={(event) => {
                        updateSegment(index, (currentSegment) => ({
                          ...currentSegment,
                          translation: {
                            ...toManualSource(currentSegment.translation),
                            englishText: event.target.value,
                          },
                        }));
                      }}
                      disabled={!canEdit || isSaving}
                      className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Start ms</span>
                    <input
                      type="number"
                      min={0}
                      value={segment.startMs ?? ""}
                      onChange={(event) => {
                        setSegmentBoundary(index, "startMs", event.target.value === "" ? null : Number(event.target.value));
                      }}
                      disabled={!canEdit || isSaving}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <button
                        type="button"
                        disabled={!canEdit || isSaving}
                        onClick={() => {
                          nudgeSegmentBoundary(index, "startMs", -100);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        -100ms
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit || isSaving}
                        onClick={() => {
                          nudgeSegmentBoundary(index, "startMs", 100);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        +100ms
                      </button>
                      <span>{formatDurationMs(segment.startMs)}</span>
                    </div>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">End ms</span>
                    <input
                      type="number"
                      min={0}
                      value={segment.endMs ?? ""}
                      onChange={(event) => {
                        setSegmentBoundary(index, "endMs", event.target.value === "" ? null : Number(event.target.value));
                      }}
                      disabled={!canEdit || isSaving}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <button
                        type="button"
                        disabled={!canEdit || isSaving}
                        onClick={() => {
                          nudgeSegmentBoundary(index, "endMs", -100);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        -100ms
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit || isSaving}
                        onClick={() => {
                          nudgeSegmentBoundary(index, "endMs", 100);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        +100ms
                      </button>
                      <span>{formatDurationMs(segment.endMs)}</span>
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canEdit || isSaving}
          onClick={() => {
            void saveEdits();
          }}
          className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Saving..." : canEdit ? "Save edits" : "Uploader can edit"}
        </button>

        {canReview ? (
          <>
            <button
              type="button"
              disabled={decisionPending !== null}
              onClick={() => {
                void setReviewDecision("approved");
              }}
              className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {decisionPending === "approved" ? "Saving..." : "Approve"}
            </button>
            <button
              type="button"
              disabled={decisionPending !== null}
              onClick={() => {
                void setReviewDecision("needs_fixes");
              }}
              className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {decisionPending === "needs_fixes" ? "Saving..." : "Needs fixes"}
            </button>
            <button
              type="button"
              disabled={decisionPending !== null}
              onClick={() => {
                void setReviewDecision("rejected");
              }}
              className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {decisionPending === "rejected" ? "Saving..." : "Reject"}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
