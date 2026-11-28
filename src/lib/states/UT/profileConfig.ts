import type { StateProfileConfig, SeverityTone } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import { CMS_IJ_LABEL, cmsScopeLetter, isCmsImmediateJeopardy } from "@/lib/states/cmsImmediateJeopardy";
import { topTierLabel } from "@/lib/states/severityScale";

/**
 * Utah assisted living publishes risk levels Low, Moderate, High, and Extreme.
 * High and Extreme are the top tier. Nursing homes use CMS letters.
 * The stored integer is not that scale: Extreme is sometimes stored as 1.
 */
function utFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  const top = topTierLabel("UT", d);
  if (top) return top;
  const letter = cmsScopeLetter(d);
  if (letter) {
    const tone: SeverityTone = "GHI".includes(letter) ? "warn" : "DEF".includes(letter) ? "info" : "mute";
    return { label: `CMS ${letter}`, tone };
  }
  const raw = d.state_severity_raw ?? d.class;
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("revocation")) return { label: "Revocation", tone: "danger" };
  if (lower.includes("suspension")) return { label: "Suspension", tone: "danger" };
  if (lower === "moderate") return { label: "Moderate", tone: "warn" };
  if (lower === "low") return { label: "Low", tone: "info" };
  if (!raw || lower.includes("immediate jeopardy")) return null;
  return { label: raw, tone: "mute" };
}

export const utProfileConfig: StateProfileConfig = {
  code: "UT",
  agencyShort: "DLBC",
  agencyLong: "Utah Dept. of Health & Human Services · Division of Licensing and Background Checks",
  citationPrefix: "",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: utFormatSeverityTag,
  formNameForDeficiency: () => null,
  regulatorPortalUrl: "https://ccl.utah.gov",
  // Every stored note is a licensor, surveyor, or office follow-up, not the home's plan.
  followUp: { label: "The state's follow-up" },
  // Full R432-270 rule cards TBD. Statute: https://rules.utah.gov/publicat/code/r432/r432-270.htm
  rulebook: [],
};
