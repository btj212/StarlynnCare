import { peerRankPhrase } from "@/lib/seo/rankPhrase";
import { careSettingCopy, peerSetPhrase } from "@/lib/city-hub/careSetting";
import { azDirectedCareLicense } from "@/lib/facility/azDirectedCare";

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
 * on record — never the generate date. Rank stays in the description.
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
    inspections > 0 && citationCount != null
      ? citationCount === 0
        ? "no citations"
        : countLabel(citationCount, "citation", "citations")
      : null;
  const facts: string[] = [];
  if (inspections > 0) facts.push(countLabel(inspections, "inspection", "inspections"));
  if (citationCount != null && inspections > 0) {
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
}): string | null {
  if (input.inspectionCount < 1) {
    return input.licenseNumber
      ? `No ${input.regulatorAbbr} inspection is on record. License ${input.licenseNumber}.`
      : null;
  }
  const cite =
    input.citationCount === 1
      ? `1 ${input.regulatorAbbr} citation on record in the last 3 years`
      : `${input.citationCount} ${input.regulatorAbbr} citations on record in the last 3 years`;
  const parts = [cite];
  if (input.lastInspected) parts.push(`last inspected ${input.lastInspected}`);
  if (input.licenseNumber) parts.push(`license ${input.licenseNumber}`);
  return `${parts.join(", ")}.`;
}

/** Minimum length for meta descriptions to avoid Ahrefs/Google "too short" warnings. */
const MIN_DESC = 110;

/**
 * Build a data-driven meta description for a facility SERP result.
 *
 * Top-half facilities (composite_percentile ≥ 50) lead with the comparative
 * rank claim. Bottom-half and unrated facilities lead with facts only — city,
 * citation count, last inspection date — with no quality claim.
 *
 * YMYL rule: never assert a ranking for a facility in the bottom half.
 */
export function buildFacilityDescription(f: {
  name: string;
  /** Composite percentile 0–100, higher = better. Null when peer set too thin. */
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
}): string {
  const citations =
    (f.inspectionCount ?? 1) < 1
      ? `no ${f.agency} inspection on record`
      : f.citationCount === 0
        ? `no ${f.agency} citations on record in the last 3 years`
        : f.citationCount === 1
          ? `1 ${f.agency} citation on record in the last 3 years`
          : `${f.citationCount} ${f.agency} citations on record in the last 3 years`;
  const inspPart = f.lastInspected ? ` · last inspected ${f.lastInspected}` : "";
  const ctaSuffix = `View the full inspection record on StarlynnCare — no referral fees.`;
  const reviewCta =
    (f.reviewCount ?? 0) > 0
      ? ` Read reviews and the full ${f.agency} inspection record on StarlynnCare.`
      : ` Read the full ${f.agency} inspection record on StarlynnCare.`;

  // Top-half — comparative claim.
  if (f.percentile != null && f.percentile >= 50) {
    const topPct = Math.max(1, 100 - f.percentile);
    const tail =
      topPct <= 10
        ? `View the full inspection record on StarlynnCare.`
        : `View inspection record — no referral commissions.`;
    const peers = f.stateCode ? peerSetPhrase(f.stateCode, f.stateName) : `${f.stateName} memory care`;
    const padNoun = f.stateCode ? careSettingCopy(f.stateCode).facilityNoun : "licensed memory care facility";
    const base = `Top ${topPct}% of ${peers} · ${citations}${inspPart}.`;
    const full = `${base} ${tail}`;
    return full.length >= MIN_DESC ? full : `${base} ${padNoun} in ${f.city}, ${f.stateName}. ${tail}`;
  }

  // Bottom-half or unrated — facts only, no ranking language.
  const base = `${f.name} in ${f.city}, ${f.stateName} · ${citations}${inspPart}.`;
  const cta = reviewCta;
  const core = base + cta;
  if (core.length >= MIN_DESC) return core;
  const padNoun = f.stateCode ? careSettingCopy(f.stateCode).facilityNoun : "licensed memory care facility";
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
  /** Total deficiencies on record. */
  citationCount: number;
  /** Most recent inspection date as ISO yyyy-mm-dd. */
  lastInspectionDate: string | null;
  /** Pre-formatted last-inspected label. When set, used instead of shortMonthYear. */
  lastInspected?: string | null;
  /** "meta" emits the "What X's website won't show you:" prefix. "prose" emits a
   *  natural-prose sentence suitable for in-page rendering. Default "meta". */
  variant?: FacilitySnippetVariant;
  /** Overrides the state-level regulator abbreviation. Colorado nursing homes are CMS, not CDPHE. */
  regulatorAbbr?: string | null;
}

/**
 * Build a data-driven facility SERP snippet from snapshot RPC + totals.
 *
 * Both variants pull from the same fragments (grade+rank, citation count,
 * last inspection) so meta and on-page prose stay aligned — important because
 * Google overrides our meta ~20–30% of the time and we want it to lift the
 * same differentiator from on-page text.
 *
 * Fragments degrade gracefully: if grade is null we drop the rank fragment;
 * if there are no inspections we drop the last-inspection fragment. The helper
 * always returns at least the citation fragment ("no CDSS citations on record"
 * when zero), so callers never get an empty string.
 */
/**
 * For bottom-half facilities: find the sub-metric that is at least 10 points
 * worse than the composite and has the lowest percentile. Returns null when no
 * sub-metric differs by the threshold, when all sub-metrics are null, or when
 * the composite is top-half (we only call this for bottom-half facilities).
 */
