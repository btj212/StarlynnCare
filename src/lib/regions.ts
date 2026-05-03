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

// Contra Costa County (major incorporated places; keep slugs aligned with ccld_rcfe_ingest.py slugify())
const CONTRA_COSTA_COUNTY_CITIES = [
  "alamo",
  "antioch",
  "bay-point",
  "brentwood",
  "clayton",
  "concord",
  "danville",
  "el-cerrito",
  "el-sobrante",
  "hercules",
  "lafayette",
  "martinez",
  "moraga",
  "oakley",
  "orinda",
  "pinole",
  "pittsburg",
  "pleasant-hill",
  "richmond",
  "rodeo",
  "san-martin",
  "san-pablo",
  "san-ramon",
  "walnut-creek",
] as const;

// San Mateo County
const SAN_MATEO_COUNTY_CITIES = [
  "atherton",
  "belmont",
  "brisbane",
  "burlingame",
  "colma",
  "daly-city",
  "east-palo-alto",
  "emerald-hills",
  "foster-city",
  "half-moon-bay",
  "hillsborough",
  "menlo-park",
  "millbrae",
  "montara",
  "pacifica",
  "portola-valley",
  "redwood-city",
  "s-san-francisco",
  "san-bruno",
  "san-carlos",
  "san-mateo",
  "south-san-francisco",
  "woodside",
] as const;

// Santa Clara County
const SANTA_CLARA_COUNTY_CITIES = [
  "campbell",
  "cupertino",
  "gilroy",
  "los-altos",
  "los-altos-hills",
  "los-gatos",
  "milpitas",
  "monte-sereno",
  "morgan-hill",
  "mountain-view",
  "palo-alto",
  "san-jose",
  "santa-clara",
  "saratoga",
  "sunnyvale",
] as const;

// Los Angeles County — 88 incorporated cities (Wikipedia "List of cities in Los Angeles County")
const LOS_ANGELES_COUNTY_CITIES = [
  "agoura-hills",
  "alhambra",
  "arcadia",
  "artesia",
  "avalon",
  "azusa",
  "baldwin-park",
  "bell",
  "bell-gardens",
  "bellflower",
  "beverly-hills",
  "bradbury",
  "burbank",
  "calabasas",
  "carson",
  "cerritos",
  "claremont",
  "commerce",
  "compton",
  "covina",
  "cudahy",
  "culver-city",
  "diamond-bar",
  "downey",
  "duarte",
  "el-monte",
  "el-segundo",
  "gardena",
  "glendale",
  "glendora",
  "hawaiian-gardens",
  "hawthorne",
  "hermosa-beach",
  "hidden-hills",
  "huntington-park",
  "industry",
  "inglewood",
  "irwindale",
  "la-canada-flintridge",
  "la-habra-heights",
  "la-mirada",
  "la-puente",
  "la-verne",
  "lakewood",
  "lancaster",
  "lawndale",
  "lomita",
  "long-beach",
  "los-angeles",
  "lynwood",
  "malibu",
  "manhattan-beach",
  "maywood",
  "monrovia",
  "montebello",
  "monterey-park",
  "norwalk",
  "palmdale",
  "palos-verdes-estates",
  "paramount",
  "pasadena",
  "pico-rivera",
  "pomona",
  "rancho-palos-verdes",
  "redondo-beach",
  "rolling-hills",
  "rolling-hills-estates",
  "rosemead",
  "san-dimas",
  "san-fernando",
  "san-gabriel",
  "san-marino",
  "santa-clarita",
  "santa-fe-springs",
  "santa-monica",
  "sierra-madre",
  "signal-hill",
  "south-el-monte",
  "south-gate",
  "south-pasadena",
  "temple-city",
  "torrance",
  "vernon",
  "walnut",
  "west-covina",
  "west-hollywood",
  "westlake-village",
  "whittier",
] as const;

