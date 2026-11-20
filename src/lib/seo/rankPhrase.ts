/**
 * One place that turns a composite peer percentile (0-100, higher = better)
 * into "top N%" or "bottom N%". A home at the 38th percentile is in the bottom
 * 38%, never the "top 62%": mixing the two on one page read as a contradiction.
 * Percentiles of 0 and 100 print as 1% so a page never says "top 0%".
 */
export function peerRankPhrase(percentile: number): { side: "top" | "bottom"; pct: number; text: string } {
  const rounded = Math.round(percentile);
  const side = rounded >= 50 ? "top" : "bottom";
  const pct = Math.max(1, side === "top" ? 100 - rounded : rounded);
  return { side, pct, text: `${side} ${pct}%` };
}
