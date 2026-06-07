/**
 * Peer percentile bar styling for homepage sample cards and carousels.
 * Percentiles are 0–100 where higher = better standing vs. the peer cohort
 * (same basis as `facility_snapshot` — see quality snapshot migration).
 *
 * Visual rule (matches methodology communication):
 * - Fill width = percentile value.
 * - Fill color by tertile: upper third “good” green, lower third “concern” red, middle gold.
 */

const LOWER_THIRD = 100 / 3;
const UPPER_THIRD = (2 * 100) / 3;

/** CSS color for the filled portion of the bar (globals.css design tokens). */
export function peerRankBarFillCss(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "var(--color-ink-4)";
  if (pct > UPPER_THIRD) return "var(--color-grade-a)";
  if (pct <= LOWER_THIRD) return "var(--color-grade-f)";
  return "var(--color-gold)";
}

/** Hex for contexts that cannot use CSS variables (legacy carousel). */
export function peerRankBarFillHex(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "#9a938a";
  if (pct > UPPER_THIRD) return "#2F6B3A";
  if (pct <= LOWER_THIRD) return "#8E2A1F";
  return "#C4923B";
}
