import type { HeroSparkSeries } from "@/lib/data/nationalHome";

type Props = {
  series: HeroSparkSeries[];
};

// Palette: each state gets a fixed color drawn from the editorial system
const STATE_COLORS: Record<string, string> = {
  CA: "var(--color-rust)",
  OR: "var(--color-teal)",
  WA: "var(--color-gold)",
  MN: "#7aa8a0",  // teal-soft variant
  TX: "#c4a06b",  // gold-soft variant
};

const STATE_LABELS: Record<string, string> = {
  CA: "CA",
  OR: "OR",
  WA: "WA",
  MN: "MN",
  TX: "TX",
};

const W = 480;
const H = 260;
const PAD = { top: 24, right: 56, bottom: 28, left: 8 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function buildPath(points: { count: number }[], maxVal: number): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => {
      const x = PAD.left + (i / (points.length - 1)) * INNER_W;
      const y = PAD.top + INNER_H - (maxVal > 0 ? (p.count / maxVal) * INNER_H : 0);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function HeroSparkChart({ series }: Props) {
  if (series.length === 0) return null;

  const allCounts = series.flatMap((s) => s.points.map((p) => p.count));
  const maxVal = Math.max(...allCounts, 1);

  // Month axis labels: first and last point
  const firstLabel = (() => {
    const m = series[0]?.points[0]?.month ?? "";
    if (!m) return "";
    const [y, mo] = m.split("-");
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
  })();
  const lastLabel = (() => {
    const pts = series[0]?.points ?? [];
    const m = pts[pts.length - 1]?.month ?? "";
    if (!m) return "";
    const [y, mo] = m.split("-");
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
  })();

  return (
    <div className="relative w-full border border-paper-rule overflow-hidden" style={{ aspectRatio: `${W}/${H}`, background: "var(--color-paper-2)" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Severe deficiency citations per state over the last 24 months"
        role="img"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {/* Eyebrow label */}
        <text
          x={PAD.left}
          y={14}
          fontFamily="var(--font-mono), ui-monospace, monospace"
          fontSize={9}
          letterSpacing="0.14em"
          fill="var(--color-ink-3)"
        >
          SEVERE CITATIONS · 24 MONTHS · 5 STATES
        </text>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PAD.top + INNER_H - frac * INNER_H;
          return (
            <line
              key={frac}
              x1={PAD.left}
              y1={y}
              x2={PAD.left + INNER_W}
              y2={y}
              stroke="var(--color-paper-rule)"
              strokeWidth={0.75}
            />
          );
        })}

        {/* State spark lines */}
        {series.map((s) => {
          const path = buildPath(s.points, maxVal);
          const color = STATE_COLORS[s.stateCode] ?? "var(--color-ink-3)";
          // Last point x/y for end label
          const pts = s.points;
          const lastIdx = pts.length - 1;
          const lastX = PAD.left + INNER_W;
          const lastY = PAD.top + INNER_H - (maxVal > 0 ? (pts[lastIdx]?.count ?? 0) / maxVal * INNER_H : 0);

          return (
            <g key={s.stateCode}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={s.stateCode === "CA" ? 2 : 1.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={s.stateCode === "CA" ? 1 : 0.7}
              />
              {/* End-of-line state label */}
              <text
                x={lastX + 5}
                y={lastY + 3.5}
                fontFamily="var(--font-mono), ui-monospace, monospace"
                fontSize={8.5}
                letterSpacing="0.06em"
                fill={color}
                opacity={s.stateCode === "CA" ? 1 : 0.8}
              >
                {STATE_LABELS[s.stateCode] ?? s.stateCode}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text
          x={PAD.left}
          y={H - 4}
          fontFamily="var(--font-mono), ui-monospace, monospace"
          fontSize={8.5}
          fill="var(--color-ink-4)"
          letterSpacing="0.06em"
        >
          {firstLabel}
        </text>
        <text
          x={PAD.left + INNER_W}
          y={H - 4}
          fontFamily="var(--font-mono), ui-monospace, monospace"
          fontSize={8.5}
          fill="var(--color-ink-4)"
          letterSpacing="0.06em"
          textAnchor="end"
        >
          {lastLabel}
        </text>
      </svg>
    </div>
  );
}
