/**
 * QualitySnapshot — top-of-page facility quality section.
 *
 * React Server Component. Zero client-side fetches. Inline SVG for all charts.
 * Single Supabase RPC call: facility_snapshot(p_facility_id).
 *
 * Layout (in order):
 *   1. Grade card  — large letter + 4 merged bars (with descriptions + median tick);
 *                    <details> expands a "show the math" panel
 *   2. Two-up row  — trajectory sparkline (left) + scope×severity heatmap (right)
 *
 * The standalone BulletStrip and PullQuote components have been removed.
 * Peer count and "updated" badge live in the section header.
 */

import { tryPublicSupabaseClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

type SnapshotMetric = {
  value: number;
  percentile: number | null;
  peer_median: number;
};

type SnapshotPayload = {
  facility: {
    id: string;
    name: string;
    beds: number | null;
    state_code: string;
    license_type: string | null;
  };
  peer_set: {
    definition: string;
    n: number;
    fallback_level: number;
  };
  metrics: {
    severity: SnapshotMetric;
    repeats: SnapshotMetric;
    frequency: SnapshotMetric;
    trajectory: SnapshotMetric;
  };
  grade: { letter: string; composite_percentile: number } | null;
  has_inspections: boolean;
  trajectory_series: Array<{
    month: string;
    facility_score: number;
    peer_median_score: number;
  }>;
  heatmap: Array<{
    severity: number;
    scope: string;
    count: number;
    tags: string[] | null;
  }>;
  pull_quote: { date: string; tag: string | null; text: string } | null;
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** Map care_category to a readable peer-set label. */
const CARE_LABEL: Record<string, string> = {
  rcfe_memory_care: "RCFE memory care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF memory care",
  alf_general: "ALF",
  snf_general: "SNF",
  snf_dementia_scu: "SNF dementia care",
  ccrc: "CCRC",
};
function careLabel(careCategory: string | undefined): string {
  return careCategory ? (CARE_LABEL[careCategory] ?? "care") : "care";
}

/** Convert a 0–100 "higher is better" percentile to a short label. */
function pctLabel(pct: number | null): string {
  if (pct === null) return "—";
  if (pct >= 80) return `top ${100 - pct}%`;
  if (pct <= 20) return `bottom ${pct}%`;
  return `${pct}th percentile`;
}

/** Grade letter → CSS colour token (as inline style hex). */
function gradeColor(letter: string | undefined): string {
  if (!letter) return "#9a938a"; // qs-muted
  if (letter.startsWith("A")) return "#6b8f71"; // good
  if (letter.startsWith("B")) return "#c8a26b"; // accent
  if (letter.startsWith("C")) return "#b7791f"; // amber
  return "#b5532e"; // bad (D / F)
}

/** Grade letter → lighter background hex. */
function gradeBg(letter: string | undefined): string {
  if (!letter) return "#f5f3f0";
  if (letter.startsWith("A")) return "#edf4ee";
  if (letter.startsWith("B")) return "#fdf6ec";
  if (letter.startsWith("C")) return "#fffbeb";
  return "#fdf1ed"; // D / F
}

/** Percentile → bar fill colour. */
function pctColor(pct: number | null): string {
  if (pct === null) return "#9a938a";
  if (pct >= 65) return "#6b8f71"; // good
  if (pct <= 35) return "#b5532e"; // bad
  return "#c8a26b"; // accent / middle
}

// ─────────────────────────────────────────────────────────────────
// Grade Card (merged with percentile strip)
// ─────────────────────────────────────────────────────────────────

// Trajectory is intentionally excluded from the grade card bars — a facility
// with zero deficiencies in both windows has delta=0, which ranks as "median"
// and would unfairly penalise clean facilities.  Trend context is shown in
// the sparkline below instead.
const METRIC_ROWS: [string, keyof SnapshotPayload["metrics"], string][] = [
  ["Severity", "severity", "Weighted citations per bed"],
  ["Repeats", "repeats", "Repeat deficiencies as share of total"],
  ["Frequency", "frequency", "Deficiencies per inspection"],
];

function GradeCard({ payload }: { payload: SnapshotPayload }) {
  const { grade, metrics, facility, peer_set } = payload;
  const letter = grade?.letter;
  const composite = grade?.composite_percentile ?? null;
  const color = gradeColor(letter);
  const bg = gradeBg(letter);

  const noData = !payload.has_inspections;

  const mathText = letter
    ? [
        `${facility.name} scores ${letter}.`,
        `Better than ${composite}% of comparable California ${facility.license_type ?? "care"} facilities.`,
        `Severity: ${pctLabel(metrics.severity.percentile)}.`,
        `Repeats: ${pctLabel(metrics.repeats.percentile)}.`,
        `Frequency: ${pctLabel(metrics.frequency.percentile)}.`,
      ].join(" ")
    : null;

  return (
    <details className="group w-full">
      <summary
        className="list-none cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={
          letter
            ? `Grade ${letter} — click to show how this grade was calculated`
            : "Quality grade — click to learn more"
        }
      >
        <div
          className="mt-5 flex flex-col sm:flex-row sm:items-start gap-5 rounded-xl border p-5 shadow-card transition-shadow group-hover:shadow-card-hover"
          style={{ borderColor: `${color}33`, backgroundColor: bg }}
        >
          {/* Large grade letter */}
          <div
            className="flex-shrink-0 w-24 h-24 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}18` }}
          >
            <span
              className="font-[family-name:var(--font-serif)] leading-none select-none"
              style={{ fontSize: "6rem", color, lineHeight: 1 }}
              aria-hidden="true"
            >
              {noData ? "—" : (letter ?? "—")}
            </span>
          </div>

          {/* Bars with descriptions and median ticks */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[--color-qs-muted] mb-3">
              Quality grade
              <span className="ml-1.5 normal-case font-normal tracking-normal text-[--color-qs-muted] group-hover:underline underline-offset-2">
                · click to show how this was calculated
                <svg
                  aria-hidden="true"
                  className="inline ml-1 h-3 w-3 -translate-y-px"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </p>
            <div className="space-y-3">
              {METRIC_ROWS.map(([label, key, desc]) => {
                const pct = metrics[key].percentile;
                const fillColor = pctColor(pct);
                return (
                  <div key={label}>
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-xs text-[--color-qs-muted] shrink-0">
                        {label}
                      </span>
                      {/* Track with overflow-hidden for fill + absolute median tick on top */}
                      <div className="relative flex-1">
                        <div className="h-1.5 rounded-full bg-black/8 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct ?? 0}%`,
                              backgroundColor: fillColor,
                            }}
                          />
                        </div>
                        {/* Median tick at 50% — outside overflow-hidden so it renders on top */}
                        <div
                          className="absolute top-0 h-1.5 w-0.5 -translate-x-1/2 rounded-full"
                          style={{
                            left: "50%",
                            backgroundColor: "rgba(154,147,138,0.45)",
                          }}
                          aria-hidden="true"
                        />
                      </div>
                      <span
                        className="w-10 text-right text-xs font-semibold tabular-nums shrink-0"
                        style={{ color: fillColor }}
                      >
                        {pct !== null ? `${pct}th` : "—"}
                      </span>
                    </div>
                    <p className="mt-0.5 pl-[5.5rem] text-[10px] text-[--color-qs-muted]">
                      {desc}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] text-[--color-qs-muted]/70">
              Tick mark at 50% = peer median · higher percentile = better facility
            </p>
          </div>
        </div>
      </summary>

      {/* "Show the math" expanded panel */}
      <div
        className="mt-2 rounded-lg border px-5 py-4 text-sm leading-relaxed text-[--color-ink]"
        style={{ borderColor: `${color}33`, backgroundColor: bg }}
      >
        {mathText ? (
          <p>{mathText}</p>
        ) : (
          <p className="text-[--color-qs-muted]">
            No inspection data in the past 36 months — grade not available.
          </p>
        )}
        <p className="mt-2 text-xs text-[--color-qs-muted]">
          Each metric is converted to a 0–100 percentile within the peer set
          (higher = better). The composite grade averages all four. Peer set:{" "}
          {peer_set.definition} ({peer_set.n} facilities).
        </p>
      </div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────
// Trajectory Sparkline (inline SVG)
// ─────────────────────────────────────────────────────────────────

function TrajectorySparkline({
  series,
  trajectoryPct,
}: {
  series: SnapshotPayload["trajectory_series"];
  trajectoryPct: number | null;
  trajectoryValue: number;
}) {
  const W = 280;
  const H = 64;
  const PAD_LEFT = 4;
  const PAD_RIGHT = 4;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 8;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const hasData = series.some(
    (p) => p.facility_score > 0 || p.peer_median_score > 0,
  );
  if (!hasData) {
    return (
      <div className="rounded-xl border border-[--color-sc-border] bg-white px-5 py-4 shadow-card flex items-center justify-center min-h-[130px]">
        <p className="text-xs text-[--color-qs-muted] text-center">
          No inspection activity in the last 24 months.
        </p>
      </div>
    );
  }

  const maxY = Math.max(
    ...series.map((p) => Math.max(p.facility_score, p.peer_median_score)),
    1,
  );
  const n = series.length;

  const xOf = (i: number) =>
    PAD_LEFT + (i / Math.max(n - 1, 1)) * plotW;
  const yOf = (v: number) =>
    PAD_TOP + (1 - v / maxY) * plotH;

  const facilityPoints = series
    .map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.facility_score).toFixed(1)}`)
    .join(" ");
  const medianPoints = series
    .map(
      (p, i) => `${xOf(i).toFixed(1)},${yOf(p.peer_median_score).toFixed(1)}`,
    )
    .join(" ");

  const first6 = series.slice(0, 6).reduce((a, b) => a + b.facility_score, 0);
  const last6 = series.slice(-6).reduce((a, b) => a + b.facility_score, 0);
  const improving = last6 < first6;
  const stable = Math.abs(last6 - first6) < 1;
  const arrowColor = stable
    ? "#9a938a"
    : improving
      ? "#6b8f71"
      : "#b5532e";
  const arrowLabel = stable ? "stable" : improving ? "↓ improving" : "↑ worsening";

  const firstMonth = series[0]?.month ?? "";
  const lastMonth = series[series.length - 1]?.month ?? "";
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split("-");
    const d = new Date(parseInt(y), parseInt(mo) - 1);
    return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
  };

  // Total weighted score (sum of all facility monthly scores in window)
  const totalScore = series.reduce((sum, p) => sum + p.facility_score, 0);
  const lastActiveSeries = [...series].reverse().find((p) => p.facility_score > 0);
  const lastActiveMonth = lastActiveSeries
    ? fmtMonth(lastActiveSeries.month)
    : null;

  return (
    <div className="rounded-xl border border-[--color-sc-border] bg-white px-5 pt-4 pb-4 shadow-card">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-xs font-semibold text-[--color-ink]">
          Citation severity over time
        </p>
        <span className="text-xs font-medium" style={{ color: arrowColor }}>
          {arrowLabel}
        </span>
      </div>
      <p className="text-[10px] text-[--color-qs-muted] mb-2">
        Weighted severity score per month · 24 months
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        aria-hidden="true"
        overflow="visible"
      >
        <polyline
          points={medianPoints}
          fill="none"
          stroke="#9a938a"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
        />
        <polyline
          points={facilityPoints}
          fill="none"
          stroke={trajectoryPct !== null && trajectoryPct >= 50 ? "#6b8f71" : "#b5532e"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-[--color-qs-muted]">
          {fmtMonth(firstMonth)}
        </span>
        <span className="inline-flex items-center gap-1 text-[9px] text-[--color-qs-muted]">
          <svg width="18" height="6" aria-hidden="true" overflow="visible">
            <line
              x1="0" y1="3" x2="18" y2="3"
              stroke="#9a938a"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.8"
            />
          </svg>
          peer median
        </span>
        <span className="text-[9px] text-[--color-qs-muted]">
          {fmtMonth(lastMonth)}
        </span>
      </div>

      {/* Summary data lines — fill card height to match heatmap */}
      <div className="mt-3 border-t border-black/5 pt-2.5 flex gap-6">
        <div>
          <p className="text-[10px] text-[--color-qs-muted]">Weighted score (24mo)</p>
          <p className="text-sm font-semibold tabular-nums text-[--color-ink]">
            {totalScore.toFixed(0)}
          </p>
        </div>
        {lastActiveMonth && (
          <div>
            <p className="text-[10px] text-[--color-qs-muted]">Last citation</p>
            <p className="text-sm font-semibold text-[--color-ink]">
              {lastActiveMonth}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Scope × Severity Heatmap (inline SVG)
// ─────────────────────────────────────────────────────────────────

const SCOPES = ["isolated", "pattern", "widespread"] as const;
const SEV_ROWS = [4, 3, 2, 1] as const;

const SEV_LABELS: Record<number, string> = {
  4: "Sev 4 · IJ",
  3: "Sev 3",
  2: "Sev 2",
  1: "Sev 1",
};

const SEV_SHORT: Record<number, string> = {
  4: "IJ",
  3: "S3",
  2: "S2",
  1: "S1",
};

function cellCode(sev: number, scope: string): string {
  const col = SCOPES.indexOf(scope as (typeof SCOPES)[number]);
  if (col === -1) return "";
  const codes: Record<number, string[]> = {
    1: ["A", "B", "C"],
    2: ["D", "E", "F"],
    3: ["G", "H", "I"],
    4: ["J", "K", "L"],
  };
  return codes[sev]?.[col] ?? "";
}

function heatFill(count: number, sev: number): string {
  if (count === 0) return "#faf7f2";
  if (sev === 4) {
    if (count >= 2) return "#8b3318";
    return "#b5532e";
  }
  if (count >= 4) return "#cc7b5a";
  if (count >= 2) return "#dda89d";
  return "#eed6cf";
}

function HeatmapGrid({ heatmap }: { heatmap: SnapshotPayload["heatmap"] }) {
  const lookup = new Map<string, { count: number; tags: string[] | null }>();
  for (const cell of heatmap) {
    lookup.set(`${cell.severity}-${cell.scope}`, {
      count: cell.count,
      tags: cell.tags,
    });
  }

  const totalFindings = heatmap.reduce((s, c) => s + c.count, 0);

  const LABEL_W = 62;
  const COL_W = 58;
  const ROW_H = 36;
  const HEAD_H = 22;
  const svgW = LABEL_W + COL_W * 3;
  const svgH = HEAD_H + ROW_H * 4;

  return (
    <div className="rounded-xl border border-[--color-sc-border] bg-white px-5 pt-4 pb-3 shadow-card">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-xs font-semibold text-[--color-ink]">
          Finding distribution
        </p>
        <span className="text-[10px] text-[--color-qs-muted]">
          {totalFindings === 0 ? "none" : `${totalFindings} total`} · 36 months
        </span>
      </div>
      <p className="text-[10px] text-[--color-qs-muted] mb-2">
        Scope × Severity (CMS A–L)
      </p>

      {totalFindings === 0 ? (
        <div className="flex items-center justify-center h-24 text-xs text-[--color-qs-muted]">
          No findings in the last 36 months.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          role="img"
          aria-label="Scope and severity heatmap of inspector findings"
          style={{ maxHeight: 180 }}
        >
          {SCOPES.map((scope, ci) => (
            <text
              key={scope}
              x={LABEL_W + ci * COL_W + COL_W / 2}
              y={HEAD_H - 6}
              textAnchor="middle"
              fontSize="8"
              fill="#9a938a"
              fontFamily="inherit"
            >
              {scope.charAt(0).toUpperCase() + scope.slice(1)}
            </text>
          ))}

          {SEV_ROWS.map((sev, ri) =>
            SCOPES.map((scope, ci) => {
              const key = `${sev}-${scope}`;
              const cell = lookup.get(key) ?? { count: 0, tags: null };
              const fill = heatFill(cell.count, sev);
              const x = LABEL_W + ci * COL_W;
              const y = HEAD_H + ri * ROW_H;
              const code = cellCode(sev, scope);
              const isIJ = sev === 4;
              const tagList = cell.tags?.slice(0, 5).join(", ") ?? "";

              return (
                <g key={key}>
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={COL_W - 2}
                    height={ROW_H - 2}
                    rx="3"
                    fill={fill}
                    stroke={isIJ ? "#c8a26b" : "#e2e8f0"}
                    strokeWidth={isIJ ? "1.5" : "0.5"}
                  />
                  <text
                    x={x + 5}
                    y={y + 12}
                    fontSize="7"
                    fill="#9a938a"
                    fontFamily="inherit"
                    opacity="0.8"
                  >
                    {code}
                  </text>
                  {cell.count > 0 && (
                    <text
                      x={x + COL_W / 2}
                      y={y + ROW_H / 2 + 4}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="600"
                      fill={cell.count >= 2 ? "#faf7f2" : "#1f1b16"}
                      fontFamily="inherit"
                    >
                      {cell.count}
                    </text>
                  )}
                  {tagList && (
                    <title>
                      {sev === 4 ? "Immediate Jeopardy" : `Severity ${sev}`},{" "}
                      {scope}: {cell.count} finding
                      {cell.count !== 1 ? "s" : ""}. Sections: {tagList}
                    </title>
                  )}
                </g>
              );
            }),
          )}

          {SEV_ROWS.map((sev, ri) => (
            <g key={`label-${sev}`}>
              <text
                x={LABEL_W - 6}
                y={HEAD_H + ri * ROW_H + ROW_H / 2 + 3}
                textAnchor="end"
                fontSize="8"
                fill={sev === 4 ? "#c8a26b" : "#9a938a"}
                fontWeight={sev === 4 ? "600" : "400"}
                fontFamily="inherit"
              >
                {SEV_LABELS[sev]}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Zero-inspections state
// ─────────────────────────────────────────────────────────────────

function NoInspectionsState({ peerN }: { peerN: number }) {
  return (
    <div className="mt-8 rounded-xl border border-[--color-sc-border] bg-white px-6 py-8 text-center shadow-card">
      <p className="text-2xl font-[family-name:var(--font-serif)] text-[--color-qs-muted]">
        —
      </p>
      <p className="mt-2 text-sm text-[--color-qs-muted]">
        No inspection records in the last 36 months. Grade not available.
      </p>
      {peerN > 0 && (
        <p className="mt-1 text-xs text-[--color-qs-muted]">
          Compared against {peerN} peer facilities.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────────────

export async function QualitySnapshot({
  facilityId,
  updatedAt,
  careCategory,
}: {
  facilityId: string;
  updatedAt?: string | null;
  careCategory?: string;
}) {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;

  let payload: SnapshotPayload | null = null;
  try {
    const { data, error } = await supabase.rpc("facility_snapshot", {
      p_facility_id: facilityId,
    });
    if (error) {
      console.error("[QualitySnapshot] RPC error:", error.message);
      return null;
    }
    payload = data as SnapshotPayload | null;
  } catch (err) {
    console.error("[QualitySnapshot] Unexpected error:", err);
    return null;
  }

  if (!payload) return null;

  const { has_inspections, peer_set, metrics, trajectory_series, heatmap } = payload;

  const tooSmallPeerSet = peer_set.n < 10;

  return (
    <section aria-labelledby="qs-heading" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="qs-heading"
          className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-[--color-navy]"
        >
          Quality snapshot
        </h2>
        {updatedAt && (
          <span className="shrink-0 rounded-md bg-black/5 px-2 py-0.5 text-[11px] text-[--color-qs-muted]">
            Updated {updatedAt}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-[--color-muted]">
        Compared to{" "}
        <strong className="font-medium text-[--color-ink]">{peer_set.n}</strong>{" "}
        California {careLabel(careCategory)} facilities
        {peer_set.fallback_level === 0 ? " of similar size" : ""}, over the last 36 months.
        {peer_set.fallback_level > 0 && (
          <span className="text-[--color-qs-muted]">
            {" "}Bed-size filter relaxed due to small peer set.
          </span>
        )}
      </p>
      {tooSmallPeerSet && (
        <p className="mt-0.5 text-xs text-[--color-qs-muted]">
          Small peer set — interpret percentiles as ranges, not exact ranks.
        </p>
      )}

      {/* Source attribution */}
      <p className="mt-2 text-xs text-[--color-qs-muted]">
        Source: California Department of Social Services, Community Care Licensing Division.{" "}
        <a
          href="https://www.ccld.dss.ca.gov/carefacilitysearch/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[--color-ink] hover:underline underline-offset-2"
        >
          View raw inspection records →
        </a>
      </p>

      {!has_inspections ? (
        <NoInspectionsState peerN={peer_set.n} />
      ) : (
        <>
          {/* 1. Grade card (merged with percentile strip) */}
          <GradeCard payload={payload} />

          {/* 2. Two-up row: sparkline + heatmap */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TrajectorySparkline
              series={trajectory_series}
              trajectoryPct={metrics.trajectory.percentile}
              trajectoryValue={metrics.trajectory.value}
            />
            <HeatmapGrid heatmap={heatmap} />
          </div>
        </>
      )}

      {/* Anchor link down to the full inspection record */}
      <p className="mt-5">
        <a
          href="#inspections-heading"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[--color-teal] hover:underline underline-offset-2"
        >
          View inspections &amp; citations
          <svg aria-hidden className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
              clipRule="evenodd"
            />
          </svg>
        </a>
      </p>
    </section>
  );
}
