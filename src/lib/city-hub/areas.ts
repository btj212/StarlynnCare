/**
 * Areas-served copy for city hubs. ZIP → neighborhood names live in code so
 * the page never hand-types a list of places from a spec. Nearby-hub slugs
 * are the cities to try; counts come from loadListedCountsForSlugs.
 */

export type NeighborhoodZip = { zip: string; name: string };

export type AreasServed = {
  heading: string;
  intro: string;
  /** ZIP labels to match against listed homes. Unmatched ZIPs are omitted. */
  neighborhoods: NeighborhoodZip[];
};

export type NearbyHubSpec = {
  slug: string;
  name: string;
};

const SAN_DIEGO_ZIPS: NeighborhoodZip[] = [
  { zip: "92101", name: "Downtown / Bankers Hill" },
  { zip: "92108", name: "Mission Valley" },
  { zip: "92109", name: "Pacific Beach / Mission Bay" },
  { zip: "92115", name: "College Area" },
  { zip: "92122", name: "University City" },
  { zip: "92127", name: "Rancho Bernardo / 4S Ranch / Sabre Springs" },
  { zip: "92128", name: "Rancho Bernardo / 4S Ranch / Sabre Springs" },
  { zip: "92129", name: "Rancho Penasquitos" },
  { zip: "92130", name: "Carmel Valley" },
];

const ST_PAUL_ZIPS: NeighborhoodZip[] = [
  { zip: "55101", name: "Downtown / Lowertown" },
  { zip: "55102", name: "West Seventh / Summit-University" },
  { zip: "55103", name: "North End / Capitol" },
  { zip: "55104", name: "Midway / Merriam Park" },
  { zip: "55105", name: "Macalester-Groveland / Highland" },
  { zip: "55106", name: "East Side" },
  { zip: "55107", name: "West Side" },
  { zip: "55108", name: "St. Anthony Park / Como" },
  { zip: "55116", name: "Highland Park" },
  { zip: "55117", name: "North End / Rice Street" },
  { zip: "55119", name: "Battle Creek / Highwood" },
  { zip: "55130", name: "Payne-Phalen" },
];

const PORTLAND_ZIPS: NeighborhoodZip[] = [
  { zip: "97201", name: "Southwest / South Portland" },
  { zip: "97202", name: "Sellwood / Brooklyn / Reed" },
  { zip: "97205", name: "Goose Hollow / Downtown west" },
  { zip: "97209", name: "Pearl / Old Town" },
  { zip: "97210", name: "Northwest District / Hillside" },
  { zip: "97211", name: "Northeast King / Concordia" },
  { zip: "97212", name: "Irvington / Alameda" },
  { zip: "97213", name: "Rose City Park / Beaumont" },
  { zip: "97214", name: "Southeast / Buckman / Sunnyside" },
  { zip: "97215", name: "Mount Tabor / South Tabor" },
  { zip: "97217", name: "Kenton / Overlook" },
  { zip: "97219", name: "Multnomah Village / Hillsdale" },
  { zip: "97220", name: "Parkrose / Gateway" },
  { zip: "97221", name: "Sylvan / southwest hills" },
  { zip: "97225", name: "Raleigh Hills / westside (Washington County mailing)" },
  { zip: "97229", name: "Bethany / Cedar Mill (Washington County mailing)" },
  { zip: "97232", name: "Kerns / Laurelhurst" },
  { zip: "97236", name: "Powellhurst / Centennial" },
  { zip: "97239", name: "South Waterfront / Homestead" },
  { zip: "97266", name: "Lents / Powellhurst-Gilbert" },
];

