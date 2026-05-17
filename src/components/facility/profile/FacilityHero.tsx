import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import type { CareCategory } from "@/lib/types";
import {
  regulatorLicensePageFor,
  regulatorLicensePageLabel,
} from "@/lib/seo/schema";
import { buildFacilitySnippet } from "@/lib/seo/meta";
import { WaMcSignalBadges } from "./WaMcSignalBadges";
import { OrMcSignalBadges } from "./OrMcSignalBadges";
import { FacilityPhotoGrid } from "./FacilityPhotoGrid";

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
  const { facility, totals, photoUrls, photoSources } = profile;
  const hasGrid = photoUrls.length >= 4;
  const suggestSubject = encodeURIComponent(`Photo submission: ${facility.name}`);
  const suggestBody = encodeURIComponent(
    `Hi,\n\nI'd like to submit a photo for ${facility.name}.\n\nPlease attach the photo to this email.\n\nThank you.`,
  );
  const suggestHref = `mailto:hello@starlynncare.com?subject=${suggestSubject}&body=${suggestBody}`;

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

  const lastInsp = profile.inspections[0] ?? null;
  const lastInspFormatted = lastInsp?.inspection_date
    ? new Date(lastInsp.inspection_date + "T12:00:00").toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : null;
  const lastInspCited = (lastInsp?.total_deficiency_count ?? 0) > 0;

  return (
    <div className="fp-verdict bg-ink text-paper relative overflow-hidden">
      {/* ── Photo grid (full-width when 4+, otherwise compact) ── */}
      {hasGrid ? (
        <FacilityPhotoGrid
          photoUrls={photoUrls}
          photoSources={photoSources}
          facilityName={facility.name}
        />
      ) : null}

      <div className={hasGrid ? "p-7" : "p-7"}>
        <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-gold mb-3.5 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
          Facility · {facility.city ?? profile.state.name}
        </div>

        {/* When < 4 photos: compact side-by-side with single photo */}
        {!hasGrid ? (
          <div className="grid gap-5" style={{ gridTemplateColumns: "110px 1fr" }}>
            <div className="flex flex-col gap-1.5">
              <FacilityPhotoGrid
                photoUrls={photoUrls}
                photoSources={photoSources}
                facilityName={facility.name}
              />
              <div className="font-[family-name:var(--font-mono)] text-[10px] leading-tight opacity-50">
                <a
                  href={suggestHref}
                  className="block text-paper/70 hover:opacity-100 transition-opacity whitespace-nowrap"
                >
                  operator? submit a photo →
                </a>
              </div>
            </div>
            <div className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] tracking-[-0.005em] text-gold-soft [&_em]:italic [&_em]:text-white">
              <span dangerouslySetInnerHTML={{ __html: copy.replace(/(citation|citations|no citations on file)/gi, "<em>$1</em>") }} />
            </div>
          </div>
        ) : (
          /* When 4+ photos: full-width copy below the grid */
          <div className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] tracking-[-0.005em] text-gold-soft [&_em]:italic [&_em]:text-white">
            <span dangerouslySetInnerHTML={{ __html: copy.replace(/(citation|citations|no citations on file)/gi, "<em>$1</em>") }} />
          </div>
        )}

        {lastInspFormatted && (
          <div className="mt-5 flex justify-between border-t border-white/15 pt-3.5 font-[family-name:var(--font-mono)] text-[10.5px] tracking-[0.06em] text-white/60">
            <span>
              Last inspection · {lastInspFormatted}
              {lastInsp?.is_complaint ? " (complaint)" : ""} · {lastInspCited ? "cited" : "clean"}
            </span>
            <span>Source · {profile.cfg.agencyShort}</span>
          </div>
        )}
      </div>
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

  // Editorial prose summary — mirrors the meta description so Google has a
  // human-readable narrative line to lift even when it overrides our meta.
  // Use the most recent visit of any type for recency accuracy.
  const lastInspectionDate =
    profile.inspections[0]?.inspection_date ?? null;
  const snippet = buildFacilitySnippet({
    facilityName: facility.name,
    stateName: state.name,
    stateCode: state.code,
    grade: profile.snapshot?.grade?.letter ?? null,
    percentile: profile.snapshot?.grade?.composite_percentile ?? null,
    citationCount: profile.totals.deficiencies,
    lastInspectionDate,
    variant: "prose",
  });

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

            {/* Editorial summary — same data points as the meta snippet so
                Google has narrative prose above-the-fold to lift. */}
            {snippet && (
              <p className="mt-5 max-w-[58ch] font-[family-name:var(--font-display)] text-[19px] italic leading-[1.45] text-ink-2">
                {snippet}
              </p>
            )}

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

            {/* Limited inspection history badge */}
            {profile.limitedHistory && (
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-amber-700 border border-amber-400 px-[5px] py-[2px] rounded-[2px]">
                  Limited Inspection History · fewer than 4 records in 3 years
                </span>
              </div>
            )}

            {/* PDF-links-only badge — shown when no inspection narrative has been parsed */}
            {!profile.hasRealInspectionText && (
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-amber-700 border border-amber-400 px-[5px] py-[2px] rounded-[2px]">
                  Inspection text not parsed · PDF links only
                </span>
              </div>
            )}

            {/* WA memory-care signal badges */}
            {profile.waMcSignals && (
              <WaMcSignalBadges signals={profile.waMcSignals} />
            )}

            {/* OR memory-care signal badges */}
            {profile.orMcSignals && (
              <OrMcSignalBadges signals={profile.orMcSignals} />
            )}
          </div>

          {/* Verdict card */}
          <VerdictCard profile={profile} />
        </div>
      </div>
    </section>
  );
}
