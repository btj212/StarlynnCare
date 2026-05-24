import type { StateProfileConfig, SeverityTone } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";

/**
 * Illinois IDPH severity taxonomy.
 *
 * Illinois ALEs/SHEs use a three-tier violation classification under
 * 77 Ill. Adm. Code § 295:
 *   Type 1 — most severe; immediate jeopardy, death, or serious harm. Maps to severity=3.
 *   Type 2 — moderate; potential for harm, repeated non-compliance. Maps to severity=2.
 *   Type 3 — least severe; administrative, minor. Maps to severity=1.
 *
 * General Violations (GV) are administrative citations that don't fit the
 * numbered tiers; displayed as "GV" with info tone.
 *
 * No federal F-tags exist for IL ALE/SHE inspections.
 */
function ilFormatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null {
  // Integer severity set by il_foia_visits_ingest.py and il_pdf_parse.py
  if (d.severity !== undefined && d.severity !== null) {
    if (d.severity >= 3 || d.immediate_jeopardy) return { label: "Type 1", tone: "danger" };
    if (d.severity === 2) return { label: "Type 2", tone: "warn" };
    if (d.severity === 1) return { label: "Type 3", tone: "info" };
  }
  if (d.immediate_jeopardy) return { label: "Type 1", tone: "danger" };

  // Fallback to state_severity_raw string (stored verbatim from FOIA workbook)
  const raw = d.state_severity_raw ?? d.class;
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === "type 1" || lower === "t1") return { label: "Type 1", tone: "danger" };
  if (lower === "type 2" || lower === "t2") return { label: "Type 2", tone: "warn" };
  if (lower === "type 3" || lower === "t3") return { label: "Type 3", tone: "info" };
  if (lower === "general violation" || lower === "gv") return { label: "GV", tone: "info" };
  return { label: raw, tone: "mute" };
}

export const ilProfileConfig: StateProfileConfig = {
  code: "IL",
  agencyShort: "IDPH",
  agencyLong: "Illinois Department of Public Health, Division of Assisted Living",
  /** Prepended to deficiency.code in citation chips: "77 Ill. Adm. Code §295.6010 a)1)2)" */
  citationPrefix: "77 Ill. Adm. Code §",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: ilFormatSeverityTag,
  formNameForDeficiency: () => null,
  regulatorPortalUrl: "https://llcs.dph.illinois.gov/s/?language=en_US",
  // Part 295 rule cards TBD — ship empty array per OR/UT pattern.
  // Statute: https://www.ilga.gov/agencies/JCAR/Sections?PartID=07700295
  rulebook: [],
};
