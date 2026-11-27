import { displayCityName } from "@/lib/resolveListingRegion";

/**
 * Licensed / directory city vs Census neighborhood.
 *
 * `facilities.city` / `city_slug` are the Census place (Parkland, Fairwood).
 * `historical_city_slugs[0]` is the DSHS LocationCity that Census replaced
 * (Tacoma, Renton, Spokane). URLs stay on the Census slug. The address line
 * and PostalAddress use the licensed city.
 */
export type LicensedCity = {
  /** City printed in the street address and JSON-LD addressLocality. */
  locality: string;
  /** Census neighborhood, when it differs from the licensed city. */
  neighborhood: string | null;
};

export type LicensedCityInput = {
  city: string | null | undefined;
  city_slug: string;
  historical_city_slugs?: string[] | null;
};

export function licensedCity(input: LicensedCityInput): LicensedCity {
  const neighborhood = displayCityName(input.city, input.city_slug);
  const prior = (input.historical_city_slugs ?? []).find(
    (slug) => slug && slug !== input.city_slug,
  );
  if (!prior) return { locality: neighborhood, neighborhood: null };
  const locality = displayCityName(null, prior);
  if (!locality || locality.toLowerCase() === neighborhood.toLowerCase()) {
    return { locality: neighborhood, neighborhood: null };
  }
  return { locality, neighborhood };
}
