import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";
import { CMS_IJ_LABEL, cmsScopeLetter, isCmsFTag, isCmsImmediateJeopardy } from "@/lib/states/cmsImmediateJeopardy";
import { topTierLabel } from "@/lib/states/severityScale";

function mnLetter(d: Deficiency): string | null {
  const direct = cmsScopeLetter(d);
  if (direct) return direct;
  const match = /^SS\s*=\s*([A-L])$/i.exec((d.state_severity_raw ?? "").replace(/\s/g, ""));
  return match ? match[1].toUpperCase() : null;
}

/** Minn. Stat. 144G.31. Level 3 is SS G–I and Level 4 is SS J–L. Those letters are not CMS F-tag letters. */
function mnFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  const top = topTierLabel("MN", d);
  if (top) return top;
  const letter = mnLetter(d);
  if (letter) return { label: `SS ${letter}`, tone: "info" };
  if (isCmsFTag(d.code) && isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
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
