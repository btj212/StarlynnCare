import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";

/**
 * AZ deficiencies use A.A.C. R9-10 rule citations with numeric severity (2=standard, 4=IJ/enforcement/abuse).
 * state_severity_raw carries the raw inspection status (e.g. "Enforcement").
 */
function azFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
  if ((d.severity ?? 0) >= 4) {
    const raw = (d.state_severity_raw ?? "").toLowerCase();
    return raw.includes("enforcement")
      ? { label: "Enforcement", tone: "warn" }
      : { label: "High Risk", tone: "warn" };
  }
  // severity=2: standard A.A.C. citation
  const code = d.code;
  if (code) return { label: code.slice(0, 16), tone: "info" };
  return { label: "A.A.C.", tone: "info" };
}

export const azProfileConfig: StateProfileConfig = {
  code: "AZ",
  agencyShort: "ADHS",
  agencyLong: "Arizona Dept. of Health Services · Bureau of Residential Facilities Licensing",
  citationPrefix: "A.A.C. § R",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: azFormatSeverityTag,
  formNameForDeficiency: () => null,
  regulatorPortalUrl: "https://azcarecheck.azdhs.gov",
  rulebook: [],
};
