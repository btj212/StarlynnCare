import Link from "next/link";
import type { FacilityProfile, DeficiencyRow } from "@/lib/facility/loadFacilityProfile";
import type { CareCategory, Deficiency } from "@/lib/types";
import {
  regulatorLicensePageFor,
  regulatorLicensePageLabel,
} from "@/lib/seo/schema";
import {
  REGULATOR_ABBR,
  buildFacilityDirectAnswer,
  buildFacilityRecordSentence,
  buildFacilitySnippet,
  reportablePercentile,
} from "@/lib/seo/meta";
import { facilityAliases, facilityDisplayName } from "@/lib/facility/aliases";
import { formatFacilityName } from "@/lib/facility/displayName";
import { displayCityName } from "@/lib/resolveListingRegion";
import { licensedCity } from "@/lib/facility/licensedCity";
import { dshsFormsUrl } from "@/lib/facility/complianceFlag";
import { displayWaLicense, priorWaDshsFormsUrl, priorWaLicenseFromSlug } from "@/lib/facility/waPriorLicense";
import { agencyLabelForInspection } from "@/lib/states/profileConfig";
import { citationCountPhrase } from "@/lib/facility/citationWindow";
import { WaMcSignalBadges } from "./WaMcSignalBadges";
import { OrMcSignalBadges } from "./OrMcSignalBadges";
import { FacilityMemoryCareBasis } from "./FacilityMemoryCareBasis";
import { AzMemoryCareBadges } from "./AzMemoryCareBadges";
import { azMcProgram } from "@/lib/facility/azMcProgram";
import { formatRecordDate } from "@/lib/format/formatRecordDate";
import { peerRankPhrase } from "@/lib/seo/rankPhrase";
import { peerSetPhrase } from "@/lib/city-hub/careSetting";
import { listLicenseLabel } from "@/lib/city-hub/licenseLabel";
import { azDirectedCareLicense } from "@/lib/facility/azDirectedCare";
import { FacilityPhotoGrid } from "./FacilityPhotoGrid";
import { formatLicenseStatus } from "@/lib/facility/licenseStatus";
import { OfferTriggerButton } from "@/components/facility/offer/FacilityOfferProvider";
import { FacilityShareButton } from "./FacilityShareButton";
import { evidenceLabelText } from "@/lib/quality/gate";
import { EvidenceLabel } from "./EvidenceLabel";
import { InspectionSummary } from "./InspectionSummary";
import { ClosedSuccessorLink } from "./PreviousFacilityInspections";

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

function formatAddr(facility: FacilityProfile["facility"]): {
  line: string;
  neighborhood: string | null;
} {
  const stateCode = (facility.state_code ?? "").toUpperCase();
  const { locality, neighborhood } = licensedCity(facility);
  const cityZip = [locality, facility.zip].filter(Boolean).join(`, ${stateCode} `);
  return {
    line: [facility.street, cityZip].filter(Boolean).join(" · "),
    neighborhood,
  };
}

