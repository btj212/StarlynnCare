import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";

function waFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
  const raw = d.state_severity_raw ?? d.class;
  if (!raw) return null;
  return { label: raw, tone: "info" };
}

export const waProfileConfig: StateProfileConfig = {
  code: "WA",
  agencyShort: "DSHS",
  agencyLong: "Washington DSHS · Aging and Disability Services Administration",
  citationPrefix: "WAC §",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: waFormatSeverityTag,
  formNameForDeficiency: () => null,
  rulebook: [],
};
