import type { SupabaseClient } from "@supabase/supabase-js";
import { regionFromSlug, type Region } from "@/lib/regions";
import { stateFromSlug } from "@/lib/states";

/**
 * Resolve a listing hub (/[state]/[city]) from static regions first, then from
 * any California city_slug that has at least one publishable facility (CDSS
 * slugify can differ from our curated region lists).
 */
export async function resolveListingRegion(
  stateSlug: string,
  regionSlug: string,
  supabase: SupabaseClient | null,
): Promise<Region | null> {
  const fromStatic = regionFromSlug(stateSlug, regionSlug);
  if (fromStatic) return fromStatic;

  const state = stateFromSlug(stateSlug);
  if (!state || state.code !== "CA" || !supabase) return null;

  const slug = regionSlug.toLowerCase();
  const { data, error } = await supabase
    .from("facilities")
    .select("city")
    .eq("state_code", "CA")
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
