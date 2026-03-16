"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type RetryJobButtonProps = {
  jobId: string;
  warningMessage?: string | null;
};

type RetryResponse = {
  message?: string;
};

export default function RetryJobButton({ jobId, warningMessage }: RetryJobButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={async () => {
        if (warningMessage && !window.confirm(warningMessage)) {
          return;
        }

        setIsPending(true);

        try {
          const response = await fetch(`/api/admin/jobs/${jobId}/retry`, {
            method: "POST",
          });

          const payload = await response.json() as RetryResponse;
          if (!response.ok) {
            throw new Error(payload.message ?? "Failed to start retry");
          }

          toast.success(payload.message ?? `Retry started for job ${jobId}.`);
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to start retry");
        } finally {
          setIsPending(false);
        }
      }}
      className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Retrying..." : "Retry"}
    </button>
  );
}
