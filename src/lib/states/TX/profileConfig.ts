import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";

function txFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (d.immediate_jeopardy) return { label: "IJ", tone: "danger" };
  const raw = d.state_severity_raw ?? d.class;
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const tone: SeverityTone =
    lower.includes("immediate") || lower.includes("high") || lower.includes("a")
      ? "danger"
      : lower.includes("medium") || lower.includes("b")
      ? "warn"
      : "info";
  return { label: raw, tone };
}

export const txProfileConfig: StateProfileConfig = {
  code: "TX",
  agencyShort: "HHSC",
  agencyLong: "Texas Health & Human Services Commission · Long-Term Care Regulation",
  citationPrefix: "26 TAC §",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: txFormatSeverityTag,
  formNameForDeficiency: () => null,
  rulebook: [],
};
