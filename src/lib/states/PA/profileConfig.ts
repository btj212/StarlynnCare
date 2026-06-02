import type { StateProfileConfig, SeverityTone } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";

/**
 * Pennsylvania DHS OLTL severity taxonomy.
 *
 * PA DHS inspects Personal Care Homes (55 Pa Code Ch 2600) and Assisted Living
 * Residences (55 Pa Code Ch 2800) under the Office of Long-Term Living (OLTL).
 * Inspection PDFs are parsed into the severity vocabulary below.
 *
 *   Citation              → standard finding, no monetary penalty.      severity=1
 *   Civil Money Penalty   → monetary penalty assessed.                   severity=2
 *   Provisional License   → license downgraded to provisional status.    severity=3
 *   Substantiated Abuse   → abuse/neglect substantiated.                 severity=4
 *   Immediate Jeopardy    → life/safety threat requiring immediate action.severity=4
 *   Revocation            → license refused or revoked.                  severity=4
 *
 * PA does not use federal F-tags or California Type A/B severity labels.
 * The `code` field holds a 55 Pa Code citation (e.g. "55 Pa Code § 2600.171").
 */
function paFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  // Integer severity mapped at ingest — prefer it first
  if (d.immediate_jeopardy) return { label: "Immediate Jeopardy", tone: "danger" };
  if (d.severity !== undefined && d.severity !== null) {
    if (d.severity >= 4) return { label: "Immediate Jeopardy / Revocation", tone: "danger" };
    if (d.severity === 3) return { label: "Provisional License", tone: "danger" };
    if (d.severity === 2) return { label: "Civil Money Penalty", tone: "warn" };
    if (d.severity === 1) return { label: "Citation", tone: "info" };
  }

  // Fallback to raw string stored in state_severity_raw
  const raw = d.state_severity_raw ?? d.class;
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();

  if (lower === "immediate jeopardy" || lower === "ij")
    return { label: "Immediate Jeopardy", tone: "danger" };
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

  return { label: raw, tone: "mute" };
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
  // 55 Pa Code Part IV rule cards — ship empty array per OR/UT/IL pattern.
  // Statutes: 55 Pa Code Ch 2600 (PCH) and Ch 2800 (ALR)
  rulebook: [],
};
