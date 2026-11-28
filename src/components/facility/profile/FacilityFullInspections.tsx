import type { FacilityProfile, InspectionRow, DeficiencyRow } from "@/lib/facility/loadFacilityProfile";
import { visitKindLabel } from "@/lib/facility/visitLabel";
import { formatInspectionListDate } from "@/lib/format/formatRecordDate";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { Deficiency } from "@/lib/types";
import {
  InspectionMetaRow,
  OfficialReportLink,
  PlainLanguageSummary,
  SubstantiatedNote,
  inspectionFacts,
  summaryIsUsable,
} from "./inspectionBlocks";
import { FacilityWatchPaid } from "@/components/facility/FacilityWatchPaid";
import { FullHistoryWaitlist } from "./FullHistoryWaitlist";
import { OlderVisits, VISIBLE_VISITS } from "./OlderVisits";

function ExpandedRow({
  insp,
  defs,
  cfg,
  showPremiumAfterSummary,
  facilityId,
  facilityName,
  fullReportHref,
}: {
  insp: InspectionRow;
  defs: DeficiencyRow[];
  cfg: FacilityProfile["cfg"];
  /** Embed Facility Watch Premium once, under the first inspection summary. */
  showPremiumAfterSummary?: boolean;
  facilityId?: string;
  facilityName?: string;
  /** The page that holds every word of this visit's citations. */
  fullReportHref: string;
}) {
  const { isSubGap, inspector, duration, hasSummary, hasFullCitationBody } = inspectionFacts(insp, defs);

  return (
    <div className="border-t border-clearing-rule-3 bg-clearing-bg/80 px-4 pb-5 pt-4 md:px-6">
      <InspectionMetaRow inspector={inspector} duration={duration} />

      {hasSummary && <PlainLanguageSummary text={insp.narrative_summary} />}

      {/* Facility Watch — directly under the first summary so it isn't mid-page fatigue */}
      {showPremiumAfterSummary && facilityId && facilityName && (
        <div className="mb-5">
          <FacilityWatchPaid
            facilityId={facilityId}
            facilityName={facilityName}
            embedded
          />
        </div>
      )}

      {/* No summary yet: list what was cited, by rule and class. The words are on the full-report page. */}
      {!hasSummary && defs.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {defs.map((def) => {
            const tag = cfg.formatSeverityTag(def as unknown as Deficiency);
            const regCode = def.code ? `${cfg.citationPrefix}${def.code}` : null;
            if (!tag && !regCode) return null;
            return (
              <li key={def.id} className="flex flex-wrap items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink-2">
                {regCode && <span className="bg-paper px-1.5 py-0.5 text-ink-3">{regCode}</span>}
                {tag && <span>{tag.label}</span>}
                {def.is_repeat && <span className="uppercase text-amber-700">Repeat</span>}
              </li>
            );
          })}
        </ul>
      )}

      {isSubGap && <SubstantiatedNote />}

      {hasFullCitationBody && (
        <a
          href={fullReportHref}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-clearing-rule-2 bg-clearing-card px-3.5 py-2 font-[family-name:var(--font-sans)] text-[13px] font-semibold text-teal transition-colors hover:border-teal/30"
        >
          Read the full report
          <span aria-hidden>→</span>
        </a>
      )}

      <OfficialReportLink insp={insp} cfg={cfg} />
    </div>
  );
}

