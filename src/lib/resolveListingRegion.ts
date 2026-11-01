import type { SupabaseClient } from "@supabase/supabase-js";
import { regionFromSlug, type Region } from "@/lib/regions";
import { stateFromSlug } from "@/lib/states";

const CITY_SMALL_WORDS = new Set(["of", "the", "and", "de", "del", "la", "las", "los"]);

/** Title-case a stored city only when the regulator file is all capitals. */
export function displayCityName(name: string | null | undefined, slug?: string | null): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return slug ? titleFromCitySlug(slug) : "";
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return trimmed.replace(/\.+$/, "");
  return titleCaseCity(trimmed);
}

function titleFromCitySlug(slug: string): string {
  return titleCaseCity(slug.replace(/-/g, " "));
}

function titleCaseCity(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (word === "st." || word === "st") return "St.";
      if (index > 0 && CITY_SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Resolve a listing hub (/[state]/[city]) from static regions first, then from
 * any city_slug in a covered state that has at least one publishable facility.
 *
 * The dynamic fallback exists because state regulator slugify (CDSS, HHSC, …)
 * can differ from our curated `regions.ts` city lists. We trust it because:
 *
 *   - we only fall back for slugs that resolve to a *publishable* row, and
 *   - the state slug has to be one we already route (`STATES`).
 *
 * Homepage, footer, and the facility sitemap still wait for `COVERED_STATES`.
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
    name: displayCityName(city, slug),
    kind: "city",
    state,
    citySlugs: [slug],
  };
}
