import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import type { CareCategory } from "@/lib/types";
import {
  regulatorLicensePageFor,
  regulatorLicensePageLabel,
} from "@/lib/seo/schema";

const SHORT_CATEGORY_LABEL: Record<CareCategory, string> = {
  rcfe_memory_care: "RCFE · Memory Care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF · Memory Care",
  alf_general: "ALF",
  snf_general: "SNF",
  snf_dementia_scu: "SNF · Dementia SCU",
  ccrc: "CCRC",
  unknown: "Care Facility",
};

const MC_CATEGORIES: CareCategory[] = [
  "rcfe_memory_care",
  "alf_memory_care",
  "snf_dementia_scu",
];

function formatAddr(facility: FacilityProfile["facility"]): string {
  const stateCode = (facility.state_code ?? "").toUpperCase();
  const cityZip = [facility.city, facility.zip].filter(Boolean).join(`, ${stateCode} `);
  return [facility.street, cityZip].filter(Boolean).join(" · ");
}

function VerdictCard({ profile }: { profile: FacilityProfile }) {
  const { facility, totals, photoUrls } = profile;
  const photo = photoUrls[0] ?? null;

  // Generate verdict copy from content or derive from totals
  const copy: string = (() => {
    const beds = facility.beds ? `A ${facility.beds}-bed` : "A";
    const licType = SHORT_CATEGORY_LABEL[facility.care_category] ?? "care facility";
    if (totals.lastCitation) {
      const d = new Date(totals.lastCitation + "T12:00:00");
      const mo = d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
      const clean = totals.deficiencies === 1
        ? `one citation on file (${mo})`
        : `${totals.deficiencies} citation${totals.deficiencies === 1 ? "" : "s"} on file — most recent ${mo}`;
      return `${beds} ${licType} with ${clean}.`;
    }
    return `${beds} ${licType} with no citations on file.`;
  })();

  const lastInsp = profile.inspections.find((i) => !i.is_complaint);
  const lastInspFormatted = lastInsp?.inspection_date
    ? new Date(lastInsp.inspection_date + "T12:00:00").toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : null;

  return (
    <div className="fp-verdict bg-ink text-paper p-7 relative">
      <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-gold mb-3.5 flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
        Facility · {facility.city ?? profile.state.name}
      </div>
      <div className="grid gap-5" style={{ gridTemplateColumns: "110px 1fr" }}>
        {/* Photo or gradient placeholder */}
        <div className="relative aspect-square overflow-hidden" style={{ background: "linear-gradient(135deg, #C9D8C8 0%, #8FA89A 60%, #6F8479 100%)" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={facility.name} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.22em] text-white/70">
              Photo
            </span>
          )}
          {profile.facility.photo_attribution && (
            <span className="absolute bottom-1 left-1.5 z-10 bg-black/35 px-1.5 py-px font-[family-name:var(--font-mono)] text-[8.5px] tracking-[0.1em] text-white/85">
              {profile.facility.photo_attribution}
            </span>
          )}
        </div>
        {/* Copy */}
        <div className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] tracking-[-0.005em] text-gold-soft [&_em]:italic [&_em]:text-white">
          <span dangerouslySetInnerHTML={{ __html: copy.replace(/(citation|citations|no citations on file)/gi, "<em>$1</em>") }} />
        </div>
      </div>
      {lastInspFormatted && (
        <div className="mt-5 flex justify-between border-t border-white/15 pt-3.5 font-[family-name:var(--font-mono)] text-[10.5px] tracking-[0.06em] text-white/60">
          <span>Last inspection · {lastInspFormatted} · {totals.lastCitation ? "cited" : "clean"}</span>
          <span>Source · {profile.cfg.agencyShort}</span>
        </div>
      )}
    </div>
  );
}

export function FacilityHero({ profile }: { profile: FacilityProfile }) {
  const { facility, state } = profile;
  const isMc = MC_CATEGORIES.includes(facility.care_category) || facility.serves_memory_care;
  const addr = formatAddr(facility);

  // Split facility name into non-italic + last word italic
  const words = facility.name.trim().split(/\s+/);
  const lastWord = words.length > 1 ? words.pop() : null;
  const mainPart = words.join(" ");

  return (
    <section className="fp-hero border-b-2 border-ink px-4 py-14 md:px-8">
      <div className="mx-auto max-w-[1280px]">
        {/* Eyebrow */}
        <div className="mb-3.5 flex items-center gap-3 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-rust">
          <span className="h-px w-8 bg-rust opacity-60" />
          {state.name} · {facility.city ?? ""}
        </div>

        {/* Hero grid */}
        <div className="grid items-end gap-8 md:gap-16 md:grid-cols-[1.5fr_1fr]">
          {/* Left */}
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(44px,7vw,96px)] font-normal leading-[0.95] tracking-[-0.025em] text-ink m-0">
              {lastWord ? (
                <>
                  {mainPart} <em className="not-italic text-rust">{lastWord}.</em>
                </>
              ) : (
                <em className="not-italic text-rust">{facility.name}.</em>
              )}
            </h1>

            {/* Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="fp-tag bg-teal-soft text-teal-deep px-3 py-[5px] font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em]">
                {SHORT_CATEGORY_LABEL[facility.care_category]}
              </span>
              {facility.beds && (
                <span className="fp-tag bg-ink text-gold-soft px-3 py-[5px] font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em]">
                  {facility.beds} licensed beds · {facility.capacity_tier ?? ""}
                </span>
              )}
              {isMc && (
                <span className="fp-tag bg-teal-soft text-teal-deep px-3 py-[5px] font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em]">
                  Dementia-trained staff
                </span>
              )}
            </div>

            {/* Address */}
            {addr && (
              <div className="mt-4 font-[family-name:var(--font-display)] text-[22px] italic text-ink-2">
                {addr}
                {facility.license_number && (() => {
                  const verifyUrl = regulatorLicensePageFor(
                    facility.state_code,
                    facility.license_number,
                  );
                  const verifyLabel = regulatorLicensePageLabel(facility.state_code);
                  return verifyUrl ? (
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={verifyLabel}
                      className="ml-3 font-[family-name:var(--font-mono)] not-italic text-[11px] tracking-[0.06em] text-rust underline underline-offset-4 decoration-rust/30 hover:decoration-rust transition-colors"
                    >
                      LIC# {facility.license_number} ↗
                    </a>
                  ) : (
                    <span className="ml-3 font-[family-name:var(--font-mono)] not-italic text-[11px] tracking-[0.06em] text-rust">
                      LIC# {facility.license_number}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Verdict card */}
          <VerdictCard profile={profile} />
        </div>
      </div>
    </section>
  );
}
