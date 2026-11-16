import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import type { CostRow } from "@/lib/cost/costBand";

/**
 * Listed prices for homes, from `facility_costs` (migration 0074).
 * A failed read returns no rows, so a page shows no price and never a zero.
 */
export async function loadFacilityCosts(facilityIds: string[]): Promise<CostRow[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase || facilityIds.length === 0) return [];
  const { data, error } = await supabase.rpc("facility_costs", { p_facility_ids: facilityIds });
  if (error) {
    console.error("[facility-costs]", error.message);
    return [];
  }
  return (data ?? []) as CostRow[];
}
