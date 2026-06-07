/**
 * Server-rendered SVG bar chart — no charting library.
 * Accessible: role="img" + <title>/<desc> + visually-hidden data table fallback.
 * Palette: rust for severe/IJ, ink-2 for neutral/standard bars.
 */

export type BarChartData = {
  label: string;
  value: number;
  /** When true, bar renders in --color-rust (severe/IJ). Default: false (ink-2). */
  severe?: boolean;
  /** Optional sublabel shown under the category label (e.g. facility count "n=168") */
  sub?: string;
};

type BarChartSSRProps = {
  /** Chart title for screen readers and the visible heading above the chart. */
  title: string;
  /** Short description for the <desc> element. */
  description: string;
  data: BarChartData[];
  orientation?: "horizontal" | "vertical";
  /** Unit label appended to values in tooltips / table (e.g. "IJ findings", "def/facility"). */
  unit?: string;
  /** Round displayed values to this many decimal places. Default 1. */
  precision?: number;
};

const SVG_FONT = "system-ui,-apple-system,sans-serif";
const SVG_MONO = "ui-monospace,SFMono-Regular,monospace";

export function BarChartSSR({
  title,
  description,
  data,
  orientation = "vertical",
  unit = "",
  precision = 1,
}: BarChartSSRProps) {
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(precision));
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      {orientation === "horizontal" ? (
        <HorizontalChart
          title={title}
          description={description}
          data={data}
          max={max}
          fmt={fmt}
          unit={unit}
        />
      ) : (
        <VerticalChart
          title={title}
          description={description}
          data={data}
          max={max}
          fmt={fmt}
          unit={unit}
        />
      )}
      {/* Visually-hidden accessible data table */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">{unit || "Value"}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{fmt(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Horizontal bar chart (Story A — top facilities by IJ) ──────────────────

type ChartProps = {
  title: string;
  description: string;
  data: BarChartData[];
  max: number;
  fmt: (v: number) => string;
  unit: string;
};

function HorizontalChart({ title, description, data, max, fmt, unit }: ChartProps) {
  const rowH = 36;
  const labelW = 240;
  const barAreaW = 320;
  const valueW = 52;
  const paddingTop = 4;
  const paddingBottom = 24;
  const svgW = labelW + barAreaW + valueW + 16;
  const svgH = paddingTop + data.length * rowH + paddingBottom;

  return (
    <svg
      role="img"
      aria-labelledby="hc-title hc-desc"
      viewBox={`0 0 ${svgW} ${svgH}`}
      width="100%"
      style={{ maxWidth: svgW, display: "block", overflow: "visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="hc-title">{title}</title>
      <desc id="hc-desc">{description}</desc>

      {data.map((d, i) => {
        const y = paddingTop + i * rowH;
        const barW = Math.max(2, (d.value / max) * barAreaW);
        const fill = d.severe ? "var(--color-rust)" : "var(--color-ink-3, #6b6b6b)";
        const labelY = y + rowH / 2;

        return (
          <g key={d.label}>
            {/* Category label */}
            <text
              x={labelW - 8}
              y={labelY + 5}
              textAnchor="end"
              fontFamily={SVG_FONT}
              fontSize={13}
              fill="var(--color-ink-2, #333)"
              aria-hidden="true"
            >
              {d.label.length > 32 ? d.label.slice(0, 30) + "…" : d.label}
            </text>
            {/* Bar */}
            <rect
              x={labelW}
              y={y + 6}
              width={barW}
              height={rowH - 14}
              fill={fill}
              opacity={0.85}
              rx={2}
            />
            {/* Value */}
            <text
              x={labelW + barAreaW + 6}
              y={labelY + 5}
              textAnchor="start"
              fontFamily={SVG_MONO}
              fontSize={12}
              fontWeight="600"
              fill={d.severe ? "var(--color-rust)" : "var(--color-ink, #111)"}
              aria-hidden="true"
            >
              {fmt(d.value)}
            </text>
          </g>
        );
      })}

      {/* Unit label at bottom */}
      {unit && (
        <text
          x={labelW + barAreaW / 2}
          y={svgH - 4}
          textAnchor="middle"
          fontFamily={SVG_MONO}
          fontSize={10}
          fill="var(--color-ink-4, #aaa)"
          aria-hidden="true"
        >
          {unit}
        </text>
      )}
    </svg>
  );
}

// ── Vertical bar chart (Stories B, C) ────────────────────────────────────

function VerticalChart({ title, description, data, max, fmt, unit }: ChartProps) {
  const barAreaH = 180;
  const labelAreaH = 60;
  const valueH = 20;
  const paddingLeft = 42;
  const paddingRight = 16;
  const barSpacing = 8;
  const n = data.length;
  const svgW = paddingLeft + n * (Math.floor((320 - paddingLeft - paddingRight) / Math.max(n, 1))) + paddingRight;
  const barW = Math.max(18, (svgW - paddingLeft - paddingRight - (n - 1) * barSpacing) / Math.max(n, 1));
  const totalW = paddingLeft + n * barW + (n - 1) * barSpacing + paddingRight;
  const svgH = valueH + barAreaH + labelAreaH + 24;

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    pct: t,
    val: max * t,
    y: valueH + barAreaH - t * barAreaH,
  }));

  return (
    <svg
      role="img"
      aria-labelledby="vc-title vc-desc"
      viewBox={`0 0 ${totalW} ${svgH}`}
      width="100%"
      style={{ maxWidth: Math.max(totalW, 320), display: "block", overflow: "visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="vc-title">{title}</title>
      <desc id="vc-desc">{description}</desc>

      {/* Y-axis grid lines */}
      {ticks.map((t) => (
        <g key={t.pct} aria-hidden="true">
          <line
            x1={paddingLeft}
            x2={totalW - paddingRight}
            y1={t.y}
            y2={t.y}
            stroke="var(--color-paper-rule, #e5e5e5)"
            strokeWidth={t.pct === 0 ? 1.5 : 1}
          />
          <text
            x={paddingLeft - 6}
            y={t.y + 4}
            textAnchor="end"
            fontFamily={SVG_MONO}
            fontSize={10}
            fill="var(--color-ink-4, #aaa)"
          >
            {fmt(t.val)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const x = paddingLeft + i * (barW + barSpacing);
        const barH = Math.max(2, (d.value / max) * barAreaH);
        const barY = valueH + barAreaH - barH;
        const fill = d.severe ? "var(--color-rust)" : "var(--color-ink-3, #6b6b6b)";
        const centerX = x + barW / 2;

        return (
          <g key={d.label} aria-hidden="true">
            {/* Bar */}
            <rect x={x} y={barY} width={barW} height={barH} fill={fill} opacity={0.85} rx={2} />
            {/* Value above bar */}
            <text
              x={centerX}
              y={barY - 4}
              textAnchor="middle"
              fontFamily={SVG_MONO}
              fontSize={11}
              fontWeight="600"
              fill={d.severe ? "var(--color-rust)" : "var(--color-ink, #111)"}
            >
              {fmt(d.value)}
            </text>
            {/* Category label — wrap at ~12 chars */}
            {wrapLabel(d.label, centerX, valueH + barAreaH + 14, barW)}
            {/* Sub label (e.g. n=168) */}
            {d.sub && (
              <text
                x={centerX}
                y={valueH + barAreaH + 46}
                textAnchor="middle"
                fontFamily={SVG_MONO}
                fontSize={10}
                fill="var(--color-ink-4, #aaa)"
              >
                {d.sub}
              </text>
            )}
          </g>
        );
      })}

      {/* X-axis unit */}
      {unit && (
        <text
          x={totalW / 2}
          y={svgH - 4}
          textAnchor="middle"
          fontFamily={SVG_MONO}
          fontSize={10}
          fill="var(--color-ink-4, #aaa)"
          aria-hidden="true"
        >
          {unit}
        </text>
      )}
    </svg>
  );
}

function wrapLabel(text: string, cx: number, y: number, maxW: number) {
  const charsPerLine = Math.max(6, Math.floor(maxW / 7));
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > charsPerLine && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3).map((line, i) => (
    <text
      key={i}
      x={cx}
      y={y + i * 13}
      textAnchor="middle"
      fontFamily={SVG_FONT}
      fontSize={11}
      fill="var(--color-ink-2, #444)"
      aria-hidden="true"
    >
      {line}
    </text>
  ));
}
