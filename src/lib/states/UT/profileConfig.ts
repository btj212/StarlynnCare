import type { StateProfileConfig, SeverityTone } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import { CMS_IJ_LABEL, isCmsImmediateJeopardy } from "@/lib/states/cmsImmediateJeopardy";

/**
 * Utah severity taxonomy (§5.2 of UT methodology brief).
 *
 * UT does not publish a numerical severity scale. We map enforcement outcomes:
 *   4 / IJ  — License suspension/revocation, Immediate Jeopardy, substantiated abuse
 *   3       — Civil penalty ≥ $500, admission ban, on-site monitoring
 *   2       — Civil penalty < $500 or moderate citation cluster
 *   1       — Citation / Plan of Correction, no penalty
 *
 * NF records from CMS use the federal A-L scope-severity matrix stored as severity_int.
 */
function utFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  if (isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
  const raw = d.state_severity_raw ?? d.class;
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("revocation")) return { label: "Revocation", tone: "danger" };
  if (lower.includes("suspension")) return { label: "Suspension", tone: "danger" };
  // Utah does not publish a severity scale. Do not rename a stored outcome
  // to Serious, Moderate, or Standard.
  if (!raw || lower.includes("immediate jeopardy")) return null;
  return { label: raw, tone: "mute" };
}

export const utProfileConfig: StateProfileConfig = {
  code: "UT",
  agencyShort: "DLBC",
  agencyLong: "Utah Dept. of Health & Human Services · Division of Licensing and Background Checks",
  citationPrefix: "",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: utFormatSeverityTag,
  formNameForDeficiency: () => null,
  regulatorPortalUrl: "https://ccl.utah.gov",
  // Every stored note is a licensor, surveyor, or office follow-up, not the home's plan.
  followUp: { label: "The state's follow-up" },
  // Full R432-270 rule cards TBD. Statute: https://rules.utah.gov/publicat/code/r432/r432-270.htm
  rulebook: [],
};
