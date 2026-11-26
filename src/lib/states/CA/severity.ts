/**
 * California severity tag formatter.
 *
 * CA CDSS uses Type A (actual/imminent harm) / Type B (potential harm).
 * CMS-certified facilities additionally carry scope×severity letter codes
 * (A–L) in deficiency.scope_severity_code. Immediate Jeopardy is only the
 * CMS J/K/L rows — never a CDSS Type A citation with a stored IJ flag.
 */

import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";
import {
  CMS_IJ_LABEL,
  cmsScopeLetter,
  isCmsImmediateJeopardy,
} from "@/lib/states/cmsImmediateJeopardy";

const CMS_ROW_TONE: Record<string, SeverityTone> = {
  J: "danger",
  K: "danger",
  L: "danger",
  G: "danger",
  H: "danger",
  I: "danger",
  D: "warn",
  E: "warn",
  F: "warn",
  A: "info",
  B: "info",
  C: "info",
};

export function caFormatSeverityTag(
  d: Deficiency,
): { label: string; tone: SeverityTone } | null {
  if (d.class === "Type A") return { label: "Type A", tone: "danger" };
  if (d.class === "Type B") return { label: "Type B", tone: "warn" };
  if (isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
  const letter = cmsScopeLetter(d);
  if (letter) {
    return { label: `CMS ${letter}`, tone: CMS_ROW_TONE[letter] ?? "info" };
  }
  if (d.state_severity_raw) {
    return { label: d.state_severity_raw, tone: "info" };
  }
  return null;
}

export function caFormNameForDeficiency(_d: Deficiency): string | null {
  return "LIC-9099";
}