function websiteHref(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function WaPreviousLicenseLink({
  slug,
  licenseNumber,
  waFacilityType,
  className,
}: {
  slug: string;
  licenseNumber: string | null;
  waFacilityType: string | null | undefined;
  className: string;
}) {
  const prior = priorWaLicenseFromSlug(slug, licenseNumber);
  const href = priorWaDshsFormsUrl(slug, licenseNumber, waFacilityType);
  if (!prior || !href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      Previous license {displayWaLicense(prior)}
    </a>
  );
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
  const showSeverityCallout =
    (snapshot?.peer_set.n ?? 0) >= 10 && !!snapshot?.has_inspections && sevTier !== null;
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
    const licType =
      facility.state_code === "CO"
        ? facility.co_care_setting === "NH"
          ? "CMS nursing home"
          : "CDPHE assisted living residence"
        : (SHORT_CATEGORY_LABEL[facility.care_category] ?? "care facility");
    const citLabel = citationCountPhrase({
      count: totals.deficiencies,
      agencyShort: cfg.agencyShort,
      window: "profile",
    });
    return `${beds} ${licType} with ${citLabel}.`;
  })();

  const lastVisit = profile.latestVisit;
  const lastInsp = inspections[0] ?? null;
  const lastInspFormatted = lastVisit
    ? formatRecordDate(lastVisit.date, lastVisit.precision)
    : lastInsp?.inspection_date
      ? formatRecordDate(lastInsp.inspection_date, lastInsp.datePrecision)
      : null;
  const lastInspCited =
    lastVisit && lastInsp && lastVisit.date === lastInsp.inspection_date
      ? (lastInsp.total_deficiency_count ?? 0) > 0
      : null;

  return (
    <div className="fp-verdict relative overflow-hidden rounded-[22px] bg-ink text-paper shadow-[var(--shadow-feature)]">
      {/* ── Photo grid (full-width when 4+, otherwise compact) ── */}
      {hasGrid ? (
        <FacilityPhotoGrid
          photoUrls={photoUrls}
          photoSources={photoSources}
          facilityName={facilityDisplayName(facility)}
        />
      ) : null}

      <div className={hasGrid ? "p-7" : "p-7"}>
        <div className="mb-3.5 flex items-center gap-2 font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
          Facility · {displayCityName(facility.city, facility.city_slug) || profile.state.name}
        </div>

        {/* When < 4 photos: compact side-by-side with single photo */}
        {!hasGrid ? (
          <div className="grid gap-5" style={{ gridTemplateColumns: "110px 1fr" }}>
            <div className="flex flex-col gap-1.5">
              <FacilityPhotoGrid
                photoUrls={photoUrls}
                photoSources={photoSources}
                facilityName={facilityDisplayName(facility)}
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
              <span dangerouslySetInnerHTML={{ __html: copy.replace(/(no citations|citations|citation)/gi, "<em>$1</em>") }} />
            </div>
          </div>
        ) : (
          /* When 4+ photos: full-width copy below the grid */
          <div className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] tracking-[-0.005em] text-gold-soft [&_em]:italic [&_em]:text-white">
            <span dangerouslySetInnerHTML={{ __html: copy.replace(/(no citations|citations|citation)/gi, "<em>$1</em>") }} />
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
                {(lastVisit?.isComplaint || lastInsp?.is_complaint) ? " (complaint)" : ""}
                {lastInspCited == null ? "" : lastInspCited ? " · cited" : " · no findings"}
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
  const website = facility.website?.trim() || null;
  const phone = facility.phone
    ? facility.phone.replace(/\D/g, "").replace(/^1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")
    : null;
  const legalName = formatFacilityName(facility.name);
  const displayName = facilityDisplayName(facility);
  const aliases = facilityAliases(facility);
  const cityName = displayCityName(facility.city, facility.city_slug) || state.name;

  // Editorial prose summary — mirrors the meta description so Google has a
  // human-readable narrative line to lift even when it overrides our meta.
  // Same date as the "Last inspection" header: inspections rows plus, for WA,
  // the latest posted PDF month.
  const lastVisit = profile.latestVisit;
  const lastInspectedLabel = lastVisit
    ? formatRecordDate(lastVisit.date, lastVisit.precision)
    : null;
  const lastInspectionDate = lastVisit?.date ?? null;
  const checkedOn = facility.state_records_checked_at?.slice(0, 10) ?? null;
  const noReportsPosted =
    facility.state_code === "WA" &&
    checkedOn != null &&
    profile.totals.inspections === 0 &&
    profile.totals.deficiencies === 0 &&
    !profile.latestVisit &&
    !profile.complianceFlag;
  const formsUrl = noReportsPosted
    ? dshsFormsUrl(facility.license_number, facility.wa_facility_type)
    : null;
  const reportableRank = reportablePercentile(
    profile.snapshot?.grade?.composite_percentile,
    profile.snapshot?.peer_set.n,
  );
  const recordSentence = noReportsPosted
    ? null
    : buildFacilityRecordSentence({
        citationCount: profile.totals.deficiencies,
        inspectionCount: profile.totals.inspections,
        lastInspected: lastInspectedLabel,
        regulatorAbbr: profile.cfg.agencyShort,
        licenseNumber: facility.license_number,
      });
  const snippet = noReportsPosted
    ? `${displayName} has no DSHS reports posted as of ${checkedOn}.`
    : profile.totals.inspections < 1
      ? null
      : buildFacilitySnippet({
        facilityName: displayName,
        stateName: state.name,
        stateCode: state.code,
        grade: reportableRank == null ? null : profile.snapshot?.grade?.letter ?? null,
        percentile: reportableRank,
        severityPercentile: reportableRank == null ? null : profile.snapshot?.metrics.severity.percentile ?? null,
        frequencyPercentile: reportableRank == null ? null : profile.snapshot?.metrics.frequency.percentile ?? null,
        repeatsPercentile: reportableRank == null ? null : profile.snapshot?.metrics.repeats.percentile ?? null,
        citationCount: profile.totals.deficiencies,
        lastInspectionDate,
        lastInspected: lastInspectedLabel,
        variant: "prose",
        regulatorAbbr: profile.cfg.agencyShort,
      });
  const azDirected = azDirectedCareLicense(facility.az_license_level);
  const azLicenseLabel =
    facility.state_code === "AZ"
      ? listLicenseLabel({
          stateCode: "AZ",
          care_category: facility.care_category,
          license_type: facility.license_type,
          az_license_level: facility.az_license_level,
        })
      : null;
  const azNoun = azDirected
    ? "Directed Care licensed home"
    : azLicenseLabel
      ? /home$/i.test(azLicenseLabel)
        ? azLicenseLabel
        : `${azLicenseLabel} home`
      : undefined;
  const directAnswer = noReportsPosted
    ? null
    : buildFacilityDirectAnswer({
        name: displayName,
        city: cityName,
        stateName: state.name,
        stateCode: state.code,
        regulatorAbbr: profile.cfg.agencyShort ?? REGULATOR_ABBR[state.code] ?? "state",
        licenseNumber: facility.license_number,
        inspectionCount: profile.totals.inspections,
        citationCount: profile.totals.deficiencies,
        lastInspected: lastInspectedLabel,
        beds: facility.beds,
        azLicenseLevel: facility.az_license_level,
        facilityNoun: facility.state_code === "AZ" ? azNoun : undefined,
      });

  return (
    <section className="fp-hero border-b border-clearing-rule px-4 py-9 sm:px-6 md:px-[60px] md:py-14">
      <div className="mx-auto max-w-[1280px]">
        {/* Eyebrow */}
        <div className="mb-3.5">
          <span className="clearing-chip">
            {state.name} · {displayCityName(facility.city, facility.city_slug)}
          </span>
        </div>

        {/* Hero grid */}
        <div className="grid items-end gap-8 md:grid-cols-[1.5fr_1fr] md:gap-16">
          {/* Left */}
          <div>
            <h1 className="m-0 font-[family-name:var(--font-display)] text-[clamp(36px,5.5vw,72px)] font-normal leading-[0.95] tracking-[-0.025em] text-ink">
              {displayName}
            </h1>
            {legalName !== displayName ? (
              <p className="mt-3 font-[family-name:var(--font-sans)] text-[15px] leading-snug text-ink-3">
                Licensed as {legalName}
              </p>
            ) : null}
            <InspectionSummary
              lastInspected={lastInspectedLabel}
              inspectionCount={profile.totals.inspections}
              citationCount={profile.totals.deficiencies}
            />
            {profile.waMcSignals ? <WaMcSignalBadges signals={profile.waMcSignals} /> : null}
            {profile.orMcSignals ? <OrMcSignalBadges signals={profile.orMcSignals} /> : null}
            {facility.state_code === "AZ" ? (
              <AzMemoryCareBadges
                program={azMcProgram(facility)}
                regulatorShort={profile.memoryCareBasis.regulatorShort}
                regulatorUrl={profile.memoryCareBasis.sourceUrl}
                directedCare={azDirected}
              />
            ) : null}
            <EvidenceLabel
              label={evidenceLabelText(facility, profile.memoryCareBasis.regulator)}
            />
            {aliases.aliases.length > 0 ? (
              <p className="mt-1 font-[family-name:var(--font-sans)] text-[14px] leading-snug text-ink-3">
                Also listed as {aliases.aliases.map((alias) => formatFacilityName(alias)).join(", ")}
              </p>
            ) : null}

            {/* 40–60 word answer for facility-name / inspection queries. */}
            {directAnswer && (
              <p className="mt-5 max-w-[58ch] font-[family-name:var(--font-sans)] text-[17px] leading-[1.55] text-ink-2 sm:text-[18px]">
                {directAnswer}
              </p>
            )}
            <nav aria-label="Next steps" className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              <a
                href="#record"
                className="font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal underline underline-offset-4"
              >
                View inspection record
              </a>
              <Link
                href={`/${state.slug}/${facility.city_slug}/${facility.slug}/inspections`}
                className="font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal underline underline-offset-4"
              >
                Full citation reports
              </Link>
              <Link
                href={`/${state.slug}/${facility.city_slug}`}
                className="font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal underline underline-offset-4"
              >
                Compare homes in {cityName}
              </Link>
            </nav>

            {/* Editorial summary — same data points as the meta snippet so
                Google has narrative prose above-the-fold to lift. */}
            {!directAnswer && recordSentence && (
              <p className="mt-5 max-w-[58ch] font-[family-name:var(--font-sans)] text-[17px] leading-[1.55] text-ink-2 sm:text-[18px]">
                {recordSentence}
              </p>
            )}
            {snippet && (
              <p className={`max-w-[58ch] font-[family-name:var(--font-sans)] text-[17px] leading-[1.55] text-ink-2 sm:text-[18px] ${directAnswer || recordSentence ? "mt-3" : "mt-5"}`}>
                {snippet}{" "}
                {formsUrl ? (
                  <>
                    <a href={formsUrl} className="underline" rel="noopener noreferrer">
                      DSHS record
                    </a>
                    <WaPreviousLicenseLink
                      slug={facility.slug}
                      licenseNumber={facility.license_number}
                      waFacilityType={facility.wa_facility_type}
                      className="ml-2 underline"
                    />
                  </>
                ) : null}
              </p>
            )}

            {/* Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="fp-tag rounded-full bg-clearing-chip px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-semibold text-teal">
                {listLicenseLabel({
                  stateCode: facility.state_code,
                  care_category: facility.care_category,
                  license_type: facility.license_type,
                  mo_level_of_care: facility.mo_level_of_care,
                  mn_dementia_care_licensed: facility.mn_dementia_care_licensed,
                  az_license_level: facility.az_license_level,
                })}
              </span>
              {facility.state_code === "CO" && (
                <span className="fp-tag rounded-full bg-clearing-chip px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-semibold text-teal">
                  {facility.co_care_setting === "NH" ? "CMS" : "CDPHE"}
                </span>
              )}
              {facility.beds && (
                <span className="fp-tag rounded-full bg-ink px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-semibold text-gold-soft">
                  {facility.beds} beds
                </span>
              )}
              {azDirected && (
                <span className="fp-tag rounded-full border border-paper-rule bg-paper-2 px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-medium text-ink-3">
                  Directed Care
                </span>
              )}
              {facility.state_code === "AZ" && azMcProgram(facility).confirmed && (
                <span className="fp-tag rounded-full border border-teal/35 bg-teal-soft px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-semibold text-teal-deep">
                  Memory care program confirmed
                </span>
              )}
              {isMc && facility.state_code !== "CO" && facility.state_code !== "AZ" && facility.state_code !== "WA" && profile.memoryCareBasis.kind === "memory-care" && (
                <span className="fp-tag rounded-full bg-clearing-chip px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-semibold text-teal">
                  Dementia-trained staff
                </span>
              )}
              {(() => {
                const status = formatLicenseStatus(facility.license_status);
                if (!status) return null;
                const tone =
                  status.tone === "danger"
                    ? "border-rust/40 bg-rust/10 text-rust"
                    : status.tone === "warn"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-paper-rule bg-paper-2 text-ink-3";
                return (
                  <span
                    className={`fp-tag rounded-full border px-3 py-[5px] font-[family-name:var(--font-sans)] text-[12px] font-semibold ${tone}`}
                  >
                    {status.label}
                  </span>
                );
              })()}
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

            {facility.license_status?.trim().toUpperCase() === "CLOSED" ? (
              <ClosedSuccessorLink successor={profile.addressSuccessor} />
            ) : null}

            {addr.line && (
              <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-[family-name:var(--font-display)] text-[18px] italic leading-snug text-ink-2 sm:text-[20px]">
                <span>{addr.line}</span>
                {addr.neighborhood && (
                  <span className="font-[family-name:var(--font-sans)] text-[13px] not-italic tracking-[0.02em] text-ink-3">
                    {addr.neighborhood}
                  </span>
                )}
                {phone && (
                  <a
                    href={`tel:${facility.phone}`}
                    className="hidden font-[family-name:var(--font-sans)] text-[13px] not-italic tracking-[0.02em] text-ink-3 transition-colors hover:text-ink md:inline"
                  >
                    {phone}
                  </a>
                )}
                {website && (
                  <a
                    href={websiteHref(website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-[family-name:var(--font-sans)] text-[13px] not-italic tracking-[0.02em] text-teal underline decoration-teal/30 underline-offset-4 transition-colors hover:decoration-teal"
                  >
                    Website
                  </a>
                )}
                {facility.license_number && (() => {
                  const verifyUrl = regulatorLicensePageFor(
                    facility.state_code,
                    facility.license_number,
                  );
                  const verifyLabel = regulatorLicensePageLabel(facility.state_code);
                  return (
                    <>
                      {verifyUrl ? (
                        <a
                          href={verifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={verifyLabel}
                          className="font-[family-name:var(--font-sans)] text-[12px] font-medium not-italic tracking-[0.02em] text-teal underline decoration-teal/30 underline-offset-4 transition-colors hover:decoration-teal"
                        >
                          LIC# {facility.license_number} ↗
                        </a>
                      ) : (
                        <span className="font-[family-name:var(--font-sans)] text-[12px] font-medium not-italic tracking-[0.02em] text-teal">
                          LIC# {facility.license_number}
                        </span>
                      )}
                      {facility.state_code === "WA" ? (
                        <WaPreviousLicenseLink
                          slug={facility.slug}
                          licenseNumber={facility.license_number}
                          waFacilityType={facility.wa_facility_type}
                          className="font-[family-name:var(--font-sans)] text-[12px] font-medium not-italic tracking-[0.02em] text-teal underline decoration-teal/30 underline-offset-4 transition-colors hover:decoration-teal"
                        />
                      ) : null}
                    </>
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

            {facility.state_code === "AZ" ? null : (
              <FacilityMemoryCareBasis basis={profile.memoryCareBasis} />
            )}

            {/* Mobile-only percentile badge — rank summary visible without scrolling */}
            {reportableRank != null && profile.snapshot?.grade && (
              <div className="mt-4 flex items-center gap-4 border-t border-clearing-rule pt-4 md:hidden">
                <div>
                  <div className="mb-0.5 font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                    Peer rank
                  </div>
                  <div className="font-[family-name:var(--font-sans)] text-[15px] font-semibold text-ink-2">
                    {peerRankPhrase(profile.snapshot.grade.composite_percentile).text.replace(/^./, (c) => c.toUpperCase())} of {peerSetPhrase(facility.state_code, state.name)}
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
              <FacilityShareButton facilityName={facility.name} />
            </div>
          </div>

          {/* Verdict card */}
          <VerdictCard profile={profile} />
        </div>
      </div>
    </section>
  );
}
