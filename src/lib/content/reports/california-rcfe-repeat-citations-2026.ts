/**
 * Static content data for the CA RCFE Repeat Citations 2026 report.
 *
 * All numbers are sourced directly from the StarlynnCare database on 2026-05-11
 * using the exact methodology defined in docs/analyses/HOOK_DECISION.md.
 *
 * METHODOLOGY SUMMARY:
 *   Repeat citation = same CCR Title 22 regulation code cited at the same facility
 *   in 3 or more DISTINCT inspection visits (not total deficiency rows).
 *   Chain WCS = average of per-facility (sum(severity_weight)/beds) scores, last 3 years.
 *   Scope multiplier = 1 for all CA facilities (scope field is NULL in CA CDSS data).
 *   Only chains with ≥3 CA facilities in the dataset are included.
 */

// ─── Repeat offender table (top 20 by distinct-visit count) ──────────────────

export type RepeatOffenderRow = {
  facilityName: string;
  city: string;
  citySlug: string;
  facilitySlug: string;
  regulationCode: string;
  regulationPlain: string;
  timesDistinctVisits: number;
  maxSeverity: number;
  mostRecentDate: string;
};

/** Plain-English labels for CA CCR Title 22 regulation codes used in this report. */
export const REGULATION_LABELS: Record<string, string> = {
  "87303(a)": "General facility maintenance — clean, safe, and in good repair",
  "87411(a)": "Staffing — sufficient numbers and competent personnel at all times",
  "87309(a)": "Safe storage of disinfectants, cleaning solutions, and hazardous items",
  "87465(a)(4)": "Incidental medical/dental care plan requirements",
  "87465(a)(1)": "Incidental medical/dental care — arranging appropriate care",
  "87468.2(a)(4)": "Personal rights — privacy and personal information of residents",
  "87211(a)(1)": "Serious incident reporting requirements",
  "87555(b)(8)": "Food service — quality and safety standards",
  "87464(f)(1)": "Basic services — care and supervision as defined",
  "87465(c)(2)": "Medication management for residents unable to self-administer",
  "87468.1(a)(2)": "Personal rights — safe, healthful, and comfortable accommodations",
  "87466": "Regular observation of residents for changes in condition",
};

/**
 * Top 20 repeat-offender facility+regulation pairs.
 * Source: CDSS inspection records in StarlynnCare DB, queried 2026-05-11.
 * Sorted by distinct inspection visit count DESC, then max severity DESC.
 */
