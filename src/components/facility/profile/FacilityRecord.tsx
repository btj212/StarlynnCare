import type { FacilityProfile, TimelinePoint, ScopeSeverityCell } from "@/lib/facility/loadFacilityProfile";
import { SectionHead } from "@/components/editorial/SectionHead";
import Link from "next/link";

// ─── Timeline rail ─────────────────────────────────────────────────────────

function TimelineRail({ timeline, windowMonths }: { timeline: TimelinePoint[]; windowMonths: number }) {
  if (timeline.length === 0) {
    return (
      <div className="flex h-[130px] items-center justify-center border-b border-ink">
        <span className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3 tracking-wide">No inspection activity in this window.</span>
      </div>
    );
  }

  const totalWeighted = timeline.reduce((s, p) => s + p.facilityScore, 0);
  const lastCited = [...timeline].reverse().find((p) => p.cited);
  const lastCitedLabel = lastCited
    ? (() => {
        const [y, mo] = lastCited.month.split("-");
        const d = new Date(parseInt(y), parseInt(mo) - 1);
        return d.toLocaleString("en-US", { month: "short", year: "numeric" }).toUpperCase();
      })()
    : null;

  const peerMedianY = 50; // visual mid-point of the rail (percentage)

  // Axis labels
  const firstMonth = timeline[0]?.month ?? "";
  const lastMonth = timeline[timeline.length - 1]?.month ?? "";
  const fmtAxis = (m: string) => {
    const [y, mo] = m.split("-");
    const d = new Date(parseInt(y), parseInt(mo) - 1);
    return d.toLocaleString("en-US", { month: "short", year: "numeric" });
  };

  const lastCitedIdx = lastCited
    ? timeline.findIndex((p) => p.month === lastCited.month)
    : -1;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div className="font-[family-name:var(--font-display)] text-[64px] leading-[0.9] tracking-[-0.02em] text-grade-a">
          {totalWeighted.toFixed(0)}
          <span className="font-[family-name:var(--font-mono)] ml-2 text-[0.32em] tracking-wide text-ink-3">
            weighted score · {windowMonths} mo
          </span>
        </div>
        <div className="max-w-[38ch] text-right font-[family-name:var(--font-display)] text-[17px] italic text-ink-2">
          {totalWeighted === 0
            ? "No citation activity in this window."
            : `${lastCitedLabel ? `Last citation: ${lastCitedLabel}.` : ""} Compared against peer median (dashed).`}
        </div>
      </div>

      {/* Rail */}
      <div className="relative h-[130px] border-b border-ink">
        {/* Peer median dashed line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-ink-4"
          style={{ top: `${peerMedianY}%` }}
        />
        <div
          className="absolute right-1 font-[family-name:var(--font-mono)] text-[9.5px] text-ink-3 tracking-[0.06em]"
          style={{ top: `calc(${peerMedianY}% - 16px)` }}
        >
          peer median
        </div>

        {/* Month bars */}
        {timeline.map((p, i) => {
          const left = ((i + 0.5) / timeline.length) * 100;
          const height = p.cited ? 24 : 4;
          return (
            <div
              key={p.month}
              className="absolute -translate-x-1/2"
              style={{
                left: `${left}%`,
                bottom: 0,
                width: 14,
                height,
                background: p.cited ? "var(--color-rust)" : "var(--color-paper-rule)",
              }}
            />
          );
        })}

        {/* Marker for last cited month */}
        {lastCited && lastCitedIdx >= 0 && (
          <div
            className="absolute bottom-0 -translate-x-1/2"
            style={{ left: `${((lastCitedIdx + 0.5) / timeline.length) * 100}%`, width: 1.5, height: 90, background: "var(--color-ink)" }}
          >
            <div className="absolute -left-[5px] -top-2.5 h-3 w-3 rounded-full border-2 border-paper-2 bg-rust" />
            <div className="absolute -left-9 -top-8 w-20 text-center font-[family-name:var(--font-mono)] text-[9.5px] leading-tight text-rust tracking-[0.04em]">
              {lastCitedLabel}
            </div>
          </div>
        )}
      </div>

      {/* Axis labels */}
      <div className="flex justify-between font-[family-name:var(--font-mono)] text-[10px] text-ink-3 tracking-[0.06em]">
        <span>{fmtAxis(firstMonth)}</span>
        <span>{fmtAxis(lastMonth)}</span>
      </div>
    </div>
  );
}

// ─── Scope × Severity heatmap ──────────────────────────────────────────────

const SCOPES = ["isolated", "pattern", "widespread"] as const;
const SEV_ROWS = [4, 3, 2, 1] as const;
const SEV_LABELS: Record<number, string> = {
  4: "Sev 4 · IJ",
  3: "Sev 3",
  2: "Sev 2",
  1: "Sev 1",
};

function heatFill(count: number, sev: number): string {
  if (count === 0) return "#faf7f2";
  if (sev === 4) return count >= 2 ? "#8b3318" : "#b5532e";
  if (count >= 4) return "#cc7b5a";
  if (count >= 2) return "#dda89d";
  return "#eed6cf";
}

function cmsCellCode(sev: number, scope: string): string {
  const col = SCOPES.indexOf(scope as typeof SCOPES[number]);
  if (col === -1) return "";
  const codes: Record<number, string[]> = {
    1: ["A", "B", "C"],
    2: ["D", "E", "F"],
    3: ["G", "H", "I"],
    4: ["J", "K", "L"],
  };
  return codes[sev]?.[col] ?? "";
}