function InspectionItem({
  insp,
  defs,
  cfg,
  showPremiumAfterSummary,
  facilityId,
  facilityName,
  fullReportBase,
}: {
  insp: InspectionRow;
  defs: DeficiencyRow[];
  cfg: FacilityProfile["cfg"];
  showPremiumAfterSummary?: boolean;
  facilityId?: string;
  facilityName?: string;
  fullReportBase: string;
}) {
  const isSubGap =
    insp.is_complaint &&
    insp.raw_data?.outcome === "Substantiated" &&
    defs.length === 0;
  const hasCitation = defs.length > 0 || isSubGap;

  const worstDef = defs.find((d) => d.class === "Type A") ?? defs[0] ?? null;
  const tag = worstDef ? cfg.formatSeverityTag(worstDef as unknown as Deficiency) : null;

  const verdictLabel = isSubGap
    ? "Citation on file"
    : defs.length === 0
    ? "No findings"
    : tag
    ? `${tag.label} · ${defs.length} finding${defs.length === 1 ? "" : "s"}`
    : `${defs.length} finding${defs.length === 1 ? "" : "s"}`;

  const inspType = visitKindLabel(insp);

  const outcome = insp.is_complaint && insp.raw_data?.outcome ? insp.raw_data.outcome : null;

  // Sections that have something to show inside
  const hasContent =
    insp.narrative_summary || defs.length > 0 || isSubGap || insp.source_url ||
    insp.raw_data?.narrative?.trim();

  return (
    <details
      className={`group border-b border-paper-rule last:border-b-0 ${
        hasCitation ? "bg-[#FBE5DC]/30" : ""
      }`}
      open={hasCitation}
    >
      {/* ── Summary: the always-visible clickable row ── */}
      <summary
        className={`flex cursor-pointer list-none items-center gap-3 px-4 py-4 md:px-6 select-none hover:bg-paper/70 transition-colors [&::-webkit-details-marker]:hidden ${
          !hasContent ? "cursor-default" : ""
        }`}
      >
        {/* Citation indicator stripe */}
        <span
          className={`hidden shrink-0 self-stretch w-[3px] rounded-full md:block ${
            hasCitation ? "bg-rust" : "bg-paper-rule"
          }`}
        />

        {/* Date */}
        <span className="w-[90px] shrink-0 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink-2">
          {formatInspectionListDate(insp.inspection_date, insp.datePrecision)}
        </span>

        {/* Type + outcome */}
        <div className="min-w-0 flex-1">
          <div className="font-[family-name:var(--font-display)] text-[17px] leading-[1.2] tracking-[-0.005em] text-ink">
            {inspType}
          </div>
          {outcome && (
            <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-ink-3">
              {outcome}
            </div>
          )}
        </div>

        {/* Verdict badge */}
        <span
          className={`shrink-0 rounded-sm px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] ${
            hasCitation
              ? tag?.tone === "danger"
                ? "bg-rust text-white"
                : "bg-[#FBE5DC] text-rust font-semibold"
              : "text-grade-a"
          }`}
        >
          {verdictLabel}
        </span>

        {/* Expand chevron */}
        {hasContent && (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
          </svg>
        )}
      </summary>

      {/* ── Expanded content ── */}
      {hasContent && (
        <ExpandedRow
          insp={insp}
          defs={defs}
          cfg={cfg}
          showPremiumAfterSummary={showPremiumAfterSummary}
          facilityId={facilityId}
          facilityName={facilityName}
          fullReportHref={`${fullReportBase}#inspection-${insp.id}`}
        />
      )}
    </details>
  );
}

type FacilityFullInspectionsProps = {
  profile: FacilityProfile;
  /** When true, render Premium checkout under the first inspection summary. */
  showPaidWatch?: boolean;
};

/** A date or an older row means the file is not empty. */
function holdsInspectionVisit(profile: FacilityProfile): boolean {
  return (
    profile.hiddenOlderCount > 0 ||
    profile.totals.inspections > 0 ||
    Boolean(profile.facility.last_inspection_date) ||
    Boolean(profile.latestInspection)
  );
}

function fullRecordDeck(profile: FacilityProfile): string {
  const { inspections, totals, facility, hasRealInspectionText } = profile;
  if (inspections.length > 0 && !hasRealInspectionText) {
    return "Inspection reports for this home have not been parsed yet.";
  }
  if (inspections.length === 0) {
    if (holdsInspectionVisit(profile)) {
      return "The inspection visits we hold are older than the last 3 years.";
    }
    return "No inspection is in the records we hold.";
  }
  if (facility.state_code === "WA" && profile.windowComplaints > 0) {
    const visits = totals.inspections === 1 ? "inspection" : "inspections";
    const complaints = profile.windowComplaints === 1 ? "investigation" : "investigations";
    return `${totals.inspections} ${visits} and ${profile.windowComplaints} complaint ${complaints} in the public record, most recent first. Each row opens to a plain-language summary and links to the full citation text.`;
  }
  const shown = inspections.length + profile.olderWindowVisits;
  const noun = shown === 1 ? "inspection" : "inspections";
  return `${shown} ${noun} in the public record, most recent first. Each row opens to a plain-language summary and links to the full citation text.`;
}