const KANSAS_CITY_ZIPS: NeighborhoodZip[] = [
  { zip: "64111", name: "Midtown / Valentine" },
  { zip: "64112", name: "Country Club Plaza" },
  { zip: "64113", name: "Brookside / Waldo" },
  { zip: "64114", name: "Waldo / Wornall" },
  { zip: "64116", name: "Northland / Briarcliff (Clay)" },
  { zip: "64117", name: "Northland / Antioch (Clay)" },
  { zip: "64118", name: "Northland / Gladstone edge (Clay)" },
  { zip: "64119", name: "Northland / Shoal Creek (Clay)" },
  { zip: "64151", name: "Northland / Parkville / Tiffany Springs (Platte)" },
  { zip: "64152", name: "Northland / Barry Road / Platte" },
  { zip: "64153", name: "KCI / northern Platte" },
  { zip: "64154", name: "Zona Rosa / northern Platte" },
  { zip: "64155", name: "Staley / Shoal Creek (Clay)" },
  { zip: "64156", name: "Shoal Creek (Clay)" },
  { zip: "64157", name: "Shoal Creek (Clay)" },
  { zip: "64158", name: "Shoal Creek / Liberty edge (Clay)" },
];

const VANCOUVER_ZIPS: NeighborhoodZip[] = [
  { zip: "98660", name: "Downtown / Waterfront" },
  { zip: "98662", name: "Vancouver Mall area" },
  { zip: "98663", name: "central Vancouver" },
  { zip: "98682", name: "east Vancouver / Orchards side" },
  { zip: "98683", name: "Cascade Park / Fisher's Landing" },
  { zip: "98684", name: "east Vancouver" },
];

const DENVER_ZIPS: NeighborhoodZip[] = [
  { zip: "80202", name: "Downtown / LoDo / Riverfront" },
  { zip: "80238", name: "Central Park" },
  { zip: "80246", name: "Cherry Creek / Glendale area" },
  { zip: "80222", name: "southeast Denver" },
  { zip: "80224", name: "southeast Denver" },
  { zip: "80247", name: "southeast Denver" },
];

const COLORADO_SPRINGS_ZIPS: NeighborhoodZip[] = [
  { zip: "80904", name: "westside" },
  { zip: "80909", name: "central-east" },
  { zip: "80918", name: "University Park" },
  { zip: "80922", name: "northeast / Stetson Hills" },
];

const CHICAGO_ZIPS: NeighborhoodZip[] = [
  { zip: "60611", name: "Streeterville / Gold Coast" },
  { zip: "60614", name: "Lincoln Park" },
  { zip: "60617", name: "South Chicago / South Shore" },
  { zip: "60631", name: "Norwood Park" },
  { zip: "60637", name: "Hyde Park" },
  { zip: "60640", name: "Uptown / Edgewater" },
  { zip: "60641", name: "Portage Park / Irving Park" },
  { zip: "60655", name: "Mount Greenwood" },
  { zip: "60657", name: "Lakeview" },
];

const AREAS: Record<string, AreasServed> = {
  "CA:san-diego": {
    heading: "Areas of San Diego on this page",
    intro:
      "Homes below are listed under the San Diego city slug. Neighborhood names are the USPS ZIP of the licensed address, not a marketing region. County: San Diego County.",
    neighborhoods: SAN_DIEGO_ZIPS,
  },
  "MN:st-paul": {
    heading: "Areas of St. Paul on this page",
    intro:
      "St. Paul sits in Ramsey County. Neighborhood names follow the licensed ZIP. Highland Park (55105 / 55116) has several of the homes on this page.",
    neighborhoods: ST_PAUL_ZIPS,
  },
  "MO:kansas-city": {
    heading: "Where these Kansas City, MO homes sit",
    intro:
      "Kansas City, Missouri spans Jackson, Clay, and Platte counties. Northland addresses (Shoal Creek, Tiffany Springs, Briarcliff, Barry Road) are Clay or Platte. Kansas City, Kansas is a different state and a different regulator.",
    neighborhoods: KANSAS_CITY_ZIPS,
  },
  "OR:portland": {
    heading: "Areas of Portland on this page",
    intro:
      "Most Portland mailing addresses are in Multnomah County. A ZIP on the west side can be a Washington County mailing address even when the city line says Portland; we do not overwrite county from this page.",
    neighborhoods: PORTLAND_ZIPS,
  },
  "WA:vancouver": {
    heading: "Areas of Vancouver on this page",
    intro:
      "Neighborhood names are the USPS ZIP of the licensed address for homes inside Vancouver city limits. Labels are general. Homes with a Vancouver mailing address in unincorporated Clark County are listed in their own section.",
    neighborhoods: VANCOUVER_ZIPS,
  },
  "CO:denver": {
    heading: "Areas of Denver on this page",
    intro:
      "These are the licensed ZIPs of the Denver homes on this page. Downtown / LoDo / Riverfront is 80202. Southeast Denver is 80222, 80224, and 80247.",
    neighborhoods: DENVER_ZIPS,
  },
  "CO:colorado-springs": {
    heading: "Areas of Colorado Springs on this page",
    intro:
      "Colorado Springs is in El Paso County. These are the licensed ZIPs of the homes on this page.",
    neighborhoods: COLORADO_SPRINGS_ZIPS,
  },
  "IL:chicago": {
    heading: "Areas of Chicago on this page",
    intro:
      "Chicago is in Cook County. These are the licensed ZIPs of the homes on this page. IDPH does not publish a bed count for these rows.",
    neighborhoods: CHICAGO_ZIPS,
  },
};

