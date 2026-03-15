export function getJobStageClassName(stage: string): string {
  if (stage === "audio") {
    return "bg-blue-100 text-blue-700";
  }
  if (stage === "asr") {
    return "bg-indigo-100 text-indigo-700";
  }
  if (stage === "segment") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (stage === "translate") {
    return "bg-cyan-100 text-cyan-700";
  }
  if (stage === "finalize") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-200 text-slate-700";
}

export function getJobStateClassName(state: string): string {
  if (state === "processing" || state === "in_progress") {
    return "bg-blue-100 text-blue-700";
  }
  if (state === "needs_review" || state === "completed") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (state === "failed") {
    return "bg-rose-100 text-rose-700";
  }
  if (state === "manual_intervention") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-200 text-slate-700";
}

export function isRetryableJobState(state: string): boolean {
  return state === "failed" || state === "manual_intervention";
}

export function getJobFailureTooltip(errorPayload: unknown): string {
  if (!errorPayload || typeof errorPayload !== "object") {
    return "No failure details available";
  }

  const payload = errorPayload as { code?: unknown; message?: unknown };
  const code = typeof payload.code === "string" && payload.code.length > 0
    ? payload.code
    : "unknown_error";
  const message = typeof payload.message === "string" && payload.message.length > 0
    ? payload.message
    : "No error message provided";

  return `${code}: ${message}`;
}

export function getJobFailureMessage(errorPayload: unknown): string {
  if (!errorPayload || typeof errorPayload !== "object") {
    return "No error message provided";
  }

  const payload = errorPayload as { message?: unknown };
  if (typeof payload.message === "string" && payload.message.length > 0) {
    return payload.message;
  }

  return "No error message provided";
}

export function serializeJobFailurePayload(errorPayload: unknown): string {
  try {
    return JSON.stringify(errorPayload, null, 2);
  } catch {
    return String(errorPayload);
  }
}

export function formatJobUpdatedAt(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null || ms < 0) {
    return "--:--.---";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  const millis = (ms % 1000).toString().padStart(3, "0");
  return `${minutes}:${seconds}.${millis}`;
}
