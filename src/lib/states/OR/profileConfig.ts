import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";
import { CMS_IJ_LABEL, isCmsImmediateJeopardy } from "@/lib/states/cmsImmediateJeopardy";

function orFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
  if (d.severity !== undefined && d.severity !== null) {
    if (d.severity >= 4) return { label: "Level 4", tone: "danger" };
    if (d.severity === 3) return { label: "Level 3", tone: "warn" };
    if (d.severity === 2) return { label: "Level 2", tone: "info" };
    if (d.severity === 1) return { label: "Level 1", tone: "mute" };
  }
  const raw = d.state_severity_raw ?? d.class;
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "level 4" || lower === "immediate jeopardy") return { label: "Level 4", tone: "danger" };
  if (lower === "level 3") return { label: "Level 3", tone: "warn" };
  if (lower === "level 2") return { label: "Level 2", tone: "info" };
  if (lower === "level 1") return { label: "Level 1", tone: "mute" };
  return { label: raw, tone: "info" };
}

export const orProfileConfig: StateProfileConfig = {
  code: "OR",
  agencyShort: "OR-DHS",
  agencyLong: "Oregon Dept. of Human Services · Long-Term Care Licensing",
  citationPrefix: "OAR §",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: orFormatSeverityTag,
  formNameForDeficiency: () => null,
  regulatorPortalUrl: "https://ltclicensing.oregon.gov",
  followUp: { label: "The home's plan of correction" },
  rulebook: [],
};
