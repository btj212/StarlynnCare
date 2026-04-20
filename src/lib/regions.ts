/**
 * Region (county) definitions for the beachhead launch.
 *
 * A "region" is a URL slug that sits between state and facility in the
 * route tree: /california/[region]/[facility]. It can be either:
 *   - a county (e.g. "alameda-county") — aggregates many city_slug values
 *   - a city   (e.g. "oakland")         — matches a single city_slug
 *
 * Facilities are always written to the DB with their actual city_slug
 * ("oakland", not "alameda-county"). The county pages use the cities
 * list below to build their city_slug IN (...) filter.
 */

import { stateFromSlug, type StateInfo } from "./states";

export type RegionKind = "county" | "city";

export interface Region {
  slug: string;                 // URL slug: "alameda-county" or "oakland"
  name: string;                 // Display name: "Alameda County" or "Oakland"
  kind: RegionKind;
  state: StateInfo;
  /**
   * city_slug values in the `facilities` table that belong to this region.
   * For a county, this is the list of member cities. For a city, this is
   * a single-element list matching the city_slug itself.
   */
  citySlugs: ReadonlyArray<string>;
}

const CALIFORNIA = stateFromSlug("california")!;

/**
 * Alameda County cities — incorporated places only. If a CDSS record has a
 * city outside this list but is located in Alameda County (per address),
 * we normalize the city_slug at ingest time to one of these values.
 */
const ALAMEDA_COUNTY_CITIES = [
  "alameda",
  "albany",
  "berkeley",
  "castro-valley",
  "dublin",
  "emeryville",
  "fremont",
  "hayward",
  "livermore",
  "newark",
  "oakland",
  "piedmont",
  "pleasanton",
  "san-leandro",
  "san-lorenzo",
  "sunol",
  "union-city",
] as const;

export const REGIONS: ReadonlyArray<Region> = [
  {
    slug: "alameda-county",
    name: "Alameda County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: ALAMEDA_COUNTY_CITIES,
  },
  ...ALAMEDA_COUNTY_CITIES.map<Region>((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
    kind: "city" as const,
    state: CALIFORNIA,
    citySlugs: [slug],
  })),
];

export function regionFromSlug(
  stateSlug: string,
  regionSlug: string,
): Region | null {
  const state = stateFromSlug(stateSlug);
  if (!state) return null;
  const match = REGIONS.find(
    (r) => r.state.code === state.code && r.slug === regionSlug.toLowerCase(),
  );
  return match ?? null;
}

export function regionsForState(stateCode: string): ReadonlyArray<Region> {
  return REGIONS.filter((r) => r.state.code === stateCode.toUpperCase());
}