export const REPEAT_OFFENDERS: RepeatOffenderRow[] = [
  {
    facilityName: "Opal Care LLC",
    city: "Oakland",
    citySlug: "oakland",
    facilitySlug: "opal-care-llc-200672",
    regulationCode: "87468.2(a)(4)",
    regulationPlain: "Personal rights — privacy",
    timesDistinctVisits: 10,
    maxSeverity: 3,
    mostRecentDate: "2026-04-23",
  },
  {
    facilityName: "Oakland Heights Senior Living",
    city: "Oakland",
    citySlug: "oakland",
    facilitySlug: "oakland-heights-senior-living-200513",
    regulationCode: "87303(a)",
    regulationPlain: "General facility maintenance",
    timesDistinctVisits: 9,
    maxSeverity: 3,
    mostRecentDate: "2024-11-08",
  },
  {
    facilityName: "Whitten Heights Assisted Living and Memory Care",
    city: "La Habra",
    citySlug: "la-habra",
    facilitySlug: "whitten-heights-assisted-living-and-memory-care-4192",
    regulationCode: "87303(a)",
    regulationPlain: "General facility maintenance",
    timesDistinctVisits: 8,
    maxSeverity: 3,
    mostRecentDate: "2026-04-21",
  },
  {
    facilityName: "Opal Care LLC",
    city: "Oakland",
    citySlug: "oakland",
    facilitySlug: "opal-care-llc-200672",
    regulationCode: "87411(a)",
    regulationPlain: "Staffing levels and competency",
    timesDistinctVisits: 7,
    maxSeverity: 3,
    mostRecentDate: "2025-04-02",
  },
  {
    facilityName: "Roundhill Care Homes, Inc.",
    city: "Alamo",
    citySlug: "alamo",
    facilitySlug: "roundhill-care-homes-inc-440596",
    regulationCode: "87309(a)",
    regulationPlain: "Safe storage — hazardous items",
    timesDistinctVisits: 6,
    maxSeverity: 3,
    mostRecentDate: "2026-03-23",
  },
  {
    facilityName: "Regency Palms Long Beach",
    city: "Long Beach",
    citySlug: "long-beach",
    facilitySlug: "regency-palms-long-beach-602567",
    regulationCode: "87465(a)(4)",
    regulationPlain: "Medical/dental care plan",
    timesDistinctVisits: 6,
    maxSeverity: 3,
    mostRecentDate: "2025-10-24",
  },
  {
    facilityName: "Brittany House",
    city: "Long Beach",
    citySlug: "long-beach",
    facilitySlug: "brittany-house-320417",
    regulationCode: "87211(a)(1)",
    regulationPlain: "Serious incident reporting",
    timesDistinctVisits: 6,
    maxSeverity: 2,
    mostRecentDate: "2026-01-21",
  },
  {
    facilityName: "Roundhill Care Homes, Inc.",
    city: "Alamo",
    citySlug: "alamo",
    facilitySlug: "roundhill-care-homes-inc-440596",
    regulationCode: "87555(b)(8)",
    regulationPlain: "Food service quality and safety",
    timesDistinctVisits: 6,
    maxSeverity: 2,
    mostRecentDate: "2026-03-23",
  },
  {
    facilityName: "Eskaton Gold River Lodge",
    city: "Gold River",
    citySlug: "gold-river",
    facilitySlug: "eskaton-gold-river-lodge-1241",
    regulationCode: "87465(a)(1)",
    regulationPlain: "Medical care arrangement",
    timesDistinctVisits: 5,
    maxSeverity: 4,
    mostRecentDate: "2024-09-17",
  },
  {
    facilityName: "Astoria Park Senior Living",
    city: "Pasadena",
    citySlug: "pasadena",
    facilitySlug: "astoria-park-senior-living-603566",
    regulationCode: "87411(a)",
    regulationPlain: "Staffing levels and competency",
    timesDistinctVisits: 5,
    maxSeverity: 4,
    mostRecentDate: "2026-05-04",
  },
  {
    facilityName: "Ivy Park at Hayward",
    city: "Hayward",
    citySlug: "hayward",
    facilitySlug: "ivy-park-at-hayward-200922",
    regulationCode: "87309(a)",
    regulationPlain: "Safe storage — hazardous items",
    timesDistinctVisits: 5,
    maxSeverity: 4,
    mostRecentDate: "2025-10-30",
  },
  {
    facilityName: "Belmont Village Aliso Viejo",
    city: "Aliso Viejo",
    citySlug: "aliso-viejo",
    facilitySlug: "belmont-village-aliso-viejo-5563",
    regulationCode: "87464(f)(1)",
    regulationPlain: "Basic care and supervision services",
    timesDistinctVisits: 5,
    maxSeverity: 3,
    mostRecentDate: "2026-05-08",
  },
  {
    facilityName: "La Posada",
    city: "Whittier",
    citySlug: "whittier",
    facilitySlug: "la-posada-603504",
    regulationCode: "87465(c)(2)",
    regulationPlain: "Medication self-administration",
    timesDistinctVisits: 5,
    maxSeverity: 3,
    mostRecentDate: "2024-11-15",
  },
  {
    facilityName: "Whitten Heights Assisted Living and Memory Care",
    city: "La Habra",
    citySlug: "la-habra",
    facilitySlug: "whitten-heights-assisted-living-and-memory-care-4192",
    regulationCode: "87468.1(a)(2)",
    regulationPlain: "Resident personal rights — safe accommodations",
    timesDistinctVisits: 5,
    maxSeverity: 3,
    mostRecentDate: "2025-08-18",
  },
  {
    facilityName: "Brittany House",
    city: "Long Beach",
    citySlug: "long-beach",
    facilitySlug: "brittany-house-320417",
    regulationCode: "87468.1(a)(2)",
    regulationPlain: "Resident personal rights — safe accommodations",
    timesDistinctVisits: 5,
    maxSeverity: 3,
    mostRecentDate: "2026-02-23",
  },
  {
    facilityName: "Beach Terrace Assisted Living and Memory Care",
    city: "Stanton",
    citySlug: "stanton",
    facilitySlug: "beach-terrace-assisted-living-and-memory-care-5901",
    regulationCode: "87303(a)",
    regulationPlain: "General facility maintenance",
    timesDistinctVisits: 5,
    maxSeverity: 3,
    mostRecentDate: "2025-06-03",
  },
  {
    facilityName: "Opal Care LLC",
    city: "Oakland",
    citySlug: "oakland",
    facilitySlug: "opal-care-llc-200672",
    regulationCode: "87303(a)",
    regulationPlain: "General facility maintenance",
    timesDistinctVisits: 5,
    maxSeverity: 2,
    mostRecentDate: "2025-09-24",
  },
  {
    facilityName: "Montgomery Springs Manor",
    city: "Hayward",
    citySlug: "hayward",
    facilitySlug: "montgomery-springs-manor-601506",
    regulationCode: "87303(a)",
    regulationPlain: "General facility maintenance",
    timesDistinctVisits: 5,
    maxSeverity: 2,
    mostRecentDate: "2026-03-24",
  },
  {
    facilityName: "Avenir Memory Care Westside",
    city: "Los Angeles",
    citySlug: "los-angeles",
    facilitySlug: "avenir-memory-care-westside-320184",
    regulationCode: "87303(a)",
    regulationPlain: "General facility maintenance",
    timesDistinctVisits: 4,
    maxSeverity: 4,
    mostRecentDate: "2025-07-31",
  },
  {
    facilityName: "Aegis Living Corte Madera",
    city: "Corte Madera",
    citySlug: "corte-madera",
    facilitySlug: "aegis-living-corte-madera-803994",
    regulationCode: "87465(a)(5)",
    regulationPlain: "Medication assistance",
    timesDistinctVisits: 4,
    maxSeverity: 3,
    mostRecentDate: "2025-09-18",
  },
];

