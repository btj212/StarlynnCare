import type { SupabaseClient } from "@supabase/supabase-js";
import type { Region } from "@/lib/regions";

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
}> {
  const { data: facRows, error: facErr } = await supabase
    .from("facilities")
    .select("id, updated_at")
    .eq("state_code", region.state.code)
    .eq("publishable", true)
    .in("city_slug", region.citySlugs as unknown as string[]);

  if (facErr) {
    console.error("[loadRegionHubSummary] facilities:", facErr.message);
    return { totalCount: 0, withDeficiency: 0, findingsDate: null };
  }

  const facilityIds = (facRows ?? []).map((r: { id: string }) => r.id);
  const totalCount = facilityIds.length;

  let mostRecent: number = 0;
  for (const r of facRows ?? []) {
    const ts = (r as { updated_at: string | null }).updated_at;
    if (!ts) continue;
    const t = new Date(ts).getTime();
    if (t > mostRecent) mostRecent = t;
  }
  const findingsDate =
    mostRecent > 0 ? new Date(mostRecent).toISOString().split("T")[0] : null;

  if (totalCount === 0) {
    return { totalCount: 0, withDeficiency: 0, findingsDate };
  }

  const { data: inspRows } = await supabase
    .from("inspections")
    .select("id, facility_id")
    .in("facility_id", facilityIds);

  const inspFacMap = new Map<string, string>();
  for (const i of (inspRows ?? []) as Array<{ id: string; facility_id: string }>) {
    inspFacMap.set(i.id, i.facility_id);
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
      break;
    }
    for (const d of (defRows ?? []) as Array<{ inspection_id: string }>) {
      const fid = inspFacMap.get(d.inspection_id);
      if (fid) facilitiesWithAnyDef.add(fid);
    }
  }

  return {
    totalCount,
    withDeficiency: facilitiesWithAnyDef.size,
    findingsDate,
  };
}
