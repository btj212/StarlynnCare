/**
 * City browse URL (`/{state}/{city}/facilities`) vs the city hub.
 *
 * Google was indexing both: the hub and the unfiltered browse page returned
 * 200 and competed (San Diego browse 379 impressions vs hub 43). The hub is
 * the canonical city URL — it already lists every home A to Z. Unfiltered
 * `/facilities` 308s there. Search, pagination, and the small-homes filter
 * stay on `/facilities` so those tools remain usable.
 */

export type CityBrowseQuery = {
  page?: string;
  q?: string;
  homes?: string;
};

export function cityBrowsePageNumber(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** True when the browse URL carries a search, page, or size filter. */
export function cityBrowseIsFiltered(query: CityBrowseQuery): boolean {
  const page = cityBrowsePageNumber(query.page);
  const q = (query.q ?? "").trim();
  return page > 1 || q.length > 0 || query.homes === "small";
}

export function cityBrowseHubPath(stateSlug: string, regionSlug: string): string {
  return `/${stateSlug}/${regionSlug}`;
}
