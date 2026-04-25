/**
 * QualitySnapshot — top-of-page facility quality section.
 *
 * React Server Component. Zero client-side fetches. Inline SVG for all charts.
 * Single Supabase RPC call: facility_snapshot(p_facility_id).
 *
 * Layout (in order):
 *   1. Grade card  — large letter + 4 sub-bars; <details> reveals "show the math"
 *   2. Percentile bullet strip — 4 horizontal bars (severity/repeats/frequency/trajectory)
 *   3. Two-up row — trajectory sparkline (left) + scope×severity heatmap (right)
 *   4. Pull quote — most severe inspector narrative
 *   5. Peer attribution footnote
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

/** Narrative description of a trajectory metric value. */
function trajectoryLabel(value: number, pct: number | null): string {
  if (pct === null) return "no data";
  if (value < -0.01) return "improving";
  if (value > 0.01) return "worsening";
  return "stable";
}

/** Percentile → bar fill colour. */
function pctColor(pct: number | null): string {
  if (pct === null) return "#9a938a";
  if (pct >= 65) return "#6b8f71"; // good
  if (pct <= 35) return "#b5532e"; // bad
  return "#c8a26b"; // accent / middle
}

// ─────────────────────────────────────────────────────────────────
// Grade Card
// ─────────────────────────────────────────────────────────────────