function worstSubMetricFragment(
  composite: number,
  severityPct: number | null | undefined,
  frequencyPct: number | null | undefined,
  repeatsPct: number | null | undefined,
): { percentile: number; label: string } | null {
  const candidates: Array<{ percentile: number; label: string }> = [
    { percentile: severityPct ?? Infinity, label: "citation severity" },
    { percentile: frequencyPct ?? Infinity, label: "citation frequency" },
    { percentile: repeatsPct ?? Infinity, label: "repeat-citation rate" },
  ].filter((c) => c.percentile !== Infinity && c.percentile < 50 && composite - c.percentile >= 10);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.percentile < a.percentile ? b : a));
}

export function buildFacilitySnippet(args: FacilitySnippetArgs): string {
  const {
    facilityName,
    stateName,
    stateCode,
    grade,
    percentile,
    severityPercentile,
    frequencyPercentile,
    repeatsPercentile,
    citationCount,
    lastInspectionDate,
    variant = "meta",
    regulatorAbbr,
  } = args;

  const reg = regulatorAbbr?.trim() || REGULATOR_ABBR[stateCode] || "state";

  // Clamp the displayed rank so we never print "top 0%" / "bottom 0%" — at the
  // tails (percentile === 100 or === 0) say "top 1%" / "bottom 1%" instead.
  let rankFrag: string | null = null;
  if (percentile != null) {
    if (percentile >= 50) {
      rankFrag = `Ranked in the ${peerRankPhrase(percentile).text} of ${peerSetPhrase(stateCode, stateName)}`;
    } else {
      // For bottom-half, prefer the worst sub-metric when the gap is ≥ 10 pts
      const worst = worstSubMetricFragment(
        percentile,
        severityPercentile,
        frequencyPercentile,
        repeatsPercentile,
      );
      if (worst) {
        rankFrag = `Ranked in the bottom ${Math.max(1, Math.round(worst.percentile))}% on ${worst.label} among ${stateName} peers`;
      } else {
        rankFrag = `Ranked in the ${peerRankPhrase(percentile).text} of ${peerSetPhrase(stateCode, stateName)}`;
      }
    }
  }

  const citeFrag =
    citationCount > 0
      ? `${citationCount} ${reg} citation${citationCount === 1 ? "" : "s"} on record`
      : `no ${reg} citations on record`;

  const inspMo = args.lastInspected ?? shortMonthYear(lastInspectionDate);
  const inspFrag = inspMo ? `last inspected ${inspMo}` : null;

  if (variant === "prose") {
    if (rankFrag) {
      const tail = [citeFrag, inspFrag].filter(Boolean).join("; ");
      const ranked = rankFrag.charAt(0).toLowerCase() + rankFrag.slice(1);
      return `${facilityName} is ${ranked} with ${tail}.`;
    }
    return `${facilityName} has ${citeFrag}${inspFrag ? `; ${inspFrag}` : ""}.`;
  }

  // Meta variant: lead with the value (percentile/grade) so the differentiator
  // lands in the visible snippet before Google truncates it.
  if (rankFrag) {
    const tail = [citeFrag, inspFrag].filter(Boolean).join(" · ");
    return `${rankFrag}${tail ? ` · ${tail}` : ""}.`;
  }
  // No grade — lead with citations and inspection date.
  return `${citeFrag}${inspFrag ? ` · ${inspFrag}` : ""}. Independent public-record review on StarlynnCare.`;
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
}): string | null {
  if (input.inspectionCount < 1 && !input.licenseNumber) return null;

  const license = input.licenseNumber ? ` License ${input.licenseNumber}.` : "";
  const beds = input.beds != null ? ` Licensed for ${input.beds} beds.` : "";
  const inspected = input.lastInspected ? ` Last inspected ${input.lastInspected}.` : "";

  let record: string;
  if (input.inspectionCount < 1) {
    record = `No ${input.regulatorAbbr} inspection is on file yet.`;
  } else if (input.citationCount === 0) {
    record = `${input.inspectionCount} ${input.regulatorAbbr} ${input.inspectionCount === 1 ? "inspection is" : "inspections are"} on file from the last 3 years, with no citations in that window.`;
  } else {
    record = `${input.inspectionCount} ${input.regulatorAbbr} ${input.inspectionCount === 1 ? "inspection" : "inspections"} and ${input.citationCount} ${input.citationCount === 1 ? "citation" : "citations"} are on file from the last 3 years.`;
  }

  const noun =
    input.facilityNoun ??
    (input.stateCode === "AZ" || input.stateName === "Arizona"
      ? input.azLicenseLevel != null && !azDirectedCareLicense(input.azLicenseLevel)
        ? "licensed home"
        : "Directed Care licensed home"
      : input.stateCode === "WA" || input.stateName === "Washington"
        ? "licensed home that may serve residents with dementia"
        : input.stateCode === "PA" || input.stateName === "Pennsylvania"
          ? "licensed personal care or assisted living home"
          : "licensed memory care home");

  const base = `${input.name} is a ${noun} in ${input.city}, ${input.stateName}.${license}${beds} ${record}${inspected} Read the dated inspection record on this page; StarlynnCare does not take referral fees.`;
  const words = wordCount(base);
  if (words < 40) {
    const padded = `${base} Compare it with nearby homes using the same ${input.regulatorAbbr} source.`;
    return wordCount(padded) <= 70 ? padded : base;
  }
  if (words > 60) {
    const shorter = `${input.name} in ${input.city}, ${input.stateName}.${license} ${record}${inspected} The inspection record is on this page.`;
    return shorter;
  }
  return base;
}
