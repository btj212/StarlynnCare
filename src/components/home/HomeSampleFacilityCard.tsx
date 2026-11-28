import Link from "next/link";
import type { HomeSampleFacility } from "@/components/home/homeSampleFacilityTypes";
import { peerMedianLines } from "@/lib/facility/pageCopy";
import { REGULATOR_ABBR } from "@/lib/seo/meta";
import { stateFromCode } from "@/lib/states";

export function HomeSampleFacilityCard({ facility }: { facility: HomeSampleFacility }) {
  const stateInfo = stateFromCode(facility.state_code);
  const stateSlug = stateInfo?.slug ?? facility.state_code.toLowerCase();
  const stateName = stateInfo?.name ?? facility.state_code;
  const profileUrl = `/${stateSlug}/${facility.city_slug}/${facility.slug}`;
  const lines = peerMedianLines({
    agencyShort: REGULATOR_ABBR[facility.state_code] ?? "state",
    windowMonths: 36,
    severityValue: facility.severityValue,
    severityPeerMedian: facility.severityPeerMedian,
    repeatsValue: facility.repeatsValue,
    repeatsPeerMedian: facility.repeatsPeerMedian,
    frequencyValue: facility.frequencyValue,
    frequencyPeerMedian: facility.frequencyPeerMedian,
  });

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
      </div>

      {lines.length > 0 ? (
        <div className="flex flex-col gap-3 bg-clearing-bg p-4 sm:p-6">
          <ul className="m-0 flex list-none flex-col gap-2 p-0 font-[family-name:var(--font-sans)] text-[13px] leading-snug text-ink-2">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="m-0 pt-1 text-[11px] leading-relaxed text-ink-4">
            Not medical advice. The figures compare published inspections with similar-size homes.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col items-start gap-2 border-t border-clearing-rule-3 bg-clearing-tint px-4 py-3.5 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-[22px] sm:text-[13px]">
        <span className="text-balance">Source: {stateName} state agency · public inspection data</span>
        <Link href={profileUrl} className="text-teal no-underline font-medium hover:text-teal-deep shrink-0">
          View full profile →
        </Link>
      </div>
    </div>
  );
}
