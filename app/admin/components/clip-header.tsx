import Link from "next/link";
import RenderId from "../../components/render-id";

type ClipHeaderProps = {
  clipId: string;
  title: string;
  sourceType: string;
  rightsStatus: string;
};

export default function ClipHeader({ clipId, title, sourceType, rightsStatus }: ClipHeaderProps) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-glass backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Clip Detail</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span><RenderId value={clipId} /></span>
            <span>Source: {sourceType}</span>
            <span>Rights: {rightsStatus}</span>
          </div>
        </div>
        <Link
          href="/admin"
          className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
