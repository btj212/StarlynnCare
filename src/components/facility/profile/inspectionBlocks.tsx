import type { FacilityProfile, InspectionRow, DeficiencyRow } from "@/lib/facility/loadFacilityProfile";
import { agencyLabelForInspection } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";

// A stored plain-language summary is shown even when the source file has no
// long narrative. The placeholder check is only for the summary text itself.
const WA_PLACEHOLDER_RE_UI = /^—:\s*WA DSHS report:/i;
const URL_RE_UI = /^https?:\/\//i;

export function summaryIsUsable(summary: string | null | undefined): boolean {
  // A stored summary stands on its own. Illinois and several other states
  // never have a long source narrative; hiding the summary in that case
  // left families with the raw citation line.
  if (!summary) return false;
  const text = summary.trim();
  if (text.length < 80) return false;
  if (WA_PLACEHOLDER_RE_UI.test(text)) return false;
  if (/^(I don't have enough|I cannot write|I can't write)\b/i.test(text)) return false;
  return true;
}

function isPdfUrl(text: string | null | undefined): boolean {
  return !!text && URL_RE_UI.test(text.trim());
}

const MIN_FOLLOW_UP_CHARS = 40;

/** A stored plan shorter than this is a stub such as Arizona's "View" link label. */
function followUpText(value: string | null): string | null {
  const text = value?.trim() ?? "";
  if (text.length < MIN_FOLLOW_UP_CHARS) return null;
  // Colorado stores this sentence on citations that have no plan.
  if (/^a plan of correction was not required\b/i.test(text)) return null;
  return text;
}

function formatFine(value: string | number | null): string | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100) % 100;
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function correctionLabel(status: string | null): string | null {
  if (status === "corrected") return "Marked corrected on the DHS report";
  if (status === "open") return "Not marked corrected";
  return null;
}

function severityToneClass(tone: "danger" | "warn" | "info" | "ok" | "mute"): string {
  switch (tone) {
    case "danger": return "bg-rust text-white";
    case "warn":   return "bg-gold-soft text-[#6E5520]";
    case "ok":     return "bg-teal-soft text-teal-deep";
    default:       return "bg-paper-rule text-ink-2";
  }
}

export function DeficiencyBlock({
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
        // For states where `description` carries the cited regulation text
        // rather than the inspector's finding (e.g. MO), relabel so we don't
        // imply this paragraph is the specific finding — unless a real
        // inspector_narrative has since been ingested.
        const ruleOnly = !!cfg.deficiencyTextIsRuleOnly && !def.inspector_narrative;
        return (
          <>
            <div className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-rust">
              {ruleOnly ? "Regulation cited" : "Verbatim citation text"}{regCode ? ` · ${regCode}` : ""}
            </div>
            <p className="font-[family-name:var(--font-display)] text-[18px] italic leading-[1.4] text-ink">
              &ldquo;{narrative}&rdquo;
            </p>
            {ruleOnly && (
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-ink-3">
                This is the rule that was cited, not the inspector&rsquo;s specific
                finding.
              </p>
            )}
          </>
        );
      })()}
      <FindingFollowUp def={def} cfg={cfg} />
    </div>
  );
}

function FindingFollowUp({
  def,
  cfg,
}: {
  def: DeficiencyRow;
  cfg: FacilityProfile["cfg"];
}) {
  const followUp = cfg.followUp;
  if (!followUp) return null;

  const plan = followUp.label ? followUpText(def.plan_of_correction) : null;
  const fine = followUp.showFine ? formatFine(def.civil_money_penalty) : null;
  const correction = followUp.showStatus ? correctionLabel(def.status) : null;
  if (!plan && !fine && !correction) return null;

  return (
    <div className="mt-3">
      {(correction || fine) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {correction && (
            <span
              className={`font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide px-1.5 py-0.5 ${
                def.status === "corrected"
                  ? "bg-teal-soft text-teal-deep"
                  : "bg-gold-soft text-amber-700"
              }`}
            >
              {correction}
            </span>
          )}
          {fine && (
            <span className="bg-paper px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-ink-2">
              Fine: {fine}
            </span>
          )}
        </div>
      )}
      {plan && followUp.label && (
        <details>
          <summary className="cursor-pointer font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-ink-3">
            {followUp.label}
          </summary>
          <p className="mt-2 whitespace-pre-wrap font-[family-name:var(--font-sans)] text-[15px] leading-relaxed text-ink-2">
            {plan}
          </p>
        </details>
      )}
    </div>
  );
}

