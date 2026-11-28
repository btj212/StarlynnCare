import type { SupabaseClient } from "@supabase/supabase-js";
import { publishedFacilityIds, seriousCitationCutoff } from "@/lib/data/stateMemoryCareStats";
import { todayIsoDate } from "@/lib/data/inspectionDates";

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

const ID_CHUNK = 150;

function chunk(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Counts and the oldest date for one state's published homes.
 * Filters by facility id. It does not join facilities from the inspections table.
 */
export async function loadInspectionWindow(
  supabase: SupabaseClient,
  code: string,
): Promise<InspectionWindow | null> {
  const cutoff = seriousCitationCutoff();
  const today = todayIsoDate();
  const facilityIds = await publishedFacilityIds(supabase, code);
  if (!facilityIds) {
    console.error(`[inspectionWindow] count failed for ${code}`);
    return null;
  }
  if (facilityIds.length === 0) {
    return {
      cutoff,
      inspections: 0,
      complaintInspections: 0,
      complaintFlagged: false,
      oldest: null,
    };
  }

  let inspections = 0;
  let complaintInspections = 0;
  let anyComplaint = 0;
  let oldest: string | null = null;

  for (const ids of chunk(facilityIds, ID_CHUNK)) {
    const [recent, recentComplaint, anyComplaintRow, oldestRow] = await Promise.all([
      supabase
        .from("inspections")
        .select("id", { count: "exact", head: true })
        .in("facility_id", ids)
        .gte("inspection_date", cutoff)
        .lte("inspection_date", today),
      supabase
        .from("inspections")
        .select("id", { count: "exact", head: true })
        .in("facility_id", ids)
        .gte("inspection_date", cutoff)
        .lte("inspection_date", today)
        .eq("is_complaint", true),
      supabase
        .from("inspections")
        .select("id", { count: "exact", head: true })
        .in("facility_id", ids)
        .lte("inspection_date", today)
        .eq("is_complaint", true),
      supabase
        .from("inspections")
        .select("inspection_date")
        .in("facility_id", ids)
        .order("inspection_date", { ascending: true })
        .not("inspection_date", "is", null)
        .lte("inspection_date", today)
        .limit(1),
    ]);

    if (
      recent.error ||
      recentComplaint.error ||
      anyComplaintRow.error ||
      oldestRow.error ||
      recent.count == null ||
      recentComplaint.count == null ||
      anyComplaintRow.count == null
    ) {
      console.error(`[inspectionWindow] count failed for ${code}`);
      return null;
    }

    inspections += recent.count;
    complaintInspections += recentComplaint.count;
    anyComplaint += anyComplaintRow.count;
    const first = oldestRow.data?.[0] as { inspection_date?: string | null } | undefined;
    const day = first?.inspection_date ? first.inspection_date.slice(0, 10) : null;
    if (day && (oldest == null || day < oldest)) oldest = day;
  }

  return {
    cutoff,
    inspections,
    complaintInspections,
    complaintFlagged: anyComplaint > 0,
    oldest,
  };
}
