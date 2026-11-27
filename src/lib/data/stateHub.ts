import { quoteHomesOnPage } from "@/lib/city-hub/dedupe";
import { regionsForState } from "@/lib/regions";
import { cityHubPageExists } from "@/lib/seo/indexability";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import type { HomeSampleFacility } from "@/components/home/homeSampleFacilityTypes";
import type { CareCategory } from "@/lib/types";
import { stateFromCode } from "@/lib/states";
import { todayIsoDate } from "@/lib/data/inspectionDates";

/** §02 rotates through this many publishable facilities (hourly reshuffle). */
export const SAMPLE_CARD_ROTATION_COUNT = 10;

type PublishableCityRow = {
  id: string;
  name: string | null;
  zip: string | null;
  city: string | null;
  city_slug: string | null;
  capacity_tier: string | null;
};

/**
 * Every publishable home's city, past PostgREST's 1000-row cap. An unpaged
 * select was why Arizona city cards (Mesa) showed a partial count.
 */
export async function loadPublishableCityRows(
  supabase: NonNullable<ReturnType<typeof tryPublicSupabaseClient>>,
  stateCode: string,
): Promise<{ rows: PublishableCityRow[]; error: string | null }> {
  const pageSize = 1000;
  const rows: PublishableCityRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("facilities")
      .select("id, name, zip, city, city_slug, capacity_tier")
      .eq("state_code", stateCode)
      .eq("publishable", true)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) return { rows, error: error.message };
    const page = (data ?? []) as PublishableCityRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return { rows, error: null };
}

function asQuotedHome(row: PublishableCityRow) {
  return {
    ...row,
    name: row.name ?? "",
    inspections: 0,
    total_citations: 0,
  };
}

/** Homes a city or county page lists, so a card count matches that page. */
function quotedRows(rows: PublishableCityRow[], stateCode: string): PublishableCityRow[] {
  return quoteHomesOnPage(rows.map(asQuotedHome), stateCode);
}

