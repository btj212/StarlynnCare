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
};

const MAX_TITLE = 60;
const hasMemoryCare = (s: string) => /\bmemory\s+care\b/i.test(s);

/**
 * Build a ≤60-character facility page title.
 *
 * Top-half facilities (composite_percentile ≥ 50) get a comparative rank claim:
 *   "Autumn Glow · Top 14% of California Memory Care"
 *
 * Bottom-half and unrated facilities get a geographic anchor with no quality
 * claim. The "Memory Care" phrase is skipped when it already appears in the
 * facility name to avoid duplication:
 *   "Sunrise Memory Care · Pasadena, CA"
 *   "Oakwood Gardens · Memory Care in Pasadena, CA"
 *
 * YMYL rule: never invent a percentile rank. Null → no claim.
 */
export function buildFacilityTitle(input: {
  name: string;
  stateName: string;
  /** Composite percentile 0–100, higher = better. Null when peer set too thin. */
  percentile: number | null;
  city: string;
}): string {
  const { name, stateName, percentile, city } = input;
  const abbr = STATE_ABBR[stateName] ?? stateName;

  // Top-half — comparative ranking claim allowed.
  if (percentile != null && percentile >= 50) {
    const topPct = Math.max(1, 100 - percentile);
    const candidates = [
      `${name} · Top ${topPct}% of ${stateName} Memory Care`,
      `${name} · Top ${topPct}% in ${stateName}`,
      `${name} · Top ${topPct}% in ${abbr}`,
      `${name} · Top ${topPct}%`,
      name,
    ];
    return candidates.find((c) => c.length <= MAX_TITLE) ?? candidates.at(-1)!;
  }

  // Bottom-half or unrated — geographic anchor, zero quality claim.
  // Skip "Memory Care" phrase when already present in the facility name.
  const geoVariants: string[] = hasMemoryCare(name)
    ? [
        `${name} · ${city}, ${abbr}`,
        `${name} · ${city}`,
        `${name} · ${abbr}`,
        name,
      ]
    : [
        `${name} · Memory Care in ${city}, ${abbr}`,
        `${name} · Memory Care in ${city}`,
        `${name} · ${city}, ${abbr}`,
        `${name} · ${city}`,
        name,
      ];
  return geoVariants.find((c) => c.length <= MAX_TITLE) ?? geoVariants.at(-1)!;
}

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
  /** Regulator abbreviation: "CDSS" / "DSHS" / "OR DHS" / "MDH" */
  agency: string;
  /** Pre-formatted month+year string, e.g. "Apr 2026" */
  lastInspected: string | null;
}): string {
  const citations =
    f.citationCount === 0
      ? `clean inspection record`
      : f.citationCount === 1
        ? `1 ${f.agency} citation on record`
        : `${f.citationCount} ${f.agency} citations on record`;
  const inspPart = f.lastInspected ? ` · last inspected ${f.lastInspected}` : "";

  // Top-half — comparative claim.
  if (f.percentile != null && f.percentile >= 50) {
    const topPct = Math.max(1, 100 - f.percentile);
    // Very elite (top 10%): lean into the transparency angle.
    const tail =
      topPct <= 10
        ? `See the full inspection record on StarlynnCare.`
        : `Free public-record review on StarlynnCare.`;
    return `Top ${topPct}% of ${f.stateName} memory care · ${citations}${inspPart}. ${tail}`;
  }

  // Bottom-half or unrated — facts only, no ranking language.
  return `${f.name} in ${f.city}, ${f.stateName} · ${citations}${inspPart}. Free public-record review on StarlynnCare.`;
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
  /** Total deficiencies on record. */
  citationCount: number;
  /** Most recent non-complaint inspection date as ISO yyyy-mm-dd. */
  lastInspectionDate: string | null;
  /** "meta" emits the "What X's website won't show you:" prefix. "prose" emits a
   *  natural-prose sentence suitable for in-page rendering. Default "meta". */
  variant?: FacilitySnippetVariant;
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
export function buildFacilitySnippet(args: FacilitySnippetArgs): string {
  const {
    facilityName,
    stateName,
    stateCode,
    grade,
    percentile,
    citationCount,
    lastInspectionDate,
    variant = "meta",
  } = args;

  const reg = REGULATOR_ABBR[stateCode] ?? "state";

  // Clamp the displayed rank so we never print "top 0%" / "bottom 0%" — at the
  // tails (percentile === 100 or === 0) say "top 1%" / "bottom 1%" instead.
  let rankFrag: string | null = null;
  if (percentile != null) {
    if (percentile >= 50) {
      const topPct = Math.max(1, 100 - percentile);
      rankFrag = `Ranked in the top ${topPct}% of ${stateName} memory care`;
    } else {
      const bottomPct = Math.max(1, percentile);
      rankFrag = `Ranked in the bottom ${bottomPct}% of ${stateName} memory care`;
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
      return `${facilityName} is ${rankFrag} with ${tail}.`;
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
  return `${citeFrag}${inspFrag ? ` · ${inspFrag}` : ""}. Free public-record review on StarlynnCare.`;
}
