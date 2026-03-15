"use client";

import { useState } from "react";

type RenderIdProps = {
  value: string;
  className?: string;
  prefixChars?: number;
  suffixChars?: number;
};

function truncateId(value: string, prefixChars: number, suffixChars: number): string {
  if (value.length <= prefixChars + suffixChars + 1) {
    return value;
  }

  return `${value.slice(0, prefixChars)}...${value.slice(-suffixChars)}`;
}

export default function RenderId({
  value,
  className,
  prefixChars = 8,
  suffixChars = 6,
}: RenderIdProps) {
  const [copied, setCopied] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const displayValue = truncateId(value, prefixChars, suffixChars);

  return (
    <span className="relative inline-flex">
      {tooltipVisible ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg"
        >
          {value}
        </span>
      ) : null}
      <button
        type="button"
        className={`inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-left text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 ${className ?? ""}`}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1100);
          } catch {
            setCopied(false);
          }
        }}
        aria-label={`Copy id ${value}`}
      >
        <span>{copied ? "Copied" : displayValue}</span>
      </button>
    </span>
  );
}
