import { regionsForState, type Region } from "@/lib/regions";

/** Returns the CA county region whose seed city list contains this city_slug, if any. */
export function countyRegionContainingCitySlug(
  stateCode: string,
  citySlug: string,
): Region | null {
  const slug = citySlug.toLowerCase();
  const counties = regionsForState(stateCode).filter((r) => r.kind === "county");
  return counties.find((c) => c.citySlugs.some((s) => s.toLowerCase() === slug)) ?? null;
}
