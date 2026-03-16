"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import JobFailureBadge from "./components/job-failure-badge";
import JobStageBadge from "./components/job-stage-badge";
import JobStateBadge from "./components/job-state-badge";
import {
  formatJobUpdatedAt,
  getJobFailureTooltip,
  isRetryableJobState,
  serializeJobFailurePayload,
} from "./lib/job-presenters";
import RenderId from "../components/render-id";

type ClipRow = {
  id: string;
  title: string;
  sourceType: string;
  rightsStatus: string;
  updatedAt: string;
  latestJob: {
    id: string;
    state: string;
    stage: string;
    updatedAt: string;
  } | null;
};

type RunningJobRow = {
  id: string;
  clipId: string;
  state: string;
  stage: string;
  updatedAt: string;
  errorPayload?: unknown;
};

type JobRow = RunningJobRow & {
  errorPayload?: unknown;
  reviewStatus?: string | null;
  hasManualChanges?: boolean | null;
};

type UploadSuccess = {
  clipId: string;
  jobId: string;
  message: string;
};

type UploadError = {
  code?: string;
  message?: string;
  activeJobId?: string;
};

type RetrySuccess = {
  jobId: string;
  clipId: string;
  retriedFromJobId: string;
  message: string;
};

function getRetryWarningMessage(job: JobRow): string | null {
  if (job.reviewStatus && (job.reviewStatus !== "generated" || job.hasManualChanges)) {
    return "This clip already has saved review work. Retrying will start a new processing job and reseed the editor state when finalize completes, replacing manual edits and resetting the review status to generated.";
  }

  return null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function uploadWithProgress(input: {
  title: string;
  file: File;
  onProgress: (percent: number) => void;
}): Promise<UploadSuccess> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.set("title", input.title);
    formData.set("file", input.file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/clips/upload");
    request.responseType = "json";

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) {
        return;
      }

      const percent = Math.round((event.loaded / event.total) * 100);
      input.onProgress(percent);
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        input.onProgress(100);
        resolve(request.response as UploadSuccess);
        return;
      }

      reject(request.response as UploadError);
    };

    request.onerror = () => {
      reject({ code: "network_error", message: "Network error while uploading clip" } satisfies UploadError);
    };

    request.send(formData);
  });
}