// San Diego County — 18 incorporated cities
const SAN_DIEGO_COUNTY_CITIES = [
  "carlsbad",
  "chula-vista",
  "coronado",
  "del-mar",
  "el-cajon",
  "encinitas",
  "escondido",
  "imperial-beach",
  "la-mesa",
  "lemon-grove",
  "national-city",
  "oceanside",
  "poway",
  "san-diego",
  "san-marcos",
  "santee",
  "solana-beach",
  "vista",
] as const;

// Orange County — 34 incorporated cities
const ORANGE_COUNTY_CITIES = [
  "aliso-viejo",
  "anaheim",
  "brea",
  "buena-park",
  "costa-mesa",
  "cypress",
  "dana-point",
  "fountain-valley",
  "fullerton",
  "garden-grove",
  "huntington-beach",
  "irvine",
  "la-habra",
  "la-palma",
  "laguna-beach",
  "laguna-hills",
  "laguna-niguel",
  "laguna-woods",
  "lake-forest",
  "los-alamitos",
  "mission-viejo",
  "newport-beach",
  "orange",
  "placentia",
  "rancho-santa-margarita",
  "san-clemente",
  "san-juan-capistrano",
  "santa-ana",
  "seal-beach",
  "stanton",
  "tustin",
  "villa-park",
  "westminster",
  "yorba-linda",
] as const;

// Sacramento County — 7 incorporated cities
const SACRAMENTO_COUNTY_CITIES = [
  "citrus-heights",
  "elk-grove",
  "folsom",
  "galt",
  "isleton",
  "rancho-cordova",
  "sacramento",
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

  {
    slug: "contra-costa-county",
    name: "Contra Costa County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: CONTRA_COSTA_COUNTY_CITIES,
  },
  ...CONTRA_COSTA_COUNTY_CITIES.map<Region>((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
    kind: "city" as const,
    state: CALIFORNIA,
    citySlugs: [slug],
  })),

  {
    slug: "san-mateo-county",
    name: "San Mateo County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SAN_MATEO_COUNTY_CITIES,
  },
  ...SAN_MATEO_COUNTY_CITIES.map<Region>((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
    kind: "city" as const,
    state: CALIFORNIA,
    citySlugs: [slug],
  })),

  {
    slug: "santa-clara-county",
    name: "Santa Clara County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SANTA_CLARA_COUNTY_CITIES,
  },
  ...SANTA_CLARA_COUNTY_CITIES.map<Region>((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
    kind: "city" as const,
    state: CALIFORNIA,
    citySlugs: [slug],
  })),

  {
    slug: "los-angeles-county",
    name: "Los Angeles County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: LOS_ANGELES_COUNTY_CITIES,
  },
  ...LOS_ANGELES_COUNTY_CITIES.map<Region>((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
    kind: "city" as const,
    state: CALIFORNIA,
    citySlugs: [slug],
  })),

  {
    slug: "san-diego-county",
    name: "San Diego County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SAN_DIEGO_COUNTY_CITIES,
  },
  ...SAN_DIEGO_COUNTY_CITIES.map<Region>((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
    kind: "city" as const,
    state: CALIFORNIA,
    citySlugs: [slug],
  })),

  {
    slug: "orange-county",
    name: "Orange County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: ORANGE_COUNTY_CITIES,
  },
  ...ORANGE_COUNTY_CITIES.map<Region>((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
    kind: "city" as const,
    state: CALIFORNIA,
    citySlugs: [slug],
  })),

  {
    slug: "sacramento-county",
    name: "Sacramento County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SACRAMENTO_COUNTY_CITIES,
  },
  ...SACRAMENTO_COUNTY_CITIES.map<Region>((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
    kind: "city" as const,
    state: CALIFORNIA,
    citySlugs: [slug],
  })),

  /** City & county of San Francisco — not nested under another county list */
  {
    slug: "san-francisco",
    name: "San Francisco",
    kind: "city",
    state: CALIFORNIA,
    citySlugs: ["san-francisco"],
  },
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