/** Values both the profile row and the full-report page derive from one visit. */
export function inspectionFacts(insp: InspectionRow, defs: DeficiencyRow[]) {
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
  return {
    isSubGap,
    rawNarrative,
    inspector,
    duration,
    hasSummary: summaryIsUsable(insp.narrative_summary),
    hasFullCitationBody: defs.length > 0 || isSubGap || !!rawNarrative,
  };
}

export function InspectionMetaRow({
  inspector,
  duration,
}: {
  inspector: string | null;
  duration: string | null;
}) {
  if (!inspector && !duration) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-4 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-3">
      {inspector && <span>Inspector · {inspector}</span>}
      {duration && <span>{duration}</span>}
    </div>
  );
}

export function PlainLanguageSummary({ text }: { text: string | null }) {
  return (
    <div className="mb-4 rounded-[14px] border border-teal/25 bg-teal-soft/40 px-4 py-3.5">
      <p className="mb-1.5 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.12em] text-teal">
        Plain-language summary
      </p>
      <p className="text-[15px] leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}

export function SubstantiatedNote() {
  return (
    <div className="mt-3 rounded-[14px] border-l-[3px] border-rust bg-[#FBE5DC] px-5 py-3">
      <p className="font-sans text-[13.5px] font-semibold text-amber-700">
        Substantiated — the state found a violation and issued a citation. Full citation details are on file with the state.
      </p>
    </div>
  );
}

export function OfficialReportLink({
  insp,
  cfg,
}: {
  insp: InspectionRow;
  cfg: FacilityProfile["cfg"];
}) {
  if (!insp.source_url) return null;
  return (
    <div className="mt-4">
      <a
        href={insp.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-[family-name:var(--font-sans)] text-[12px] font-medium tracking-[0.02em] text-ink-3 transition-colors hover:text-ink-2"
      >
        View official {agencyLabelForInspection(insp, cfg).short} report
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3 w-3 shrink-0" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13L13 3M7 3h6v6" />
        </svg>
      </a>
    </div>
  );
}

/** Everything the state wrote for one visit. Rendered on the full-report page. */
export function InspectionFullText({
  insp,
  defs,
  cfg,
}: {
  insp: InspectionRow;
  defs: DeficiencyRow[];
  cfg: FacilityProfile["cfg"];
}) {
  const { isSubGap, rawNarrative, inspector, duration, hasSummary } = inspectionFacts(insp, defs);
  return (
    <div>
      <InspectionMetaRow inspector={inspector} duration={duration} />
      {hasSummary && <PlainLanguageSummary text={insp.narrative_summary} />}
      {defs.map((def) => (
        <DeficiencyBlock key={def.id} def={def} cfg={cfg} />
      ))}
      {isSubGap && <SubstantiatedNote />}
      {rawNarrative && (
        <details className="mt-5 group/notes">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-[family-name:var(--font-sans)] text-[12px] font-medium tracking-[0.02em] text-rust transition-colors hover:text-rust/70 [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5 shrink-0 transition-transform duration-200 group-open/notes:rotate-90" aria-hidden>
              <path d="M6 4l6 4-6 4V4z" />
            </svg>
            <span className="group-open/notes:hidden">Read raw inspector notes</span>
            <span className="hidden group-open/notes:inline">Close inspector notes</span>
          </summary>
          <p className="mt-3 whitespace-pre-line border-l-2 border-rust/30 pl-4 text-[13px] leading-relaxed text-ink-2">
            {rawNarrative}
          </p>
        </details>
      )}
      <OfficialReportLink insp={insp} cfg={cfg} />
    </div>
  );
}
