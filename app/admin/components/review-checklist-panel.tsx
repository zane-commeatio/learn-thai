import type { ClipDetailViewModel } from "../clips/[clipId]/clip-detail-view-model";

type ReviewChecklist = ClipDetailViewModel["reviewChecklist"];

type ReviewChecklistPanelProps = {
  checklist: ReviewChecklist;
};

function getBadgeClasses(status: "pass" | "fail") {
  if (status === "pass") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function ReviewChecklistPanel({ checklist }: ReviewChecklistPanelProps) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white p-6 shadow-glass">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Publish-Ready Review Checklist</h2>
          <p className="mt-1 text-sm text-slate-500">{checklist.summary}</p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${checklist.isReviewReady
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"}`}
        >
          {checklist.isReviewReady ? "System-ready for review" : "Not review-ready"}
        </span>
      </div>

      <ul className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50">
        {checklist.items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="max-w-3xl">
              <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getBadgeClasses(item.status)}`}>
                {item.status}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Human Review Still Required</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {checklist.humanChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Known Gaps Before Publish Enforcement</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {checklist.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
