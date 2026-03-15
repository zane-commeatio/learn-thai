"use client";

import { useRef, useState } from "react";

type AudioStageWidgetProps = {
  posterUrl: string | null;
  normalizedVideoUrl: string | null;
  wavUrl: string | null;
};

export default function AudioStageWidget({
  posterUrl,
  normalizedVideoUrl,
  wavUrl,
}: AudioStageWidgetProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wavRef = useRef<HTMLAudioElement | null>(null);
  const [linkPlayback, setLinkPlayback] = useState(true);

  const hasVideo = !!normalizedVideoUrl;
  const hasWav = !!wavUrl;
  const hasPoster = !!posterUrl;

  async function playSyncedFromCurrentTime() {
    const video = videoRef.current;
    const wav = wavRef.current;
    if (!video || !wav) {
      return;
    }

    wav.currentTime = video.currentTime;
    await Promise.allSettled([video.play(), wav.play()]);
  }

  function pauseBoth() {
    videoRef.current?.pause();
    wavRef.current?.pause();
  }

  function syncWavToVideo() {
    const video = videoRef.current;
    const wav = wavRef.current;
    if (!video || !wav) {
      return;
    }

    wav.currentTime = video.currentTime;
  }

  if (!hasPoster && !hasVideo && !hasWav) {
    return <p className="text-slate-600">No audio-stage artifacts are available yet.</p>;
  }

  return (
    <div className="space-y-3">
      {hasPoster ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Poster preview</p>
          <img
            src={posterUrl ?? undefined}
            alt="Clip poster frame"
            className="h-44 w-auto max-w-full rounded-lg border border-slate-200 bg-slate-100 object-cover"
          />
        </div>
      ) : null}

      {hasVideo ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Normalized video</p>
          <video
            ref={videoRef}
            controls
            preload="metadata"
            src={normalizedVideoUrl ?? undefined}
            poster={posterUrl ?? undefined}
            className="w-full max-w-2xl rounded-lg border border-slate-200 bg-black"
            onPlay={() => {
              if (!linkPlayback || !hasWav) {
                return;
              }

              const wav = wavRef.current;
              const video = videoRef.current;
              if (!wav || !video) {
                return;
              }

              wav.currentTime = video.currentTime;
              void wav.play();
            }}
            onPause={() => {
              if (!linkPlayback) {
                return;
              }

              wavRef.current?.pause();
            }}
            onSeeked={() => {
              if (!linkPlayback) {
                return;
              }

              syncWavToVideo();
            }}
          />
        </div>
      ) : null}

      {hasWav ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">WAV artifact</p>
          <audio ref={wavRef} controls preload="metadata" src={wavUrl ?? undefined} className="w-full max-w-2xl" />
        </div>
      ) : null}

      {hasVideo && hasWav ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void playSyncedFromCurrentTime();
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Play synced
          </button>
          <button
            type="button"
            onClick={pauseBoth}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Pause both
          </button>
          <button
            type="button"
            onClick={syncWavToVideo}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Sync to video time
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={linkPlayback}
              onChange={(event) => {
                setLinkPlayback(event.target.checked);
              }}
              className="rounded border-slate-300"
            />
            Keep WAV linked while using video controls
          </label>
        </div>
      ) : null}
    </div>
  );
}
