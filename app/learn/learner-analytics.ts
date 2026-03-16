import type { LearnerAnalyticsEvent, LearnerEventName } from "../../src/contracts/learner-analytics";

const SESSION_STORAGE_KEY = "learn-thai.learner-session-id";

type TrackLearnerEventInput = {
  name: LearnerEventName;
  clipId?: string | null;
  clipVersion?: number | null;
  feedPosition?: number | null;
  playbackMs?: number | null;
};

export function trackLearnerEvent(input: TrackLearnerEventInput) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: LearnerAnalyticsEvent = {
    sessionId: getLearnerSessionId(),
    name: input.name,
    clipId: input.clipId ?? null,
    clipVersion: input.clipVersion ?? null,
    feedPosition: input.feedPosition ?? null,
    playbackMs: input.playbackMs ?? null,
  };

  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/learner/events", blob);
    return;
  }

  void fetch("/api/learner/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  });
}

function getLearnerSessionId() {
  const existingValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY)?.trim();
  if (existingValue) {
    return existingValue;
  }

  const sessionId = window.crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}