// ─── Chain scorecard (exact WCS, ≥3 facilities, last 3 years) ────────────────
//
// THRESHOLD ANALYSIS (queried 2026-05-11):
//   ≥3 facilities: 5 operators — the only viable threshold.
//   ≥5 facilities: 1 operator  (Transformer Opco / Oakmont only — not a useful list).
//   ≥10 facilities: 1 operator (same).
//
// Decision: use ≥3. This gives a list of 5. Operators with very small total
// bed counts (Alara: 3 facilities, ~18 beds) are flagged with `smallSampleNote`
// to allow readers and editors to apply appropriate caution. The clearest
// "worst large chain" for editorial use is Aegis Senior Communities (4 facilities,
// 55 inspections, WCS 0.137) which has substantially more statistical backing.

export type ChainScorecardRow = {
  /** Operator name exactly as it appears in CDSS licensing records. */
  cdssOperatorName: string;
  /** Consumer-recognizable brand name (if identifiable; null if obscure LLC). */
  brandNote: string | null;
  caFacilitiesInDataset: number;
  totalBeds: number;
  totalInspections: number;
  totalDeficiencies: number;
  weightedCitationScore: number;
  /**
   * Non-null when small total-bed count limits statistical reliability.
   * Render as a visible footnote on the scorecard table.
   */
  smallSampleNote: string | null;
};

/**
 * Chain scorecard — Weighted Citation Score (WCS).
 * Only operators with ≥3 CA facilities in the dataset.
 * ≥5 and ≥10 thresholds both yield ≤1 operator — not a meaningful list.
 * Last 3 years of data (2023-05-11 – 2026-05-11).
 * Sorted worst to best (highest WCS first).
 * Source: CDSS records in StarlynnCare DB, queried 2026-05-11.
 */
export const CHAIN_SCORECARD: ChainScorecardRow[] = [
  {
    cdssOperatorName: "Alara Health Services Inc",
    brandNote: "Alara Health Services",
    caFacilitiesInDataset: 3,
    totalBeds: 18,
    totalInspections: 11,
    totalDeficiencies: 5,
    weightedCitationScore: 0.778,
    smallSampleNote:
      "3 facilities, ~18 total licensed beds. Score is sensitive to small-sample effects at this scale.",
  },
  {
    cdssOperatorName: "Aegis Senior Communities, Llc",
    brandNote: "Aegis Senior Communities",
    caFacilitiesInDataset: 4,
    totalBeds: 362,
    totalInspections: 55,
    totalDeficiencies: 19,
    weightedCitationScore: 0.137,
    smallSampleNote: null,
  },
  {
    cdssOperatorName: "Well Oak Tenant Llc;oakmont Management Group Llc",
    brandNote: "Oakmont Senior Living (Well Oak entities)",
    caFacilitiesInDataset: 3,
    totalBeds: 476,
    totalInspections: 31,
    totalDeficiencies: 8,
    weightedCitationScore: 0.073,
    smallSampleNote: null,
  },
  {
    cdssOperatorName: "Transformer Opco Llc;oakmont Management Group Llc",
    brandNote: "Oakmont Senior Living (Transformer Opco entities)",
    caFacilitiesInDataset: 12,
    totalBeds: 1212,
    totalInspections: 78,
    totalDeficiencies: 11,
    weightedCitationScore: 0.021,
    smallSampleNote: null,
  },
  {
    cdssOperatorName: "Front Porch Communities and Services",
    brandNote: "Front Porch Communities",
    caFacilitiesInDataset: 3,
    totalBeds: 1254,
    totalInspections: 33,
    totalDeficiencies: 3,
    weightedCitationScore: 0.006,
    smallSampleNote: null,
  },
];

