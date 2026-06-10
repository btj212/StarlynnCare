import type { FacilityProfile, InspectionRow, DeficiencyRow } from "@/lib/facility/loadFacilityProfile";
import { agencyLabelForInspection } from "@/lib/states/profileConfig";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { Deficiency } from "@/lib/types";
import { FullHistoryWaitlist } from "./FullHistoryWaitlist";

// Mirrors inspectionHasRealNarrative from loadFacilityProfile — duplicated here
// so this component stays a pure function of its props with no cross-layer import.
const WA_PLACEHOLDER_RE_UI = /^—:\s*WA DSHS report:/i;
const URL_RE_UI = /^https?:\/\//i;

function narrativeIsPlaceholder(narrative: string | null | undefined): boolean {
  if (!narrative || narrative.trim().length < 100) return true;
  const text = narrative.trim();
  if (WA_PLACEHOLDER_RE_UI.test(text)) return true;
  // Multi-PDF concatenation: every non-empty line is a placeholder
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.every((l) => WA_PLACEHOLDER_RE_UI.test(l) || l.startsWith("—:"));
}

function isPdfUrl(text: string | null | undefined): boolean {
  return !!text && URL_RE_UI.test(text.trim());
}

function severityToneClass(tone: "danger" | "warn" | "info" | "ok" | "mute"): string {
  switch (tone) {
    case "danger": return "bg-rust text-white";
    case "warn":   return "bg-gold-soft text-[#6E5520]";
    case "ok":     return "bg-teal-soft text-teal-deep";
    default:       return "bg-paper-rule text-ink-2";
  }
}

function DeficiencyBlock({
  def,
  cfg,
}: {
  def: DeficiencyRow;
  cfg: FacilityProfile["cfg"];
}) {
  const d = def as unknown as Deficiency;
  const tag = cfg.formatSeverityTag(d);
  const regCode = def.code ? `${cfg.citationPrefix}${def.code}` : null;

  return (
    <div className="mt-3 rounded-sm border-l-[3px] border-rust bg-[#FBE5DC] px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {tag && (
          <span className={`px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] ${severityToneClass(tag.tone)}`}>
            {tag.label}
          </span>
        )}
        {def.immediate_jeopardy && (
          <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase text-rust tracking-wide">
            Immediate jeopardy
          </span>
        )}
        {regCode && (
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-ink-3 bg-paper px-1.5 py-0.5 tracking-[0.04em]">
            {regCode}
          </span>
        )}
        {def.is_repeat && (
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-amber-700 bg-gold-soft px-1.5 py-0.5">
            Repeat
          </span>
        )}
      </div>
      {(def.inspector_narrative || def.description) && (() => {
        const narrative = def.inspector_narrative ?? def.description;
        const isUrl = isPdfUrl(narrative);
        const isPlaceholder = !isUrl && (
          (def.description ?? "").startsWith("WA DSHS report:") ||
          (def.inspector_narrative ?? "").startsWith("WA DSHS report:")
        );
        if (isUrl || isPlaceholder) {
          return (
            <p className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3 italic">
              Only the regulator&rsquo;s PDF report is available — open it via the link below.
            </p>
          );
        }
        return (
          <>
            <div className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-rust">
              Verbatim citation text{regCode ? ` · ${regCode}` : ""}
            </div>
            <p className="font-[family-name:var(--font-display)] text-[18px] italic leading-[1.4] text-ink">
              &ldquo;{narrative}&rdquo;
            </p>
          </>
        );
      })()}
    </div>
  );
}

