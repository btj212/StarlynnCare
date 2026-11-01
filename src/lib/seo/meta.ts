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

const MAX_TITLE = 60;

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

/**
 * Name and place first. A comparative rank stays in the description and on
 * the page, not in the title, because facility-name searches need the city.
 * "Reviews" appears only when a published review exists.
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
}): string {
  const { name, stateName, city, citationCount, inspectionCount, reviewCount } = input;
  const abbr = STATE_ABBR[stateName] ?? stateName;
  const place = `${name}, ${city}, ${abbr}`;
  const inspections = inspectionCount ?? 0;
  const reviews = reviewCount ?? 0;
  const facts: string[] = [];
  if (inspections > 0) facts.push(countLabel(inspections, "inspection", "inspections"));
  if (citationCount != null && inspections > 0) {
    facts.push(countLabel(citationCount, "citation", "citations"));
  }
  if (reviews > 0) facts.push("reviews");

  const candidates = [
    facts.length ? `${place}: ${joinTitleFacts(facts)}` : place,
    facts.length > 1 ? `${place}: ${joinTitleFacts(facts.slice(0, -1))}` : place,
    place,
    `${name}, ${city}`,
    `${name}, ${abbr}`,
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
      ? `1 ${input.regulatorAbbr} citation on record`
      : `${input.citationCount} ${input.regulatorAbbr} citations on record`;
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
        ? `no ${f.agency} citations on record`
        : f.citationCount === 1
          ? `1 ${f.agency} citation on record`
          : `${f.citationCount} ${f.agency} citations on record`;
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
    const base = `Top ${topPct}% of ${f.stateName} memory care · ${citations}${inspPart}.`;
    const full = `${base} ${tail}`;
    return full.length >= MIN_DESC ? full : `${base} Licensed memory care in ${f.city}, ${f.stateName}. ${tail}`;
  }

  // Bottom-half or unrated — facts only, no ranking language.
  const base = `${f.name} in ${f.city}, ${f.stateName} · ${citations}${inspPart}.`;
  const cta = reviewCta;
  const core = base + cta;
  if (core.length >= MIN_DESC) return core;
  // Pad to minimum with a useful phrase about memory care.
  return `${base} Licensed memory care facility. ${ctaSuffix}`;
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
  /** Most recent non-complaint inspection date as ISO yyyy-mm-dd. */
  lastInspectionDate: string | null;
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
      const topPct = Math.max(1, 100 - percentile);
      rankFrag = `Ranked in the top ${topPct}% of ${stateName} memory care`;
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
        const bottomPct = Math.max(1, Math.round(percentile));
        rankFrag = `Ranked in the bottom ${bottomPct}% of ${stateName} memory care`;
      }
    }
  }

  const citeFrag =
    citationCount > 0
      ? `${citationCount} ${reg} citation${citationCount === 1 ? "" : "s"} on record`
      : `no ${reg} citations on record`;

  const inspMo = shortMonthYear(lastInspectionDate);
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