// ─── Year-over-year citation rate data (2021–2025) ────────────────────────────

export type YearlyRateRow = {
  year: number;
  inspections: number;
  deficiencies: number;
  deficiencyRate: number;
  note?: string;
};

/**
 * Deficiency rate per inspection by year, 2021–2025.
 * Derived from Analysis 6 (severity_trends_2020_2025).
 * 2020 excluded (1 inspection — COVID shutdown).
 */
export const YEARLY_RATES: YearlyRateRow[] = [
  { year: 2021, inspections: 556, deficiencies: 185, deficiencyRate: 0.33, note: "Post-COVID ramp-up year" },
  { year: 2022, inspections: 1085, deficiencies: 479, deficiencyRate: 0.44 },
  { year: 2023, inspections: 1323, deficiencies: 919, deficiencyRate: 0.69 },
  { year: 2024, inspections: 1725, deficiencies: 1331, deficiencyRate: 0.77 },
  { year: 2025, inspections: 2245, deficiencies: 1299, deficiencyRate: 0.58, note: "Partial year — data through May 2026" },
];

// ─── Summary stats ────────────────────────────────────────────────────────────

export const REPORT_SUMMARY = {
  totalFacilities: 484,
  totalInspections: 12167,
  totalDeficiencies: 7748,
  repeatOffenderFacilities: 63,
  repeatOffenderPct: 13,
  oneInN: 8,
  dataWindowStart: "May 2019",
  dataWindowEnd: "May 2026",
  topRepeatedRegulation: "§87303(a)",
  topRepeatedRegulationPlain: "General facility maintenance — clean, safe, and in good repair",
  rateRisePct: 132,
  rate2021: 0.33,
  rate2024: 0.77,
  queryDate: "2026-05-11",
} as const;

// ─── Methodology disclosure (for "About this data" block) ────────────────────

export const METHODOLOGY_DISCLOSURE = `This analysis covers 484 California Residential Care Facilities for the Elderly (RCFEs) for which StarlynnCare has ingested inspection records from the California Department of Social Services (CDSS) Community Care Licensing Division. This is not a complete census of all California RCFEs. The CDSS Community Care Licensing Division is the authoritative source for California RCFE inspection records; families should verify current status directly at the CDSS website.

A "regulatory citation" or "deficiency" is a finding by a CDSS licensing agent that a facility violated a California Code of Regulations Title 22 requirement at the time of inspection. Deficiencies are administrative compliance findings — not determinations that a resident was harmed, and not necessarily reflective of current conditions. Facilities are required to submit corrective action plans.

"Repeat citation" in this analysis means the same CCR Title 22 regulation code was cited at the same facility in 3 or more distinct inspection visits in our database (May 2019 – May 2026). A repeat citation does not mean the violation was never corrected between visits.

"Chain" means facilities sharing the same operator name as recorded in CDSS licensing records. CDSS records list the legal entity, which may differ from consumer brand names. Chain rankings include only operators with 3 or more facilities in our dataset; operators with fewer facilities are excluded to ensure a minimum level of statistical meaningfulness. Operators with very small total bed counts (fewer than 50 beds across all facilities) have scores that are more sensitive to individual inspection outcomes and should be interpreted with caution.

"Weighted Citation Score" is a relative index of citation frequency and severity in our dataset over the last three years. It is not a safety rating or clinical quality measure.

Inspection activity dropped significantly in 2020–2021 due to COVID-era restrictions; year-over-year trend data should be interpreted in that context.`;
