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
const TEXAS = stateFromSlug("texas")!;
const OREGON = stateFromSlug("oregon")!;
const MINNESOTA = stateFromSlug("minnesota")!;
const WASHINGTON = stateFromSlug("washington")!;

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
  "altadena",
  "arcadia",
  "arleta",
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
  "canoga-park",
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
  "granada-hills",
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
  "montrose",
  "northridge",
  "norwalk",
  "pacific-palisades",
  "palmdale",
  "palos-verdes-estates",
  "paramount",
  "pasadena",
  "pico-rivera",
  "playa-vista",
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
  "sherman-oaks",
  "sierra-madre",
  "signal-hill",
  "south-el-monte",
  "south-gate",
  "south-pasadena",
  "studio-city",
  "tarzana",
  "temple-city",
  "torrance",
  "valencia",
  "van-nuys",
  "vernon",
  "walnut",
  "west-covina",
  "west-hills",
  "west-hollywood",
  "westlake-village",
  "whittier",
  "woodland-hills",
] as const;

// San Diego County — 18 incorporated cities
const SAN_DIEGO_COUNTY_CITIES = [
  "carlsbad",
  "cardiff-by-the-sea",
  "chula-vista",
  "coronado",
  "del-mar",
  "el-cajon",
  "encinitas",
  "escondido",
  "fallbrook",
  "imperial-beach",
  "la-jolla",
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

// Sacramento County — incorporated cities + common CDSS mail-city slugs (CDPs / neighborhoods)
const SACRAMENTO_COUNTY_CITIES = [
  "antelope",
  "carmichael",
  "citrus-heights",
  "elk-grove",
  "fair-oaks",
  "folsom",
  "galt",
  "gold-river",
  "isleton",
  "orangevale",
  "rancho-cordova",
  "sacramento",
  "sun-city",
] as const;

/** Fresno County — seed list; expand as Supabase reveals more publishable cities */
const FRESNO_COUNTY_CITIES = ["fresno", "clovis"] as const;

/** Monterey County — seed list */
const MONTEREY_COUNTY_CITIES = [
  "salinas",
  "monterey",
  "marina",
  "pacific-grove",
  "seaside",
] as const;

/** Ventura County — seed list */
const VENTURA_COUNTY_CITIES = [
  "thousand-oaks",
  "simi-valley",
  "oxnard",
  "camarillo",
  "ventura",
] as const;

/** Kern County — seed list */
const KERN_COUNTY_CITIES = ["bakersfield", "tehachapi", "delano"] as const;

/** Stanislaus County — seed list */
const STANISLAUS_COUNTY_CITIES = [
  "modesto",
  "turlock",
  "ceres",
  "oakdale",
] as const;

/** Tulare County — seed list */
const TULARE_COUNTY_CITIES = ["visalia", "tulare", "porterville"] as const;

/** Solano County — seed list */
const SOLANO_COUNTY_CITIES = [
  "vallejo",
  "fairfield",
  "vacaville",
  "benicia",
] as const;

/** Sonoma County — seed list */
const SONOMA_COUNTY_CITIES = [
  "santa-rosa",
  "petaluma",
  "sebastopol",
  "windsor",
  "healdsburg",
] as const;

/** San Bernardino County — seed list */
const SAN_BERNARDINO_COUNTY_CITIES = [
  "rancho-cucamonga",
  "san-bernardino",
  "redlands",
  "upland",
  "ontario",
  "chino",
  "chino-hills",
  "fontana",
] as const;

/** San Joaquin County — seed list */
const SAN_JOAQUIN_COUNTY_CITIES = [
  "stockton",
  "lodi",
  "tracy",
  "manteca",
] as const;

/** Phase 4 expansion — coastal / inland counties with substantial RCFE supply */
const RIVERSIDE_COUNTY_CITIES = [
  "riverside",
  "corona",
  "temecula",
  "murrieta",
  "moreno-valley",
  "menifee",
  "hemet",
  "indio",
  "cathedral-city",
  "palm-springs",
  "palm-desert",
  "la-quinta",
  "rancho-mirage",
  "desert-hot-springs",
  "beaumont",
  "banning",
  "lake-elsinore",
  "perris",
  "eastvale",
  "jurupa-valley",
  "norco",
  "wildomar",
  "canyon-lake",
  "calimesa",
] as const;

const PLACER_COUNTY_CITIES = [
  "roseville",
  "rocklin",
  "lincoln",
  "auburn",
  "granite-bay",
  "loomis",
  "north-highlands",
  "colfax",
] as const;

const EL_DORADO_COUNTY_CITIES = [
  "placerville",
  "south-lake-tahoe",
  "el-dorado-hills",
  "cameron-park",
  "shingle-springs",
] as const;

const YOLO_COUNTY_CITIES = ["davis", "woodland", "west-sacramento", "winters"] as const;

const MARIN_COUNTY_CITIES = [
  "san-rafael",
  "novato",
  "mill-valley",
  "san-anselmo",
  "larkspur",
  "corte-madera",
  "fairfax",
  "sausalito",
  "tiburon",
] as const;

const SANTA_CRUZ_COUNTY_CITIES = [
  "santa-cruz",
  "watsonville",
  "scotts-valley",
  "capitola",
  "aptos",
  "soquel",
] as const;

const SANTA_BARBARA_COUNTY_CITIES = [
  "santa-barbara",
  "goleta",
  "lompoc",
  "santa-maria",
  "carpinteria",
  "buellton",
  "guadalupe",
  "solvang",
] as const;

const SAN_LUIS_OBISPO_COUNTY_CITIES = [
  "san-luis-obispo",
  "paso-robles",
  "atascadero",
  "arroyo-grande",
  "morro-bay",
  "nipomo",
  "pismo-beach",
  "grover-beach",
  "oceano",
] as const;

const NAPA_COUNTY_CITIES = [
  "napa",
  "american-canyon",
  "st-helena",
  "calistoga",
  "yountville",
] as const;

const MENDOCINO_COUNTY_CITIES = ["ukiah", "fort-bragg", "willits"] as const;

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

  {
    slug: "fresno-county",
    name: "Fresno County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: FRESNO_COUNTY_CITIES,
  },
  ...FRESNO_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "monterey-county",
    name: "Monterey County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: MONTEREY_COUNTY_CITIES,
  },
  ...MONTEREY_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "ventura-county",
    name: "Ventura County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: VENTURA_COUNTY_CITIES,
  },
  ...VENTURA_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "kern-county",
    name: "Kern County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: KERN_COUNTY_CITIES,
  },
  ...KERN_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "stanislaus-county",
    name: "Stanislaus County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: STANISLAUS_COUNTY_CITIES,
  },
  ...STANISLAUS_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "tulare-county",
    name: "Tulare County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: TULARE_COUNTY_CITIES,
  },
  ...TULARE_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "solano-county",
    name: "Solano County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SOLANO_COUNTY_CITIES,
  },
  ...SOLANO_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "sonoma-county",
    name: "Sonoma County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SONOMA_COUNTY_CITIES,
  },
  ...SONOMA_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "san-bernardino-county",
    name: "San Bernardino County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SAN_BERNARDINO_COUNTY_CITIES,
  },
  ...SAN_BERNARDINO_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "san-joaquin-county",
    name: "San Joaquin County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SAN_JOAQUIN_COUNTY_CITIES,
  },
  ...SAN_JOAQUIN_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "riverside-county",
    name: "Riverside County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: RIVERSIDE_COUNTY_CITIES,
  },
  ...RIVERSIDE_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "placer-county",
    name: "Placer County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: PLACER_COUNTY_CITIES,
  },
  ...PLACER_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "el-dorado-county",
    name: "El Dorado County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: EL_DORADO_COUNTY_CITIES,
  },
  ...EL_DORADO_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "yolo-county",
    name: "Yolo County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: YOLO_COUNTY_CITIES,
  },
  ...YOLO_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "marin-county",
    name: "Marin County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: MARIN_COUNTY_CITIES,
  },
  ...MARIN_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "santa-cruz-county",
    name: "Santa Cruz County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SANTA_CRUZ_COUNTY_CITIES,
  },
  ...SANTA_CRUZ_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "santa-barbara-county",
    name: "Santa Barbara County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SANTA_BARBARA_COUNTY_CITIES,
  },
  ...SANTA_BARBARA_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "san-luis-obispo-county",
    name: "San Luis Obispo County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: SAN_LUIS_OBISPO_COUNTY_CITIES,
  },
  ...SAN_LUIS_OBISPO_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "napa-county",
    name: "Napa County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: NAPA_COUNTY_CITIES,
  },
  ...NAPA_COUNTY_CITIES.map<Region>((slug) => ({
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
    slug: "mendocino-county",
    name: "Mendocino County",
    kind: "county",
    state: CALIFORNIA,
    citySlugs: MENDOCINO_COUNTY_CITIES,
  },
  ...MENDOCINO_COUNTY_CITIES.map<Region>((slug) => ({
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

  // ── Texas (HHSC ALF directory ingest — hubs 404 until publishable TX rows exist)
  {
    slug: "harris-county",
    name: "Harris County",
    kind: "county",
    state: TEXAS,
    citySlugs: [
      "atascocita",
      "baytown",
      "bellaire",
      "cypress",
      "deer-park",
      "el-lago",
      "friendswood",
      "highlands",
      "houston",
      "huffman",
      "humble",
      "jersey-village",
      "katy",
      "kingwood",
      "la-porte",
      "missouri-city",
      "pasadena-tx",
      "pearland",
      "spring",
      "sugar-land",
      "tomball",
      "webster",
    ],
  },
  {
    slug: "fort-bend-county",
    name: "Fort Bend County",
    kind: "county",
    state: TEXAS,
    citySlugs: [
      "arcola",
      "fresno",
      "fulshear",
      "katy",
      "meadows-place",
      "needville",
      "richmond-tx",
      "rosenberg",
      "sugar-land",
    ],
  },
  {
    slug: "montgomery-county",
    name: "Montgomery County",
    kind: "county",
    state: TEXAS,
    citySlugs: [
      "conroe",
      "magnolia",
      "montgomery",
      "new-caney",
      "porter",
      "shenandoah",
      "spring",
      "the-woodlands",
      "willis",
    ],
  },
  {
    slug: "brazoria-county",
    name: "Brazoria County",
    kind: "county",
    state: TEXAS,
    citySlugs: ["alvin", "angleton", "lake-jackson", "manvel", "pearland", "rosharon", "sweeny"],
  },
  {
    slug: "galveston-county",
    name: "Galveston County",
    kind: "county",
    state: TEXAS,
    citySlugs: [
      "dickinson",
      "friendswood",
      "galveston",
      "hitchcock",
      "la-marque",
      "league-city",
      "santa-fe",
      "texas-city",
    ],
  },
  {
    slug: "dallas-county",
    name: "Dallas County",
    kind: "county",
    state: TEXAS,
    citySlugs: [
      "carrollton",
      "cedar-hill",
      "coppell",
      "dallas",
      "desoto",
      "duncanville",
      "farmers-branch",
      "garland",
      "irving",
      "lancaster",
      "mesquite",
      "richardson",
      "rowlett",
      "sachse",
      "sunnyvale",
    ],
  },
  {
    slug: "collin-county",
    name: "Collin County",
    kind: "county",
    state: TEXAS,
    citySlugs: ["allen", "anna", "frisco", "mckinney", "murphy", "plano", "princeton", "prosper", "sachse", "wylie"],
  },
  {
    slug: "tarrant-county",
    name: "Tarrant County",
    kind: "county",
    state: TEXAS,
    citySlugs: [
      "arlington-tx",
      "azle",
      "bedford",
      "benbrook",
      "burleson",
      "colleyville",
      "crowley",
      "euless",
      "forest-hill",
      "fort-worth",
      "grand-prairie",
      "grapevine",
      "haltom-city",
      "hurst",
      "keller",
      "mansfield",
      "north-richland-hills",
      "richland",
      "richland-hills",
      "saginaw",
      "southlake",
      "watauga",
      "westworth-village",
    ],
  },
  {
    slug: "denton-county",
    name: "Denton County",
    kind: "county",
    state: TEXAS,
    citySlugs: [
      "argyle",
      "corinth",
      "denton",
      "double-oak",
      "flower-mound",
      "highland-village",
      "keller",
      "lewisville",
      "roanoke",
      "sanger",
      "trophy-club",
    ],
  },
  {
    slug: "bexar-county",
    name: "Bexar County",
    kind: "county",
    state: TEXAS,
    citySlugs: [
      "castle-hills",
      "converse",
      "helotes",
      "hollywood-park",
      "leon-valley",
      "live-oak",
      "lytle",
      "san-antonio",
      "shavano-park",
      "atascosa",
    ],
  },
  {
    slug: "travis-county",
    name: "Travis County",
    kind: "county",
    state: TEXAS,
    citySlugs: [
      "austin",
      "bee-cave",
      "buda",
      "cedar-park",
      "georgetown",
      "granger",
      "kyle",
      "lakeway",
      "leander",
      "manchaca",
      "manor",
      "pflugerville",
      "round-rock",
      "san-leanna",
      "san-marcos",
      "taylor",
      "west-lake-hills",
      "wimberley",
    ],
  },
  // --- Oregon (Portland metro footprint for Phase 1 ingest) ---
  {
    slug: "multnomah-county",
    name: "Multnomah County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "portland",
      "gresham",
      "troutdale",
      "fairview",
      "wood-village",
      "maywood-park",
    ],
  },
  {
    slug: "washington-county-or",
    name: "Washington County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "beaverton",
      "hillsboro",
      "tigard",
      "tualatin",
      "forest-grove",
      "cornelius",
      "sherwood",
      "king-city",
      "north-plains",
      "banks",
      "gaston",
    ],
  },
  {
    slug: "clackamas-county",
    name: "Clackamas County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "clackamas",
      "happy-valley",
      "lake-oswego",
      "milwaukie",
      "oregon-city",
      "west-linn",
      "wilsonville",
      "canby",
      "molalla",
      "sandy",
      "estacada",
      "damascus",
      "gladstone",
    ],
  },
  // Oregon — statewide county hubs
  {
    slug: "marion-county",
    name: "Marion County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "salem",
      "keizer",
      "silverton",
      "stayton",
      "woodburn",
      "mount-angel",
      "aumsville",
      "turner",
      "donald",
      "scotts-mills",
    ],
  },
  {
    slug: "lane-county",
    name: "Lane County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "eugene",
      "springfield",
      "florence",
      "junction-city",
      "cottage-grove",
      "creswell",
      "coburg",
      "veneta",
      "lowell",
    ],
  },
  {
    slug: "jackson-county",
    name: "Jackson County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "medford",
      "ashland",
      "jacksonville",
      "central-point",
      "eagle-point",
      "phoenix",
      "talent",
      "white-city",
      "shady-cove",
    ],
  },
  {
    slug: "josephine-county",
    name: "Josephine County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "grants-pass",
      "cave-junction",
      "kerby",
    ],
  },
  {
    slug: "deschutes-county",
    name: "Deschutes County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "bend",
      "redmond",
      "sisters",
      "sunriver",
      "la-pine",
    ],
  },
  {
    slug: "yamhill-county",
    name: "Yamhill County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "mcminnville",
      "newberg",
      "dundee",
      "dayton",
      "sheridan",
      "amity",
      "lafayette",
    ],
  },
  {
    slug: "linn-county",
    name: "Linn County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "albany",
      "corvallis",
      "sweet-home",
      "lebanon",
      "tangent",
      "millersburg",
    ],
  },
  {
    slug: "douglas-county-or",
    name: "Douglas County",
    kind: "county",
    state: OREGON,
    citySlugs: [
      "roseburg",
      "sutherlin",
      "myrtle-creek",
      "winston",
      "canyonville",
      "glendale",
      "drain",
      "yoncalla",
    ],
  },
  // --- Washington — additional county hubs ---
  {
    slug: "king-county",
    name: "King County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "seattle",
      "bellevue",
      "kent",
      "renton",
      "kirkland",
      "redmond",
      "shoreline",
      "burien",
      "sammamish",
      "auburn",
      "federal-way",
      "issaquah",
      "maple-valley",
      "mercer-island",
      "north-bend",
      "covington",
      "des-moines",
      "normandy-park",
      "seatac",
      "tukwila",
      "woodinville",
      "bothell",
      "kenmore",
    ],
  },
  {
    slug: "snohomish-county",
    name: "Snohomish County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "everett",
      "lynnwood",
      "edmonds",
      "marysville",
      "lake-stevens",
      "snohomish",
      "mountlake-terrace",
      "mukilteo",
      "mill-creek",
      "bothell",
    ],
  },
  {
    slug: "pierce-county",
    name: "Pierce County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "tacoma",
      "lakewood",
      "puyallup",
      "sumner",
      "bonney-lake",
      "university-place",
      "spanaway",
      "gig-harbor",
      "federal-way",
    ],
  },
  // Washington — eastern WA and additional hubs
  {
    slug: "spokane-county",
    name: "Spokane County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "spokane",
      "spokane-valley",
      "cheney",
      "medical-lake",
      "millwood",
      "airway-heights",
    ],
  },
  {
    slug: "benton-county",
    name: "Benton County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "kennewick",
      "richland",
      "west-richland",
      "benton-city",
      "prosser",
    ],
  },
  {
    slug: "franklin-county",
    name: "Franklin County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "pasco",
      "connell",
    ],
  },
  {
    slug: "kitsap-county",
    name: "Kitsap County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "bremerton",
      "bainbridge-island",
      "poulsbo",
      "port-orchard",
      "silverdale",
      "kingston",
    ],
  },
  {
    slug: "thurston-county",
    name: "Thurston County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "olympia",
      "lacey",
      "tumwater",
      "yelm",
      "tenino",
      "rainier",
    ],
  },
  {
    slug: "yakima-county",
    name: "Yakima County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "yakima",
      "selah",
      "union-gap",
      "sunnyside",
      "grandview",
      "moxee",
      "wapato",
      "toppenish",
    ],
  },
  {
    slug: "whatcom-county",
    name: "Whatcom County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "bellingham",
      "ferndale",
      "lynden",
      "blaine",
      "birch-bay",
      "sumas",
      "nooksack",
    ],
  },
  {
    slug: "skagit-county",
    name: "Skagit County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "mount-vernon",
      "anacortes",
      "burlington",
      "sedro-woolley",
      "oak-harbor",
      "la-conner",
    ],
  },
  {
    slug: "grays-harbor-county",
    name: "Grays Harbor County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "aberdeen",
      "hoquiam",
      "cosmopolis",
      "ocean-shores",
      "elma",
      "montesano",
    ],
  },
  {
    slug: "lewis-county",
    name: "Lewis County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "centralia",
      "chehalis",
      "napavine",
      "pe-ell",
      "winlock",
    ],
  },
  {
    slug: "clark-county",
    name: "Clark County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "vancouver",
      "camas",
      "battle-ground",
      "la-center",
      "washougal",
    ],
  },
  {
    slug: "island-county",
    name: "Island County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "oak-harbor",
      "coupeville",
      "freeland",
      "clinton",
    ],
  },
  {
    slug: "walla-walla-county",
    name: "Walla Walla County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "walla-walla",
      "college-place",
      "waitsburg",
    ],
  },
  {
    slug: "whitman-county",
    name: "Whitman County",
    kind: "county",
    state: WASHINGTON,
    citySlugs: [
      "pullman",
      "colfax",
    ],
  },

  // ─── Minnesota ─────────────────────────────────────────────────────────────
  {
    slug: "hennepin-county",
    name: "Hennepin County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "minneapolis",
      "minnetonka",
      "edina",
      "plymouth",
      "bloomington",
      "eden-prairie",
      "maple-grove",
      "brooklyn-park",
      "golden-valley",
      "st-louis-park",
      "richfield",
      "robbinsdale",
      "champlin",
      "new-hope",
      "crystal",
      "hopkins",
    ],
  },
  {
    slug: "ramsey-county",
    name: "Ramsey County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "st-paul",
      "maplewood",
      "roseville",
      "north-st-paul",
      "little-canada",
      "shoreview",
      "arden-hills",
      "vadnais-heights",
      "white-bear-lake",
      "mounds-view",
    ],
  },
  {
    slug: "dakota-county",
    name: "Dakota County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "eagan",
      "burnsville",
      "lakeville",
      "apple-valley",
      "hastings",
      "west-st-paul",
      "south-st-paul",
      "inver-grove-heights",
      "farmington",
      "rosemount",
    ],
  },
  {
    slug: "washington-county-mn",
    name: "Washington County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "woodbury",
      "stillwater",
      "cottage-grove",
      "oakdale",
      "newport",
    ],
  },
  {
    slug: "anoka-county",
    name: "Anoka County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "blaine",
      "coon-rapids",
      "fridley",
      "columbia-heights",
      "andover",
      "ramsey",
      "st-francis",
    ],
  },
  {
    slug: "olmsted-county",
    name: "Olmsted County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "rochester",
    ],
  },
  {
    slug: "st-louis-county",
    name: "St. Louis County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "duluth",
      "hibbing",
      "virginia",
      "cloquet",
    ],
  },
  {
    slug: "blue-earth-county",
    name: "Blue Earth County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "mankato",
      "north-mankato",
    ],
  },
  {
    slug: "stearns-county",
    name: "Stearns County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "st-cloud",
      "waite-park",
      "sartell",
    ],
  },
  {
    slug: "scott-county",
    name: "Scott County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "shakopee",
      "prior-lake",
      "savage",
      "jordan",
    ],
  },
  {
    slug: "wright-county",
    name: "Wright County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "buffalo",
      "monticello",
      "st-michael",
      "rogers",
    ],
  },
  {
    slug: "clay-county",
    name: "Clay County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "moorhead",
      "dilworth",
    ],
  },
  {
    slug: "douglas-county",
    name: "Douglas County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "alexandria",
    ],
  },
  {
    slug: "carver-county",
    name: "Carver County",
    kind: "county",
    state: MINNESOTA,
    citySlugs: [
      "chaska",
      "chanhassen",
      "waconia",
      "victoria",
    ],
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

/**
 * Returns the county Region that contains `citySlug` for the given state,
 * or null if the city is not part of a mapped county.
 */
export function parentCountyForCity(
  stateCode: string,
  citySlug: string,
): Region | null {
  const code = stateCode.toUpperCase();
  const city = citySlug.toLowerCase();
  return (
    REGIONS.find(
      (r) =>
        r.state.code === code &&
        r.kind === "county" &&
        (r.citySlugs as readonly string[]).includes(city),
    ) ?? null
  );
}
