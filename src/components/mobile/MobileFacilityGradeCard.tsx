import type { CareCategory } from "@/lib/types";
import { TrackedProfileLink } from "@/components/analytics/TrackedProfileLink";
import { peerMedianLines } from "@/lib/facility/pageCopy";
import { REGULATOR_ABBR } from "@/lib/seo/meta";
import { stateFromCode } from "@/lib/states";

export type MobileGradeFacility = {
  id: string;
  name: string;
  city: string | null;
  state_code: string;
  slug: string;
  city_slug: string;
  license_number?: string | null;
  beds?: number | null;
  care_category: CareCategory;
  grade: string | null;
  composite: number | null;
  sev_pct: number | null;
  rep_pct: number | null;
  freq_pct: number | null;
  severityValue?: number | null;
  severityPeerMedian?: number | null;
  repeatsValue?: number | null;
  repeatsPeerMedian?: number | null;
  frequencyValue?: number | null;
  frequencyPeerMedian?: number | null;
};

export function MobileFacilityGradeCard({ facility }: { facility: MobileGradeFacility }) {
  const stateInfo = stateFromCode(facility.state_code);
  const stateSlug = stateInfo?.slug ?? facility.state_code.toLowerCase();
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
    <TrackedProfileLink href={profileUrl} facilityId={facility.id} className="m-facility block no-underline">
      <div className="m-fc-head">
        <div className="m-fc-photo" aria-hidden />
        <div className="min-w-0">
          <h3 className="m-fc-name">{facility.name}</h3>
          <div className="m-fc-loc">{facility.city ? `${facility.city}, ${facility.state_code}` : stateInfo?.name ?? facility.state_code}</div>
          <div className="m-fc-meta">
            {facility.license_number && <span className="lic">LIC# {facility.license_number}</span>}
            {facility.beds != null && facility.beds > 0 && <span>Cap. {facility.beds}</span>}
            <span>{facility.care_category.replace(/_/g, " ")}</span>
          </div>
        </div>
      </div>
      {lines.length > 0 ? (
        <div className="m-fc-grade">
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-snug text-ink-2">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="m-fc-peer-note">
            Not medical advice. The figures compare published inspections with similar-size homes.
          </p>
        </div>
      ) : null}
      <div className="m-fc-foot">
        <span>{stateInfo?.name ?? facility.state_code} · public inspection data</span>
        <span className="text-teal font-medium">View profile →</span>
      </div>
    </TrackedProfileLink>
  );
}