function ScopeSeverityGrid({ grid }: { grid: ScopeSeverityCell[] }) {
  const lookup = new Map<string, ScopeSeverityCell>();
  for (const cell of grid) lookup.set(`${cell.sev}-${cell.scope}`, cell);

  const total = grid.reduce((s, c) => s + c.count, 0);

  return (
    <div className="border border-paper-rule bg-paper-2 p-7">
      <div className="mb-1 flex items-baseline justify-between">
        <h4 className="font-[family-name:var(--font-display)] text-[24px] font-normal m-0">Finding distribution</h4>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-ink-3">
          {total === 0 ? "none" : `${total} total`} · 36 months
        </span>
      </div>
      <p className="mb-4 font-[family-name:var(--font-display)] text-[18px] italic text-ink-2">
        Scope × Severity (CMS A–L)
      </p>

      {total === 0 ? (
        <div className="flex h-24 items-center justify-center font-[family-name:var(--font-mono)] text-[12px] text-ink-3">
          No findings in the last 36 months.
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "62px repeat(3, 1fr)" }}>
          {/* Header row */}
          <div />
          {SCOPES.map((s) => (
            <div key={s} className="py-1 text-center font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-wide text-ink-3">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          ))}

          {/* Data rows */}
          {SEV_ROWS.map((sev) => (
            <>
              <div
                key={`lbl-${sev}`}
                className={`flex items-center pr-2 text-right font-[family-name:var(--font-mono)] text-[9px] ${sev === 4 ? "font-semibold text-gold" : "text-ink-3"}`}
              >
                {SEV_LABELS[sev]}
              </div>
              {SCOPES.map((scope) => {
                const cell = lookup.get(`${sev}-${scope}`);
                const count = cell?.count ?? 0;
                const fill = heatFill(count, sev);
                const code = cmsCellCode(sev, scope);
                return (
                  <div
                    key={`${sev}-${scope}`}
                    className="relative m-0.5 flex min-h-[36px] items-center justify-center rounded-[3px] border"
                    style={{
                      background: fill,
                      borderColor: sev === 4 ? "#c8a26b" : "#e2e8f0",
                      borderWidth: sev === 4 ? 1.5 : 0.5,
                    }}
                  >
                    <span className="absolute left-1 top-1 font-[family-name:var(--font-mono)] text-[7px] text-ink-3/80">
                      {code}
                    </span>
                    {count > 0 && (
                      <span
                        className="font-semibold tabular-nums"
                        style={{ fontSize: 12, color: count >= 2 ? "#faf7f2" : "#1f1b16" }}
                      >
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Compact inspection list ────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function CompactInspectionList({ profile }: { profile: FacilityProfile }) {
  const { inspections, deficienciesByInspection, cfg } = profile;

  return (
    <div className="border border-paper-rule bg-paper-2">
      {inspections.map((insp) => {
        const defs = deficienciesByInspection.get(insp.id) ?? [];
        const outcome = insp.raw_data?.outcome;
        const isSubGap =
          insp.is_complaint &&
          outcome === "Substantiated" &&
          defs.length === 0;
        const hasCitation = defs.length > 0 || isSubGap;
        const clean = !hasCitation;

        const worstDef = defs.find((d) => d.class === "Type A") ?? defs[0] ?? null;
        const tag = worstDef ? cfg.formatSeverityTag(worstDef as Parameters<typeof cfg.formatSeverityTag>[0]) : null;

        return (
          <a
            key={insp.id}
            href="#full-record"
            className="grid items-center border-b border-paper-rule px-5 py-4 transition-colors hover:bg-paper last:border-b-0"
            style={{ gridTemplateColumns: "100px 1fr 100px 24px" }}
          >
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-2 tracking-[0.06em]">
              {insp.inspection_date}
            </span>
            <div>
              <div className="font-[family-name:var(--font-display)] text-[18px] tracking-[-0.005em]">
                {insp.is_complaint ? "Complaint Investigation" : insp.inspection_type === "other" ? "Other Visit" : "Annual Compliance Visit"}
              </div>
              <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-ink-3">
                {insp.is_complaint && outcome ? `${outcome}` : cfg.agencyShort}
              </div>
            </div>
            <div
              className={`text-right font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] ${
                clean ? "text-grade-a" : "font-semibold text-rust"
              }`}
            >
              {isSubGap
                ? "Citation on file"
                : defs.length === 0
                ? "No findings"
                : tag
                ? `${defs.length} · ${tag.label}`
                : `${defs.length} def.`}
            </div>
            <span className="text-right text-ink-3">→</span>
          </a>
        );
      })}
    </div>
  );
}

// ─── Main section ───────────────────────────────────────────────────────────

export function FacilityRecord({ profile }: { profile: FacilityProfile }) {
  const { timeline, scopeSeverityGrid, totals, cfg } = profile;

  return (
    <section id="record" className="border-b border-paper-rule py-16">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="§ 03 · The Record"
          title={
            <>
              Citation history, <em>plotted month by month.</em>
            </>
          }
          deck={
            totals.deficiencies === 0
              ? "No citations in the last 36 months."
              : `${totals.deficiencies} deficiencie${totals.deficiencies === 1 ? "" : "s"} on record. Each bar is a month with a citation.`
          }
        />

        {/* Top row: timeline rail (left) + scope×severity grid (right) */}
        <div className="grid gap-7 md:grid-cols-[1.6fr_1fr]">
          <div className="border border-paper-rule bg-paper-2 p-8">
            <TimelineRail timeline={timeline} windowMonths={cfg.timelineWindowMonths} />
          </div>
          <ScopeSeverityGrid grid={scopeSeverityGrid} />
        </div>

        {/* Full-width inspection list below */}
        <div className="mt-7">
          <CompactInspectionList profile={profile} />
        </div>

        <div className="mt-4 flex justify-end">
          <a href="#full-record" className="border-b border-rust pb-px font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.06em] text-rust">
            View raw inspection records →
          </a>
        </div>
      </div>
    </section>
  );
}
