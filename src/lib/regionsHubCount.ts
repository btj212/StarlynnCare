import type { SupabaseClient } from "@supabase/supabase-js";
import type { Region } from "@/lib/regions";
import { facilityListedInSitemap } from "@/lib/seo/indexability";
import { todayIsoDate } from "@/lib/data/inspectionDates";
import {
  belongsOnCityPage,
  paOverrideOrFilter,
  paOverridePageSlugs,
  waOverrideOrFilter,
  waOverridePageSlugs,
} from "@/lib/city-hub/municipality";

/**
 * Exact publishable facility count for a listing region (matches hub page query).
 */
export async function countPublishableFacilitiesInRegion(
  supabase: SupabaseClient,
  region: Region,
): Promise<number> {
  const { count, error } = await supabase
    .from("facilities")
    .select("*", { count: "exact", head: true })
    .eq("state_code", region.state.code)
    .eq("publishable", true)
    .in("city_slug", region.citySlugs as unknown as string[]);

  if (error) {
    console.error("[regionsHubCount]", error.message);
    return -1;
  }
  return count ?? 0;
}

/**
 * Lightweight summary used by `generateMetadata` on the city/county hub. Returns
 * the three numbers that feed the data-driven SERP snippet:
 *   - totalCount: publishable facilities in the region
 *   - withDeficiency: of those, how many have ≥1 cited deficiency on record
 *   - findingsDate: ISO yyyy-mm-dd of the most recent `facilities.updated_at`
 *
 * Inspection IDs are batched in chunks of 150 to stay under PostgREST URL limits
 * (same chunking convention as the hub render).
 */
