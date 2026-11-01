/** First set on a city hub. The rest stay on the crawlable facilities page. */
export const HUB_PREVIEW_LIMIT = 24;
export const HUB_ITEM_LIST_LIMIT = 50;
export const CITY_BROWSE_PAGE_SIZE = 48;

type RankedFacility = {
  name: string;
  inspections: number;
  total_citations: number;
  capacity_tier: string;
};

function byEvidence(a: RankedFacility, b: RankedFacility): number {
  const aRecord = a.inspections > 0 ? 1 : 0;
  const bRecord = b.inspections > 0 ? 1 : 0;
  if (aRecord !== bRecord) return bRecord - aRecord;
  if (b.inspections !== a.inspections) return b.inspections - a.inspections;
  if (b.total_citations !== a.total_citations) return b.total_citations - a.total_citations;
  return a.name.localeCompare(b.name);
}

/**
 * Homes of 6 beds or fewer stay off the hub unless they are the only homes
 * in the city. Order is inspections, then citations, then name.
 */
export function rankHubFacilities<T extends RankedFacility>(facilities: T[]): {
  preview: T[];
  itemList: T[];
  onlySmallHomes: boolean;
} {
  const nonSmall = facilities.filter((facility) => facility.capacity_tier !== "small");
  const pool = nonSmall.length > 0 ? nonSmall : facilities;
  const sorted = [...pool].sort(byEvidence);
  return {
    preview: sorted.slice(0, HUB_PREVIEW_LIMIT),
    itemList: sorted.slice(0, HUB_ITEM_LIST_LIMIT),
    onlySmallHomes: nonSmall.length === 0 && facilities.length > 0,
  };
}