const NEARBY: Record<string, NearbyHubSpec[]> = {
  "CA:san-diego": [
    { slug: "escondido", name: "Escondido" },
    { slug: "oceanside", name: "Oceanside" },
    { slug: "chula-vista", name: "Chula Vista" },
    { slug: "carlsbad", name: "Carlsbad" },
    { slug: "la-mesa", name: "La Mesa" },
    { slug: "vista", name: "Vista" },
    { slug: "poway", name: "Poway" },
    { slug: "encinitas", name: "Encinitas" },
    { slug: "la-jolla", name: "La Jolla" },
    { slug: "san-marcos", name: "San Marcos" },
    { slug: "national-city", name: "National City" },
    { slug: "el-cajon", name: "El Cajon" },
    { slug: "lemon-grove", name: "Lemon Grove" },
    { slug: "coronado", name: "Coronado" },
    { slug: "santee", name: "Santee" },
  ],
  "MN:st-paul": [
    { slug: "minneapolis", name: "Minneapolis" },
    { slug: "maplewood", name: "Maplewood" },
    { slug: "eagan", name: "Eagan" },
    { slug: "woodbury", name: "Woodbury" },
    { slug: "roseville", name: "Roseville" },
    { slug: "west-st-paul", name: "West St. Paul" },
    { slug: "inver-grove-heights", name: "Inver Grove Heights" },
    { slug: "oakdale", name: "Oakdale" },
    { slug: "mendota-heights", name: "Mendota Heights" },
    { slug: "arden-hills", name: "Arden Hills" },
    { slug: "white-bear-lake", name: "White Bear Lake" },
    { slug: "vadnais-heights", name: "Vadnais Heights" },
    { slug: "new-brighton", name: "New Brighton" },
    { slug: "little-canada", name: "Little Canada" },
    { slug: "shoreview", name: "Shoreview" },
    { slug: "north-st-paul", name: "North St. Paul" },
    { slug: "south-st-paul", name: "South St. Paul" },
    { slug: "st-anthony", name: "St. Anthony" },
  ],
  "MO:kansas-city": [
    { slug: "lees-summit", name: "Lee's Summit" },
    { slug: "lee-s-summit", name: "Lee's Summit" },
    { slug: "independence", name: "Independence" },
    { slug: "gladstone", name: "Gladstone" },
    { slug: "liberty", name: "Liberty" },
    { slug: "blue-springs", name: "Blue Springs" },
    { slug: "raymore", name: "Raymore" },
    { slug: "grain-valley", name: "Grain Valley" },
    { slug: "kearney", name: "Kearney" },
    { slug: "belton", name: "Belton" },
    { slug: "raytown", name: "Raytown" },
  ],
  "WA:vancouver": [
    { slug: "orchards", name: "Orchards" },
    { slug: "mount-vista", name: "Mount Vista" },
    { slug: "five-corners", name: "Five Corners" },
    { slug: "battle-ground", name: "Battle Ground" },
    { slug: "salmon-creek", name: "Salmon Creek" },
    { slug: "hazel-dell", name: "Hazel Dell" },
    { slug: "camas", name: "Camas" },
    { slug: "washougal", name: "Washougal" },
  ],
  "CO:denver": [
    { slug: "aurora", name: "Aurora" },
    { slug: "lakewood", name: "Lakewood" },
    { slug: "thornton", name: "Thornton" },
    { slug: "broomfield", name: "Broomfield" },
    { slug: "centennial", name: "Centennial" },
    { slug: "littleton", name: "Littleton" },
    { slug: "arvada", name: "Arvada" },
    { slug: "westminster", name: "Westminster" },
    { slug: "northglenn", name: "Northglenn" },
    { slug: "wheat-ridge", name: "Wheat Ridge" },
    { slug: "greenwood-village", name: "Greenwood Village" },
    { slug: "golden", name: "Golden" },
  ],
  "CO:colorado-springs": [
    { slug: "denver", name: "Denver" },
    { slug: "aurora", name: "Aurora" },
    { slug: "pueblo", name: "Pueblo" },
  ],
  "IL:chicago": [
    { slug: "evanston", name: "Evanston" },
    { slug: "park-ridge", name: "Park Ridge" },
    { slug: "elmhurst", name: "Elmhurst" },
    { slug: "naperville", name: "Naperville" },
    { slug: "orland-park", name: "Orland Park" },
    { slug: "oak-park", name: "Oak Park" },
    { slug: "niles", name: "Niles" },
    { slug: "morton-grove", name: "Morton Grove" },
    { slug: "oak-lawn", name: "Oak Lawn" },
    { slug: "wilmette", name: "Wilmette" },
    { slug: "glenview", name: "Glenview" },
  ],
  "OR:portland": [
    { slug: "beaverton", name: "Beaverton" },
    { slug: "hillsboro", name: "Hillsboro" },
    { slug: "lake-oswego", name: "Lake Oswego" },
    { slug: "happy-valley", name: "Happy Valley" },
    { slug: "tualatin", name: "Tualatin" },
    { slug: "sherwood", name: "Sherwood" },
    { slug: "wilsonville", name: "Wilsonville" },
    { slug: "clackamas", name: "Clackamas" },
    { slug: "gresham", name: "Gresham" },
    { slug: "milwaukie", name: "Milwaukie" },
    { slug: "oregon-city", name: "Oregon City" },
    { slug: "troutdale", name: "Troutdale" },
    { slug: "west-linn", name: "West Linn" },
  ],
};

