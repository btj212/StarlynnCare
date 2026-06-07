import type { SupabaseClient } from "@supabase/supabase-js";
import { regionFromSlug, type Region } from "@/lib/regions";
import { stateFromSlug, COVERED_STATES } from "@/lib/states";

/**
 * Resolve a listing hub (/[state]/[city]) from static regions first, then from
 * any city_slug in a covered state that has at least one publishable facility.
 *
 * The dynamic fallback exists because state regulator slugify (CDSS, HHSC, …)
 * can differ from our curated `regions.ts` city lists. We trust it because:
 *
 *   - we only fall back for slugs that resolve to a *publishable* row, and
 *   - we only fall back inside `COVERED_STATES`,
 *
 * so an uncovered state can never return a region from this path.
 */
export async function resolveListingRegion(
  stateSlug: string,
  regionSlug: string,
  supabase: SupabaseClient | null,
): Promise<Region | null> {
  const fromStatic = regionFromSlug(stateSlug, regionSlug);
  if (fromStatic) return fromStatic;

  const state = stateFromSlug(stateSlug);
  if (!state || !supabase) return null;
  const isCovered = COVERED_STATES.some((s) => s.code === state.code);
  if (!isCovered) return null;

  const slug = regionSlug.toLowerCase();
  const { data, error } = await supabase
    .from("facilities")
    .select("city")
    .eq("state_code", state.code)
    .eq("city_slug", slug)
    .eq("publishable", true)
    .limit(1)
    .maybeSingle();

  const row = data as { city: string | null } | null;
  if (error || !row?.city) return null;
  const city = row.city;

  return {
    slug,
    name: city,
    kind: "city",
    state,
    citySlugs: [slug],
  };
}
