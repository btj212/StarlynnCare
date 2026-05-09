import type { FacilityProfile, InspectionRow, DeficiencyRow } from "@/lib/facility/loadFacilityProfile";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { Deficiency } from "@/lib/types";

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function severityToneClass(tone: "danger" | "warn" | "info" | "ok"): string {
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
  inspSourceUrl: string | null;
}) {
  // Cast to Deficiency for the formatter (DeficiencyRow is a subset)
  const d = def as unknown as Deficiency;
  const tag = cfg.formatSeverityTag(d);
  const formName = cfg.formNameForDeficiency(d);

  const regCode = def.code ? `${cfg.citationPrefix}${def.code}` : null;

  return (
    <div className="mt-3 rounded-sm border-l-2 border-rust bg-[#FBE5DC] px-5 py-4">
      {/* Tag row */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {tag && (
          <span className={`px-2.5 py-1 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.08em] ${severityToneClass(tag.tone)}`}>
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

      {/* Verbatim citation label */}
      {(def.inspector_narrative || def.description) && (
        <>
          <div className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-rust">
            Verbatim citation text{regCode ? ` · ${regCode}` : ""}
          </div>
          <p className="font-[family-name:var(--font-display)] text-[19px] italic leading-[1.4] text-ink">
            &ldquo;{def.inspector_narrative ?? def.description}&rdquo;
          </p>
        </>
      )}
    </div>
  );
}

function InspectionRow({
  insp,
  defs,
  cfg,
  index,
}: {
  insp: InspectionRow;
  defs: DeficiencyRow[];
  cfg: FacilityProfile["cfg"];
  index: number;
}) {
  const hasTypeA = defs.some((d) => d.class === "Type A");
  const isSubGap =
    insp.is_complaint &&
    insp.raw_data?.outcome === "Substantiated" &&
    defs.length === 0;
  const hasCitation = defs.length > 0 || isSubGap;

  const inspector = insp.raw_data?.inspector_name ?? null;
  const rawNarrative = (insp.raw_data?.narrative ?? "")
    .replace(/^(\d+\s+)+/, "")
    .replace(/^\*\*\*report continues from LIC9099\*\*\*\s*/i, "")
    .trim();

  const verdictLabel = isSubGap
    ? "Citation on file"
    : defs.length === 0
    ? "No findings"
    : `${defs.length} deficiencie${defs.length === 1 ? "" : "s"}`;

  const verdictClass = hasCitation
    ? "text-rust font-semibold"
    : "text-grade-a";

  const inspType = insp.is_complaint
    ? "Complaint Investigation"
    : insp.inspection_type === "other"
    ? "Other Visit"
    : "Annual Compliance Visit";

  const complaint = insp.complaint_id ? ` · ${insp.complaint_id}` : "";

  const areasLabel =
    insp.raw_data?.areas_examined ??
    insp.narrative_summary?.slice(0, 100) ??
    "—";

  return (
    <div className={`fp-fr-row border-b border-paper-rule last:border-b-0 ${hasCitation ? "bg-[#FBE5DC]/40" : ""}`}>
      {/* Main grid row — desktop */}
      <div className="hidden items-start gap-4 px-5 py-4 md:grid" style={{ gridTemplateColumns: "110px 1.3fr 1.3fr 2fr 1fr" }}>
        <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink">
          {insp.inspection_date}
        </span>
        <div>
          <span className="font-[family-name:var(--font-display)] text-[18px] leading-[1.2] tracking-[-0.005em]">
            {inspType}
          </span>
          {complaint && (
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-ink-3 tracking-[0.04em]">
              {complaint}
            </span>
          )}
        </div>
        <div className="font-sans text-[13px] leading-[1.45] text-ink-2">
          {inspector && <div>{inspector}</div>}
          {insp.raw_data?.duration_minutes && (
            <div className="text-ink-3">{Math.round(insp.raw_data.duration_minutes / 60 * 10) / 10} hrs on-site</div>
          )}
        </div>
        <div className="font-sans text-[13px] leading-[1.45] text-ink-2">{areasLabel}</div>
        <div className={`text-right font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] ${verdictClass}`}>
          {verdictLabel}
        </div>
      </div>

      {/* Card layout — mobile */}
      <div className="px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-2">{insp.inspection_date}</span>
          <span className={`font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide ${verdictClass}`}>
            {verdictLabel}
          </span>
        </div>
        <div className="mt-0.5 font-[family-name:var(--font-display)] text-[18px]">{inspType}</div>
        {areasLabel !== "—" && (
          <div className="mt-1 text-[13px] text-ink-2">{areasLabel}</div>
        )}
      </div>

      {/* Citation blocks */}
      {defs.map((def) => (
        <div key={def.id} className="px-5 pb-4">
          <DeficiencyBlock
            def={def}
            cfg={cfg}
            inspSourceUrl={insp.source_url}
          />
        </div>
      ))}

      {/* Substantiated complaint gap notice */}
      {isSubGap && (
        <div className="mx-5 mb-4 rounded-sm border-l-2 border-rust bg-[#FBE5DC] px-5 py-3">
          <p className="font-sans text-[13.5px] font-semibold text-amber-700">
            Substantiated — the state found a violation and issued a citation. Full citation details are on file with the state.
          </p>
        </div>
      )}

      {/* AI summary */}
      {insp.narrative_summary && (
        <div className="mx-5 mb-4 rounded-sm border border-teal/20 bg-teal-soft/35 px-4 py-3">
          <p className="mb-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-teal">
            Plain-language summary
          </p>
          <p className="text-[13.5px] leading-relaxed text-ink-2">{insp.narrative_summary}</p>
        </div>
      )}

      {/* Raw narrative (collapsed) */}
      {rawNarrative && (
        <details className="mx-5 mb-4">
          <summary className="cursor-pointer list-none font-[family-name:var(--font-mono)] text-[11px] text-teal hover:underline underline-offset-2">
            {insp.narrative_summary ? "View full inspector notes" : "Inspector notes"}
          </summary>
          <p className="mt-2 border-l-2 border-paper-rule pl-3 text-[13px] leading-relaxed text-ink-2 whitespace-pre-line">
            {rawNarrative}
          </p>
        </details>
      )}

      {/* Official source link */}
      {insp.source_url && (
        <div className="mx-5 mb-4 border-t border-paper-rule/40 pt-3">
          <a
            href={insp.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[11px] text-teal hover:underline underline-offset-2"
          >
            View official {cfg.agencyShort} report →
          </a>
        </div>
      )}
    </div>
  );
}

export function FacilityFullInspections({ profile }: { profile: FacilityProfile }) {
  const { inspections, deficienciesByInspection, totals, cfg } = profile;

  return (
    <section id="full-record" className="border-b border-paper-rule py-16">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="§ 06 · Full Inspection Record"
          title={
            <>
              Every {cfg.agencyShort} visit, <em>verbatim.</em>
            </>
          }
          deck={
            inspections.length === 0
              ? "No inspection records yet indexed for this facility."
              : `${inspections.length} inspection${inspections.length === 1 ? "" : "s"} in the public record, ordered most recent first. Each row is a primary ${cfg.agencyShort} document — date, inspector, areas examined, and the verbatim finding.`
          }
        />

        {/* Summary strip */}
        {inspections.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-8 border border-paper-rule bg-paper-2 px-6 py-4">
            <div className="text-center">
              <div className="font-[family-name:var(--font-display)] text-[40px] leading-none text-ink">{totals.inspections}</div>
              <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-ink-3">reports on file</div>
            </div>
            <div className="text-center">
              <div className="font-[family-name:var(--font-display)] text-[40px] leading-none text-ink">{totals.deficiencies}</div>
              <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-ink-3">total deficiencies</div>
            </div>
            {totals.typeA > 0 && (
              <div className="text-center">
                <div className="font-[family-name:var(--font-display)] text-[40px] leading-none text-rust">{totals.typeA}</div>
                <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-ink-3">severe (Type A)</div>
              </div>
            )}
          </div>
        )}

        {inspections.length === 0 ? (
          <div className="border border-paper-rule bg-paper-2 px-6 py-8 text-center">
            <p className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3 tracking-wide">
              Individual inspection and deficiency records are scraped in a separate pipeline. This section will populate with dated citations as that pipeline runs.
            </p>
          </div>
        ) : (
          <>
            {/* Table header — desktop only */}
            <div className="hidden border-b border-t border-paper-rule bg-ink px-5 py-3.5 md:grid" style={{ gridTemplateColumns: "110px 1.3fr 1.3fr 2fr 1fr" }}>
              {["Date", "Inspection type", "Inspector / Duration", "Areas examined", "Findings"].map((h) => (
                <span key={h} className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-gold-soft">
                  {h}
                </span>
              ))}
            </div>

            <div className="border border-paper-rule bg-paper-2">
              {inspections.map((insp, i) => (
                <InspectionRow
                  key={insp.id}
                  insp={insp}
                  defs={deficienciesByInspection.get(insp.id) ?? []}
                  cfg={cfg}
                  index={i}
                />
              ))}
            </div>
          </>
        )}

        {inspections.length > 0 && (
          <div className="mt-4 flex justify-end">
            <a
              href={`https://www.ccld.dss.ca.gov/carefacilitysearch/`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-b border-rust pb-px font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.06em] text-rust"
            >
              Open all raw {cfg.agencyShort} PDFs →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
