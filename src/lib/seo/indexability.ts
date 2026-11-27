/**
 * What Google is asked to index.
 *
 * Every publishable facility profile is in the sitemap and is indexable.
 * A city hub lists that same publishable set. Homes of 6 beds or fewer sit
 * in the Small homes section (a Washington tier card stays in its own
 * section). The 2026-11 rule that kept Arizona homes of 10 beds or fewer
 * with no citations, and homes of 6 beds or fewer with no inspection, off
 * the lede is retired — those homes are why Mesa said one number and listed
 * another.
 *
 * `scripts/validate/search_console_coverage.py` mirrors these predicates.
 */

export const AZ_SMALL_BED_LIMIT = 10;

export function azSmallHomeWithoutCitations(
  stateCode: string,
  beds: number | null,
  deficiencyCount: number,
): boolean {
  return (
    stateCode === "AZ" &&
    beds != null &&
    beds <= AZ_SMALL_BED_LIMIT &&
    deficiencyCount === 0
  );
}

export function facilityMarkedNoindex(_input: {
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
  reviewCount: number;
  tourQuestionCount: number;
  photoCount: number;
}): boolean {
  // Publishable profiles are in the sitemap (613 WA AFHs with no inspection
  // row, 369 small Arizona homes with no citations). Do not noindex them.
  return false;
}

/**
 * City hub / A–Z listed set. Every publishable home on the page is listed,
 * including a home of 6 beds or fewer and an Arizona home of 10 beds or
 * fewer with no citations. The headline, the stats, and the A–Z index are
 * this set. A newly licensed home with no inspections yet stays listed.
 *
 * The arguments stay so callers can pass the same record they always did.
 * Listing no longer depends on bed count or whether a citation exists.
 */
export function facilityListedOnHub(input: {
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
}): boolean {
  // Bed count and citations no longer decide the list. The arguments stay
  // so every caller still passes the same record.
  void input;
  return true;
}

/**
 * A city hub page 404s when it has no home to list. State-hub links, the
 * homepage city count, and the hub sitemap use the same bar, so a city
 * below it is not counted and not linked.
 */
export const CITY_HUB_MIN_HOMES = 1;

export function cityHubPageExists(listedHomeCount: number): boolean {
  return listedHomeCount >= CITY_HUB_MIN_HOMES;
}

/** @deprecated Use facilityListedOnHub for city counts; sitemap includes every publishable profile. */
export function facilityListedInSitemap(input: {
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
}): boolean {
  return facilityListedOnHub(input);
}

/**
 * A hub is noindex only when it has homes and none of them are listed.
 * Empty hubs 404 instead. Arizona small homes are listed now, so a city
 * made only of those homes is a real hub.
 */
export function listingHubMarkedNoindex(
  facilities: Array<{
    stateCode: string;
    beds: number | null;
    deficiencyCount: number;
    inspectionCount?: number;
  }>,
): boolean {
  return (
    facilities.length > 0 &&
    facilities.every(
      (facility) =>
        !facilityListedOnHub({
          stateCode: facility.stateCode,
          beds: facility.beds,
          deficiencyCount: facility.deficiencyCount,
          inspectionCount: facility.inspectionCount ?? 0,
        }),
    )
  );
}
