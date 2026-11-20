import { azSmallHomeWithoutCitations } from "@/lib/seo/indexability";
import { displayCityName } from "@/lib/resolveListingRegion";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

export type StateCityCount = { slug: string; name: string; count: number };

const PAGE_SIZE = 1000;
const TTL_MS = 60 * 60 * 1000;
const memo = new Map<string, { at: number; cities: StateCityCount[] }>();

/**
 * Cities in a state ranked by published homes, for "other cities" links.
 * Arizona homes of 10 beds or fewer are skipped: they are noindex unless they
 * have citations, and a city with only those has no indexable hub to link to.
 * Kept in memory for an hour so each city page does not re-read the state.
 */
export async function loadStateCityCounts(stateCode: string): Promise<StateCityCount[]> {
  const hit = memo.get(stateCode);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cities;

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const byCity = new Map<string, StateCityCount>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("facilities")
      .select("city_slug, city, beds")
      .eq("state_code", stateCode)
      .eq("publishable", true)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return [];

    const page = (data ?? []) as Array<{ city_slug: string | null; city: string | null; beds: number | null }>;
    for (const row of page) {
      if (!row.city_slug || azSmallHomeWithoutCitations(stateCode, row.beds, 0)) continue;
      const existing = byCity.get(row.city_slug);
      if (existing) existing.count += 1;
      else
        byCity.set(row.city_slug, {
          slug: row.city_slug,
          name: displayCityName(row.city, row.city_slug),
          count: 1,
        });
    }
    if (page.length < PAGE_SIZE) break;
  }

  const cities = [...byCity.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  memo.set(stateCode, { at: Date.now(), cities });
  return cities;
}
