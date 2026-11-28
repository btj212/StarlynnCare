import { careSettingCopy } from "@/lib/city-hub/careSetting";
import { azDirectedCareLicense } from "@/lib/facility/azDirectedCare";
import {
  BASIS_NOT_RECORDED_SENTENCE,
  citationRecordPhrase,
  facilityPageNoun,
  weightedCitationsPerBedPhrase,
} from "@/lib/facility/pageCopy";
import {
  texasRecentResultsSentence,
  texasRecentResultsUnpublished,
  texasRegulatorRecordUrl,
} from "@/lib/facility/texasRecord";

/**
 * Clip meta descriptions for `<meta name="description">` and matching OG/Twitter fields.
 * Prefer sentence boundaries; otherwise word boundaries; keeps length ≤ `max` including ellipsis.
 * Abbreviations (single capital letter + period, e.g. "St.", "Dr.", "Mt.") are never treated
 * as sentence boundaries, preventing truncation mid-city-name like "…in St.…".
 */
export function clipMetaDescription(text: string, max = 160): string {
  const t = text.trim();
  if (t.length <= max) return t;

  const ellipsis = "…";
  const budget = max - ellipsis.length;
  const slice = t.slice(0, budget);
  const preferFrom = Math.floor(max * 0.6);

  // Last sentence end within slice, not before preferFrom.
  // Skip periods that are preceded by an abbreviation (e.g. "N.", "St.", "Dr.", "Mt.").
  for (let i = slice.length - 1; i >= preferFrom; i--) {
    const c = slice[i];
    if (c === "." || c === "!" || c === "?") {
      const next = slice[i + 1];
      if (next === undefined || /\s/.test(next ?? "")) {
        const prev = i > 0 ? slice[i - 1] : "";
        const prevPrev = i > 1 ? slice[i - 2] : "";
        const prevPrevPrev = i > 2 ? slice[i - 3] : "";
        // Single uppercase: "N.", "A.", "U.", etc.
        const isSingleUpperAbbrev =
          /[A-Z]/.test(prev) && (prevPrev === "" || /[\s\-]/.test(prevPrev));
        // Two-letter uppercase-initial: "St.", "Dr.", "Mt.", "Rd.", "Jr.", "Sr.", etc.
        const isTwoLetterAbbrev =
          /[a-z]/.test(prev) &&
          /[A-Z]/.test(prevPrev) &&
          (prevPrevPrev === "" || /[\s\-]/.test(prevPrevPrev));
        const isAbbreviation = isSingleUpperAbbrev || isTwoLetterAbbrev;
        if (isAbbreviation) continue;
        const out = slice.slice(0, i + 1).trim();
        if (out.length > 0 && out.length <= budget) return out + ellipsis;
      }
    }
  }

  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > preferFrom && lastSpace > 0) {
    return slice.slice(0, lastSpace).trim() + ellipsis;
  }

  return slice.trim() + ellipsis;
}

/**
 * State regulator abbreviation used inline in meta/prose copy ("CDSS citations",
 * "MDH citations", etc.). Mirrors `regulatorLicensePageLabel` but as a bare
 * abbreviation suitable for prose.
 */
export const REGULATOR_ABBR: Record<string, string> = {
  CA: "CDSS",
  TX: "HHSC",
  OR: "OR DHS",
  WA: "DSHS",
  MN: "MDH",
  UT: "DLBC",
  IL: "IDPH",
  PA: "PA DHS",
  AZ: "ADHS",
  MO: "DHSS",
  CO: "CDPHE",
};

/**
 * Format an ISO date (e.g. "2025-07-14") as "Jul 2025". Returns null when input
 * is missing so callers can drop the fragment cleanly.
 */
export function shortMonthYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const STATE_ABBR: Record<string, string> = {
  California: "CA",
  Washington: "WA",
  Oregon: "OR",
  Minnesota: "MN",
  Texas: "TX",
  Pennsylvania: "PA",
  Utah: "UT",
  Illinois: "IL",
  Arizona: "AZ",
  Missouri: "MO",
  Colorado: "CO",
};