function GradeCard({ payload }: { payload: SnapshotPayload }) {
  const { grade, metrics, facility, peer_set } = payload;
  const letter = grade?.letter;
  const composite = grade?.composite_percentile ?? null;
  const color = gradeColor(letter);
  const bg = gradeBg(letter);

  const noData = !payload.has_inspections;

  // "Show the math" narrative
  const mathText = letter
    ? [
        `${facility.name} scores ${letter}.`,
        `Better than ${composite}% of comparable California ${facility.license_type ?? "care"} facilities.`,
        `Severity: ${pctLabel(metrics.severity.percentile)}.`,
        `Repeats: ${pctLabel(metrics.repeats.percentile)}.`,
        `Frequency: ${pctLabel(metrics.frequency.percentile)}.`,
        `Trajectory: ${trajectoryLabel(metrics.trajectory.value, metrics.trajectory.percentile)}.`,
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
        {/* The visible card */}
        <div
          className="mt-8 flex flex-col sm:flex-row sm:items-center gap-5 rounded-xl border p-5 shadow-card transition-shadow group-hover:shadow-card-hover"
          style={{
            borderColor: `${color}33`,
            backgroundColor: bg,
          }}
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

          {/* Sub-bars + label */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[--color-qs-muted] mb-3">
              Quality grade
              <span className="ml-1.5 text-[--color-qs-muted] normal-case font-normal tracking-normal">
                · click to show how this was calculated
              </span>
            </p>
            <div className="space-y-2">
              {(
                [
                  ["Severity", metrics.severity.percentile],
                  ["Repeats", metrics.repeats.percentile],
                  ["Frequency", metrics.frequency.percentile],
                  ["Trajectory", metrics.trajectory.percentile],
                ] as [string, number | null][]
              ).map(([label, pct]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-[--color-qs-muted] shrink-0">
                    {label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-black/8 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct ?? 0}%`,
                        backgroundColor: pctColor(pct),
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-medium tabular-nums w-8 text-right"
                    style={{ color: pctColor(pct) }}
                  >
                    {pct !== null ? `${pct}` : "—"}
                  </span>
                </div>
              ))}
            </div>
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
// Percentile Bullet Strip
// ─────────────────────────────────────────────────────────────────

function BulletStrip({ metrics }: { metrics: SnapshotPayload["metrics"] }) {
  const rows: [string, string, SnapshotMetric][] = [
    ["Severity", "Weighted citations per bed", metrics.severity],
    ["Repeats", "Repeat deficiencies as share of total", metrics.repeats],
    ["Frequency", "Deficiencies per inspection", metrics.frequency],
    ["Trajectory", "Improving or worsening vs. prior year", metrics.trajectory],
  ];

  return (
    <div className="mt-5 rounded-xl border border-[--color-sc-border] bg-white px-5 py-4 shadow-card">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[--color-qs-muted]">
        Percentile within peer group — higher is better
      </p>
      <div className="space-y-3">
        {rows.map(([label, desc, metric]) => {
          const pct = metric.percentile;
          const fillColor = pctColor(pct);
          const markerLeft = pct !== null ? `${pct}%` : "50%";

          return (
            <div key={label}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-medium text-[--color-ink]">
                  {label}
                </span>
                <span className="text-[10px] text-[--color-qs-muted] hidden sm:block">
                  {desc}
                </span>
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: fillColor }}
                >
                  {pct !== null ? `${pct}th` : "—"}
                </span>
              </div>
              {/* Bar */}
              <div className="relative h-2 rounded-full bg-black/6">
                {/* Peer median tick at 50% */}
                <div
                  className="absolute top-0 w-px h-2 bg-[--color-qs-muted]/50"
                  style={{ left: "50%" }}
                  aria-hidden="true"
                />
                {/* Facility marker */}
                {pct !== null && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{
                      left: markerLeft,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: fillColor,
                    }}
                    aria-label={`${pct}th percentile`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-[--color-qs-muted]">
        Tick mark at 50% = peer median.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Trajectory Sparkline (inline SVG)
// ─────────────────────────────────────────────────────────────────

function TrajectorySparkline({
  series,
  trajectoryPct,
  trajectoryValue,
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

  // Check if there's actually any data to show
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

  // Determine direction arrow
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

  // First + last month labels
  const firstMonth = series[0]?.month ?? "";
  const lastMonth = series[series.length - 1]?.month ?? "";
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split("-");
    const d = new Date(parseInt(y), parseInt(mo) - 1);
    return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
  };

  return (
    <div className="rounded-xl border border-[--color-sc-border] bg-white px-5 pt-4 pb-3 shadow-card">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-xs font-semibold text-[--color-ink]">
          Citation severity over time
        </p>
        <span
          className="text-xs font-medium"
          style={{ color: arrowColor }}
        >
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
        {/* Peer median — dashed */}
        <polyline
          points={medianPoints}
          fill="none"
          stroke="#9a938a"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
        />
        {/* Facility line — solid */}
        <polyline
          points={facilityPoints}
          fill="none"
          stroke={trajectoryPct !== null && trajectoryPct >= 50 ? "#6b8f71" : "#b5532e"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-[--color-qs-muted]">
          {fmtMonth(firstMonth)}
        </span>
        <span className="text-[9px] text-[--color-qs-muted]">
          — peer median
        </span>
        <span className="text-[9px] text-[--color-qs-muted]">
          {fmtMonth(lastMonth)}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Scope × Severity Heatmap (inline SVG)
// ─────────────────────────────────────────────────────────────────

const SCOPES = ["isolated", "pattern", "widespread"] as const;
const SEV_ROWS = [4, 3, 2, 1] as const; // top = most severe

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

/** Severity + scope → CMS A–L cell code. */
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

/** Count → fill color (paper → bad). */
function heatFill(count: number, sev: number): string {
  if (count === 0) return "#faf7f2"; // paper
  if (sev === 4) {
    if (count >= 2) return "#8b3318"; // dark bad
    return "#b5532e"; // bad
  }
  if (count >= 4) return "#cc7b5a";
  if (count >= 2) return "#dda89d";
  return "#eed6cf"; // very light
}

function HeatmapGrid({
  heatmap,
}: {
  heatmap: SnapshotPayload["heatmap"];
}) {
  // Index the data by severity+scope
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
          {/* Column headers */}
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

          {/* Rows */}
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
                  {/* CMS code */}
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
                  {/* Count */}
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
                  {/* Tooltip via SVG title */}
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

          {/* Row labels */}
          {SEV_ROWS.map((sev, ri) => (
            <g key={`label-${sev}`}>
              {/* Short label for mobile */}
              <text
                x={LABEL_W - 6}
                y={HEAD_H + ri * ROW_H + ROW_H / 2 + 3}
                textAnchor="end"
                fontSize="8"
                fill={sev === 4 ? "#c8a26b" : "#9a938a"}
                fontWeight={sev === 4 ? "600" : "400"}
                fontFamily="inherit"
                className="hidden-sm"
              >
                {SEV_LABELS[sev]}
              </text>
            </g>
          ))}
        </svg>
      )}

      {/* Legend */}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {SEV_ROWS.map((sev) => (
          <span
            key={sev}
            className="inline-flex items-center gap-1 text-[9px]"
            style={{ color: sev === 4 ? "#c8a26b" : "#9a938a" }}
          >
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{
                backgroundColor: sev === 4 ? "#c8a26b" : "#e2e8f0",
                border: sev === 4 ? "1px solid #c8a26b" : "none",
              }}
            />
            {SEV_SHORT[sev]}: {SEV_LABELS[sev]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pull Quote
// ─────────────────────────────────────────────────────────────────

function PullQuote({
  quote,
}: {
  quote: SnapshotPayload["pull_quote"];
}) {
  if (!quote) return null;

  const dateFormatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(quote.date + "T12:00:00Z"));

  const text =
    quote.text.length > 420
      ? quote.text.slice(0, 420).trimEnd() + "…"
      : quote.text;

  return (
    <figure className="mt-6 rounded-xl border-l-4 border-[--color-bad] bg-white px-6 py-5 shadow-card">
      <blockquote className="font-[family-name:var(--font-serif)] text-[0.9375rem] leading-relaxed text-[--color-ink] italic">
        &ldquo;{text}&rdquo;
      </blockquote>
      <figcaption className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-[--color-qs-muted]">
        <span>Inspector finding</span>
        <span aria-hidden>·</span>
        <time dateTime={quote.date}>{dateFormatted}</time>
        {quote.tag && (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono text-[9px] bg-black/5 px-1.5 py-0.5 rounded">
              {quote.tag}
            </span>
          </>
        )}
      </figcaption>
    </figure>
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
}: {
  facilityId: string;
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

  const { has_inspections, peer_set, metrics, trajectory_series, heatmap, pull_quote } =
    payload;

  const tooSmallPeerSet = peer_set.n < 10;

  return (
    <section aria-labelledby="qs-heading" className="mt-10">
      <h2
        id="qs-heading"
        className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-[--color-navy]"
      >
        Quality snapshot
      </h2>
      <p className="mt-1 text-sm text-[--color-muted]">
        How this facility compares to peers over the last 36 months.
        No marketing language — numbers from state inspection records only.
      </p>

      {/* Limited peer set banner */}
      {tooSmallPeerSet && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[--color-amber]/40 bg-[--color-amber-light] px-4 py-2.5 text-xs text-[--color-amber]">
          <svg
            aria-hidden
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            Limited peer set ({peer_set.n} facilities) — interpret with caution.
            Percentiles are less stable with small samples.
          </span>
        </div>
      )}

      {!has_inspections ? (
        <NoInspectionsState peerN={peer_set.n} />
      ) : (
        <>
          {/* 1. Grade card */}
          <GradeCard payload={payload} />

          {/* 2. Percentile bullet strip */}
          <BulletStrip metrics={metrics} />

          {/* 3. Two-up row: sparkline + heatmap */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TrajectorySparkline
              series={trajectory_series}
              trajectoryPct={metrics.trajectory.percentile}
              trajectoryValue={metrics.trajectory.value}
            />
            <HeatmapGrid heatmap={heatmap} />
          </div>

          {/* 4. Pull quote */}
          <PullQuote quote={pull_quote} />
        </>
      )}

      {/* 5. Peer attribution footnote */}
      <p className="mt-4 text-xs text-[--color-qs-muted]">
        Compared to{" "}
        <strong className="font-medium text-[--color-ink]">{peer_set.n}</strong>{" "}
        California {payload.facility.license_type ?? "care"} facilities
        {peer_set.fallback_level === 0 ? " of similar size" : ""}.
        {peer_set.fallback_level > 0 && (
          <span>
            {" "}
            Bed-size filter relaxed due to small peer set (fallback level{" "}
            {peer_set.fallback_level}).
          </span>
        )}
      </p>
    </section>
  );
}
