import Link from "next/link";
import type { BenchmarkTier } from "@/lib/benchmarks";

interface BenchmarkRowProps {
  label: string;
  explanation: string;
  /** The primary value to display as the headline number/text */
  thisValue: string;
  /** Secondary context string, e.g. "County median: 0.09" */
  context?: string;
  tier: BenchmarkTier;
}

const TIER_CONFIG: Record<
  BenchmarkTier,
  { label: string; barClass: string; badgeClass: string; dotClass: string }
> = {
  strong: {
    label: "Strong",
    barClass: "bg-teal",
    badgeClass: "bg-teal-light text-teal border border-teal/20",
    dotClass: "bg-teal",
  },
  mixed: {
    label: "Mixed",
    barClass: "bg-amber",
    badgeClass: "bg-amber-light text-amber border border-amber/30",
    dotClass: "bg-amber",
  },
  concerns: {
    label: "Concerns",
    barClass: "bg-red-400",
    badgeClass: "bg-red-light text-red-600 border border-red-200",
    dotClass: "bg-red-400",
  },
  informational: {
    label: "For reference",
    barClass: "bg-slate-300",
    badgeClass: "bg-sc-border text-slate border border-sc-border",
    dotClass: "bg-slate-400",
  },
};

export function BenchmarkRow({
  label,
  explanation,
  thisValue,
  context,
  tier,
}: BenchmarkRowProps) {
  const cfg = TIER_CONFIG[tier];

  return (
    <div className="flex flex-col gap-2 py-4 border-b border-sc-border/60 last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
      {/* Left: indicator dot + label */}
      <div className="flex items-start gap-3 sm:w-52 shrink-0">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dotClass}`}
          aria-hidden
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink leading-snug">
            {label}
          </p>
          <p className="mt-0.5 text-xs text-muted leading-snug">{explanation}</p>
        </div>
      </div>

      {/* Right: values + tier badge */}
      <div className="flex flex-1 items-center justify-between gap-3 pl-5 sm:pl-0">
        <div>
          <p className="text-sm font-semibold text-ink">{thisValue}</p>
          {context && <p className="text-xs text-muted mt-0.5">{context}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badgeClass}`}
          >
            {cfg.label}
          </span>
          <Link
            href="/methodology"
            className="text-xs text-muted hover:text-teal underline-offset-2 hover:underline"
            title="How we calculate this"
          >
            ?
          </Link>
        </div>
      </div>
    </div>
  );
}
