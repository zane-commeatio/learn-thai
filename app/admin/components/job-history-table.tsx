import RenderId from "../../components/render-id";
import JobFailureBadge from "./job-failure-badge";
import JobStageBadge from "./job-stage-badge";
import JobStateBadge from "./job-state-badge";
import RetryJobButton from "./retry-job-button";

type JobHistoryTableProps = {
  jobs: Array<{
    id: string;
    state: string;
    stage: string;
    updatedAtLabel: string;
    failureTooltip: string | null;
    canRetry: boolean;
  }>;
  retryWarningMessage?: string | null;
};

export default function JobHistoryTable({ jobs, retryWarningMessage }: JobHistoryTableProps) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
      <h2 className="text-xl font-semibold text-ink">Job History</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">Job</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-slate-100">
                <td className="px-3 py-3 font-medium text-slate-800"><RenderId value={job.id} /></td>
                <td className="px-3 py-3">
                  {job.failureTooltip ? <JobFailureBadge tooltip={job.failureTooltip} /> : <JobStateBadge state={job.state} />}
                </td>
                <td className="px-3 py-3"><JobStageBadge stage={job.stage} /></td>
                <td className="px-3 py-3 text-slate-600">{job.updatedAtLabel}</td>
                <td className="px-3 py-3">
                  {job.canRetry ? <RetryJobButton jobId={job.id} warningMessage={retryWarningMessage} /> : <span className="text-xs text-slate-400">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {jobs.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No jobs yet for this clip.</p>
      ) : null}
    </section>
  );
}
