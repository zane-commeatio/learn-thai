import { getJobStageClassName } from "../lib/job-presenters";

type JobStageBadgeProps = {
  stage: string;
  className?: string;
};

export default function JobStageBadge({ stage, className }: JobStageBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getJobStageClassName(stage)} ${className ?? ""}`.trim()}>
      {stage}
    </span>
  );
}