function ExpandedRow({
  insp,
  defs,
  cfg,
}: {
  insp: InspectionRow;
  defs: DeficiencyRow[];
  cfg: FacilityProfile["cfg"];
}) {
  const isSubGap =
    insp.is_complaint &&
    insp.raw_data?.outcome === "Substantiated" &&
    defs.length === 0;

  const rawNarrative = (insp.raw_data?.narrative ?? "")
    .replace(/^(\d+\s+)+/, "")
    .replace(/^\*\*\*report continues from LIC9099\*\*\*\s*/i, "")
    .trim();

  const inspector = insp.raw_data?.inspector_name ?? null;
  const duration = insp.raw_data?.duration_minutes
    ? `${Math.round((insp.raw_data.duration_minutes / 60) * 10) / 10} hrs on-site`
    : null;

  return (
    <div className="border-t border-paper-rule/60 bg-paper/60 px-4 pb-5 pt-4 md:px-6">
      {/* Inspector meta row */}
      {(inspector || duration) && (
        <div className="mb-4 flex flex-wrap gap-4 font-[family-name:var(--font-mono)] text-[10.5px] tracking-[0.06em] text-ink-3">
          {inspector && <span>Inspector · {inspector}</span>}
          {duration && <span>{duration}</span>}
        </div>
      )}

      {/* 1. AI plain-language summary — suppressed when raw narrative is a placeholder */}
      {insp.narrative_summary && !narrativeIsPlaceholder(insp.raw_data?.narrative) && (
        <div className="mb-4 rounded-sm border border-teal/25 bg-teal-soft/40 px-4 py-3.5">
          <p className="mb-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-teal">
            Plain-language summary
          </p>
          <p className="text-[14px] leading-relaxed text-ink-2">{insp.narrative_summary}</p>
        </div>
      )}

      {/* 2. Citation blocks */}
      {defs.map((def) => (
        <DeficiencyBlock key={def.id} def={def} cfg={cfg} />
      ))}

      {/* 3. Substantiated complaint gap */}
      {isSubGap && (
        <div className="mt-3 rounded-sm border-l-[3px] border-rust bg-[#FBE5DC] px-5 py-3">
          <p className="font-sans text-[13.5px] font-semibold text-amber-700">
            Substantiated — the state found a violation and issued a citation. Full citation details are on file with the state.
          </p>
        </div>
      )}

      {/* 4. Full inspector notes — expandable text disclosure */}
      {rawNarrative && (
        <details className="mt-5 group/notes">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] text-rust hover:text-rust/70 transition-colors [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5 shrink-0 transition-transform duration-200 group-open/notes:rotate-90" aria-hidden>
              <path d="M6 4l6 4-6 4V4z" />
            </svg>
            <span className="group-open/notes:hidden">Read raw inspector notes</span>
            <span className="hidden group-open/notes:inline">Close inspector notes</span>
          </summary>
          <p className="mt-3 border-l-2 border-rust/30 pl-4 text-[13px] leading-relaxed text-ink-2 whitespace-pre-line">
            {rawNarrative}
          </p>
        </details>
      )}

      {/* 5. Official report link — demoted, grey */}
      {insp.source_url && (
        <div className="mt-4">
          <a
            href={insp.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-ink-3 hover:text-ink-2 transition-colors"
          >
            View official {agencyLabelForInspection(insp, cfg).short} report
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3 w-3 shrink-0" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13L13 3M7 3h6v6" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

function InspectionItem({
  insp,
  defs,
  cfg,
}: {
  insp: InspectionRow;
  defs: DeficiencyRow[];
  cfg: FacilityProfile["cfg"];
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

  const inspType = insp.is_complaint
    ? "Complaint Investigation"
    : insp.inspection_type === "other"
    ? "Other Visit"
    : "Annual Compliance Visit";

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
          {insp.inspection_date}
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
        <ExpandedRow insp={insp} defs={defs} cfg={cfg} />
      )}
    </details>
  );
}


export function FacilityFullInspections({ profile }: { profile: FacilityProfile }) {
  const { inspections, deficienciesByInspection, totals, cfg, hiddenOlderCount, oldestHiddenYear, hasRealInspectionText } = profile;

  return (
    <section id="full-record" className="scroll-mt-28 border-b border-paper-rule py-16">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="Full Inspection Record"
          title={
            <>
              Every inspection visit, <em>verbatim.</em>
            </>
          }
          deck={
            inspections.length === 0
              ? "No inspection records yet indexed for this facility."
              : `${inspections.length} inspection${inspections.length === 1 ? "" : "s"} in the public record, most recent first. Click any row to expand — cited rows open automatically.`
          }
        />

        {/* PDF-links-only banner — shown when no inspection has parsed narrative text */}
        {inspections.length > 0 && !hasRealInspectionText && (
          <div className="mb-6 flex items-start gap-3 rounded-sm border border-amber-400 bg-amber-50 px-5 py-4">
            <span className="mt-0.5 shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-amber-700">
              Note
            </span>
            <p className="text-[13.5px] leading-relaxed text-amber-900">
              Inspection reports for this facility have not yet been parsed — we only have links to the
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
          <div className="border border-paper-rule bg-paper-2 px-6 py-8 text-center">
            <p className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3 tracking-wide">
              Individual inspection and deficiency records are scraped in a separate pipeline. This
              section will populate with dated citations as that pipeline runs.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border border-paper-rule bg-paper-2">
            {inspections.map((insp) => (
              <InspectionItem
                key={insp.id}
                insp={insp}
                defs={deficienciesByInspection.get(insp.id) ?? []}
                cfg={cfg}
              />
            ))}
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
            hiddenCount={hiddenOlderCount}
            oldestYear={oldestHiddenYear}
          />
        )}
      </div>
    </section>
  );
}
