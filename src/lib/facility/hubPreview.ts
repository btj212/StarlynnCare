import {
  cityHubCardGroup,
  listedInMemoryCareGroup,
  type CityHubCardGroup,
} from "@/lib/city-hub/careSetting";
import { facilityListedOnHub } from "@/lib/seo/indexability";

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

/**
 * Every home a city page should link to, A to Z. This is the listed set:
 * every publishable home on the page, including small homes. The facility
 * sitemap is every publishable profile.
 */
export function homesForCityIndex<
  T extends { name: string; beds: number | null; inspections: number; total_citations: number },
>(facilities: T[], stateCode: string): T[] {
  return facilities
    .filter((facility) =>
      facilityListedOnHub({
        stateCode,
        beds: facility.beds,
        deficiencyCount: facility.total_citations,
        inspectionCount: facility.inspections,
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function byEvidence(a: RankedFacility, b: RankedFacility): number {
  const aRecord = a.inspections > 0 ? 1 : 0;
  const bRecord = b.inspections > 0 ? 1 : 0;
  if (aRecord !== bRecord) return bRecord - aRecord;
  if (b.inspections !== a.inspections) return b.inspections - a.inspections;
  if (b.total_citations !== a.total_citations) return b.total_citations - a.total_citations;
  return a.name.localeCompare(b.name);
}

/**
 * The opening cards prefer homes over 6 beds, ordered by inspections, then
 * citations, then name. Small homes have their own section; this preview
 * is only the fuller records.
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

type GridHome = RankedFacility & {
  id: string;
  capacity_tier: "small" | "medium" | "large" | "unknown";
  careChip?: string | null;
  serves_memory_care: boolean;
  memory_care_disclosure_filed: boolean;
  tx_alzheimer_certified?: boolean;
};

function gridGroup(home: GridHome, stateSlug: string): CityHubCardGroup {
  return cityHubCardGroup({
    careChip: home.careChip,
    capacityTier: home.capacity_tier,
    inMemoryCareGroup: listedInMemoryCareGroup({
      stateSlug,
      careChip: home.careChip,
      servesMemoryCare: home.serves_memory_care,
      memoryCareDisclosureFiled: home.memory_care_disclosure_filed,
      txAlzheimerCertified: home.tx_alzheimer_certified,
    }),
  });
}

/**
 * Cards for the city hub. The opening set is the fullest records. Every
 * small home and every Washington tier home is included so those sections
 * are complete. A home is returned once.
 */
export function homesForCityHubGrid<T extends GridHome>(homes: T[], stateSlug: string): T[] {
  const previewIds = new Set(rankHubFacilities(homes).preview.map((home) => home.id));
  return homes.filter((home) => {
    const group = gridGroup(home, stateSlug);
    if (group === "small" || group === "confirmed-accepts" || group === "credential") return true;
    return previewIds.has(home.id);
  });
}