export async function loadRegionHubSummary(
  supabase: SupabaseClient,
  region: Region,
): Promise<{
  totalCount: number;
  withDeficiency: number;
  findingsDate: string | null;
  firstPublishedAt: string | null;
  /**
   * Homes that can still justify the hub. Zero with a non-zero total means
   * every home is an excluded Arizona small home, so the hub is noindex.
   * A failed record check leaves this equal to totalCount.
   */
  indexableFacilityCount: number;
  /** Minnesota ALDC licenses among listed homes. */
  dementiaLicenseCount: number;
  /** Set when the facilities query failed — callers must not treat this as an empty hub. */
  fetchError: string | null;
}> {
  const { data: facRows, error: facErr } = await supabase
    .from("facilities")
    .select("id, updated_at, created_at, beds, name, zip, city_slug, mn_dementia_care_licensed, wa_county, historical_city_slugs")
    .eq("state_code", region.state.code)
    .eq("publishable", true)
    .in("city_slug", region.citySlugs as unknown as string[]);

  if (facErr) {
    console.error("[loadRegionHubSummary] facilities:", facErr.message);
    return {
      totalCount: 0,
      withDeficiency: 0,
      findingsDate: null,
      firstPublishedAt: null,
      indexableFacilityCount: 0,
      dementiaLicenseCount: 0,
      fetchError: facErr.message,
    };
  }

  type HubRow = {
    id: string;
    updated_at: string | null;
    created_at: string | null;
    beds: number | null;
    name?: string;
    zip?: string | null;
    city_slug?: string;
    mn_dementia_care_licensed?: boolean | null;
    wa_county?: string | null;
    historical_city_slugs?: string[] | null;
  };
  const byId = new Map<string, HubRow>();
  for (const row of (facRows ?? []) as HubRow[]) byId.set(row.id, row);

  if (
    region.kind === "city" &&
    region.state.code === "PA" &&
    paOverridePageSlugs().includes(region.slug)
  ) {
    const { data: extraRows } = await supabase
      .from("facilities")
      .select("id, updated_at, created_at, beds, name, zip, city_slug, mn_dementia_care_licensed, wa_county, historical_city_slugs")
      .eq("state_code", "PA")
      .eq("publishable", true)
      .or(paOverrideOrFilter());
    for (const row of (extraRows ?? []) as HubRow[]) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }

  if (
    region.kind === "city" &&
    region.state.code === "WA" &&
    waOverridePageSlugs().includes(region.slug)
  ) {
    const { data: extraRows } = await supabase
      .from("facilities")
      .select("id, updated_at, created_at, beds, name, zip, city_slug, mn_dementia_care_licensed, wa_county, historical_city_slugs")
      .eq("state_code", "WA")
      .eq("publishable", true)
      .or(waOverrideOrFilter());
    for (const row of (extraRows ?? []) as HubRow[]) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }

  const mergedRows = [...byId.values()].filter((row) => {
    if (region.kind !== "city") return true;
    if (region.state.code !== "PA" && region.state.code !== "WA") return true;
    return belongsOnCityPage(
      {
        stateCode: region.state.code,
        zip: row.zip ?? null,
        name: row.name ?? "",
        citySlug: row.city_slug ?? region.slug,
        county: row.wa_county,
        historicalCitySlugs: row.historical_city_slugs,
      },
      region.slug,
    );
  });
  const facilityIds = mergedRows.map((r) => r.id);
  const totalCount = facilityIds.length;

  let mostRecent: number = 0;
  let earliest: number = Infinity;
  for (const r of mergedRows) {
    const ts = r.updated_at;
    if (ts) {
      const t = new Date(ts).getTime();
      if (t > mostRecent) mostRecent = t;
    }
    const ca = r.created_at;
    if (ca) {
      const t = new Date(ca).getTime();
      if (t < earliest) earliest = t;
    }
  }
  const findingsDate =
    mostRecent > 0 ? new Date(mostRecent).toISOString().split("T")[0] : null;
  const firstPublishedAt =
    earliest < Infinity ? new Date(earliest).toISOString() : null;

  if (totalCount === 0) {
    return {
      totalCount: 0,
      withDeficiency: 0,
      findingsDate,
      firstPublishedAt,
      indexableFacilityCount: 0,
      dementiaLicenseCount: 0,
      fetchError: null,
    };
  }

  // Chunk to avoid URL-length limits and PostgREST's 1000-row default cap.
  const INSP_CHUNK = 150;
  const inspFacMap = new Map<string, string>();
  const inspCountByFac = new Map<string, number>();
  let recordCheckIncomplete = false;
  for (let ci = 0; ci < facilityIds.length; ci += INSP_CHUNK) {
    const chunk = facilityIds.slice(ci, ci + INSP_CHUNK);
    const { data: inspRows, error: inspErr } = await supabase
      .from("inspections")
      .select("id, facility_id")
      .in("facility_id", chunk)
      .lte("inspection_date", todayIsoDate())
      .limit(5000);
    if (inspErr) {
      console.error("[loadRegionHubSummary] inspections:", inspErr.message);
      recordCheckIncomplete = true;
      break;
    }
    for (const i of (inspRows ?? []) as Array<{ id: string; facility_id: string }>) {
      inspFacMap.set(i.id, i.facility_id);
      inspCountByFac.set(i.facility_id, (inspCountByFac.get(i.facility_id) ?? 0) + 1);
    }
  }
  const inspIds = [...inspFacMap.keys()];

  const facilitiesWithAnyDef = new Set<string>();
  const CHUNK = 150;
  for (let ci = 0; ci < inspIds.length; ci += CHUNK) {
    const chunk = inspIds.slice(ci, ci + CHUNK);
    const { data: defRows, error: defErr } = await supabase
      .from("deficiencies")
      .select("inspection_id")
      .in("inspection_id", chunk)
      .limit(5000);
    if (defErr) {
      console.error("[loadRegionHubSummary] deficiencies:", defErr.message);
      recordCheckIncomplete = true;
      break;
    }
    for (const d of (defRows ?? []) as Array<{ inspection_id: string }>) {
      const fid = inspFacMap.get(d.inspection_id);
      if (fid) facilitiesWithAnyDef.add(fid);
    }
  }

  const listedRows = recordCheckIncomplete
    ? mergedRows
    : mergedRows.filter((row) => {
        return facilityListedInSitemap({
          stateCode: region.state.code,
          beds: row.beds,
          deficiencyCount: facilitiesWithAnyDef.has(row.id) ? 1 : 0,
          inspectionCount: inspCountByFac.get(row.id) ?? 0,
        });
      });
  const indexableFacilityCount = listedRows.length;
  const listedIds = new Set(listedRows.map((row) => row.id));
  const withDeficiencyListed = [...facilitiesWithAnyDef].filter((id) => listedIds.has(id)).length;
  const dementiaLicenseCount = listedRows.filter((row) => row.mn_dementia_care_licensed).length;

  return {
    totalCount,
    withDeficiency: withDeficiencyListed,
    findingsDate,
    firstPublishedAt,
    indexableFacilityCount,
    dementiaLicenseCount,
    fetchError: null,
  };
}