function cityTallies(
  rows: PublishableCityRow[],
  stateCode: string,
): Map<string, { name: string; slug: string; count: number }> {
  const bySlug = new Map<string, PublishableCityRow[]>();
  for (const row of rows) {
    const slug = row.city_slug ?? "";
    if (!slug) continue;
    const list = bySlug.get(slug);
    if (list) list.push(row);
    else bySlug.set(slug, [row]);
  }

  const cityMap = new Map<string, { name: string; slug: string; count: number }>();
  for (const [slug, list] of bySlug) {
    const quoted = quotedRows(list, stateCode);
    if (!cityHubPageExists(quoted.length)) continue;
    const name = quoted.find((row) => row.city?.trim())?.city?.trim() || slug;
    cityMap.set(slug, { name, slug, count: quoted.length });
  }
  return cityMap;
}

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
    firstPublishedAt: string | null;
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
    stats: { facilities: 0, inspections: 0, severeCitations: 0, lastRefreshed: null, firstPublishedAt: null },
    gradeCardFacilities: [],
    counties: [],
    topCities: [],
    sampleReviews: [],
  };

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return fallback;

  const [facRes, inspRes, sevRes, refreshRes, firstRes] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }).eq("publishable", true).eq("state_code", "CA"),
    supabase.from("inspections").select("*", { count: "exact", head: true }),
    supabase.from("deficiencies").select("*", { count: "exact", head: true }).gte("severity", 3),
    supabase.from("facilities").select("updated_at").eq("publishable", true).eq("state_code", "CA").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("facilities").select("created_at").eq("publishable", true).eq("state_code", "CA").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const facilityCount = facRes.count ?? 0;
  const inspCount = inspRes.count ?? 0;
  const sevCount = sevRes.count ?? 0;
  const lastUpdated = refreshRes.data?.updated_at as string | null;
  const lastRefreshed = lastUpdated
    ? new Date(lastUpdated).toISOString().split("T")[0]
    : null;
  const firstCreated = firstRes.data?.created_at as string | null;
  const firstPublishedAt = firstCreated ? new Date(firstCreated).toISOString() : null;

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

  const { rows: citySourceRows } = await loadPublishableCityRows(supabase, "CA");
  const cityMap = cityTallies(citySourceRows, "CA");

  const counties: CountyRow[] = regionsForState("CA")
    .filter((r) => r.kind === "county")
    .map((region) => {
      const slugSet = new Set(region.citySlugs);
      const count = quotedRows(
        citySourceRows.filter((row) => row.city_slug && slugSet.has(row.city_slug)),
        "CA",
      ).length;
      const citiesWithData = region.citySlugs.filter((s) => cityMap.has(s)).length;
      return {
        name: region.name,
        slug: region.slug,
        count,
        cities: citiesWithData,
      };
    })
    .filter((c) => cityHubPageExists(c.count));

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
    stats: { facilities: facilityCount, inspections: inspCount, severeCitations: sevCount, lastRefreshed, firstPublishedAt },
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
    stats: { facilities: 0, inspections: 0, severeCitations: 0, lastRefreshed: null, firstPublishedAt: null },
    gradeCardFacilities: [],
    counties: [],
    topCities: [],
    sampleReviews: [],
  };

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return fallback;

  const [facRes, refreshRes, firstRes, idRes] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }).eq("publishable", true).eq("state_code", stateCode),
    supabase.from("facilities").select("updated_at").eq("publishable", true).eq("state_code", stateCode).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("facilities").select("created_at").eq("publishable", true).eq("state_code", stateCode).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("facilities").select("id").eq("publishable", true).eq("state_code", stateCode),
  ]);

  const facilityCount = facRes.count ?? 0;
  const lastUpdated = refreshRes.data?.updated_at as string | null;
  const lastRefreshed = lastUpdated ? new Date(lastUpdated).toISOString().split("T")[0] : null;
  const firstCreated = firstRes.data?.created_at as string | null;
  const firstPublishedAt = firstCreated ? new Date(firstCreated).toISOString() : null;

  const idRows = idRes.data ?? [];
  const allIds = idRows.map((r: { id: string }) => r.id);

  // Chunk helper — PostgREST .in() is URL-encoded; batching avoids length limits
  // when a state has many facilities (e.g. AZ with 1,900+).
  function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // Fetch inspection count scoped to this state's facilities
  let inspCount = 0;
  let sevCount = 0;
  if (allIds.length > 0) {
    const ID_BATCH = 200;
    const idChunks = chunk(allIds, ID_BATCH);

    const inspCounts = await Promise.all(
      idChunks.map((ids) =>
        supabase
          .from("inspections")
          .select("*", { count: "exact", head: true })
          .in("facility_id", ids)
          .lte("inspection_date", todayIsoDate())
          .then((r) => r.count ?? 0)
      )
    );
    inspCount = inspCounts.reduce((s, n) => s + n, 0);

    // Severe deficiencies in last 24 months, chunked the same way
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 24);
    const cutoff = cutoffDate.toISOString().split("T")[0];

    const inspIdArrays = await Promise.all(
      idChunks.map((ids) =>
        supabase
          .from("inspections")
          .select("id")
          .in("facility_id", ids)
          .gte("inspection_date", cutoff)
          .lte("inspection_date", todayIsoDate())
          .then((r) => (r.data ?? []).map((row: { id: string }) => row.id))
      )
    );
    const inspIds = inspIdArrays.flat();

    if (inspIds.length > 0) {
      const inspIdChunks = chunk(inspIds, ID_BATCH);
      const sevCounts = await Promise.all(
        inspIdChunks.map((ids) =>
          supabase
            .from("deficiencies")
            .select("*", { count: "exact", head: true })
            .in("inspection_id", ids)
            .gte("severity", 3)
            .then((r) => r.count ?? 0)
        )
      );
      sevCount = sevCounts.reduce((s, n) => s + n, 0);
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

  const { rows: citySourceRows } = await loadPublishableCityRows(supabase, stateCode);
  const cityMap = cityTallies(citySourceRows, stateCode);

  const counties: CountyRow[] = regionsForState(stateCode)
    .filter((r) => r.kind === "county")
    .map((region) => {
      const slugSet = new Set(region.citySlugs);
      const count = quotedRows(
        citySourceRows.filter((row) => row.city_slug && slugSet.has(row.city_slug)),
        stateCode,
      ).length;
      const citiesWithData = region.citySlugs.filter((s) => cityMap.has(s)).length;
      return { name: region.name, slug: region.slug, count, cities: citiesWithData };
    })
    .filter((c) => cityHubPageExists(c.count));

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

  return { stats: { facilities: facilityCount, inspections: inspCount, severeCitations: sevCount, lastRefreshed, firstPublishedAt }, gradeCardFacilities, counties, topCities, sampleReviews };
}

export function getSeasonAndYear(): { season: string; year: number } {
  const m = new Date().getMonth();
  let season = "Fall";
  if (m < 3) season = "Winter";
  else if (m < 6) season = "Spring";
  else if (m < 9) season = "Summer";
  return { season, year: new Date().getFullYear() };
}
