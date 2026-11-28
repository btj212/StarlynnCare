import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";
import { CMS_IJ_LABEL, isCmsImmediateJeopardy } from "@/lib/states/cmsImmediateJeopardy";

/**
 * AZ deficiencies use A.A.C. R9-10 rule citations. Arizona assisted living
 * does not use CMS Immediate Jeopardy. state_severity_raw is the inspection
 * status (e.g. "Enforcement").
 */
export function azFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
  if ((d.severity ?? 0) >= 4 || d.immediate_jeopardy) {
    const raw = (d.state_severity_raw ?? "").toLowerCase();
    return raw.includes("enforcement") ? { label: "Enforcement", tone: "warn" } : null;
  }
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
  followUp: { label: "The home's plan of correction" },
  rulebook: [],
};
