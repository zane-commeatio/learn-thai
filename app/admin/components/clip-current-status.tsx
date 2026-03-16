import JobFailureBadge from "./job-failure-badge";
import JobStageBadge from "./job-stage-badge";
import JobStateBadge from "./job-state-badge";
import RetryJobButton from "./retry-job-button";

type ClipCurrentStatusProps = {
  status: {
    jobId: string;
    state: string;
    stage: string;
    updatedAtLabel: string;
    failureTooltip: string | null;
    failureMessage: string | null;
    canRetry: boolean;
  } | null;
  retryWarningMessage?: string | null;
};

export default function ClipCurrentStatus({ status, retryWarningMessage }: ClipCurrentStatusProps) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
      <h2 className="text-xl font-semibold text-ink">Current Status</h2>
      {status ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {status.failureTooltip ? (
              <JobFailureBadge tooltip={status.failureTooltip} />
            ) : (
              <JobStateBadge state={status.state} />
            )}
            <JobStageBadge stage={status.stage} />
            <span className="text-slate-600">Updated {status.updatedAtLabel}</span>
            {status.canRetry ? <RetryJobButton jobId={status.jobId} warningMessage={retryWarningMessage} /> : null}
          </div>
          {status.failureMessage ? <p className="text-sm text-rose-700">Error: {status.failureMessage}</p> : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No jobs yet for this clip.</p>
      )}
    </section>
  );
}
