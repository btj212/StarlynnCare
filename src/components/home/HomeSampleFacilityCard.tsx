import Link from "next/link";
import type { HomeSampleFacility } from "@/components/home/homeSampleFacilityTypes";
import { peerRankBarFillCss } from "@/lib/peerRankBar";

const STATE_SLUG: Record<string, string> = { CA: "california" };

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
        className="h-1.5 relative min-w-0 sm:order-2"
        style={{ background: "var(--color-paper-2)", borderRadius: 0 }}
      >
        <span
          className="absolute left-0 top-0 bottom-0"
          style={{ width: `${w}%`, background: fillColor }}
        />
      </span>
    </div>
  );
}

export function HomeSampleFacilityCard({ facility }: { facility: HomeSampleFacility }) {
  const stateSlug = STATE_SLUG[facility.state_code] ?? facility.state_code.toLowerCase();
  const profileUrl = `/${stateSlug}/${facility.city_slug}/${facility.slug}`;
  const composite = facility.composite != null ? Math.round(facility.composite) : null;

  return (
    <div className="border border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[1fr_auto] sm:p-[22px] items-start border-b border-paper-rule">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-[22px] sm:text-[26px] leading-[1.05] tracking-[-0.005em] m-0 mb-1">
            {facility.name}
          </h3>
          <div className="text-[13.5px] text-ink-3">
            {facility.city}, CA
          </div>
          <div className="flex flex-wrap gap-3 mt-2 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
            {facility.license_number && (
              <span className="text-rust">LIC# {facility.license_number}</span>
            )}
            {facility.beds && <span>Capacity {facility.beds}</span>}
            <span className="uppercase">{facility.care_category.replace(/_/g, " ")}</span>
          </div>
        </div>
        {composite != null && (
          <div
            className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-2.5 py-1 justify-self-start sm:justify-self-end"
            style={{ background: "var(--color-teal-soft)", color: "var(--color-teal-deep)" }}
          >
            Top {100 - composite}%
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 sm:p-6" style={{ background: "var(--color-paper)" }}>
        <div className="pb-1 border-b border-paper-rule mb-1">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-rust m-0">
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

      <div
        className="flex flex-col gap-2 items-start sm:flex-row sm:justify-between sm:items-center px-4 sm:px-[22px] py-3.5 border-t border-paper-rule font-[family-name:var(--font-mono)] text-[11px] sm:text-[11.5px] tracking-[0.06em] text-ink-3"
        style={{ background: "var(--color-paper-2)" }}
      >
        <span className="text-balance">Source: CA CDSS · Community Care Licensing</span>
        <Link href={profileUrl} className="text-teal no-underline font-medium hover:text-teal-deep shrink-0">
          View full profile →
        </Link>
      </div>
    </div>
  );
}
