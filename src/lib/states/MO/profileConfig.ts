import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";

/**
 * MO deficiencies use 19 CSR tag codes with numeric severity (2=standard, 4=complaint/abuse/IJ).
 * state_severity_raw carries the SURVEY_CATEGORY from the DHSS FOIA export.
 */
function moFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
  if ((d.severity ?? 0) >= 4) {
    const raw = (d.state_severity_raw ?? "").toUpperCase();
    if (raw.includes("COMPLAINT")) return { label: "Complaint", tone: "warn" };
    return { label: "High Risk", tone: "warn" };
  }
  const code = d.code;
  if (code) return { label: code.slice(0, 12), tone: "info" };
  return { label: "19 CSR", tone: "info" };
}

export const moProfileConfig: StateProfileConfig = {
  code: "MO",
  agencyShort: "DHSS",
  agencyLong: "Missouri Dept. of Health and Senior Services · Section for Long-Term Care Regulation",
  citationPrefix: "19 CSR §",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: moFormatSeverityTag,
  formNameForDeficiency: () => null,
  regulatorPortalUrl: "https://healthapps.dhss.mo.gov/showmeltc/",
  rulebook: [],
  // FOIA Excel gave us only the per-TAG standard text, not the SOD finding.
  deficiencyTextIsRuleOnly: true,
};
