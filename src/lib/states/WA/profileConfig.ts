import type { StateProfileConfig } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import type { SeverityTone } from "@/lib/states/profileConfig";
import { CMS_IJ_LABEL, isCmsFTag, isCmsImmediateJeopardy } from "@/lib/states/cmsImmediateJeopardy";
import { topTierLabel } from "@/lib/states/severityScale";

// ─── ALF / AFH / ESF: DSHS Type A / B / C. Type A is the top tier. ───────────

function waFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  const top = topTierLabel("WA", d);
  if (top) return top;
  const raw = (d.state_severity_raw ?? d.class ?? "").trim();
  if (/^type\s*b$/i.test(raw)) return { label: "Type B", tone: "warn" };
  if (/^type\s*c$/i.test(raw)) return { label: "Type C", tone: "info" };
  if (isCmsFTag(d.code) && isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
  if (!raw) return null;
  return { label: raw, tone: "info" };
}

// ─── NH: CMS F-tag scope/severity ────────────────────────────────────────────

/**
 * CMS scope/severity letter ranges:
 *   A–C: No actual harm, potential for minimal harm     → info
 *   D–F: No actual harm, potential for more than min    → info
 *   G–I: Actual harm                                    → warn
 *   J–L: Immediate Jeopardy                             → danger
 */
function nhFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
  const raw = (d.state_severity_raw ?? "").toString().trim();
  if (!raw) return null;
  if (raw.startsWith("IJ")) return { label: CMS_IJ_LABEL, tone: "danger" };
  if (raw.startsWith("Actual Harm")) return { label: raw, tone: "warn" };
  if (raw.startsWith("Potential Harm")) return { label: raw, tone: "info" };
  if (raw.startsWith("No Harm")) return { label: raw, tone: "ok" };
  const letter = raw.charAt(0).toUpperCase();
  if (["J", "K", "L"].includes(letter)) return { label: CMS_IJ_LABEL, tone: "danger" };
  if (["G", "H", "I"].includes(letter)) return { label: `Harm (${raw})`, tone: "warn" };
  return { label: raw, tone: "info" };
}

// ─── Nursing-home specific config ────────────────────────────────────────────

export const waNhProfileConfig: StateProfileConfig = {
  code: "WA",
  agencyShort: "CMS",
  agencyLong: "Centers for Medicare & Medicaid Services · Nursing Home Compare",
  citationPrefix: "F",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  scopeSeverityScale: "cms",
  formatSeverityTag: nhFormatSeverityTag,
  formNameForDeficiency: (d) => {
    // F-tags always have a CMS-2567 form
    if (d.code?.startsWith("F")) return "CMS-2567";
    return null;
  },
  rulebook: [],
};

// ─── ALF / AFH / ESF config (default WA) ─────────────────────────────────────

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
  regulatorPortalUrl: "https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx",
};
