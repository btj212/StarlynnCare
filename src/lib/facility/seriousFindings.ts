import type { Deficiency } from "@/lib/types";

type TaggableFinding = {
  class: string | null;
  code: string | null;
  severity: number | null;
  immediate_jeopardy: boolean;
  state_severity_raw: string | null;
  scope_severity_code: string | null;
};

/**
 * Count findings the state's own tag marks as the top tier (Type A, Type 1,
 * immediate jeopardy, and the other danger-tone labels that state already prints).
 */
export function seriousFindingCounts(
  findings: TaggableFinding[],
  format: (finding: Deficiency) => { label: string; tone: string } | null,
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    const tag = format(finding as Deficiency);
    if (!tag || tag.tone !== "danger") continue;
    counts.set(tag.label, (counts.get(tag.label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));
}
