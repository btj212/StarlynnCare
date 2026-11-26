import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `facilities.last_inspection_date` is stale for every state except MN.
 * Public pages and the API derive the date from inspection rows instead.
 * Future-dated rows (e.g. a WA visit stored as Dec 2026) are dropped.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function inspectionDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = ISO_DAY.exec(iso);
  return match ? match[0] : null;
}

/** True when the stored visit day is real and not after today. */
export function isUsableInspectionDate(
  iso: string | null | undefined,
  today = todayIsoDate(),
): boolean {
  const day = inspectionDay(iso);
  return day != null && day <= today;
}

/** Latest usable inspection day from a list. Null when none are on or before today. */
export function latestInspectionDate(
  dates: Array<string | null | undefined>,
  today = todayIsoDate(),
): string | null {
  let latest: string | null = null;
  for (const date of dates) {
    const day = inspectionDay(date);
    if (!day || day > today) continue;
    if (!latest || day > latest) latest = day;
  }
  return latest;
}

export function latestInspectionByFacility(
  rows: Array<{ facility_id: string; inspection_date: string | null }>,
  today = todayIsoDate(),
): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    const next = latestInspectionDate([out.get(row.facility_id) ?? null, row.inspection_date], today);
    if (next) out.set(row.facility_id, next);
  }
  return out;
}

const ID_CHUNK = 80;
const PAGE = 1000;

/**
 * Max usable inspection_date per facility, from inspection rows.
 * Pass `facilityIds` for a known set (API, lookup, siblings). Omit it to
 * walk the inspections table (homepage city listed-set).
 */
export async function loadLatestInspectionDates(
  supabase: SupabaseClient,
  facilityIds?: string[],
): Promise<Map<string, string>> {
  const today = todayIsoDate();
  if (facilityIds) {
    if (facilityIds.length === 0) return new Map();
    return loadDatesForIds(supabase, facilityIds, today);
  }
  return loadDatesFromInspectionTable(supabase, today);
}

async function loadDatesForIds(
  supabase: SupabaseClient,
  facilityIds: string[],
  today: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < facilityIds.length; i += ID_CHUNK) {
    const chunk = facilityIds.slice(i, i + ID_CHUNK);
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("inspections")
        .select("facility_id, inspection_date")
        .in("facility_id", chunk)
        .lte("inspection_date", today)
        .not("inspection_date", "is", null)
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[inspectionDates] id chunk failed:", error.message);
        break;
      }
      const page = (data ?? []) as Array<{
        facility_id: string;
        inspection_date: string | null;
      }>;
      for (const row of page) {
        const next = latestInspectionDate(
          [out.get(row.facility_id) ?? null, row.inspection_date],
          today,
        );
        if (next) out.set(row.facility_id, next);
      }
      if (page.length < PAGE) break;
      from += PAGE;
    }
  }
  return out;
}

async function loadDatesFromInspectionTable(
  supabase: SupabaseClient,
  today: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("inspections")
      .select("facility_id, inspection_date")
      .lte("inspection_date", today)
      .not("inspection_date", "is", null)
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[inspectionDates] table page failed:", error.message);
      break;
    }
    const page = (data ?? []) as Array<{
      facility_id: string;
      inspection_date: string | null;
    }>;
    for (const row of page) {
      const next = latestInspectionDate(
        [out.get(row.facility_id) ?? null, row.inspection_date],
        today,
      );
      if (next) out.set(row.facility_id, next);
    }
    if (page.length < PAGE) break;
  }
  return out;
}
