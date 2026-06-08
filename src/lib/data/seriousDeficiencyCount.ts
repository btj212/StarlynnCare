import type { SupabaseClient } from "@supabase/supabase-js";

/** Lookback window for the national homepage severe-deficiency stat. */
export const SERIOUS_DEFICIENCY_LOOKBACK_MONTHS = 6;

export function seriousDeficiencyCutoffDate(
  months = SERIOUS_DEFICIENCY_LOOKBACK_MONTHS,
): string {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff.toISOString().split("T")[0];
}

/**
 * Count serious deficiencies (Type A class or severity >= 3) on publishable
 * facilities since `p_since`. Uses the `count_serious_deficiencies` RPC so
 * the join + date filter runs in Postgres, not over PostgREST row caps.
 */
export async function countSeriousDeficiencies(
  supabase: SupabaseClient,
  opts?: { stateCode?: string; since?: string },
): Promise<number> {
  const { data, error } = await supabase.rpc("count_serious_deficiencies", {
    p_since: opts?.since ?? seriousDeficiencyCutoffDate(),
    p_state_code: opts?.stateCode ?? null,
  });

  if (error) {
    console.error("count_serious_deficiencies RPC failed:", error.message);
    return 0;
  }

  return Number(data ?? 0);
}
