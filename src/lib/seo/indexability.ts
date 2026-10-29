/**
 * What Google is asked to index.
 *
 * The facility page, the facility sitemap, and the listing-hub sitemap must
 * use these predicates. `scripts/validate/search_console_coverage.py` mirrors
 * them. A noindex page must not appear in the sitemap.
 *
 * A home with no inspection can still be indexed when it has a review, a tour
 * question, or a photo. Those pages stay out of the sitemap on purpose: the
 * October 27 coverage export already had 3,684 crawled-but-not-indexed URLs,
 * and the sitemap is the list of pages we ask Google to crawl.
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

export function facilityMarkedNoindex(input: {
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
  reviewCount: number;
  tourQuestionCount: number;
  photoCount: number;
}): boolean {
  const noRecord =
    input.inspectionCount === 0 &&
    input.reviewCount === 0 &&
    input.tourQuestionCount === 0 &&
    input.photoCount === 0;
  return (
    azSmallHomeWithoutCitations(input.stateCode, input.beds, input.deficiencyCount) ||
    noRecord
  );
}

/** Sitemap request list. Requires an inspection, then applies the same Arizona exclusion. */
export function facilityListedInSitemap(input: {
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
