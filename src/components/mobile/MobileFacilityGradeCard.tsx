import type { CareCategory } from "@/lib/types";
import { TrackedProfileLink } from "@/components/analytics/TrackedProfileLink";

const STATE_SLUG: Record<string, string> = { CA: "california" };

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
};

function MobileGradeBar({
  label,
  pct,
  warn,
}: {
  label: string;
  pct: number | null;
  warn?: boolean;
}) {
  const w = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
  return (
    <div className="m-bar">
      <span className="lbl">{label}</span>
      <span className="track">
        <span className={warn ? "fill warn" : "fill"} style={{ width: `${w}%` }} />
      </span>
      <span className="pct">{pct != null ? Math.round(pct) : "—"}</span>
    </div>
  );
}

export function MobileFacilityGradeCard({ facility }: { facility: MobileGradeFacility }) {
  const stateSlug = STATE_SLUG[facility.state_code] ?? facility.state_code.toLowerCase();
  const profileUrl = `/${stateSlug}/${facility.city_slug}/${facility.slug}`;

  return (
    <article className="m-facility">
      <div className="m-fc-head">
        <div className="m-fc-photo" aria-hidden />
        <div className="min-w-0">
          <h3 className="m-fc-name">{facility.name}</h3>
          <div className="m-fc-loc">{facility.city ? `${facility.city}, CA` : "California"}</div>
          <div className="m-fc-meta">
            {facility.license_number && <span className="lic">LIC# {facility.license_number}</span>}
            {facility.beds != null && facility.beds > 0 && <span>Cap. {facility.beds}</span>}
            <span>{facility.care_category.replace(/_/g, " ")}</span>
          </div>
        </div>
      </div>
      <div className="m-fc-grade">
        <div className="m-bars">
          <MobileGradeBar label="Severity" pct={facility.sev_pct} />
          <MobileGradeBar label="Repeat rate" pct={facility.rep_pct} />
          <MobileGradeBar label="Frequency" pct={facility.freq_pct} warn />
        </div>
      </div>
      <div className="m-fc-foot">
        <span>CA CDSS · Community Care Licensing</span>
        <TrackedProfileLink
          href={profileUrl}
          facilityId={facility.id}
          className="text-teal no-underline font-medium hover:text-teal-deep"
        >
          View profile →
        </TrackedProfileLink>
      </div>
    </article>
  );
}
