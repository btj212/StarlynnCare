import type { SupabaseClient } from "@supabase/supabase-js";
import { seriousCitationCutoff } from "@/lib/data/stateMemoryCareStats";

/**
 * Inspections held for one state's published homes. complaintFlagged is false
 * when no inspection in the state carries a complaint flag, so the page can say
 * the flag is missing instead of printing zero complaints.
 */
export type InspectionWindow = {
  cutoff: string;
  inspections: number;
  complaintInspections: number;
  complaintFlagged: boolean;
  oldest: string | null;
};

function inspectionsFor(supabase: SupabaseClient, code: string) {
  return supabase
    .from("inspections")
    .select("id, facilities!inner(state_code, publishable)", { count: "exact", head: true })
    .eq("facilities.state_code", code)
    .eq("facilities.publishable", true);
}

export async function loadInspectionWindow(
  supabase: SupabaseClient,
  code: string,
): Promise<InspectionWindow | null> {
  const cutoff = seriousCitationCutoff();

  const [recent, recentComplaint, anyComplaint, oldestRow] = await Promise.all([
    inspectionsFor(supabase, code).gte("inspection_date", cutoff),
    inspectionsFor(supabase, code)
      .gte("inspection_date", cutoff)
      .eq("is_complaint", true),
    inspectionsFor(supabase, code).eq("is_complaint", true),
    supabase
      .from("inspections")
      .select("inspection_date, facilities!inner(state_code, publishable)")
      .eq("facilities.state_code", code)
      .eq("facilities.publishable", true)
      .not("inspection_date", "is", null)
      .order("inspection_date", { ascending: true })
      .limit(1),
  ]);

  if (
    recent.error ||
    recentComplaint.error ||
    anyComplaint.error ||
    oldestRow.error ||
    recent.count == null ||
    recentComplaint.count == null ||
    anyComplaint.count == null
  ) {
    console.error(`[inspectionWindow] count failed for ${code}`);
    return null;
  }

  const first = oldestRow.data?.[0] as { inspection_date?: string | null } | undefined;
  return {
    cutoff,
    inspections: recent.count,
    complaintInspections: recentComplaint.count,
    complaintFlagged: anyComplaint.count > 0,
    oldest: first?.inspection_date ? first.inspection_date.slice(0, 10) : null,
  };
}
