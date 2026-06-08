import { countSeriousDeficiencies } from "@/lib/data/seriousDeficiencyCount";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { COVERED_STATES, stateFromCode } from "@/lib/states";

export type NationalStateSummary = {
  stateSlug: string;
  stateCode: string;
  stateName: string;
  facilityCount: number;
  cityCount: number;
};

export type NationalCityRow = {
  name: string;
  slug: string;
  count: number;
  stateSlug: string;
  stateCode: string;
};

export type NationalHomeData = {
  totalFacilities: number;
  totalInspections: number;
  totalSevereCitations: number;
  lastRefreshed: string | null;
  states: NationalStateSummary[];
  topCities: NationalCityRow[];
  sampleReviews: Array<{
    id: string;
    body: string;
    rating: number;
    reviewer_name: string | null;
    facility_name: string | null;
    facility_city: string | null;
    created_at: string;
  }>;
};

/**
 * Loads data for the national homepage.
 * - Total counts across all covered states.
 * - Per-state facility + city counts for the "States we cover" grid.
 * - Top 24 cities globally with correct state slug for link generation.
 */
export async function loadNationalHomeData(): Promise<NationalHomeData> {
  const fallback: NationalHomeData = {
    totalFacilities: 0,
    totalInspections: 0,
    totalSevereCitations: 0,
    lastRefreshed: null,
    states: COVERED_STATES.map((s) => ({
      stateSlug: s.slug,
      stateCode: s.code,
      stateName: s.name,
      facilityCount: 0,
      cityCount: 0,
    })),
    topCities: [],
    sampleReviews: [],
  };

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return fallback;

  // Global counts — serious deficiencies via RPC (join + 6-month window in Postgres).
  const [facRes, inspRes, totalSevereCitations, refreshRes] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }).eq("publishable", true),
    supabase.from("inspections").select("*", { count: "exact", head: true }),
    countSeriousDeficiencies(supabase),
    supabase.from("facilities").select("updated_at").eq("publishable", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const totalFacilities = facRes.count ?? 0;
  const totalInspections = inspRes.count ?? 0;
  const lastUpdated = refreshRes.data?.updated_at as string | null;
  const lastRefreshed = lastUpdated ? new Date(lastUpdated).toISOString().split("T")[0] : null;

  // Per-state counts via HEAD requests (bypass 1000-row PostgREST cap),
  // plus paginated city-slug query covering up to 5000 rows.
  const COVERED_STATE_CODES = COVERED_STATES.map((s) => s.code);
  const [stateCountResults, citySlugResult] = await Promise.all([
    Promise.all(
      COVERED_STATE_CODES.map((code) =>
        supabase
          .from("facilities")
          .select("*", { count: "exact", head: true })
          .eq("publishable", true)
          .eq("state_code", code)
          .then((r) => ({ code, count: r.count ?? 0 }))
      )
    ),
    supabase
      .from("facilities")
      .select("state_code, city_slug")
      .eq("publishable", true)
      .range(0, 4999),
  ]);

  // Build per-state stats from exact HEAD counts
  const stateFacilityCounts = new Map<string, number>(
    stateCountResults.map(({ code, count }) => [code, count])
  );

  // Build city sets and leaderboard from paginated rows
  const stateCitySets = new Map<string, Set<string>>();
  // city_slug -> { stateCode, count }
  const cityBuckets = new Map<string, { name: string; count: number; stateCode: string }>();

  for (const row of citySlugResult.data ?? []) {
    const code = (row as { state_code: string; city_slug: string | null }).state_code;
    const citySlug = (row as { state_code: string; city_slug: string | null }).city_slug;
    if (!code) continue;

    if (citySlug) {
      if (!stateCitySets.has(code)) stateCitySets.set(code, new Set());
      stateCitySets.get(code)!.add(citySlug);

      // Track cities globally — first state encountered "owns" the city
      const existing = cityBuckets.get(citySlug);
      if (existing) {
        existing.count++;
      } else {
        cityBuckets.set(citySlug, { name: citySlug, count: 1, stateCode: code });
      }
    }
  }

  // Resolve city names from a separate query (only top candidates to keep it fast)
  const topCitySlugs = Array.from(cityBuckets.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 50)
    .map(([slug]) => slug);

  if (topCitySlugs.length > 0) {
    const { data: nameRows } = await supabase
      .from("facilities")
      .select("city_slug, city, state_code")
      .in("city_slug", topCitySlugs)
      .eq("publishable", true);

    for (const r of nameRows ?? []) {
      const slug = (r as { city_slug: string; city: string | null; state_code: string }).city_slug;
      const cityName = (r as { city_slug: string; city: string | null; state_code: string }).city;
      if (slug && cityName) {
        const bucket = cityBuckets.get(slug);
        if (bucket && bucket.name === slug) {
          bucket.name = cityName;
        }
      }
    }
  }

  const topCities: NationalCityRow[] = Array.from(cityBuckets.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 24)
    .map(([slug, { name, count, stateCode }]) => {
      const stateInfo = stateFromCode(stateCode);
      return {
        name,
        slug,
        count,
        stateCode,
        stateSlug: stateInfo?.slug ?? stateCode.toLowerCase(),
      };
    });

  // Build state summaries
  const states: NationalStateSummary[] = COVERED_STATES.map((s) => ({
    stateSlug: s.slug,
    stateCode: s.code,
    stateName: s.name,
    facilityCount: stateFacilityCounts.get(s.code) ?? 0,
    cityCount: stateCitySets.get(s.code)?.size ?? 0,
  }));

  // Sample reviews
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, body, rating, reviewer_name, created_at, facility_id")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(3);

  const sampleReviews: NationalHomeData["sampleReviews"] = [];
  for (const r of reviewRows ?? []) {
    const { data: fac } = await supabase.from("facilities").select("name, city").eq("id", r.facility_id).single();
    sampleReviews.push({
      id: r.id,
      body: r.body,
      rating: r.rating,
      reviewer_name: r.reviewer_name ?? null,
      facility_name: fac?.name ?? null,
      facility_city: fac?.city ?? null,
      created_at: r.created_at,
    });
  }

  return { totalFacilities, totalInspections, totalSevereCitations, lastRefreshed, states, topCities, sampleReviews };
}