export default function DashboardClient() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [latestUploadedJobId, setLatestUploadedJobId] = useState<string | null>(null);

  const clipsQuery = useQuery({
    queryKey: ["clips"],
    queryFn: () => fetchJson<{ clips: ClipRow[] }>("/api/admin/clips"),
  });

  const runningJobsQuery = useQuery({
    queryKey: ["running-jobs"],
    queryFn: () => fetchJson<{ jobs: RunningJobRow[] }>("/api/admin/jobs/running"),
    refetchInterval: 2500,
  });

  const recentJobsQuery = useQuery({
    queryKey: ["recent-jobs"],
    queryFn: () => fetchJson<{ jobs: JobRow[] }>("/api/admin/jobs/recent"),
    refetchInterval: 2500,
  });

  const uploadedJobStatusQuery = useQuery({
    queryKey: ["job", latestUploadedJobId],
    queryFn: () => fetchJson<{ job: JobRow }>(`/api/admin/jobs/${latestUploadedJobId}`),
    enabled: Boolean(latestUploadedJobId),
    refetchInterval: 2500,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("Please choose a media file to upload.");
      }

      return uploadWithProgress({
        title,
        file: selectedFile,
        onProgress: setUploadProgress,
      });
    },
    onMutate: () => {
      setUploadProgress(0);
    },
    onSuccess: (result) => {
      toast.success(`Uploaded successfully. Clip ${result.clipId} queued as job ${result.jobId}.`);
      setLatestUploadedJobId(result.jobId);
      setTitle("");
      setSelectedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      void queryClient.invalidateQueries({ queryKey: ["clips"] });
      void queryClient.invalidateQueries({ queryKey: ["running-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["recent-jobs"] });
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }

      const payload = error as UploadError;
      toast.error(payload.message ?? "Upload failed. Please try again.");
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/admin/jobs/${jobId}/retry`, {
        method: "POST",
      });

      const payload = await response.json() as RetrySuccess | UploadError;
      if (!response.ok) {
        throw payload;
      }

      return payload as RetrySuccess;
    },
    onSuccess: (result) => {
      toast.success(`Retry started: ${result.jobId} (from ${result.retriedFromJobId}).`);
      setLatestUploadedJobId(result.jobId);
      void queryClient.invalidateQueries({ queryKey: ["running-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["recent-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["job", result.retriedFromJobId] });
    },
    onError: (error) => {
      const payload = error as UploadError;
      const activeRef = payload.activeJobId ? ` Active job: ${payload.activeJobId}.` : "";
      toast.error((payload.message ?? "Failed to start retry.") + activeRef);
      if (payload.activeJobId) {
        setLatestUploadedJobId(payload.activeJobId);
      }
    },
  });

  const clipCountText = useMemo(() => {
    const count = clipsQuery.data?.clips.length ?? 0;
    return `${count} clip${count === 1 ? "" : "s"}`;
  }, [clipsQuery.data]);

  const runningCountText = useMemo(() => {
    const count = runningJobsQuery.data?.jobs.length ?? 0;
    return `${count} running job${count === 1 ? "" : "s"}`;
  }, [runningJobsQuery.data]);

  return (
    <main className="mx-auto flex w-[min(1180px,94vw)] flex-col gap-6 py-10">
      <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-glass backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Learn Thai</p>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Admin Dashboard</h1>
            <p className="text-sm text-slate-600">Upload clips with confidence and monitor the processing pipeline live.</p>
          </div>
          <form method="post" action="/api/admin/logout">
            <button className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900">
              Log out
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <article className="rounded-3xl border border-white/60 bg-gradient-to-br from-white to-slate-50 p-6 shadow-glass">
          <div className="mb-5 space-y-1">
            <h2 className="text-xl font-semibold text-ink">Upload New Clip</h2>
            <p className="text-sm text-slate-600">Drop a video and start processing instantly.</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void uploadMutation.mutateAsync();
            }}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Clip title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Bangkok street greetings"
                minLength={2}
                required
              />
            </label>

            <div
              className={`rounded-2xl border-2 border-dashed p-5 transition ${dragActive ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-white"}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  setSelectedFile(file);
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="video/*,.mp4,.mov,.mkv"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                }}
              />
              <div className="space-y-2 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Drag and drop your clip</p>
                <p>or choose a file manually.</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Choose file
                </button>
              </div>
            </div>

            {selectedFile ? (
              <div className="rounded-2xl bg-slate-900/95 px-4 py-3 text-sm text-white">
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-slate-300">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : null}

            {uploadMutation.isPending ? (
              <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center justify-between text-sm text-blue-700">
                  <span>Uploading clip</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={uploadMutation.isPending || !selectedFile || title.trim().length < 2}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload and start processing"}
            </button>
          </form>
        </article>

        <article className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
          <h2 className="text-xl font-semibold text-ink">Pipeline Activity</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Library</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{clipCountText}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Now processing</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{runningCountText}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">Running jobs refresh automatically every 2.5 seconds.</p>

          {latestUploadedJobId ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Latest upload status</p>
              <div className="mt-2">
                <RenderId value={latestUploadedJobId} />
              </div>
              {uploadedJobStatusQuery.data?.job ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <JobStateBadge state={uploadedJobStatusQuery.data.job.state} />
                  <JobStageBadge stage={uploadedJobStatusQuery.data.job.stage} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Loading status...</p>
              )}
            </div>
          ) : null}
        </article>
      </section>

      <section className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Running Jobs</h2>
          {runningJobsQuery.isFetching ? <span className="text-xs text-slate-500">Refreshing...</span> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Clip</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {(runningJobsQuery.data?.jobs ?? []).map((job) => (
                <tr key={job.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-800"><RenderId value={job.id} /></td>
                  <td className="px-3 py-3 text-slate-600"><RenderId value={job.clipId} /></td>
                  <td className="px-3 py-3">
                    {job.state === "failed" ? (
                      <JobFailureBadge
                        tooltip={getJobFailureTooltip(job.errorPayload)}
                        copyValue={job.errorPayload ? serializeJobFailurePayload(job.errorPayload) : undefined}
                      />
                    ) : (
                      <JobStateBadge state={job.state} />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <JobStageBadge stage={job.stage} />
                  </td>
                  <td className="px-3 py-3 text-slate-600">{formatJobUpdatedAt(job.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(runningJobsQuery.data?.jobs.length ?? 0) === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No jobs are currently running.</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
        <h2 className="text-xl font-semibold text-ink">All Clips</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Clip</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Rights</th>
                <th className="px-3 py-2 font-medium">Latest Job</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(clipsQuery.data?.clips ?? []).map((clip) => (
                <tr key={clip.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-800"><RenderId value={clip.id} /></td>
                  <td className="px-3 py-3 text-slate-700">{clip.title}</td>
                  <td className="px-3 py-3 text-slate-600">{clip.sourceType}</td>
                  <td className="px-3 py-3 text-slate-600">{clip.rightsStatus}</td>
                  <td className="px-3 py-3">
                    {clip.latestJob ? (
                      <div className="flex items-center gap-2">
                        <JobStateBadge state={clip.latestJob.state} />
                        <JobStageBadge stage={clip.latestJob.stage} />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No jobs yet</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{formatJobUpdatedAt(clip.updatedAt)}</td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/clips/${clip.id}`}
                      className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Open details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(clipsQuery.data?.clips.length ?? 0) === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No clips yet. Upload one to get started.</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Recent Jobs</h2>
          {recentJobsQuery.isFetching ? <span className="text-xs text-slate-500">Refreshing...</span> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Clip</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(recentJobsQuery.data?.jobs ?? []).map((job) => (
                <tr key={job.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-800"><RenderId value={job.id} /></td>
                  <td className="px-3 py-3 text-slate-600"><RenderId value={job.clipId} /></td>
                  <td className="px-3 py-3">
                    {job.state === "failed" ? (
                      <JobFailureBadge
                        tooltip={getJobFailureTooltip(job.errorPayload)}
                        copyValue={job.errorPayload ? serializeJobFailurePayload(job.errorPayload) : undefined}
                      />
                    ) : (
                      <JobStateBadge state={job.state} />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <JobStageBadge stage={job.stage} />
                  </td>
                  <td className="px-3 py-3 text-slate-600">{formatJobUpdatedAt(job.updatedAt)}</td>
                  <td className="px-3 py-3">
                    {isRetryableJobState(job.state) ? (
                      <button
                        type="button"
                        disabled={retryMutation.isPending}
                        onClick={() => {
                          const warningMessage = getRetryWarningMessage(job);
                          if (warningMessage && !window.confirm(warningMessage)) {
                            return;
                          }

                          void retryMutation.mutateAsync(job.id);
                        }}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {retryMutation.isPending ? "Retrying..." : "Retry"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(recentJobsQuery.data?.jobs.length ?? 0) === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No jobs yet.</p>
        ) : null}
      </section>
    </main>
  );
}
