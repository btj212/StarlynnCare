/**
 * Read-only query helpers for PA insights editorial pages.
 * Backed by 3 SECURITY DEFINER RPCs created in migration 0046_pa_insights_rpcs.sql.
 * All are STABLE — results are ISR-cached for 1h on story pages.
 *
 * Column names confirmed against DB: beds (not licensed_beds), severity (1–4),
 * state_severity_raw, IJ = state_severity_raw='Immediate Jeopardy'.
 */
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { canonicalFor } from "@/lib/seo/canonical";
import { facilityCounty, normalizeCountyName } from "@/lib/geo/displayCounty";

export const PA_DATA_SOURCE = "PA DHS OLTL";
export const PA_DATA_WINDOW = "inspection record 2002–2026";
/** ISO date string for "data as of" stamps — update when a major ingest runs. */
export const PA_DATA_AS_OF = "2026-06-07";

export type PaTopIjFacility = {
  name: string;
  beds: number | null;
  county: string | null;
  citySlug: string;
  slug: string;
  profileUrl: string;
  ijCount: number;
  severeCount: number;
  totalDeficiencies: number;
};

export type PaCountyStat = {
  county: string;
  facilities: number;
  ijTotal: number;
  severeTotal: number;
  deficienciesTotal: number;
  defPerFacility: number;
};

export type PaBedTierStat = {
  tier: "small" | "medium" | "large" | "xl";
  label: string;
  n: number;
  avgSevere: number;
};

const BED_TIER_LABELS: Record<string, string> = {
  small: "Small\n< 20 beds",
  medium: "Medium\n20–49 beds",
  large: "Large\n50–99 beds",
  xl: "XL\n100+ beds",
};

/**
 * Top PA facilities by immediate-jeopardy finding count.
 * Calls pa_top_ij_facilities RPC (migration 0046).
 */
export async function loadTopFacilitiesByImmediateJeopardy(
  limit = 10,
): Promise<PaTopIjFacility[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("pa_top_ij_facilities", {
    p_limit: limit,
  });

  if (error || !data) return [];

  const rows = (
    data as Array<{
      name: string;
      beds: number | null;
      county: string | null;
      city_slug: string;
      slug: string;
      ij_count: number;
      severe_count: number;
      total_deficiencies: number;
    }>
  ).map((r) => ({
    name: r.name,
    beds: r.beds,
    county: r.county,
    citySlug: r.city_slug,
    slug: r.slug,
    profileUrl: canonicalFor(`/pennsylvania/${r.city_slug}/${r.slug}`),
    ijCount: Number(r.ij_count),
    severeCount: Number(r.severe_count),
    totalDeficiencies: Number(r.total_deficiencies),
  }));
  return overlayPaCounties(rows);
}

async function overlayPaCounties(rows: PaTopIjFacility[]): Promise<PaTopIjFacility[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase || rows.length === 0) {
    return rows.map((r) => ({ ...r, county: normalizeCountyName(r.county) }));
  }
  const { data } = await supabase
    .from("facilities")
    .select("slug, city_slug, county, wa_county")
    .eq("state_code", "PA")
    .eq("publishable", true)
    .in(
      "slug",
      rows.map((r) => r.slug),
    );
  const byKey = new Map(
    ((data ?? []) as Array<{
      slug: string;
      city_slug: string;
      county: string | null;
      wa_county: string | null;
    }>).map((r) => [`${r.city_slug}/${r.slug}`, facilityCounty(r)]),
  );
  return rows.map((r) => ({
    ...r,
    county: byKey.get(`${r.citySlug}/${r.slug}`) ?? normalizeCountyName(r.county),
  }));
}

/**
 * Deficiency stats aggregated by county, for PA counties with 5+ publishable facilities.
 * Calls pa_county_deficiency_stats RPC (migration 0046).
 */
export async function loadCountyDeficiencyStats(): Promise<PaCountyStat[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("pa_county_deficiency_stats");

  if (error || !data) return [];

  const merged = new Map<string, PaCountyStat>();
  for (const r of data as Array<{
    county: string;
    facilities: number;
    ij_total: number;
    severe_total: number;
    deficiencies_total: number;
    def_per_facility: number;
  }>) {
    const county = normalizeCountyName(r.county) ?? r.county;
    const existing = merged.get(county);
    const facilities = Number(r.facilities);
    const ijTotal = Number(r.ij_total);
    const severeTotal = Number(r.severe_total);
    const deficienciesTotal = Number(r.deficiencies_total);
    if (!existing) {
      merged.set(county, {
        county,
        facilities,
        ijTotal,
        severeTotal,
        deficienciesTotal,
        defPerFacility: Number(r.def_per_facility),
      });
      continue;
    }
    const nextFacilities = existing.facilities + facilities;
    const nextDefs = existing.deficienciesTotal + deficienciesTotal;
    merged.set(county, {
      county,
      facilities: nextFacilities,
      ijTotal: existing.ijTotal + ijTotal,
      severeTotal: existing.severeTotal + severeTotal,
      deficienciesTotal: nextDefs,
      defPerFacility: nextFacilities > 0 ? nextDefs / nextFacilities : 0,
    });
  }
  return [...merged.values()];
}

/**
 * Average severe findings per facility, grouped by bed-size tier.
 * Calls pa_bed_tier_severity RPC (migration 0046).
 * Returns tiers in ascending severity order (small → xl).
 */
export async function loadBedTierSeverity(): Promise<PaBedTierStat[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("pa_bed_tier_severity");

  if (error || !data) return [];

  const tierOrder = ["small", "medium", "large", "xl"];
  const rows = (
    data as Array<{ tier: string; n: number; avg_severe: number }>
  ).map((r) => ({
    tier: r.tier as PaBedTierStat["tier"],
    label: BED_TIER_LABELS[r.tier] ?? r.tier,
    n: Number(r.n),
    avgSevere: Number(r.avg_severe),
  }));

  return rows.sort(
    (a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier),
  );
}