const MAX_TITLE = 70;

/** Clip a title string to MAX_TITLE characters at a word boundary. */
function clipTitle(s: string): string {
  if (s.length <= MAX_TITLE) return s;
  const cut = s.slice(0, MAX_TITLE);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > MAX_TITLE * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/** A rank against fewer than 10 peers is not a public claim. */
export function reportablePercentile(
  percentile: number | null | undefined,
  peerCount: number | null | undefined,
): number | null {
  if (percentile == null || (peerCount ?? 0) < 10) return null;
  return percentile;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function stripMemoryCareWords(text: string): string {
  return text
    .replace(/\bmemory care\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,./-]+|[\s,./-]+$/g, "")
    .trim();
}

/**
 * Prose for the no-inspection title. The short form is the chip already
 * shown on city lists. Neither form adds the words "Memory Care".
 */
function licenseTitlePhrase(label: string | null | undefined): { prose: string; short: string } {
  const raw = stripMemoryCareWords(label ?? "");
  const known: Record<string, { prose: string; short: string }> = {
    AL: { prose: "Assisted Living", short: "AL" },
    ALF: { prose: "Assisted Living", short: "ALF" },
    "ALF**": { prose: "Assisted Living", short: "ALF" },
    "ASSISTED LIVING": { prose: "Assisted Living", short: "AL" },
    "TYPE A": { prose: "Assisted Living", short: "AL" },
    "TYPE B": { prose: "Assisted Living", short: "AL" },
    "TYPE C": { prose: "Assisted Living", short: "AL" },
    "ASSISTED LIVING (NO DEMENTIA CARE LICENSE)": { prose: "Assisted Living", short: "AL" },
    RCF: { prose: "Residential Care Facility", short: "RCF" },
    "RESIDENTIAL CARE": { prose: "Residential Care Facility", short: "RCF" },
    RCFE: { prose: "Residential Care Facility for the Elderly", short: "RCFE" },
    "RCFE-CCRC": { prose: "Residential Care Facility for the Elderly", short: "RCFE" },
    "PERSONAL CARE": { prose: "Personal Care", short: "Personal Care" },
    NF: { prose: "Nursing Home", short: "NF" },
    SNF: { prose: "Nursing Home", short: "SNF" },
    "NURSING HOME": { prose: "Nursing Home", short: "Nursing Home" },
    ALDC: { prose: "Assisted Living with Dementia Care", short: "ALDC" },
    CCRC: { prose: "Continuing Care", short: "CCRC" },
    "ALF/RCF": { prose: "Assisted Living or Residential Care", short: "ALF/RCF" },
    "CARE FACILITY": { prose: "Care Facility", short: "Care Facility" },
  };
  const hit = known[raw.toUpperCase()];
  if (hit) return hit;
  if (!raw) return { prose: "Care Facility", short: "Care Facility" };
  return { prose: raw, short: raw };
}

function licenseFallbackTitles(place: string, licenseLabel: string | null | undefined): string[] {
  const { prose, short } = licenseTitlePhrase(licenseLabel);
  const titles = [`${place} — Licensed ${prose}`];
  if (short !== prose) titles.push(`${place} — Licensed ${short}`);
  titles.push(`${place} — ${short}`);
  return titles;
}

/**
 * Name and city first so facility-name searches match the SERP, then a
 * concrete hook (citation count and last inspection date) so the result
 * looks like the home's page, not a generic reports dump.
 *
 * GSC (28 days ending 2026-11-24): name queries at ~position 11 with 0
 * clicks ("fields of florissant", "st peters post acute"). The
 * "{Name}, {City}: Inspection Record & Citations ({Year})" title tied the
 * profile to its /inspections subpage. Year is the last inspection year
 * we hold — never the generate date. The description states the citation
 * count and, when both numbers exist, weighted citations per bed.
 */
export function buildFacilityTitle(input: {
  name: string;
  stateName: string;
  /** Kept for callers. Rank is no longer a title claim. */
  percentile: number | null;
  city: string;
  citationCount?: number | null;
  inspectionCount?: number | null;
  reviewCount?: number | null;
  /** ISO yyyy-mm-dd of the latest inspection, used for the title year. */
  lastInspectionDate?: string | null;
  /** When Washington and not memory care, use the Adult Family Home / Assisted Living suffix. */
  stateCode?: string;
  waFacilityType?: string | null;
  dementiaTier?: "memory-care" | "confirmed-accepts" | "credential" | "neither";
  /**
   * License chip from listLicenseLabel. Used when there is no inspection,
   * including an Arizona home that is not licensed for Directed Care.
   */
  licenseLabel?: string | null;
  /** ADHS care level. Directed Care is the no-inspection Arizona title only when this says so. */
  azLicenseLevel?: string | null;
}): string {
  const { name, stateName, city, citationCount, inspectionCount, reviewCount, lastInspectionDate } = input;
  const abbr = STATE_ABBR[stateName] ?? stateName;
  const place = `${name}, ${city}`;
  const placeAbbr = `${name}, ${city}, ${abbr}`;
  const inspections = inspectionCount ?? 0;
  const reviews = reviewCount ?? 0;
  const year = lastInspectionDate?.slice(0, 4) ?? null;
  const inspected = shortMonthYear(lastInspectionDate);
  const citationHook =
    inspections > 0 && citationCount != null && !(input.stateCode === "TX" && citationCount === 0)
      ? citationCount === 0
        ? "no citations in 3 yrs"
        : countLabel(citationCount, "citation", "citations")
      : null;
  const facts: string[] = [];
  if (inspections > 0) facts.push(countLabel(inspections, "inspection", "inspections"));
  if (
    citationCount != null &&
    inspections > 0 &&
    !(input.stateCode === "TX" && citationCount === 0)
  ) {
    facts.push(countLabel(citationCount, "citation", "citations"));
  }
  if (reviews > 0) facts.push("reviews");

  const waNotMemoryCare =
    (input.stateCode === "WA" || input.stateName === "Washington") &&
    input.dementiaTier != null &&
    input.dementiaTier !== "memory-care";
  const waKind =
    (input.waFacilityType ?? "").trim().toUpperCase() === "AFH"
      ? "Adult Family Home"
      : "Assisted Living";
  const waWithAccepts =
    input.dementiaTier === "confirmed-accepts"
      ? `${waKind}, Accepts Dementia`
      : input.dementiaTier === "credential"
        ? `${waKind}, Dementia Credential`
        : waKind;
  const azDirected =
    (input.stateCode === "AZ" || input.stateName === "Arizona") &&
    azDirectedCareLicense(input.azLicenseLevel);
  const inspectionTitles =
    inspections > 0
      ? [
          citationHook && inspected ? `${place} — ${citationHook}, inspected ${inspected}` : null,
          citationHook ? `${place} — ${citationHook}${year ? ` (${year})` : ""}` : null,
          inspected ? `${place} — last inspected ${inspected}` : null,
          year ? `${place}: Inspection record (${year})` : `${place}: Inspection record`,
          `${placeAbbr}: Inspection record`,
        ].filter((candidate): candidate is string => candidate != null)
      : azDirected
        ? [`${place}: Directed Care Home`, `${placeAbbr}: Directed Care Home`]
        : waNotMemoryCare
          ? [`${place}: ${waWithAccepts}`, `${place}: ${waKind}`, `${placeAbbr}: ${waKind}`]
          : licenseFallbackTitles(place, input.licenseLabel);
  const candidates = [
    ...inspectionTitles,
    facts.length ? `${place}: ${joinTitleFacts(facts)}` : placeAbbr,
    facts.length > 1 ? `${place}: ${joinTitleFacts(facts.slice(0, -1))}` : place,
    placeAbbr,
    `${name}, ${city}`,
    `${name}, ${abbr}`,
    name,
  ];
  return clipTitle(candidates.find((candidate) => candidate.length <= MAX_TITLE) ?? name);
}

/** State hub title that answers regulator-lookup queries. */
export function buildStateHubTitle(stateName: string, regulatorAbbr: string, stateCode?: string): string {
  const setting = stateCode ? careSettingCopy(stateCode) : null;
  const topic = setting?.h1Topic ?? "Memory Care";
  const candidates =
    stateCode === "AZ"
      ? [
          `${stateName} Directed Care Inspection Reports | ${regulatorAbbr} Lookup`,
          `Directed Care Inspection Reports in ${stateName}`,
          `Directed Care in ${stateName} - Inspection Data`,
        ]
      : stateCode === "WA"
        ? [
            `${stateName} Dementia Care Inspection Reports | ${regulatorAbbr} Lookup`,
            `Dementia Care Inspection Reports in ${stateName}`,
            `Dementia Care in ${stateName} - Inspection Data`,
          ]
        : stateCode === "PA"
          ? [
              `${stateName} Personal Care Home License Search | ${regulatorAbbr}`,
              `${stateName} Assisted Living License Search | ${regulatorAbbr}`,
              `${stateName} Personal Care Inspection Reports | ${regulatorAbbr} Lookup`,
              `Personal Care Inspection Reports in ${stateName}`,
              `${topic} in ${stateName} - Inspection Data`,
            ]
          : [
              `${stateName} Memory Care Inspection Reports | ${regulatorAbbr} Lookup`,
              `Memory Care Inspection Reports in ${stateName}`,
              `Memory Care in ${stateName} - Inspection Data`,
            ];
  return clipTitle(candidates.find((candidate) => candidate.length <= MAX_TITLE) ?? candidates[candidates.length - 1]!);
}

/**
 * Title of a home's full-report page. Must not look like the profile title
 * (name + city + citation hook) so name queries stay on the profile.
 */
export function buildFacilityReportsTitle(input: {
  name: string;
  stateName: string;
  city: string;
}): string {
  const { name, stateName, city } = input;
  const abbr = STATE_ABBR[stateName] ?? stateName;
  const candidates = [
    `${name}, ${city}: Full ${abbr} inspection reports`,
    `${name}, ${city}: Full inspection reports`,
    `${name}: Full inspection reports`,
    `${name}: Inspection reports`,
    name,
  ];
  return clipTitle(candidates.find((candidate) => candidate.length <= MAX_TITLE) ?? name);
}

function joinTitleFacts(facts: string[]): string {
  if (facts.length <= 1) return facts[0] ?? "";
  if (facts.length === 2) return `${facts[0]} and ${facts[1]}`;
  return `${facts.slice(0, -1).join(", ")} and ${facts[facts.length - 1]}`;
}

/** One factual sentence for the top of a facility page. Null when there is no record to cite. */
export function buildFacilityRecordSentence(input: {
  citationCount: number;
  inspectionCount: number;
  lastInspected: string | null;
  regulatorAbbr: string;
  licenseNumber: string | null;
  stateCode?: string | null;
  /** Deficiency rows we hold, any year. `0` is an empty file, not an unknown one. */
  heldCount?: number | null;
  olderCitation?: boolean;
  /** ISO date of the newest deficiency row, any year. */
  lastCitationDate?: string | null;
  /** ISO date of the oldest inspection we hold. */
  earliestInspectionDate?: string | null;
}): string | null {
  if (
    input.stateCode &&
    texasRecentResultsUnpublished(input.stateCode, input.inspectionCount, input.citationCount)
  ) {
    return texasRecentResultsSentence(texasRegulatorRecordUrl());
  }
  if (input.inspectionCount < 1) {
    return input.licenseNumber
      ? `No ${input.regulatorAbbr} inspection is in the records we hold. License ${input.licenseNumber}.`
      : null;
  }
  const cite = citationRecordPhrase({
    stateCode: input.stateCode,
    regulatorAbbr: input.regulatorAbbr,
    windowCount: input.citationCount,
    inspectionCount: input.inspectionCount,
    heldCount: input.heldCount,
    olderCitation: input.olderCitation,
    lastCitationDate: input.lastCitationDate,
    earliestInspectionDate: input.earliestInspectionDate,
  });
  const parts = [cite];
  if (input.lastInspected) parts.push(`last inspected ${input.lastInspected}`);
  if (input.licenseNumber) parts.push(`license ${input.licenseNumber}`);
  return `${parts.join(", ")}.`;
}

/** Minimum length for meta descriptions to avoid Ahrefs/Google "too short" warnings. */
const MIN_DESC = 110;

/**
 * Meta description for a facility SERP result. Citation text names the window
 * or the records we hold. A peer sentence is the measured value against the
 * peer median, and only when both numbers are present.
 */
export function buildFacilityDescription(f: {
  name: string;
  /** Kept so callers can still pass the snapshot grade. Not printed. */
  percentile: number | null;
  stateName: string;
  stateCode?: string;
  city: string;
  citationCount: number;
  inspectionCount?: number;
  reviewCount?: number;
  /** Regulator abbreviation: "CDSS" / "DSHS" / "OR DHS" / "MDH" */
  agency: string;
  /** Pre-formatted month+year string, e.g. "Apr 2026" */
  lastInspected: string | null;
  heldCount?: number | null;
  olderCitation?: boolean;
  lastCitationDate?: string | null;
  earliestInspectionDate?: string | null;
  basisRecorded?: boolean;
  severityValue?: number | null;
  severityPeerMedian?: number | null;
  windowMonths?: number | null;
}): string {
  const inspectionCount = f.inspectionCount ?? 0;
  const citations =
    inspectionCount < 1 &&
    !(f.stateCode && texasRecentResultsUnpublished(f.stateCode, inspectionCount, f.citationCount))
      ? `no ${f.agency} inspection is in the records we hold`
      : citationRecordPhrase({
          stateCode: f.stateCode,
          regulatorAbbr: f.agency,
          windowCount: f.citationCount,
          inspectionCount,
          heldCount: f.heldCount,
          olderCitation: f.olderCitation,
          lastCitationDate: f.lastCitationDate,
          earliestInspectionDate: f.earliestInspectionDate,
        });
  const inspPart = f.lastInspected ? ` · last inspected ${f.lastInspected}` : "";
  const ctaSuffix = `View the full inspection record on StarlynnCare — no referral fees.`;
  const reviewCta =
    (f.reviewCount ?? 0) > 0
      ? ` Read reviews and the full ${f.agency} inspection record on StarlynnCare.`
      : ` Read the full ${f.agency} inspection record on StarlynnCare.`;
  const peer = weightedCitationsPerBedPhrase({
    value: f.severityValue,
    peerMedian: f.severityPeerMedian,
    agencyShort: f.agency,
    windowMonths: f.windowMonths,
  });
  const padNoun = facilityPageNoun({
    stateCode: f.stateCode ?? "",
    basisRecorded: f.basisRecorded === true,
  });

  if (peer) {
    const base = `${peer}. ${citations}${inspPart}.`;
    const full = `${base} ${ctaSuffix}`;
    return full.length >= MIN_DESC ? full : `${base} ${padNoun} in ${f.city}, ${f.stateName}. ${ctaSuffix}`;
  }

  const base = `${f.name} in ${f.city}, ${f.stateName} · ${citations}${inspPart}.`;
  const core = base + reviewCta;
  if (core.length >= MIN_DESC) return core;
  return `${base} ${padNoun.charAt(0).toUpperCase()}${padNoun.slice(1)}. ${ctaSuffix}`;
}

export type FacilitySnippetVariant = "meta" | "prose";

export interface FacilitySnippetArgs {
  facilityName: string;
  stateName: string;
  stateCode: string;
  /** Snapshot composite letter grade (e.g. "B+"). Null when peer set too thin. */
  grade: string | null;
  /** Composite percentile 0–100, higher = better. Null when grade missing. */
  percentile: number | null;
  /** Sub-metric percentiles — used to surface the worst signal instead of the composite. */
  severityPercentile?: number | null;
  frequencyPercentile?: number | null;
  repeatsPercentile?: number | null;
  /** Deficiency rows inside the 3-year window. */
  citationCount: number;
  /** Inspections in the profile window. Used so Texas does not call an empty window clean. */
  inspectionCount?: number;
  /** Most recent inspection date as ISO yyyy-mm-dd. */
  lastInspectionDate: string | null;
  /** Pre-formatted last-inspected label. When set, used instead of shortMonthYear. */
  lastInspected?: string | null;
  /** "meta" emits a compact line. "prose" emits a sentence for the page. Default "meta". */
  variant?: FacilitySnippetVariant;
  /** Overrides the state-level regulator abbreviation. Colorado nursing homes are CMS, not CDPHE. */
  regulatorAbbr?: string | null;
  heldCount?: number | null;
  olderCitation?: boolean;
  lastCitationDate?: string | null;
  earliestInspectionDate?: string | null;
  /** Weighted citations per bed. Omitted from the sentence when null. */
  severityValue?: number | null;
  severityPeerMedian?: number | null;
  windowMonths?: number | null;
}

/**
 * Citation sentence for the lede and the JSON-LD description. The peer clause
 * is the measured value against the peer median. It is omitted when either
 * number is missing.
 */
export function buildFacilitySnippet(args: FacilitySnippetArgs): string {
  const {
    facilityName,
    stateCode,
    citationCount,
    lastInspectionDate,
    variant = "meta",
    regulatorAbbr,
  } = args;

  const reg = regulatorAbbr?.trim() || REGULATOR_ABBR[stateCode] || "state";
  const citeFrag = citationRecordPhrase({
    stateCode,
    regulatorAbbr: reg,
    windowCount: citationCount,
    inspectionCount: args.inspectionCount ?? 1,
    heldCount: args.heldCount,
    olderCitation: args.olderCitation,
    lastCitationDate: args.lastCitationDate,
    earliestInspectionDate: args.earliestInspectionDate,
  });

  const inspMo = args.lastInspected ?? shortMonthYear(lastInspectionDate);
  const inspFrag = inspMo ? `last inspected ${inspMo}` : null;
  const peer = weightedCitationsPerBedPhrase({
    value: args.severityValue,
    peerMedian: args.severityPeerMedian,
    agencyShort: reg,
    windowMonths: args.windowMonths,
  });
  const peerBit = peer ? ` ${peer}.` : "";

  if (variant === "prose") {
    const lead = citeFrag.includes("records we hold")
      ? `${facilityName}: ${citeFrag}`
      : `${facilityName} has ${citeFrag}`;
    return `${lead}${inspFrag ? `; ${inspFrag}` : ""}.${peerBit}`;
  }

  return `${citeFrag}${inspFrag ? ` · ${inspFrag}` : ""}.${peerBit} Independent public-record review on StarlynnCare.`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * 40–60 word above-the-fold answer for facility-name and inspection queries.
 * Returns null when the record is too thin to support a paragraph without padding.
 */
export function buildFacilityDirectAnswer(input: {
  name: string;
  city: string;
  stateName: string;
  stateCode?: string;
  regulatorAbbr: string;
  licenseNumber: string | null;
  inspectionCount: number;
  citationCount: number;
  lastInspected: string | null;
  beds: number | null;
  /** Override the "is a … home" noun. */
  facilityNoun?: string;
  /** When set and not Directed Care, the Arizona sentence does not use that license level. */
  azLicenseLevel?: string | null;
  /** When set, "licensed memory care home" is used only if this is true. */
  basisRecorded?: boolean;
  heldCount?: number | null;
  olderCitation?: boolean;
  lastCitationDate?: string | null;
  earliestInspectionDate?: string | null;
}): string | null {
  if (input.inspectionCount < 1 && !input.licenseNumber) return null;

  const license = input.licenseNumber ? ` License ${input.licenseNumber}.` : "";
  const beds = input.beds != null ? ` Licensed for ${input.beds} beds.` : "";
  const inspected = input.lastInspected ? ` Last inspected ${input.lastInspected}.` : "";
  const citeKnown =
    input.heldCount != null ||
    input.olderCitation != null ||
    input.lastCitationDate != null ||
    input.earliestInspectionDate != null;

  let record: string;
  if (
    input.stateCode &&
    texasRecentResultsUnpublished(input.stateCode, input.inspectionCount, input.citationCount)
  ) {
    record = texasRecentResultsSentence(texasRegulatorRecordUrl());
  } else if (input.inspectionCount < 1) {
    record = `No ${input.regulatorAbbr} inspection is on file yet.`;
  } else if (input.stateCode === "TX" && input.citationCount === 0) {
    record = "HHSC has not published a citation count for this home in the last 3 years.";
  } else if (citeKnown) {
    const visits = `${input.inspectionCount} ${input.regulatorAbbr} ${input.inspectionCount === 1 ? "inspection is" : "inspections are"} on file from the last 3 years.`;
    const cite = citationRecordPhrase({
      stateCode: input.stateCode,
      regulatorAbbr: input.regulatorAbbr,
      windowCount: input.citationCount,
      inspectionCount: input.inspectionCount,
      heldCount: input.heldCount,
      olderCitation: input.olderCitation,
      lastCitationDate: input.lastCitationDate,
      earliestInspectionDate: input.earliestInspectionDate,
    });
    record = `${visits} ${cite}.`;
  } else if (input.citationCount === 0) {
    record = `${input.inspectionCount} ${input.regulatorAbbr} ${input.inspectionCount === 1 ? "inspection is" : "inspections are"} on file from the last 3 years, with no citations in that window.`;
  } else {
    record = `${input.inspectionCount} ${input.regulatorAbbr} ${input.inspectionCount === 1 ? "inspection" : "inspections"} and ${input.citationCount} ${input.citationCount === 1 ? "citation" : "citations"} are on file from the last 3 years.`;
  }

  const legacyNoun =
    input.stateCode === "AZ" || input.stateName === "Arizona"
      ? input.azLicenseLevel != null && !azDirectedCareLicense(input.azLicenseLevel)
        ? "licensed home"
        : "Directed Care licensed home"
      : input.stateCode === "WA" || input.stateName === "Washington"
        ? "licensed home that may serve residents with dementia"
        : input.stateCode === "PA" || input.stateName === "Pennsylvania"
          ? "licensed personal care or assisted living home"
          : "licensed memory care home";
  const noun =
    input.facilityNoun ??
    (input.basisRecorded == null
      ? legacyNoun
      : facilityPageNoun({
          stateCode: input.stateCode ?? "",
          basisRecorded: input.basisRecorded,
        }));
  const basisNote =
    input.basisRecorded === false ? ` ${BASIS_NOT_RECORDED_SENTENCE}` : "";

  const base = `${input.name} is a ${noun} in ${input.city}, ${input.stateName}.${license}${beds} ${record}${inspected} Read the dated inspection record on this page; StarlynnCare does not take referral fees.`;
  const words = wordCount(base);
  let body = base;
  if (words < 40) {
    const padded = `${base} Compare it with nearby homes using the same ${input.regulatorAbbr} source.`;
    body = wordCount(padded) <= 70 ? padded : base;
  } else if (words > 60) {
    body = `${input.name} is a ${noun} in ${input.city}, ${input.stateName}.${license} ${record}${inspected} The inspection record is on this page.`;
  }
  return `${body}${basisNote}`;
}