function key(stateCode: string, citySlug: string): string {
  return `${stateCode.toUpperCase()}:${citySlug.toLowerCase()}`;
}

export function areasServedFor(stateCode: string, citySlug: string): AreasServed | null {
  return AREAS[key(stateCode, citySlug)] ?? null;
}

export function nearbyHubsFor(stateCode: string, citySlug: string): NearbyHubSpec[] {
  return NEARBY[key(stateCode, citySlug)] ?? [];
}

/** Neighborhood names that actually appear in this city's listed ZIPs. */
export function neighborhoodsPresent(
  spec: AreasServed,
  zips: Array<string | null | undefined>,
): Array<{ name: string; zips: string[] }> {
  const present = new Set(
    zips.map((z) => (z ?? "").trim().slice(0, 5)).filter((z) => z.length === 5),
  );
  const byName = new Map<string, string[]>();
  for (const row of spec.neighborhoods) {
    if (!present.has(row.zip)) continue;
    const list = byName.get(row.name) ?? [];
    list.push(row.zip);
    byName.set(row.name, list);
  }
  return [...byName.entries()].map(([name, zipList]) => ({ name, zips: zipList }));
}

/** Display-only county crumb when regions.ts has no county hub (Missouri). */
export function displayCountyCrumb(
  stateCode: string,
  citySlug: string,
): { name: string; href: string | null } | null {
  const k = key(stateCode, citySlug);
  if (k === "MO:kansas-city") return { name: "Jackson County", href: null };
  if (k === "CO:colorado-springs") return { name: "El Paso County", href: null };
  if (k === "IL:chicago") return { name: "Cook County", href: null };
  return null;
}
