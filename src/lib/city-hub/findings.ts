/**
 * State-aware findings copy for city/county hubs.
 *
 * California Type-A / Type-B / CDSS language is CA-only. Other states
 * use their own regulator name and deficiency vocabulary. Missouri
 * severity numbers are not used as "serious" (that mapping is inverted
 * in stored rows and needs a data decision); Oregon citations carry no
 * class or severity in our data.
 */

export type FindingsCopy = {
  /** DataFootnote source line. */
  source: string;
  /** DataFootnote note (vocabulary). */
  note: string;
  /** Short label for a finding, used in FAQ and the findings paragraph. */
  findingPhrase: string;
  /** Stat-block label for homes with any finding on file. */
  anyFindingLabel: string;
};

const COPY: Record<string, FindingsCopy> = {
  CA: {
    source: "CA CDSS Community Care Licensing",
    note: "Type-A = immediate health/safety risk; Type-B = lesser violation",
    findingPhrase: "Type-A or Type-B deficiency",
    anyFindingLabel:
      "Facilities with at least one Type-A or Type-B deficiency finding in the indexed inspection record",
  },
  TX: {
    source: "Texas HHSC Long-Term Care Regulation",
    note: "Deficiency labels are shown as published by HHSC; see methodology for scope",
    findingPhrase: "cited deficiency",
    anyFindingLabel:
      "Facilities with at least one cited deficiency in the indexed LTCR inspection record on file",
  },
  AZ: {
    source: "ADHS BRFL / AZ Care Check",
    note: "Deficiencies cited under A.A.C. Title 9, Chapter 10 (Health Care Institutions)",
    findingPhrase: "A.A.C. R9-10 deficiency",
    anyFindingLabel:
      "Facilities with at least one A.A.C. R9-10 deficiency finding in the indexed inspection record",
  },
  WA: {
    source: "Washington DSHS Residential Care Services",
    note: "DSHS findings as published; Immediate Jeopardy is a CMS nursing-home term",
    findingPhrase: "DSHS inspection or investigation finding",
    anyFindingLabel:
      "Facilities with at least one DSHS inspection or investigation finding on file",
  },
  MN: {
    source: "Minnesota Department of Health · Minn. Stat. ch. 144G",
    note: "Substantiated finding / correction order as published by MDH; not California Type-A/Type-B",
    findingPhrase: "substantiated finding or correction order",
    anyFindingLabel:
      "Homes with at least one MDH substantiated finding or correction order on file",
  },
  OR: {
    source: "Oregon DHS Long-Term Care Licensing",
    note: "Oregon does not grade citations by severity in our data; figures are licensing violations and substantiated abuse findings as published",
    findingPhrase: "licensing violation or substantiated abuse finding",
    anyFindingLabel:
      "Homes with at least one Oregon DHS licensing violation or substantiated abuse finding on file",
  },
  MO: {
    source: "Missouri DHSS Section for Long-Term Care Regulation",
    note: "Deficiency tags cited under 19 CSR 30 (ALF/RCF). Class I/II/III is the DHSS scale; stored severity numbers are not used as 'serious' until that mapping is audited",
    findingPhrase: "DHSS citation",
    anyFindingLabel:
      "Facilities with at least one DHSS deficiency finding in the indexed inspection record",
  },
  PA: {
    source: "PA DHS OLTL",
    note: "55 Pa Code findings as published; Immediate Jeopardy is a CMS term",
    findingPhrase: "PA DHS citation",
    anyFindingLabel:
      "Homes with at least one PA DHS citation on file",
  },
  CO: {
    source: "CDPHE assisted living records and CMS nursing-home surveys",
    note: "Level E is immediate jeopardy for assisted living. CMS J, K, and L are immediate jeopardy for nursing homes.",
    findingPhrase: "higher-severity finding",
    anyFindingLabel:
      "Facilities with at least one CDPHE Level C–E citation or CMS severity 3–4 deficiency in the indexed record",
  },
  IL: {
    source: "Illinois Department of Public Health",
    note: "Type 1, 2, or 3 violations as published by IDPH",
    findingPhrase: "IDPH violation",
    anyFindingLabel:
      "Homes with at least one IDPH violation on file",
  },
  UT: {
    source: "Utah DLBC",
    note: "DLBC inspection or complaint findings as published",
    findingPhrase: "DLBC finding",
    anyFindingLabel:
      "Homes with at least one DLBC inspection or complaint finding on file",
  },
};

const FALLBACK: FindingsCopy = {
  source: "State licensing records",
  note: "Findings as published by the state regulator",
  findingPhrase: "inspection finding",
  anyFindingLabel: "Homes with at least one inspection finding on file",
};

export function findingsCopy(stateCode: string): FindingsCopy {
  return COPY[stateCode.toUpperCase()] ?? FALLBACK;
}

/** True when this state's stored rows have a class or severity we can call "serious". */
export function stateMeasuresSeverity(stateCode: string): boolean {
  const code = stateCode.toUpperCase();
  // Oregon citations in our data have no class and no severity.
  if (code === "OR") return false;
  return true;
}

/**
 * A 12-month citation trend needs enough visits in the window that a drop
 * is not just an ingest gap. Kansas City had 5 inspections in 12 months
 * (newest March 2026) and a 135 → 100 → 17 trend that read as improvement.
 */
export const TREND_MIN_INSPECTIONS_12M = 8;

export function hasReliable12MonthWindow(inspectionsLast12: number): boolean {
  return inspectionsLast12 >= TREND_MIN_INSPECTIONS_12M;
}
