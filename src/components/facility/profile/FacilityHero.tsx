import Link from "next/link";
import type { FacilityProfile, DeficiencyRow } from "@/lib/facility/loadFacilityProfile";
import type { CareCategory, Deficiency } from "@/lib/types";
import {
  regulatorLicensePageFor,
  regulatorLicensePageLabel,
} from "@/lib/seo/schema";
import { buildFacilitySnippet } from "@/lib/seo/meta";
import { agencyLabelForInspection } from "@/lib/states/profileConfig";
import { WaMcSignalBadges } from "./WaMcSignalBadges";
import { OrMcSignalBadges } from "./OrMcSignalBadges";
import { FacilityPhotoGrid } from "./FacilityPhotoGrid";
import { OfferTriggerButton } from "@/components/facility/offer/FacilityOfferProvider";

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
  const { facility, totals, photoUrls, photoSources, snapshot, deficienciesByInspection, inspections, cfg } = profile;
  const hasGrid = photoUrls.length >= 4;
  const suggestSubject = encodeURIComponent(`Photo submission: ${facility.name}`);
  const suggestBody = encodeURIComponent(
    `Hi,\n\nI'd like to submit a photo for ${facility.name}.\n\nPlease attach the photo to this email.\n\nThank you.`,
  );
  const suggestHref = `mailto:hello@starlynncare.com?subject=${suggestSubject}&body=${suggestBody}`;

  // Severity callout — sourced from the same snapshot metric the Peer
  // Comparison section uses (severity.value = weighted citations PER BED,
  // over the inspection window, vs. a size-matched peer group). This
  // normalizes for facility size: a 120-bed and a 20-bed facility are
  // compared per bed against peers in the same bed band, so the multiple is
  // apples-to-apples rather than penalizing larger facilities for raw volume.
  const sevMetric = snapshot?.metrics.severity ?? null;
  const sevValue = sevMetric?.value ?? null;
  const sevMedian = sevMetric?.peer_median ?? null;
  const sevPct = sevMetric?.percentile ?? null;
  const severityRatio =
    sevValue !== null && sevValue > 0 && sevMedian !== null && sevMedian > 0
      ? sevValue / sevMedian
      : null;
  // Cap display at 50× for extreme outliers; show a decimal for low multiples
  // so "2.4×" doesn't round away to "2×".
  const severityRatioDisplay =
    severityRatio === null
      ? null
      : severityRatio > 50
        ? "50+"
        : severityRatio >= 10
          ? String(Math.round(severityRatio))
          : severityRatio.toFixed(1);
  // Bidirectional signal: reward strong performers, flag weak ones. Tertiles
  // match the peer-rank bar (higher percentile = fewer weighted citations/bed).
  const sevTier: "good" | "mid" | "bad" | null =
    sevPct === null ? null : sevPct >= 67 ? "good" : sevPct <= 33 ? "bad" : "mid";
  const showSeverityCallout = !!snapshot?.has_inspections && sevTier !== null;
  const sevTierColor =
    sevTier === "good"
      ? "var(--color-grade-b)"
      : sevTier === "bad"
        ? "var(--color-rust)"
        : "var(--color-gold)";
  const sevHeadline =
    sevTier === "good"
      ? `Top ${100 - (sevPct ?? 0)}%`
      : sevTier === "bad"
        ? severityRatioDisplay !== null
          ? `${severityRatioDisplay}× peer median`
          : "Worse than most"
        : "Mid-pack";
  const sevPlain =
    sevTier === "good"
      ? `Fewer weighted citations per bed than ${sevPct}% of similar-size peers.`
      : sevTier === "bad"
        ? `More weighted citations per bed than ${100 - (sevPct ?? 0)}% of similar-size peers.`
        : "About average on weighted citations per bed for similar-size peers.";

  // Detect the most recent severe finding (sev ≥ 3 or IJ) within the last 90 days
  const cutoffStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split("T")[0];
  })();
  const recentSevereFinding: { date: string; def: DeficiencyRow; tag: { label: string; tone: string } | null } | null = (() => {
    for (const insp of inspections) {
      if (insp.inspection_date < cutoffStr) break;
      const defs = deficienciesByInspection.get(insp.id) ?? [];
      const severe = defs.find(
        (d) => d.immediate_jeopardy || (d.severity !== null && d.severity >= 3),
      );
      if (severe) {
        return {
          date: insp.inspection_date,
          def: severe,
          tag: cfg.formatSeverityTag(severe as unknown as Deficiency),
        };
      }
    }
    return null;
  })();

  const copy: string = (() => {
    const beds = facility.beds ? `A ${facility.beds}-bed` : "A";
    const licType = SHORT_CATEGORY_LABEL[facility.care_category] ?? "care facility";
    const citLabel =
      totals.deficiencies === 0
        ? "no citations on file"
        : totals.deficiencies === 1
          ? "one citation on file"
          : `${totals.deficiencies} citations on file`;
    return `${beds} ${licType} with ${citLabel}.`;
  })();

  const lastInsp = inspections[0] ?? null;
  const lastInspFormatted = lastInsp?.inspection_date
    ? new Date(lastInsp.inspection_date + "T12:00:00").toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : null;
  const lastInspCited = (lastInsp?.total_deficiency_count ?? 0) > 0;

  return (
    <div className="fp-verdict relative overflow-hidden rounded-[22px] bg-ink text-paper shadow-[var(--shadow-feature)]">
      {/* ── Photo grid (full-width when 4+, otherwise compact) ── */}
      {hasGrid ? (
        <FacilityPhotoGrid
          photoUrls={photoUrls}
          photoSources={photoSources}
          facilityName={facility.name}
        />
      ) : null}

      <div className={hasGrid ? "p-7" : "p-7"}>
        <div className="mb-3.5 flex items-center gap-2 font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
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
              <span dangerouslySetInnerHTML={{ __html: copy.replace(/(no citations on file|citations|citation)/gi, "<em>$1</em>") }} />
            </div>
          </div>
        ) : (
          /* When 4+ photos: full-width copy below the grid */
          <div className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] tracking-[-0.005em] text-gold-soft [&_em]:italic [&_em]:text-white">
            <span dangerouslySetInnerHTML={{ __html: copy.replace(/(no citations on file|citations|citation)/gi, "<em>$1</em>") }} />
          </div>
        )}

        {/* Severity callout — per-bed weighted citations vs. size-matched peers */}
        {showSeverityCallout && (
          <div className="hidden md:block mt-4 border-t border-white/15 pt-3.5">
            <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-gold/70 mb-0.5">
              Citation severity vs. similar-size peers
            </div>
            <div
              className="font-[family-name:var(--font-display)] text-[26px] leading-tight tracking-[-0.01em]"
              style={{ color: sevTierColor }}
            >
              {sevHeadline}
            </div>
            <div className="font-[family-name:var(--font-display)] text-[14px] italic leading-snug text-white/70 mt-1 max-w-[34ch]">
              {sevPlain}
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.06em] text-white/40 mt-1.5">
              {sevValue?.toFixed(2)} wtd citations/bed · peer median {sevMedian?.toFixed(2)} · {cfg.inspectionWindowMonths}-mo window
            </div>
            <Link
              href="/methodology#metrics-heading"
              className="mt-1.5 inline-block font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] text-gold/60 underline underline-offset-4 decoration-gold/30 hover:text-gold hover:decoration-gold transition-colors"
            >
              How severity is scored →
            </Link>
          </div>
        )}

        {lastInspFormatted && (
          <div className="hidden md:flex mt-5 justify-between border-t border-white/15 pt-3.5 font-[family-name:var(--font-mono)] text-[10.5px] tracking-[0.06em]">
            {recentSevereFinding ? (
              <span className="text-rust">
                Most recent severe finding ·{" "}
                {new Date(recentSevereFinding.date + "T12:00:00").toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
                {recentSevereFinding.def.code ? ` · ${cfg.citationPrefix}${recentSevereFinding.def.code}` : ""}
                {recentSevereFinding.tag ? ` · ${recentSevereFinding.tag.label}` : ""}
              </span>
            ) : (
              <span className="text-white/60">
                Last inspection · {lastInspFormatted}
                {lastInsp?.is_complaint ? " (complaint)" : ""} · {lastInspCited ? "cited" : "no findings"}
              </span>
            )}
            <span className="text-white/60">Source · {lastInsp ? agencyLabelForInspection(lastInsp, cfg).short : cfg.agencyShort}</span>
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
  const phone = facility.phone
    ? facility.phone.replace(/\D/g, "").replace(/^1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")
    : null;

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
    severityPercentile: profile.snapshot?.metrics.severity.percentile ?? null,
    frequencyPercentile: profile.snapshot?.metrics.frequency.percentile ?? null,
    repeatsPercentile: profile.snapshot?.metrics.repeats.percentile ?? null,
    citationCount: profile.totals.deficiencies,
    lastInspectionDate,
    variant: "prose",
  });

  return (
    <section className="fp-hero border-b border-clearing-rule px-4 py-9 sm:px-6 md:px-[60px] md:py-14">
      <div className="mx-auto max-w-[1280px]">
        {/* Eyebrow */}
        <div className="mb-3.5">
          <span className="clearing-chip">
            {state.name} · {facility.city ?? ""}
          </span>
        </div>

        {/* Hero grid */}
        <div className="grid items-end gap-8 md:grid-cols-[1.5fr_1fr] md:gap-16">
          {/* Left */}
          <div>
            <h1 className="m-0 font-[family-name:var(--font-display)] text-[clamp(40px,6vw,84px)] font-normal leading-[0.95] tracking-[-0.025em] text-ink">
              {lastWord ? (
                <>
                  {mainPart} <em className="not-italic text-teal">{lastWord}.</em>
                </>
              ) : (
                <em className="not-italic text-teal">{facility.name}.</em>
              )}
            </h1>

            {/* Editorial summary — same data points as the meta snippet so
                Google has narrative prose above-the-fold to lift. */}
            {snippet && (
              <p className="mt-5 hidden max-w-[58ch] font-[family-name:var(--font-sans)] text-[17px] leading-[1.55] text-ink-2 md:block sm:text-[18px]">
                {snippet}
              </p>
            )}

            {/* Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="fp-tag rounded-full bg-clearing-chip px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-semibold text-teal">
                {SHORT_CATEGORY_LABEL[facility.care_category]}
              </span>
              {facility.beds && (
                <span className="fp-tag rounded-full bg-ink px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-semibold text-gold-soft">
                  {facility.beds} beds
                </span>
              )}
              {isMc && (
                <span className="fp-tag rounded-full bg-clearing-chip px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-semibold text-teal">
                  Dementia-trained staff
                </span>
              )}
              {/* Phone — visible on mobile only; desktop shows in address line below */}
              {phone && (
                <a
                  href={`tel:${facility.phone}`}
                  className="fp-tag rounded-full border border-clearing-rule-2 bg-clearing-card px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-medium text-ink-3 transition-colors hover:text-ink md:hidden"
                >
                  {phone}
                </a>
              )}
            </div>

            {addr && (
              <div className="mt-4 hidden font-[family-name:var(--font-display)] text-[20px] italic text-ink-2 md:block">
                {addr}
                {phone && (
                  <a
                    href={`tel:${facility.phone}`}
                    className="ml-4 font-[family-name:var(--font-sans)] text-[13px] not-italic tracking-[0.02em] text-ink-3 transition-colors hover:text-ink"
                  >
                    {phone}
                  </a>
                )}
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
                      className="ml-3 font-[family-name:var(--font-sans)] text-[12px] font-medium not-italic tracking-[0.02em] text-teal underline decoration-teal/30 underline-offset-4 transition-colors hover:decoration-teal"
                    >
                      LIC# {facility.license_number} ↗
                    </a>
                  ) : (
                    <span className="ml-3 font-[family-name:var(--font-sans)] text-[12px] font-medium not-italic tracking-[0.02em] text-teal">
                      LIC# {facility.license_number}
                    </span>
                  );
                })()}
              </div>
            )}

            {/* Limited inspection history badge */}
            {profile.limitedHistory && (
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-[family-name:var(--font-sans)] text-[11px] font-medium uppercase tracking-[0.08em] text-amber-700">
                  Limited Inspection History · fewer than 4 records in 3 years
                </span>
              </div>
            )}

            {/* PDF-links-only badge — shown when no inspection narrative has been parsed */}
            {!profile.hasRealInspectionText && (
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-[family-name:var(--font-sans)] text-[11px] font-medium uppercase tracking-[0.08em] text-amber-700">
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

            {/* Mobile-only percentile badge — rank summary visible without scrolling */}
            {profile.snapshot?.grade && (
              <div className="mt-4 flex items-center gap-4 border-t border-clearing-rule pt-4 md:hidden">
                <div>
                  <div className="mb-0.5 font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                    Peer rank
                  </div>
                  <div className="font-[family-name:var(--font-sans)] text-[15px] font-semibold text-ink-2">
                    Top {Math.max(1, 100 - profile.snapshot.grade.composite_percentile)}% of {state.name} memory care
                  </div>
                  <a
                    href="#peer"
                    className="mt-1 block w-fit border-b border-teal/30 pb-px font-[family-name:var(--font-sans)] text-[12px] font-medium text-teal"
                  >
                    See full peer rank →
                  </a>
                </div>
              </div>
            )}

            {/* Offer CTA — above the fold on all viewports */}
            <div className="mt-5">
              <OfferTriggerButton />
            </div>
          </div>

          {/* Verdict card */}
          <VerdictCard profile={profile} />
        </div>
      </div>
    </section>
  );
}
