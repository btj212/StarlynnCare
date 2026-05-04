import type { SupabaseClient } from "@supabase/supabase-js";
import type { Region } from "@/lib/regions";

/**
 * Exact publishable facility count for a listing region (matches hub page query).
 */
export async function countPublishableFacilitiesInRegion(
  supabase: SupabaseClient,
  region: Region,
): Promise<number> {
  const { count, error } = await supabase
    .from("facilities")
    .select("*", { count: "exact", head: true })
    .eq("state_code", region.state.code)
    .eq("publishable", true)
    .in("city_slug", region.citySlugs as unknown as string[]);

  if (error) {
    console.error("[regionsHubCount]", error.message);
    return -1;
  }
  return count ?? 0;
}
