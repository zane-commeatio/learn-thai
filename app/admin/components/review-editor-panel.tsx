"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

  const lastReseededLabel = useMemo(() => {
    if (!editorState?.lastReseededAt) {
      return null;
    }

    return new Date(editorState.lastReseededAt).toLocaleString();
  }, [editorState?.lastReseededAt]);

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
          <div className="mt-4 space-y-4">
            {segments.map((segment, index) => (
              <div key={segment.index} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Segment {segment.index}</p>
                  <p className="text-xs text-slate-600">
                    Translation source <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 font-medium text-slate-900">{segment.translation.source}</span>
                  </p>
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
                        updateSegment(index, (currentSegment) => ({
                          ...currentSegment,
                          startMs: event.target.value === "" ? null : Number(event.target.value),
                        }));
                      }}
                      disabled={!canEdit || isSaving}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">End ms</span>
                    <input
                      type="number"
                      min={0}
                      value={segment.endMs ?? ""}
                      onChange={(event) => {
                        updateSegment(index, (currentSegment) => ({
                          ...currentSegment,
                          endMs: event.target.value === "" ? null : Number(event.target.value),
                        }));
                      }}
                      disabled={!canEdit || isSaving}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                    />
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
