/**
 * Shared URL path helpers.
 *
 * Use these to build internal hrefs so URL structure stays consistent
 * and can't silently drop a segment.
 */

/** Canonical 3-segment facility profile path: /{state}/{city}/{slug} */
export function facilityProfilePath(
  stateSlug: string,
  citySlug: string,
  facilitySlug: string,
): string {
  return `/${stateSlug}/${citySlug}/${facilitySlug}`;
}
