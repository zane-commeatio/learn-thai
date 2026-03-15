"use client";

import { useState } from "react";
import { getJobStateClassName } from "../lib/job-presenters";

type JobFailureBadgeProps = {
  tooltip: string;
  copyValue?: string;
  className?: string;
};

export default function JobFailureBadge({ tooltip, copyValue, className }: JobFailureBadgeProps) {
  const [copied, setCopied] = useState(false);

  const badgeClassName = `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getJobStateClassName("failed")} ${copyValue ? "cursor-copy" : ""} ${className ?? ""}`.trim();

  async function handleCopy() {
    if (!copyValue) {
      return;
    }

    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="group relative inline-flex">
      {copyValue ? (
        <button type="button" className={badgeClassName} onClick={() => void handleCopy()}>
          {copied ? "copied" : "failed"}
        </button>
      ) : (
        <span className={badgeClassName}>failed</span>
      )}
      <span className="pointer-events-none absolute -top-10 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg group-hover:block group-focus-within:block">
        {tooltip}
        {copyValue ? " (click to copy payload)" : ""}
      </span>
    </span>
  );
}
