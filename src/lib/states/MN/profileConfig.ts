import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";

function mnFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
  const raw = d.state_severity_raw ?? d.class;
  if (!raw) return null;
  return { label: raw, tone: "info" };
}

export const mnProfileConfig: StateProfileConfig = {
  code: "MN",
  agencyShort: "MDH",
  agencyLong: "Minnesota Dept. of Health · Health Regulation Division",
  citationPrefix: "Minn. Stat. §",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: mnFormatSeverityTag,
  formNameForDeficiency: () => null,
  rulebook: [],
};
