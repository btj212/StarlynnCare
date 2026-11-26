import type { StateProfileConfig, SeverityTone } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";
import { CMS_IJ_LABEL, isCmsFTag, isCmsImmediateJeopardy } from "@/lib/states/cmsImmediateJeopardy";

/**
 * Pennsylvania DHS OLTL severity taxonomy.
 *
 * PA DHS inspects Personal Care Homes (55 Pa Code Ch 2600) and Assisted Living
 * Residences (55 Pa Code Ch 2800) under the Office of Long-Term Living (OLTL).
 *
 *   Citation              → standard finding, no monetary penalty.      severity=1
 *   Civil Money Penalty   → monetary penalty assessed.                   severity=2
 *   Provisional License   → license downgraded to provisional status.    severity=3
 *   Substantiated Abuse   → abuse/neglect substantiated.                 severity=4
 *   Revocation            → license refused or revoked.                  severity=4
 *
 * Immediate Jeopardy is a CMS nursing-home (F-tag) term. 55 Pa Code Ch 2600/2800
 * does not use it. The PA PDF prompt offered "Immediate Jeopardy" as a bucket
 * for life/safety findings, so many 55 Pa Code § 2600.42 abuse/neglect rows
 * were stored with that label. Display remaps those to a PA finding — IJ only
 * prints on a CMS F-tag.
 *
 * PA does not use California Type A/B severity labels.
 * The `code` field holds a 55 Pa Code citation (e.g. "55 Pa Code § 2600.171")
 * or a CMS F-tag when a nursing-home survey was attached to the row.
 */

function isPaCodeCitation(code: string | null | undefined): boolean {
  return /55\s*pa\s*code/i.test(code ?? "");
}

function looksLikeAbuseFinding(d: Deficiency): boolean {
  const code = d.code ?? "";
  if (/2600\.42|2800\.42/.test(code)) return true;
  const text = `${d.state_severity_raw ?? ""} ${d.class ?? ""}`.toLowerCase();
  return /\babuse\b|\bneglect\b/.test(text);
}

export function paFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  const cms = isCmsFTag(d.code);
  const paCode = isPaCodeCitation(d.code);
  const raw = d.state_severity_raw ?? d.class;
  if (raw) {
    const lower = raw.toLowerCase().trim();
    if (lower === "immediate jeopardy" || lower === "ij") {
      if (cms && !paCode) return { label: CMS_IJ_LABEL, tone: "danger" };
      if (looksLikeAbuseFinding(d)) return { label: "Substantiated Abuse", tone: "danger" };
      return { label: "Serious finding", tone: "danger" };
    }
    if (lower === "revocation" || lower === "license revocation" || lower === "license refusal")
      return { label: "Revocation", tone: "danger" };
    if (lower === "substantiated abuse" || lower === "abuse" || lower === "neglect")
      return { label: "Substantiated Abuse", tone: "danger" };
    if (lower === "provisional license")
      return { label: "Provisional License", tone: "danger" };
    if (lower.includes("civil money penalty") || lower === "cmp")
      return { label: "Civil Money Penalty", tone: "warn" };
    if (lower === "citation" || lower === "deficiency")
      return { label: "Citation", tone: "info" };
  }

  // Do not promote the ingest boolean / severity=4 to Immediate Jeopardy.
  // That flag is also set for substantiated abuse and revocation.
  if (isCmsImmediateJeopardy(d) && !paCode) return { label: CMS_IJ_LABEL, tone: "danger" };
  if (d.severity !== undefined && d.severity !== null) {
    if (d.severity >= 4) {
      if (looksLikeAbuseFinding(d)) return { label: "Substantiated Abuse", tone: "danger" };
      return { label: "Serious finding", tone: "danger" };
    }
    if (d.severity === 3) return { label: "Provisional License", tone: "danger" };
    if (d.severity === 2) return { label: "Civil Money Penalty", tone: "warn" };
    if (d.severity === 1) return { label: "Citation", tone: "info" };
  }

  if (raw) return { label: raw, tone: "mute" };
  return null;
}

export const paProfileConfig: StateProfileConfig = {
  code: "PA",
  agencyShort: "PA DHS",
  agencyLong: "Pennsylvania Department of Human Services, Office of Long-Term Living",
  /**
   * PA deficiency codes already include the full citation ("55 Pa Code § 2600.171"),
   * so no additional prefix is needed.
   */
  citationPrefix: "",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: paFormatSeverityTag,
  formNameForDeficiency: () => null,
  regulatorPortalUrl:
    "https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/",
  followUp: {
    label: "The home's plan of correction",
    showStatus: true,
    showFine: true,
  },
  // 55 Pa Code Part IV rule cards — ship empty array per OR/UT/IL pattern.
  // Statutes: 55 Pa Code Ch 2600 (PCH) and Ch 2800 (ALR)
  rulebook: [],
};
