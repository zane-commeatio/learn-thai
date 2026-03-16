"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trackLearnerEvent } from "./learner-analytics";
import type { LearnerFeedResponse } from "./learner-feed-types";

async function fetchLearnerFeed(): Promise<LearnerFeedResponse> {
  const response = await fetch("/api/learner/feed", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load learner feed.");
  }

  return response.json() as Promise<LearnerFeedResponse>;
}

export default function LearnerFeedClient() {
  const feedQuery = useQuery({
    queryKey: ["learner-feed"],
    queryFn: fetchLearnerFeed,
  });
  const hasTrackedFeedLoadRef = useRef(false);

  useEffect(() => {
    if (!feedQuery.isSuccess || hasTrackedFeedLoadRef.current) {
      return;
    }

    trackLearnerEvent({
      name: "feed_loaded",
    });
    hasTrackedFeedLoadRef.current = true;
  }, [feedQuery.isSuccess]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:justify-center lg:px-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/5">
        <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.28),_transparent_48%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,1))] px-5 pb-6 pt-5">
          <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(148,163,184,0.12),transparent)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                Learner MVP
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Learn Thai
              </h1>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-300">
                Published clips will land here in a single-screen feed built for phone-sized playback.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
              Internal preview
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-4">
          {feedQuery.isPending ? <LoadingState /> : null}
          {feedQuery.isError ? <ErrorState onRetry={() => void feedQuery.refetch()} /> : null}
          {feedQuery.isSuccess && feedQuery.data.items.length === 0 ? <EmptyState /> : null}
          {feedQuery.isSuccess && feedQuery.data.items.length > 0 ? (
            <FeedList items={feedQuery.data.items} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 h-7 w-44 animate-pulse rounded-full bg-white/10" />
        <div className="mt-2 h-4 w-52 animate-pulse rounded-full bg-white/10" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04]"
        >
          <div className="aspect-[9/16] animate-pulse bg-white/8" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-white/10" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-white/10" />
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col justify-between gap-4 rounded-[1.75rem] border border-dashed border-cyan-400/30 bg-cyan-400/10 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
          Feed ready
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
          No published clips yet
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          The learner shell is live and waiting on the published clip feed. Once learner-ready versions exist,
          items from `/api/learner/feed` will render here without changing the route shell.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
        Desktop preview stays functional, but the spacing and card proportions are tuned for mobile viewport behavior.
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center rounded-[1.75rem] border border-rose-400/30 bg-rose-400/10 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-200">
        Feed error
      </p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
        The learner feed did not load
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-200">
        Check the learner API route and published clip read model, then retry.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex w-fit items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-100"
      >
        Retry feed
      </button>
    </div>
  );
}

function FeedList({ items }: { items: LearnerFeedResponse["items"] }) {
  const [activeClipKey, setActiveClipKey] = useState<string | null>(null);
  const visibilityRatiosRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (items.length === 0) {
      setActiveClipKey(null);
      visibilityRatiosRef.current.clear();
      return;
    }

    const firstClipKey = getClipKey(items[0]);

    setActiveClipKey((currentKey) => {
      if (currentKey && items.some((item) => getClipKey(item) === currentKey)) {
        return currentKey;
      }

      return firstClipKey;
    });
  }, [items]);

  const handleVisibilityChange = (clipKey: string, ratio: number) => {
    visibilityRatiosRef.current.set(clipKey, ratio);

    let nextActiveClipKey = activeClipKey;
    let highestRatio = 0;

    for (const item of items) {
      const candidateKey = getClipKey(item);
      const candidateRatio = visibilityRatiosRef.current.get(candidateKey) ?? 0;

      if (candidateRatio > highestRatio) {
        highestRatio = candidateRatio;
        nextActiveClipKey = candidateKey;
      }
    }

    if (highestRatio >= 0.55 && nextActiveClipKey && nextActiveClipKey !== activeClipKey) {
      setActiveClipKey(nextActiveClipKey);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, index) => (
        <ClipCard
          key={`${item.clipId}:${item.clipVersion}`}
          item={item}
          index={index}
          isActive={getClipKey(item) === activeClipKey}
          onVisibilityChange={handleVisibilityChange}
        />
      ))}
    </div>
  );
}

type ClipCardProps = {
  item: LearnerFeedResponse["items"][number];
  index: number;
  isActive: boolean;
  onVisibilityChange: (clipKey: string, ratio: number) => void;
};

