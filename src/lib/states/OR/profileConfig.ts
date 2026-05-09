import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";

function orFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
  const raw = d.state_severity_raw ?? d.class;
  if (!raw) return null;
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
  rulebook: [],
};
