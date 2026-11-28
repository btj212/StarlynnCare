import { countSeriousDeficiencies } from "@/lib/data/seriousDeficiencyCount";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { COVERED_STATES, stateFromCode } from "@/lib/states";
import { quoteHomesOnPage } from "@/lib/city-hub/dedupe";
import { AZ_SMALL_BED_LIMIT, cityHubPageExists, facilityListedOnHub } from "@/lib/seo/indexability";
import { loadLatestInspectionDates, todayIsoDate } from "@/lib/data/inspectionDates";

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

  // Facilities = publishable (the indexed set). Inspections = every parsed
  // report we hold, including unpublished homes — the card says "parsed and dated".
  const [facRes, inspRes, totalSevereCitations, refreshRes] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }).eq("publishable", true),
    supabase.from("inspections").select("*", { count: "exact", head: true }).lte("inspection_date", todayIsoDate()),
    countSeriousDeficiencies(supabase),
    supabase.from("facilities").select("updated_at").eq("publishable", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const totalFacilities = facRes.count ?? 0;
  const totalInspections = inspRes.count ?? 0;
  const lastUpdated = refreshRes.data?.updated_at as string | null;
  const lastRefreshed = lastUpdated ? new Date(lastUpdated).toISOString().split("T")[0] : null;

  // Per-state counts via HEAD requests (bypass 1000-row PostgREST cap).
  // City rows are fully paginated — a 5,000-row cap would drop ~571 homes.
  const COVERED_STATE_CODES = COVERED_STATES.map((s) => s.code);
  const [stateCountResults, cityRows] = await Promise.all([
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
    loadPublishableCityRows(supabase),
  ]);

  // Build per-state stats from exact HEAD counts
  const stateFacilityCounts = new Map<string, number>(
    stateCountResults.map(({ code, count }) => [code, count])
  );

  // Build city sets and leaderboard from paginated rows
  const stateCitySets = new Map<string, Set<string>>();
  const cityBuckets = new Map<string, { slug: string; name: string; count: number; stateCode: string }>();
  const listedByCity = new Map<string, CityRow[]>();
  const azSmallIds = cityRows
    .filter(
      (row) =>
        row.state_code === "AZ" &&
        row.beds != null &&
        row.beds <= AZ_SMALL_BED_LIMIT,
    )
    .map((row) => row.id);
  const azSmallCited = await azSmallCitationIds(supabase, azSmallIds);
  const waIds = cityRows.filter((row) => row.state_code === "WA").map((row) => row.id);
  const otherIds = cityRows.filter((row) => row.state_code !== "WA").map((row) => row.id);
  const [waDates, otherDates] = await Promise.all([
    loadLatestInspectionDates(supabase, waIds, { excludeComplaints: true }),
    loadLatestInspectionDates(supabase, otherIds),
  ]);
  const lastInspByFac = new Map([...otherDates, ...waDates]);

  for (const row of cityRows) {
    const code = row.state_code;
    const citySlug = row.city_slug;
    if (!code || !citySlug) continue;

    // Same listed set as the city page. A city with no listed home has no hub page.
    const listed = facilityListedOnHub({
      stateCode: code,
      beds: row.beds,
      deficiencyCount: azSmallCited.has(row.id) ? 1 : 0,
      inspectionCount: lastInspByFac.has(row.id) ? 1 : 0,
    });
    if (!listed) continue;

    const cityKey = `${code}:${citySlug}`;
    const list = listedByCity.get(cityKey);
    if (list) list.push(row);
    else listedByCity.set(cityKey, [row]);
  }

  for (const [, list] of listedByCity) {
    const code = list[0]?.state_code;
    const citySlug = list[0]?.city_slug;
    if (!code || !citySlug) continue;
    const quoted = quoteHomesOnPage(
      list.map((row) => ({
        id: row.id,
        name: row.name ?? "",
        zip: row.zip,
        inspections: 0,
        total_citations: 0,
      })),
      code,
    );
    if (!cityHubPageExists(quoted.length)) continue;

    if (!stateCitySets.has(code)) stateCitySets.set(code, new Set());
    stateCitySets.get(code)!.add(citySlug);

    cityBuckets.set(`${code}:${citySlug}`, {
      slug: citySlug,
      name: list.find((row) => row.city?.trim())?.city?.trim() || citySlug,
      count: quoted.length,
      stateCode: code,
    });
  }

  const topCities: NationalCityRow[] = Array.from(cityBuckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
    .map(({ slug, name, count, stateCode }) => {
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

type CityRow = {
  id: string;
  state_code: string;
  city_slug: string | null;
  city: string | null;
  name: string | null;
  zip: string | null;
  beds: number | null;
};

async function loadPublishableCityRows(
  supabase: NonNullable<ReturnType<typeof tryPublicSupabaseClient>>,
): Promise<CityRow[]> {
  const pageSize = 1000;
  const rows: CityRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("facilities")
      .select("id, state_code, city_slug, city, name, zip, beds")
      .eq("publishable", true)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("[nationalHome] city page failed:", error.message);
      break;
    }
    const page = (data ?? []) as CityRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/** AZ small homes with at least one cited inspection — needed for sitemap-listed city counts. */
async function azSmallCitationIds(
  supabase: NonNullable<ReturnType<typeof tryPublicSupabaseClient>>,
  facilityIds: string[],
): Promise<Set<string>> {
  const cited = new Set<string>();
  const chunkSize = 150;
  for (let i = 0; i < facilityIds.length; i += chunkSize) {
    const chunk = facilityIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("inspections")
      .select("facility_id, total_deficiency_count")
      .in("facility_id", chunk)
      .gt("total_deficiency_count", 0)
      .limit(5000);
    if (error) {
      console.error("[nationalHome] AZ citation probe failed:", error.message);
      continue;
    }
    for (const row of data ?? []) {
      const id = (row as { facility_id: string }).facility_id;
      if (id) cited.add(id);
    }
  }
  return cited;
}
