/**
 * Display-layer municipality for homes whose mailing city_slug is wrong.
 * No database writes. Facility URLs keep the stored city_slug.
 *
 * Pittsburgh mailing addresses currently place Mt. Lebanon (ZIP 15228 /
 * "Mt. Lebanon" in the name) and Bethel Park homes on /pennsylvania/pittsburgh.
 * Those homes belong on their own city hubs.
 */

export type DisplayMunicipality = { slug: string; name: string };

const PA_ZIP: Record<string, DisplayMunicipality> = {
  "15228": { slug: "mt-lebanon", name: "Mt. Lebanon" },
  "15102": { slug: "bethel-park", name: "Bethel Park" },
};

const PA_NAME: Array<{ re: RegExp; city: DisplayMunicipality }> = [
  { re: /\bmt\.?\s*lebanon\b/i, city: { slug: "mt-lebanon", name: "Mt. Lebanon" } },
  { re: /\bmount lebanon\b/i, city: { slug: "mt-lebanon", name: "Mt. Lebanon" } },
  { re: /\bbethel park\b/i, city: { slug: "bethel-park", name: "Bethel Park" } },
];

export type MunicipalityInput = {
  stateCode: string;
  zip: string | null | undefined;
  name: string;
  citySlug: string;
  /** WA directory county. Used to split Census places that share a slug. */
  county?: string | null;
  /** Prior city_slug values (DSHS LocationCity before the Census rewrite). */
  historicalCitySlugs?: string[] | null;
};

export function displayMunicipality(input: MunicipalityInput): DisplayMunicipality | null {
  if (input.stateCode.toUpperCase() !== "PA") return null;
  for (const rule of PA_NAME) {
    if (rule.re.test(input.name)) return rule.city;
  }
  const zip = (input.zip ?? "").trim().slice(0, 5);
  return zip ? (PA_ZIP[zip] ?? null) : null;
}

/**
 * Two Census CDPs named Fairwood (King / Renton vs Spokane). Facility URLs
 * keep city_slug=fairwood. Hub membership follows the DSHS city: Spokane
 * homes list on /washington/spokane, King homes stay on /washington/fairwood.
 */
const WA_FAIRWOOD_HUB: Record<string, string> = {
  Spokane: "spokane",
  King: "fairwood",
};

function waFairwoodHub(input: MunicipalityInput): string | null {
  if (input.citySlug !== "fairwood") return null;
  const county = (input.county ?? "").trim();
  if (county && WA_FAIRWOOD_HUB[county]) return WA_FAIRWOOD_HUB[county];
  const hist = input.historicalCitySlugs ?? [];
  if (hist.includes("spokane")) return "spokane";
  if (hist.includes("renton")) return "fairwood";
  return null;
}

/** Keep a home on this city page only when its display municipality matches. */
export function belongsOnCityPage(input: MunicipalityInput, pageSlug: string): boolean {
  const state = input.stateCode.toUpperCase();
  if (state === "PA") {
    const override = displayMunicipality(input);
    if (!override) return input.citySlug === pageSlug;
    return override.slug === pageSlug;
  }
  if (state === "WA") {
    const fairwoodHub = waFairwoodHub(input);
    if (fairwoodHub) return fairwoodHub === pageSlug;
  }
  return input.citySlug === pageSlug;
}

export function paOverridePageSlugs(): string[] {
  return ["mt-lebanon", "bethel-park", "pittsburgh"];
}

/** Filter for the extra PA query that pulls mis-slugged homes onto the right hub. */
export function paOverrideOrFilter(): string {
  return [
    "zip.eq.15228",
    "zip.eq.15102",
    "name.ilike.%Mt. Lebanon%",
    "name.ilike.%Mount Lebanon%",
    "name.ilike.%Bethel Park%",
  ].join(",");
}

export function waOverridePageSlugs(): string[] {
  return ["fairwood", "spokane"];
}

/** Extra query: Fairwood CDP homes that belong on the Spokane hub. */
export function waOverrideOrFilter(): string {
  return "city_slug.eq.fairwood";
}
