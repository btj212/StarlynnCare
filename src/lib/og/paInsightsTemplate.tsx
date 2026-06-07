/**
 * Shared JSX template for PA insights story Open Graph images.
 * Rendered via next/og ImageResponse (Satori). Only inline styles, no Tailwind.
 */

export type PaInsightsOgProps = {
  /** Large hero figure (e.g. "21 IJ findings"). */
  heroStat: string;
  /** Short headline (1–2 lines). */
  headline: string;
  /** Eyebrow label (e.g. "Immediate jeopardy · PA DHS"). */
  eyebrow: string;
};

const PAPER = "#faf9f7";
const INK = "#1a1816";
const RUST = "#b94a2c";
const TEAL = "#1a7a6e";
const MONO = "monospace";
const DISPLAY = "serif";

export function PaInsightsOgTemplate({ heroStat, headline, eyebrow }: PaInsightsOgProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "1200px",
        height: "630px",
        background: PAPER,
        padding: "56px 64px",
        fontFamily: DISPLAY,
        position: "relative",
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: RUST,
        }}
      />

      {/* Eyebrow */}
      <div
        style={{
          display: "flex",
          fontFamily: MONO,
          fontSize: "16px",
          color: RUST,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "24px",
        }}
      >
        {eyebrow}
      </div>

      {/* Main content row */}
      <div style={{ display: "flex", flex: 1, gap: "56px", alignItems: "flex-start" }}>
        {/* Left: hero stat */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "380px",
            flexShrink: 0,
            borderLeft: `4px solid ${RUST}`,
            paddingLeft: "28px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontFamily: DISPLAY,
              fontWeight: 600,
              color: RUST,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {heroStat}
          </div>
          <div
            style={{
              marginTop: "12px",
              fontFamily: MONO,
              fontSize: "13px",
              color: INK,
              opacity: 0.5,
              letterSpacing: "0.06em",
            }}
          >
            PA DHS OLTL records
          </div>
        </div>

        {/* Right: headline */}
        <div
          style={{
            display: "flex",
            flex: 1,
            fontSize: "34px",
            fontFamily: DISPLAY,
            color: INK,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          {headline}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "32px",
          paddingTop: "20px",
          borderTop: `1px solid rgba(0,0,0,0.12)`,
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: "22px",
            fontWeight: 600,
            color: TEAL,
            letterSpacing: "-0.01em",
          }}
        >
          StarlynnCare
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: "13px",
            color: INK,
            opacity: 0.45,
            letterSpacing: "0.06em",
          }}
        >
          Verified PA DHS inspection data
        </div>
      </div>
    </div>
  );
}
