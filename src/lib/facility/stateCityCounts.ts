import { quoteHomesOnPage } from "@/lib/city-hub/dedupe";
import { cityHubPageExists, facilityListedInSitemap } from "@/lib/seo/indexability";
import { displayCityName } from "@/lib/resolveListingRegion";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { todayIsoDate } from "@/lib/data/inspectionDates";

export type StateCityCount = { slug: string; name: string; count: number };

const PAGE_SIZE = 1000;
const INSP_CHUNK = 150;
const TTL_MS = 60 * 60 * 1000;
const memo = new Map<string, { at: number; cities: StateCityCount[] }>();

type FacRow = {
  id: string;
  city_slug: string | null;
  city: string | null;
  name: string | null;
  zip: string | null;
  beds: number | null;
};

async function listedCountByCity(
  stateCode: string,
  slugs?: string[],
): Promise<StateCityCount[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const rows: FacRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = supabase
      .from("facilities")
      .select("id, city_slug, city, name, zip, beds")
      .eq("state_code", stateCode)
      .eq("publishable", true)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (slugs && slugs.length > 0) q = q.in("city_slug", slugs);
    const { data, error } = await q;
    if (error) return [];
    const page = (data ?? []) as FacRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const ids = rows.map((r) => r.id);
  const inspCount = new Map<string, number>();
  const inspFac = new Map<string, string>();
  for (let ci = 0; ci < ids.length; ci += INSP_CHUNK) {
    const chunk = ids.slice(ci, ci + INSP_CHUNK);
    const { data, error } = await supabase
      .from("inspections")
      .select("id, facility_id")
      .in("facility_id", chunk)
      .lte("inspection_date", todayIsoDate())
      .limit(5000);
    if (error) break;
    for (const i of (data ?? []) as Array<{ id: string; facility_id: string }>) {
      inspFac.set(i.id, i.facility_id);
      inspCount.set(i.facility_id, (inspCount.get(i.facility_id) ?? 0) + 1);
    }
  }

  const withDef = new Set<string>();
  const inspIds = [...inspFac.keys()];
  for (let ci = 0; ci < inspIds.length; ci += INSP_CHUNK) {
    const chunk = inspIds.slice(ci, ci + INSP_CHUNK);
    const { data, error } = await supabase
      .from("deficiencies")
      .select("inspection_id")
      .in("inspection_id", chunk)
      .limit(5000);
    if (error) break;
    for (const d of (data ?? []) as Array<{ inspection_id: string }>) {
      const fid = inspFac.get(d.inspection_id);
      if (fid) withDef.add(fid);
    }
  }

  const listedByCity = new Map<string, FacRow[]>();
  for (const row of rows) {
    if (!row.city_slug) continue;
    if (
      !facilityListedInSitemap({
        stateCode,
        beds: row.beds,
        deficiencyCount: withDef.has(row.id) ? 1 : 0,
        inspectionCount: inspCount.get(row.id) ?? 0,
      })
    ) {
      continue;
    }
    const list = listedByCity.get(row.city_slug);
    if (list) list.push(row);
    else listedByCity.set(row.city_slug, [row]);
  }

  const byCity = new Map<string, StateCityCount>();
  for (const [slug, list] of listedByCity) {
    const quoted = quoteHomesOnPage(
      list.map((row) => ({
        id: row.id,
        name: row.name ?? "",
        zip: row.zip,
        inspections: inspCount.get(row.id) ?? 0,
        total_citations: withDef.has(row.id) ? 1 : 0,
      })),
      stateCode,
    );
    if (!cityHubPageExists(quoted.length)) continue;
    const nameRow = list.find((row) => row.city?.trim());
    byCity.set(slug, {
      slug,
      name: displayCityName(nameRow?.city, slug),
      count: quoted.length,
    });
  }

  return [...byCity.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Cities in a state ranked by listed homes (the same set a city page quotes).
 * Cached for an hour so nearby-city links do not re-read the whole state.
 */
export async function loadStateCityCounts(stateCode: string): Promise<StateCityCount[]> {
  const hit = memo.get(stateCode);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cities;
  const cities = await listedCountByCity(stateCode);
  memo.set(stateCode, { at: Date.now(), cities });
  return cities;
}

/** Listed counts for a known set of city slugs (sibling hubs in one county). */
export async function loadListedCountsForSlugs(
  stateCode: string,
  slugs: string[],
): Promise<Map<string, StateCityCount>> {
  if (slugs.length === 0) return new Map();
  const cities = await listedCountByCity(stateCode, slugs);
  return new Map(cities.map((c) => [c.slug, c]));
}
