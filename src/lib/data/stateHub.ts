import { regionsForState } from "@/lib/regions";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import type { HomeSampleFacility } from "@/components/home/homeSampleFacilityTypes";
import type { CareCategory } from "@/lib/types";
import { stateFromCode } from "@/lib/states";

/** §02 rotates through this many publishable facilities (hourly reshuffle). */
export const SAMPLE_CARD_ROTATION_COUNT = 10;

/** Deterministic shuffle — same cohort for the ~1h ISR window. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  const out = [...items];
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type CountyRow = {
  name: string;
  slug: string;
  count: number;
  cities: number;
};

export type CityRow = {
  name: string;
  slug: string;
  count: number;
  /** Populated by loadStateHubData / loadNationalHomeData to build correct href. */
  stateSlug?: string;
};

export type StateHubData = {
  stats: {
    facilities: number;
    inspections: number;
    severeCitations: number;
    lastRefreshed: string | null;
  };
  gradeCardFacilities: HomeSampleFacility[];
  counties: CountyRow[];
  topCities: CityRow[];
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

/** Legacy alias — CaliforniaStateHubData is identical to StateHubData. */
export type CaliforniaStateHubData = StateHubData;

/**
 * Loads homepage / California rich-hub data.
 * Mirrors legacy `loadHomeData` in `src/app/page.tsx` — global stats + CA county rollups + global city leaderboard + recent reviews.
 */
export async function loadCaliforniaStateHubData(): Promise<CaliforniaStateHubData> {
  const fallback: CaliforniaStateHubData = {
    stats: { facilities: 0, inspections: 0, severeCitations: 0, lastRefreshed: null },
    gradeCardFacilities: [],
    counties: [],
    topCities: [],
    sampleReviews: [],
  };

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return fallback;

  const [facRes, inspRes, sevRes, refreshRes] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }).eq("publishable", true).eq("state_code", "CA"),
    supabase.from("inspections").select("*", { count: "exact", head: true }),
    supabase.from("deficiencies").select("*", { count: "exact", head: true }).gte("severity", 3),
    supabase.from("facilities").select("updated_at").eq("publishable", true).eq("state_code", "CA").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const facilityCount = facRes.count ?? 0;
  const inspCount = inspRes.count ?? 0;
  const sevCount = sevRes.count ?? 0;
  const lastUpdated = refreshRes.data?.updated_at as string | null;
  const lastRefreshed = lastUpdated
    ? new Date(lastUpdated).toISOString().split("T")[0]
    : null;

  const { data: idRows } = await supabase
    .from("facilities")
    .select("id")
    .eq("publishable", true)
    .eq("state_code", "CA");

  const allIds = (idRows ?? []).map((r: { id: string }) => r.id);
  const hourSeed = Math.floor(Date.now() / 3600000);
  const pickedIds = seededShuffle(allIds, hourSeed).slice(0, SAMPLE_CARD_ROTATION_COUNT);

  let gradeCardFacilities: HomeSampleFacility[] = [];
  if (pickedIds.length > 0) {
    const { data: pickedRows } = await supabase
      .from("facilities")
      .select(
        "id, name, city, state_code, slug, city_slug, license_number, beds, care_category",
      )
      .in("id", pickedIds);

    const rowById = new Map(
      (pickedRows ?? []).map((r) => [r.id as string, r]),
    );
    const ordered = pickedIds
      .map((id) => rowById.get(id))
      .filter((r): r is NonNullable<typeof r> => r != null);

    gradeCardFacilities = (
      await Promise.all(
        ordered.map(async (picked) => {
          const { data: snap } = await supabase.rpc("facility_snapshot", {
            p_facility_id: picked.id,
          });
          const s = snap as null | {
            grade?: { letter: string; composite_percentile: number } | null;
            metrics?: {
              severity: { percentile: number };
              repeats: { percentile: number };
              frequency: { percentile: number };
            } | null;
          };
          return {
            ...picked,
            care_category: picked.care_category as CareCategory,
            grade: s?.grade?.letter ?? null,
            composite: s?.grade?.composite_percentile ?? null,
            sev_pct: s?.metrics?.severity?.percentile ?? null,
            rep_pct: s?.metrics?.repeats?.percentile ?? null,
            freq_pct: s?.metrics?.frequency?.percentile ?? null,
          } satisfies HomeSampleFacility;
        }),
      )
    ).filter(Boolean);
  }

  const { data: tierRows } = await supabase
    .from("facilities")
    .select("city_slug, capacity_tier")
    .eq("state_code", "CA")
    .eq("publishable", true);

  const countsByCity = new Map<string, number>();
  const smallCountsByCity = new Map<string, number>();
  for (const row of tierRows ?? []) {
    const slug = (row as { city_slug: string | null }).city_slug ?? "";
    const tier =
      (row as { capacity_tier: string | null }).capacity_tier ?? "unknown";
    if (!slug) continue;
    if (tier === "small") {
      smallCountsByCity.set(slug, (smallCountsByCity.get(slug) ?? 0) + 1);
    } else {
      countsByCity.set(slug, (countsByCity.get(slug) ?? 0) + 1);
    }
  }

  const counties: CountyRow[] = regionsForState("CA")
    .filter((r) => r.kind === "county")
    .map((region) => {
      const nMediumPlus = region.citySlugs.reduce(
        (acc, s) => acc + (countsByCity.get(s) ?? 0),
        0,
      );
      const nSmall = region.citySlugs.reduce(
        (acc, s) => acc + (smallCountsByCity.get(s) ?? 0),
        0,
      );
      const citiesWithData = region.citySlugs.filter(
        (s) =>
          (countsByCity.get(s) ?? 0) > 0 ||
          (smallCountsByCity.get(s) ?? 0) > 0,
      ).length;
      return {
        name: region.name,
        slug: region.slug,
        count: nMediumPlus + nSmall,
        cities: citiesWithData,
      };
    })
    .filter((c) => c.count > 0);

  const { data: cityRows } = await supabase
    .from("facilities")
    .select("city, city_slug")
    .eq("publishable", true)
    .eq("state_code", "CA");

  const cityMap = new Map<string, { name: string; slug: string; count: number }>();
  for (const r of cityRows ?? []) {
    if (!r.city_slug) continue;
    const existing = cityMap.get(r.city_slug);
    if (existing) { existing.count++; }
    else { cityMap.set(r.city_slug, { name: r.city ?? r.city_slug, slug: r.city_slug, count: 1 }); }
  }
  const topCities = Array.from(cityMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, body, rating, reviewer_name, created_at, facility_id")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(3);

  const sampleReviews: CaliforniaStateHubData["sampleReviews"] = [];
  for (const r of reviewRows ?? []) {
    const { data: fac } = await supabase
      .from("facilities")
      .select("name, city")
      .eq("id", r.facility_id)
      .single();
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

  return {
    stats: { facilities: facilityCount, inspections: inspCount, severeCitations: sevCount, lastRefreshed },
    gradeCardFacilities,
    counties,
    topCities,
    sampleReviews,
  };
}

/**
 * Generic state hub data loader.
 * Mirrors loadCaliforniaStateHubData but scoped to any state via stateCode.
 */
export async function loadStateHubData(stateCode: string): Promise<StateHubData> {
  const stateSlug = stateFromCode(stateCode)?.slug ?? stateCode.toLowerCase();
  const fallback: StateHubData = {
    stats: { facilities: 0, inspections: 0, severeCitations: 0, lastRefreshed: null },
    gradeCardFacilities: [],
    counties: [],
    topCities: [],
    sampleReviews: [],
  };

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return fallback;

  const [facRes, refreshRes, idRes] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }).eq("publishable", true).eq("state_code", stateCode),
    supabase.from("facilities").select("updated_at").eq("publishable", true).eq("state_code", stateCode).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("facilities").select("id").eq("publishable", true).eq("state_code", stateCode),
  ]);

  const facilityCount = facRes.count ?? 0;
  const lastUpdated = refreshRes.data?.updated_at as string | null;
  const lastRefreshed = lastUpdated ? new Date(lastUpdated).toISOString().split("T")[0] : null;

  const idRows = idRes.data ?? [];
  const allIds = idRows.map((r: { id: string }) => r.id);

  // Fetch inspection count scoped to this state's facilities
  let inspCount = 0;
  let sevCount = 0;
  if (allIds.length > 0) {
    const { count: ic } = await supabase
      .from("inspections")
      .select("*", { count: "exact", head: true })
      .in("facility_id", allIds);
    inspCount = ic ?? 0;

    // Count severe deficiencies via inspection IDs for this state
    const { data: inspIdRows } = await supabase
      .from("inspections")
      .select("id")
      .in("facility_id", allIds);
    const inspIds = (inspIdRows ?? []).map((r: { id: string }) => r.id);
    if (inspIds.length > 0) {
      const { count: sc } = await supabase
        .from("deficiencies")
        .select("*", { count: "exact", head: true })
        .in("inspection_id", inspIds)
        .gte("severity", 3);
      sevCount = sc ?? 0;
    }
  }

  const hourSeed = Math.floor(Date.now() / 3600000);
  const pickedIds = seededShuffle(allIds, hourSeed).slice(0, SAMPLE_CARD_ROTATION_COUNT);

  let gradeCardFacilities: HomeSampleFacility[] = [];
  if (pickedIds.length > 0) {
    const { data: pickedRows } = await supabase
      .from("facilities")
      .select("id, name, city, state_code, slug, city_slug, license_number, beds, care_category")
      .in("id", pickedIds);

    const rowById = new Map((pickedRows ?? []).map((r) => [r.id as string, r]));
    const ordered = pickedIds.map((id) => rowById.get(id)).filter((r): r is NonNullable<typeof r> => r != null);

    gradeCardFacilities = (
      await Promise.all(
        ordered.map(async (picked) => {
          const { data: snap } = await supabase.rpc("facility_snapshot", { p_facility_id: picked.id });
          const s = snap as null | {
            grade?: { letter: string; composite_percentile: number } | null;
            metrics?: { severity: { percentile: number }; repeats: { percentile: number }; frequency: { percentile: number } } | null;
          };
          return {
            ...picked,
            care_category: picked.care_category as CareCategory,
            grade: s?.grade?.letter ?? null,
            composite: s?.grade?.composite_percentile ?? null,
            sev_pct: s?.metrics?.severity?.percentile ?? null,
            rep_pct: s?.metrics?.repeats?.percentile ?? null,
            freq_pct: s?.metrics?.frequency?.percentile ?? null,
          } satisfies HomeSampleFacility;
        }),
      )
    ).filter(Boolean);
  }

  const { data: tierRows } = await supabase
    .from("facilities")
    .select("city_slug, capacity_tier")
    .eq("state_code", stateCode)
    .eq("publishable", true);

  const countsByCity = new Map<string, number>();
  const smallCountsByCity = new Map<string, number>();
  for (const row of tierRows ?? []) {
    const slug = (row as { city_slug: string | null }).city_slug ?? "";
    const tier = (row as { capacity_tier: string | null }).capacity_tier ?? "unknown";
    if (!slug) continue;
    if (tier === "small") {
      smallCountsByCity.set(slug, (smallCountsByCity.get(slug) ?? 0) + 1);
    } else {
      countsByCity.set(slug, (countsByCity.get(slug) ?? 0) + 1);
    }
  }

  const counties: CountyRow[] = regionsForState(stateCode)
    .filter((r) => r.kind === "county")
    .map((region) => {
      const nMediumPlus = region.citySlugs.reduce((acc, s) => acc + (countsByCity.get(s) ?? 0), 0);
      const nSmall = region.citySlugs.reduce((acc, s) => acc + (smallCountsByCity.get(s) ?? 0), 0);
      const citiesWithData = region.citySlugs.filter(
        (s) => (countsByCity.get(s) ?? 0) > 0 || (smallCountsByCity.get(s) ?? 0) > 0,
      ).length;
      return { name: region.name, slug: region.slug, count: nMediumPlus + nSmall, cities: citiesWithData };
    })
    .filter((c) => c.count > 0);

  const { data: cityRows } = await supabase
    .from("facilities")
    .select("city, city_slug")
    .eq("publishable", true)
    .eq("state_code", stateCode);

  const cityMap = new Map<string, { name: string; slug: string; count: number }>();
  for (const r of cityRows ?? []) {
    if (!r.city_slug) continue;
    const existing = cityMap.get(r.city_slug);
    if (existing) { existing.count++; }
    else { cityMap.set(r.city_slug, { name: r.city ?? r.city_slug, slug: r.city_slug, count: 1 }); }
  }
  const topCities: CityRow[] = Array.from(cityMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
    .map((c) => ({ ...c, stateSlug }));

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, body, rating, reviewer_name, created_at, facility_id")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(3);

  const sampleReviews: StateHubData["sampleReviews"] = [];
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

  return { stats: { facilities: facilityCount, inspections: inspCount, severeCitations: sevCount, lastRefreshed }, gradeCardFacilities, counties, topCities, sampleReviews };
}

export function getSeasonAndYear(): { season: string; year: number } {
  const m = new Date().getMonth();
  let season = "Fall";
  if (m < 3) season = "Winter";
  else if (m < 6) season = "Spring";
  else if (m < 9) season = "Summer";
  return { season, year: new Date().getFullYear() };
}
