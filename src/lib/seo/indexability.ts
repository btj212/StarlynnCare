/**
 * What Google is asked to index.
 *
 * Every publishable facility profile is in the sitemap and is indexable.
 * City / A–Z hubs still use `facilityListedOnHub` so a thin Arizona small
 * home or a Washington AFH with no inspection is not counted in the city
 * lede — that listed set is separate from the crawl list.
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
 * City hub / A–Z listed set. Requires an inspection, then excludes Arizona
 * homes of 10 beds or fewer with no citations. Not the sitemap rule.
 */
export function facilityListedOnHub(input: {
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
}): boolean {
  if (input.inspectionCount < 1) return false;
  return !azSmallHomeWithoutCitations(
    input.stateCode,
    input.beds,
    input.deficiencyCount,
  );
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
 * A city or county hub that only lists excluded Arizona homes has nothing
 * unique left to rank. Empty hubs 404 instead, so an empty list is not noindex.
 */
export function listingHubMarkedNoindex(
  facilities: Array<{ stateCode: string; beds: number | null; deficiencyCount: number }>,
): boolean {
  return (
    facilities.length > 0 &&
    facilities.every((facility) =>
      azSmallHomeWithoutCitations(
        facility.stateCode,
        facility.beds,
        facility.deficiencyCount,
      ),
    )
  );
}
