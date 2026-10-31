import type { StateProfileConfig, SeverityTone } from "@/lib/states/profileConfig";
import type { Deficiency } from "@/lib/types";

const FIND_AND_COMPARE = "https://cdphe.colorado.gov/health-facilities/find-and-compare-facilities";
const CARE_COMPARE = "https://www.medicare.gov/care-compare/";

/**
 * Colorado assisted-living letters are Chapter 7, Part 3.9.
 * A and B are potential harm. C and D are actual harm. E is immediate jeopardy.
 * They are not California Type A/B labels and they are not CMS F-tag letters.
 */
function coAlrSeverity(d: Deficiency): { label: string; tone: SeverityTone } | null {
  const letter = (d.class ?? "").trim().toUpperCase();
  if (letter === "E" || (d.immediate_jeopardy && !d.scope_severity_code)) {
    return { label: "Level E", tone: "danger" };
  }
  if (letter === "D") return { label: "Level D", tone: "warn" };
  if (letter === "C") return { label: "Level C", tone: "warn" };
  if (letter === "B") return { label: "Level B", tone: "info" };
  if (letter === "A") return { label: "Level A", tone: "ok" };
  return null;
}

/** CMS scope-and-severity letters. J, K, and L are immediate jeopardy. */
function coNhSeverity(d: Deficiency): { label: string; tone: SeverityTone } | null {
  const letter = (d.scope_severity_code ?? "").trim().toUpperCase();
  if (!letter || letter.length !== 1) return null;
  if ("JKL".includes(letter)) return { label: `CMS ${letter}`, tone: "danger" };
  if ("GHI".includes(letter)) return { label: `CMS ${letter}`, tone: "warn" };
  if ("DEF".includes(letter)) return { label: `CMS ${letter}`, tone: "info" };
  if ("ABC".includes(letter)) return { label: `CMS ${letter}`, tone: "mute" };
  return null;
}

export const coAlrProfileConfig: StateProfileConfig = {
  code: "CO",
  agencyShort: "CDPHE",
  agencyLong: "Colorado Department of Public Health and Environment",
  citationPrefix: "",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: coAlrSeverity,
  formNameForDeficiency: () => null,
  regulatorPortalUrl: FIND_AND_COMPARE,
  deficiencyTextIsRuleOnly: true,
  rulebook: [
    {
      id: "co-license",
      icon: "report",
      question: "Who licenses this assisted living residence?",
      regCite: "C.R.S. 25-27-104 · 6 CCR 1011-1 Chapter 7",
      plain:
        "CDPHE licenses assisted living residences. A secure environment for residents who need one is optional under Chapter 7, Part 25. CDPHE does not publish a facility-level list of homes that have that option, so this page does not call the home state-verified memory care.",
      ask: "Ask whether the home has a secure environment, and ask to see the part of the license that says so.",
    },
    {
      id: "co-levels",
      icon: "enforce",
      question: "What do Level A through E mean?",
      regCite: "6 CCR 1011-1 Chapter 7, Part 3.9",
      plain:
        "Level A is an isolated potential for harm. Level B is a pattern of potential harm. Level C is isolated actual harm. Level D is a pattern of actual harm. Level E is immediate jeopardy. These letters are not CMS F-tag letters.",
      ask: "Ask what the home changed after its most recent Level C, D, or E citation.",
    },
    {
      id: "co-training",
      icon: "training",
      question: "Does dementia training mean this is a memory-care home?",
      regCite: "6 CCR 1011-1 Chapter 7",
      plain:
        "Every Colorado assisted living residence has to train staff on dementia. That training is not a separate memory-care license, and it is not evidence that this home has a secure environment.",
      ask: "Ask what the dementia training covers and how often new staff complete it.",
    },
  ],
};

export const coNhProfileConfig: StateProfileConfig = {
  code: "CO",
  agencyShort: "CMS",
  agencyLong: "Centers for Medicare & Medicaid Services",
  citationPrefix: "",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: coNhSeverity,
  formNameForDeficiency: () => null,
  regulatorPortalUrl: CARE_COMPARE,
  deficiencyTextIsRuleOnly: true,
  rulebook: [
    {
      id: "co-nh-cms",
      icon: "report",
      question: "Who inspects this nursing home?",
      regCite: "CMS Care Compare",
      plain:
        "This is a nursing home, not a CDPHE assisted living residence. Federal surveyors cite F-tags. The letters A through L are CMS scope and severity. They are not Colorado Level A through E.",
      ask: "Ask the home to walk through its latest CMS survey, including any immediate-jeopardy tags (J, K, or L).",
    },
    {
      id: "co-nh-text",
      icon: "enforce",
      question: "Why does the citation text look like a rule?",
      regCite: "CMS health-citation file",
      plain:
        "The public citation file gives the standard statement for the tag. It is not the inspector's write-up of what happened in this building. The finding itself is in the survey packet on Care Compare.",
      ask: "Ask for the Statement of Deficiencies, not only the tag number.",
    },
  ],
};
