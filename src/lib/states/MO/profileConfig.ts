import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";
import { CMS_IJ_LABEL, isCmsImmediateJeopardy } from "@/lib/states/cmsImmediateJeopardy";
import { topTierLabel } from "@/lib/states/severityScale";

/**
 * DHSS publishes Class I, II, and III. Class I is the top tier.
 * state_severity_raw is the survey category, not the class.
 */
function moFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  const top = topTierLabel("MO", d);
  if (top) return top;
  const text = (d.class ?? "").trim();
  if (/^class\s+(ii|2)$/i.test(text)) return { label: "Class II", tone: "warn" };
  if (/^class\s+(iii|3)$/i.test(text)) return { label: "Class III", tone: "info" };
  if (isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
  if ((d.severity ?? 0) >= 4 || d.immediate_jeopardy) {
    const raw = (d.state_severity_raw ?? "").toUpperCase();
    if (raw.includes("COMPLAINT")) return { label: "Complaint", tone: "warn" };
    return null;
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
