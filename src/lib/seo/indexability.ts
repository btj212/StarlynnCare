/**
 * Listing and index predicates. The decisions live in the quality gate.
 * This file only re-exports them so existing imports keep working.
 *
 * While GATE_ENFORCED is false, a publishable home is listed and a city hub
 * exists when at least one home is listed. Homes of 6 beds or fewer sit in
 * the Small homes section. The 2026-11 rule that kept Arizona homes of 10
 * beds or fewer with no citations, and homes of 6 beds or fewer with no
 * inspection, off the lede is retired.
 *
 * `scripts/validate/search_console_coverage.py` mirrors these predicates.
 */

export {
  AZ_SMALL_BED_LIMIT,
  CITY_HUB_MIN_HOMES,
  azSmallHomeWithoutCitations,
  cityHubPageExists,
  facilityListedInSitemap,
  facilityListedOnHub,
  facilityMarkedNoindex,
  listingHubMarkedNoindex,
} from "@/lib/quality/gate";
