import type { StateProfileConfig, SeverityTone } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";

/**
 * Utah severity taxonomy (§5.2 of UT methodology brief).
 *
 * UT does not publish a numerical severity scale. We map enforcement outcomes:
 *   4 / IJ  — License suspension/revocation, Immediate Jeopardy, substantiated abuse
 *   3       — Civil penalty ≥ $500, admission ban, on-site monitoring
 *   2       — Civil penalty < $500 or moderate citation cluster
 *   1       — Citation / Plan of Correction, no penalty
 *
 * NF records from CMS use the federal A-L scope-severity matrix stored as severity_int.
 */
function utFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  // Integer severity (populated by CMS overlay and CCL scraper)
  if (d.severity !== undefined && d.severity !== null) {
    if (d.severity >= 4 || d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
    if (d.severity === 3) return { label: "Serious", tone: "warn" };
    if (d.severity === 2) return { label: "Moderate", tone: "info" };
    if (d.severity === 1) return { label: "Standard", tone: "mute" };
  }
  // Fallback to raw string
  if (d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
  const raw = d.state_severity_raw ?? d.class;
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("immediate jeopardy") || lower.includes("revocation") || lower.includes("suspension")) {
    return { label: "IJ", tone: "danger" };
  }
  if (lower.includes("admission ban") || lower.includes("monitoring")) {
    return { label: "Serious", tone: "warn" };
  }
  if (lower.includes("penalty") || lower.includes("fine")) {
    return { label: "Moderate", tone: "info" };
  }
  return { label: raw, tone: "mute" };
}

export const utProfileConfig: StateProfileConfig = {
  code: "UT",
  agencyShort: "DLBC",
  agencyLong: "Utah Dept. of Health & Human Services · Division of Licensing and Background Checks",
  citationPrefix: "R432-",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: utFormatSeverityTag,
  formNameForDeficiency: () => null,
  regulatorPortalUrl: "https://ccl.utah.gov",
  // Full R432-270 rule cards TBD. Statute: https://rules.utah.gov/publicat/code/r432/r432-270.htm
  rulebook: [],
};
