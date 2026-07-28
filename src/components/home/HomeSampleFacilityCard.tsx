import Link from "next/link";
import type { HomeSampleFacility } from "@/components/home/homeSampleFacilityTypes";
import { peerRankBarFillCss } from "@/lib/peerRankBar";
import { stateFromCode } from "@/lib/states";

export function GradeBar({ label, pct }: { label: string; pct: number | null }) {
  const w = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
  const fillColor = peerRankBarFillCss(pct);
  return (
    <div className="flex flex-col gap-1.5 text-[13px] min-w-0 sm:grid sm:grid-cols-[minmax(0,5.5rem)_1fr_2.75rem] sm:items-center sm:gap-2.5">
      <div className="flex items-center justify-between gap-2 min-w-0 sm:contents">
        <span className="text-ink-2 shrink-0">{label}</span>
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 text-right tracking-[0.04em] tabular-nums sm:order-3">
          {pct != null ? Math.round(pct) : "—"}
        </span>
      </div>
      <span
        className="relative h-2 min-w-0 overflow-hidden rounded-full sm:order-2"
        style={{ background: "#EEF1EC" }}
      >
        <span
          className="absolute top-0 bottom-0 left-0 rounded-full"
          style={{ width: `${w}%`, background: fillColor }}
        />
      </span>
    </div>
  );
}

export function HomeSampleFacilityCard({ facility }: { facility: HomeSampleFacility }) {
  const stateInfo = stateFromCode(facility.state_code);
  const stateSlug = stateInfo?.slug ?? facility.state_code.toLowerCase();
  const stateName = stateInfo?.name ?? facility.state_code;
  const profileUrl = `/${stateSlug}/${facility.city_slug}/${facility.slug}`;
  const composite = facility.composite != null ? Math.round(facility.composite) : null;

  return (
    <div className="overflow-hidden rounded-[22px] border border-clearing-rule-2 bg-clearing-card shadow-[var(--shadow-feature)]">
      <div className="grid grid-cols-1 items-start gap-4 border-b border-clearing-rule-3 p-4 sm:grid-cols-[1fr_auto] sm:p-[26px]">
        <div>
          <h3 className="m-0 mb-1 font-[family-name:var(--font-display)] text-[22px] leading-[1.05] tracking-[-0.005em] sm:text-[26px]">
            {facility.name}
          </h3>
          <div className="text-[13.5px] text-ink-3">
            {facility.city}, {facility.state_code}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-3">
            {facility.license_number && (
              <span className="font-medium text-teal">LIC# {facility.license_number}</span>
            )}
            {facility.beds && <span>Capacity {facility.beds}</span>}
            <span className="uppercase">{facility.care_category.replace(/_/g, " ")}</span>
          </div>
        </div>
        {composite != null && (
          <div
            className="justify-self-start rounded-full px-2.5 py-1 font-[family-name:var(--font-sans)] text-[12px] font-semibold sm:justify-self-end"
            style={{ background: "var(--color-clearing-chip)", color: "var(--color-teal)" }}
          >
            Top {Math.max(1, 100 - composite)}%
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 bg-clearing-bg p-4 sm:p-6">
        <div className="mb-1 border-b border-clearing-rule-3 pb-1">
          <p className="m-0 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.12em] text-teal">
            Peer-relative percentiles · higher is better
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-[family-name:var(--font-mono)] text-[10px] text-ink-4 list-none p-0 m-0">
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0" style={{ background: "var(--color-grade-a)" }} aria-hidden />
              Upper third
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0" style={{ background: "var(--color-gold)" }} aria-hidden />
              Middle third
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0" style={{ background: "var(--color-grade-f)" }} aria-hidden />
              Lower third
            </li>
          </ul>
        </div>
        <GradeBar label="Severity" pct={facility.sev_pct} />
        <GradeBar label="Repeat rate" pct={facility.rep_pct} />
        <GradeBar label="Frequency" pct={facility.freq_pct} />
        <p className="text-[11px] leading-relaxed text-ink-4 m-0 pt-1">
          Not medical advice. Percentiles summarize published inspections versus peers — same methodology as full
          facility profiles.
        </p>
      </div>

      <div className="flex flex-col items-start gap-2 border-t border-clearing-rule-3 bg-clearing-tint px-4 py-3.5 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-[22px] sm:text-[13px]">
        <span className="text-balance">Source: {stateName} state agency · public inspection data</span>
        <Link href={profileUrl} className="text-teal no-underline font-medium hover:text-teal-deep shrink-0">
          View full profile →
        </Link>
      </div>
    </div>
  );
}