export function FacilityFullInspections({
  profile,
  showPaidWatch = false,
}: FacilityFullInspectionsProps) {
  const { inspections, deficienciesByInspection, totals, cfg, hiddenOlderCount, oldestHiddenYear, hasRealInspectionText } = profile;

  // Prefer the first inspection that has a usable plain-language summary; else first row.
  const premiumInspectionId = (() => {
    if (!showPaidWatch || inspections.length === 0) return null;
    const withSummary = inspections.find(
      (insp) =>
        summaryIsUsable(insp.narrative_summary),
    );
    return (withSummary ?? inspections[0]).id;
  })();

  return (
    <section id="full-record" className="scroll-mt-36 border-b border-clearing-rule py-16 md:scroll-mt-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px]">
        <SectionHead
          label="Full Inspection Record"
          title={
            <>
              Every inspection visit, <em>in plain language.</em>
            </>
          }
          deck={fullRecordDeck(profile)}
        />

        {/* PDF-links-only banner — shown when no inspection has parsed narrative text */}
        {inspections.length > 0 && !hasRealInspectionText && (
          <div className="mb-6 flex items-start gap-3 rounded-sm border border-amber-400 bg-amber-50 px-5 py-4">
            <span className="mt-0.5 shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-amber-700">
              Note
            </span>
            <p className="text-[13.5px] leading-relaxed text-amber-900">
              Inspection reports for this home have not been parsed yet. We only have links to the
              regulator&rsquo;s PDF documents. Open the PDFs below to see the actual findings.
              Citation text, plain-language summaries, and quality scores are not available until
              the PDFs are processed.
            </p>
          </div>
        )}

        {/* Summary strip */}
        {inspections.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-8 border border-paper-rule bg-paper-2 px-6 py-4">
            <div className="text-center">
              <div className="font-[family-name:var(--font-display)] text-[40px] leading-none text-ink">
                {totals.inspections}
              </div>
              <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-ink-3">
                reports on file
              </div>
            </div>
            <div className="text-center">
              <div className="font-[family-name:var(--font-display)] text-[40px] leading-none text-ink">
                {totals.deficiencies}
              </div>
              <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-ink-3">
                total deficiencies
              </div>
            </div>
            {totals.typeA > 0 && (
              <div className="text-center">
                <div className="font-[family-name:var(--font-display)] text-[40px] leading-none text-rust">
                  {totals.typeA}
                </div>
                <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-ink-3">
                  severe (Type A)
                </div>
              </div>
            )}
          </div>
        )}

        {inspections.length === 0 ? (
          holdsInspectionVisit(profile) ? null : (
          <div className="border border-paper-rule bg-paper-2 px-6 py-8 text-center">
            <p className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3 tracking-wide">
              Individual inspection and deficiency records are scraped in a separate pipeline. This
              section will populate with dated citations as that pipeline runs.
            </p>
          </div>
          )
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-clearing-rule-2 bg-clearing-card shadow-[var(--shadow-card)]">
            {inspections.slice(0, VISIBLE_VISITS).map((insp) => (
              <InspectionItem
                key={insp.id}
                insp={insp}
                defs={deficienciesByInspection.get(insp.id) ?? []}
                cfg={cfg}
                showPremiumAfterSummary={insp.id === premiumInspectionId}
                facilityId={profile.facility.id}
                facilityName={profile.facility.name}
                fullReportBase={`/${profile.state.slug}/${profile.facility.city_slug}/${profile.facility.slug}/inspections`}
              />
            ))}
            {profile.olderWindowVisits > 0 ? (
              <p className="border-t border-clearing-rule-2 px-5 py-4 font-[family-name:var(--font-mono)] text-[12px] text-ink-3">
                <a
                  href={`/${profile.state.slug}/${profile.facility.city_slug}/${profile.facility.slug}/inspections`}
                  className="border-b border-rust pb-px text-rust"
                >
                  {profile.olderWindowVisits} older visits in the last 3 years are on the full record page
                </a>
              </p>
            ) : null}
            <OlderVisits count={Math.max(0, inspections.length - VISIBLE_VISITS)}>
              {inspections.slice(VISIBLE_VISITS).map((insp) => (
                <InspectionItem
                  key={insp.id}
                  insp={insp}
                  defs={deficienciesByInspection.get(insp.id) ?? []}
                  cfg={cfg}
                  showPremiumAfterSummary={insp.id === premiumInspectionId}
                  facilityId={profile.facility.id}
                  facilityName={profile.facility.name}
                  fullReportBase={`/${profile.state.slug}/${profile.facility.city_slug}/${profile.facility.slug}/inspections`}
                />
              ))}
            </OlderVisits>
          </div>
        )}

        {inspections.length > 0 && cfg.regulatorPortalUrl && (
          <div className="mt-4 flex justify-end">
            <a
              href={cfg.regulatorPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-b border-rust pb-px font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.06em] text-rust"
            >
              View {cfg.agencyShort} inspection portal →
            </a>
          </div>
        )}

        {hiddenOlderCount > 0 && oldestHiddenYear !== null && (
          <FullHistoryWaitlist
            facilityId={profile.facility.id}
            facilityName={profile.facility.name}
            stateCode={profile.facility.state_code}
            hiddenCount={hiddenOlderCount}
            oldestYear={oldestHiddenYear}
          />
        )}
      </div>
    </section>
  );
}
