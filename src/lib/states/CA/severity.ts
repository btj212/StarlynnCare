/**
 * California severity tag formatter.
 *
 * CA CDSS uses Type A (actual/imminent harm) / Type B (potential harm).
 * CMS-certified facilities (SNFs with cms_id) additionally carry
 * scope×severity letter codes (A–L) stored in deficiency.scope_severity_code.
 *
 * Priority order:
 *   1. immediate_jeopardy → "IJ" (danger)
 *   2. class === "Type A"  → "Type A" (danger)
 *   3. class === "Type B"  → "Type B" (warn)
 *   4. scope_severity_code (CMS A–L) → formatted letter (info/warn/danger by row)
 *   5. state_severity_raw as fallback
 *   6. null → no chip
 */

import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";

const CMS_ROW_TONE: Record<string, SeverityTone> = {
  // Rows J–L = Immediate Jeopardy
  J: "danger", K: "danger", L: "danger",
  // Rows G–I = Actual Harm
  G: "danger", H: "danger", I: "danger",
  // Rows D–F = Potential for More Than Minimal Harm
  D: "warn", E: "warn", F: "warn",
  // Rows A–C = Minimal Harm
  A: "info", B: "info", C: "info",
};

export function caFormatSeverityTag(
  d: Deficiency,
): { label: string; tone: SeverityTone } | null {
  if (d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
  if (d.class === "Type A") return { label: "Type A", tone: "danger" };
  if (d.class === "Type B") return { label: "Type B", tone: "warn" };
  if (d.scope_severity_code) {
    const letter = d.scope_severity_code.toUpperCase();
    const tone = CMS_ROW_TONE[letter] ?? "info";
    return { label: letter, tone };
  }
  if (d.state_severity_raw) {
    return { label: d.state_severity_raw, tone: "info" };
  }
  return null;
}

export function caFormNameForDeficiency(_d: Deficiency): string | null {
  return "LIC-9099";
}
