import { getJobStateClassName } from "../lib/job-presenters";

type JobStateBadgeProps = {
  state: string;
  className?: string;
};

export default function JobStateBadge({ state, className }: JobStateBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getJobStateClassName(state)} ${className ?? ""}`.trim()}>
      {state}
    </span>
  );
}
