import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";

/**
 * ADHS does not use a federal F-tag / severity score system for ALFs.
 * AZ Care Check displays violations with plain rule citations (A.A.C. § R9-10-xxx).
 * Until the PDF parse pipeline populates structured severity data, we fall back to
 * the raw string from the inspection record.
 */
function azFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
  const raw = d.state_severity_raw ?? d.class;
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("immediate jeopardy") || lower.includes("class i")) {
    return { label: "IJ", tone: "danger" };
  }
  if (lower.includes("class ii") || lower.includes("substantial")) {
    return { label: "Class II", tone: "warn" };
  }
  if (lower.includes("class iii") || lower.includes("minor")) {
    return { label: "Class III", tone: "info" };
  }
  return { label: raw.slice(0, 24), tone: "info" };
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