function ClipCard({ item, index, isActive, onVisibilityChange }: ClipCardProps) {
  const clipKey = getClipKey(item);
  const cardRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "buffering" | "error">("loading");
  const [awaitingUserStart, setAwaitingUserStart] = useState(false);
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(false);
  const [isSlowActive, setIsSlowActive] = useState(false);
  const [canSlowPlayback, setCanSlowPlayback] = useState(true);
  const meaningText = getMeaningText(item);
  const transcriptText = getTranscriptText(item);
  const hasTranscript = transcriptText.length > 0;
  const hasTrackedImpressionRef = useRef(false);
  const hasTrackedPlayStartRef = useRef(false);

  useEffect(() => {
    const card = cardRef.current;

    if (!card) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry) {
          return;
        }

        onVisibilityChange(clipKey, entry.intersectionRatio);
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    observer.observe(card);

    return () => {
      observer.disconnect();
    };
  }, [clipKey, onVisibilityChange]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setCanSlowPlayback(typeof video.playbackRate === "number");
    enablePitchPreservingPlayback(video);
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (!isActive) {
      setIsSlowActive(false);
      resetPlaybackRate(video);
      video.pause();
      return;
    }

    void attemptPlayback(video, {
      onAutoplayBlocked: () => {
        setAwaitingUserStart(true);
      },
    });
  }, [isActive]);

  useEffect(() => {
    if (!isActive || hasTrackedImpressionRef.current) {
      return;
    }

    trackLearnerEvent({
      name: "clip_impression",
      clipId: item.clipId,
      clipVersion: item.clipVersion,
      feedPosition: index,
    });
    hasTrackedImpressionRef.current = true;
  }, [index, isActive, item.clipId, item.clipVersion]);

  const handleReplay = async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.currentTime = 0;
    setStatus("loading");
    hasTrackedPlayStartRef.current = false;
    trackLearnerEvent({
      name: "clip_replay",
      clipId: item.clipId,
      clipVersion: item.clipVersion,
      feedPosition: index,
      playbackMs: Math.round(video.currentTime * 1000),
    });
    await attemptPlayback(video, {
      onAutoplayBlocked: () => {
        setAwaitingUserStart(true);
      },
    });
  };

  const handleStartPlayback = async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setStatus("loading");
    setAwaitingUserStart(false);

    try {
      await video.play();
    } catch {
      setAwaitingUserStart(true);
    }
  };

  const handleSlowStart = () => {
    const video = videoRef.current;

    if (!video || !isActive || !canSlowPlayback || isSlowActive) {
      return;
    }

    setIsSlowActive(true);
    video.playbackRate = 0.7;
    trackLearnerEvent({
      name: "slow_hold_started",
      clipId: item.clipId,
      clipVersion: item.clipVersion,
      feedPosition: index,
      playbackMs: Math.round(video.currentTime * 1000),
    });
  };

  const handleSlowEnd = () => {
    const video = videoRef.current;

    if (!video || !isSlowActive) {
      return;
    }

    setIsSlowActive(false);
    resetPlaybackRate(video);
    trackLearnerEvent({
      name: "slow_hold_ended",
      clipId: item.clipId,
      clipVersion: item.clipVersion,
      feedPosition: index,
      playbackMs: Math.round(video.currentTime * 1000),
    });
  };

  return (
    <article
      ref={cardRef}
      className={`overflow-hidden rounded-[1.75rem] border bg-white/[0.04] transition ${
        isActive ? "border-cyan-300/70 shadow-[0_24px_64px_rgba(34,211,238,0.12)]" : "border-white/10"
      }`}
    >
      <div className="relative aspect-[9/16] bg-slate-950">
        <video
          ref={videoRef}
          src={item.videoUrl}
          poster={item.thumbnailUrl}
          playsInline
          preload={isActive ? "auto" : "metadata"}
          className="h-full w-full object-cover"
          onLoadStart={() => {
            setStatus("loading");
          }}
          onLoadedData={() => {
            setStatus("ready");
          }}
          onWaiting={() => {
            setStatus("buffering");
          }}
          onPlaying={() => {
            setAwaitingUserStart(false);
            setStatus("ready");
            if (!hasTrackedPlayStartRef.current) {
              trackLearnerEvent({
                name: "clip_play_started",
                clipId: item.clipId,
                clipVersion: item.clipVersion,
                feedPosition: index,
                playbackMs: Math.round((videoRef.current?.currentTime ?? 0) * 1000),
              });
              hasTrackedPlayStartRef.current = true;
            }
          }}
          onEnded={() => {
            setStatus("ready");
            hasTrackedPlayStartRef.current = false;
            trackLearnerEvent({
              name: "clip_play_completed",
              clipId: item.clipId,
              clipVersion: item.clipVersion,
              feedPosition: index,
              playbackMs: Math.round((videoRef.current?.currentTime ?? 0) * 1000),
            });
          }}
          onError={() => {
            setAwaitingUserStart(false);
            setStatus("error");
            trackLearnerEvent({
              name: "clip_load_failed",
              clipId: item.clipId,
              clipVersion: item.clipVersion,
              feedPosition: index,
            });
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.04),rgba(2,6,23,0.88))]" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <div className="inline-flex rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-medium text-white/90">
            Clip {index + 1}
          </div>
          <div
            className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
              isActive
                ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                : "border-white/10 bg-black/30 text-white/70"
            }`}
          >
            {isActive ? "Active" : "Queued"}
          </div>
        </div>

        {status !== "ready" ? (
          <div className="absolute inset-x-0 top-14 flex justify-center px-4">
            <div
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                status === "error"
                  ? "border-rose-300/30 bg-rose-400/15 text-rose-100"
                  : "border-white/10 bg-black/35 text-white/85"
              }`}
            >
              {status === "loading" ? "Loading clip..." : null}
              {status === "buffering" ? "Buffering..." : null}
              {status === "error" ? "Playback unavailable for this clip." : null}
            </div>
          </div>
        ) : null}

        {awaitingUserStart && status !== "error" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 p-6">
            <button
              type="button"
              onClick={() => void handleStartPlayback()}
              className="rounded-full border border-white/20 bg-white px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
            >
              Tap to start clip
            </button>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 p-6">
            <div className="max-w-[16rem] rounded-3xl border border-rose-300/25 bg-slate-950/90 p-4 text-center">
              <p className="text-sm font-semibold text-white">Clip failed to load</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Check the published media URL and try this clip again after the source is fixed.
              </p>
            </div>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {item.summary}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!hasTranscript) {
                    return;
                  }

                  setIsTranscriptVisible((currentValue) => {
                    const nextValue = !currentValue;

                    trackLearnerEvent({
                      name: nextValue ? "transcript_revealed" : "transcript_hidden",
                      clipId: item.clipId,
                      clipVersion: item.clipVersion,
                      feedPosition: index,
                      playbackMs: Math.round((videoRef.current?.currentTime ?? 0) * 1000),
                    });

                    return nextValue;
                  });
                }}
                disabled={!hasTranscript}
                className={`mt-4 w-full max-w-[16rem] rounded-3xl border px-4 py-3 text-left transition ${
                  hasTranscript
                    ? "border-white/15 bg-black/35 text-white hover:border-cyan-200/45 hover:bg-cyan-300/12"
                    : "border-white/10 bg-black/25 text-white/85"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/85">
                    {isTranscriptVisible ? "Thai transcript" : "Meaning"}
                  </span>
                  {hasTranscript ? (
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
                      Tap
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white">
                  {isTranscriptVisible ? transcriptText : meaningText}
                </p>
                {!hasTranscript ? (
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    Transcript reveal will appear once published transcript segments are available.
                  </p>
                ) : null}
              </button>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleReplay()}
                disabled={status === "error"}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-200/50 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/20 disabled:text-white/40"
              >
                Replay
              </button>
              <button
                type="button"
                onPointerDown={handleSlowStart}
                onPointerUp={handleSlowEnd}
                onPointerCancel={handleSlowEnd}
                onPointerLeave={handleSlowEnd}
                onBlur={handleSlowEnd}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    handleSlowStart();
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    handleSlowEnd();
                  }
                }}
                disabled={!isActive || status === "error" || !canSlowPlayback}
                className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isSlowActive
                    ? "border-cyan-200/70 bg-cyan-300/20 text-cyan-50"
                    : "border-white/15 bg-black/40 text-white"
                } disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/20 disabled:text-white/40`}
              >
                {canSlowPlayback ? "Hold to slow" : "Slow hold unavailable"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function getClipKey(item: LearnerFeedResponse["items"][number]) {
  return `${item.clipId}:${item.clipVersion}`;
}

function getMeaningText(item: LearnerFeedResponse["items"][number]) {
  const meaning = item.meaning?.trim();
  const summary = item.summary.trim();

  if (meaning) {
    return meaning;
  }

  if (summary) {
    return summary;
  }

  return "Meaning will appear here when the published learner payload includes it.";
}

function getTranscriptText(item: LearnerFeedResponse["items"][number]) {
  const transcriptLines = item.segments
    ?.map((segment) => segment.text.trim())
    .filter((segment) => segment.length > 0);

  return transcriptLines?.join("\n") ?? "";
}

function enablePitchPreservingPlayback(video: HTMLVideoElement) {
  if ("preservesPitch" in video) {
    video.preservesPitch = true;
  }

  if ("webkitPreservesPitch" in video) {
    (video as HTMLVideoElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
  }
}

function resetPlaybackRate(video: HTMLVideoElement) {
  video.playbackRate = 1;
}

async function attemptPlayback(
  video: HTMLVideoElement,
  options: {
    onAutoplayBlocked: () => void;
  },
) {
  try {
    await video.play();
  } catch {
    options.onAutoplayBlocked();
  }
}
