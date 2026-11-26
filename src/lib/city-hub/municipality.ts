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
};

export function displayMunicipality(input: MunicipalityInput): DisplayMunicipality | null {
  if (input.stateCode.toUpperCase() !== "PA") return null;
  for (const rule of PA_NAME) {
    if (rule.re.test(input.name)) return rule.city;
  }
  const zip = (input.zip ?? "").trim().slice(0, 5);
  return zip ? (PA_ZIP[zip] ?? null) : null;
}

/** Keep a home on this city page only when its display municipality matches. */
export function belongsOnCityPage(input: MunicipalityInput, pageSlug: string): boolean {
  const override = displayMunicipality(input);
  if (!override) return input.citySlug === pageSlug;
  return override.slug === pageSlug;
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
