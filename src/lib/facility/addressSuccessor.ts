import { formatFacilityName } from "@/lib/facility/displayName";
import { isUsableInspectionDate, todayIsoDate } from "@/lib/data/inspectionDates";
import { formatRecordDate } from "@/lib/format/formatRecordDate";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

/**
 * Arizona Care Check successor links live in facilities.license_status_detail.
 *
 * A closed row names the new row:
 *   "... = StarlynnCare row {uuid} (unpublished)."
 * A new row names the old rows:
 *   "... previous StarlynnCare row(s): {uuid} (NAME, LICENSE); {uuid} (...)"
 *
 * TODO: a structured column (successor_facility_id on the closed row, and the
 * old ids on the new row) would be better than parsing this note.
 */

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const SUCCESSOR_ROW = new RegExp(`StarlynnCare row (${UUID})`, "i");
const PREDECESSOR_BLOCK = /previous StarlynnCare row\(s\):\s*([\s\S]*)$/i;

export type PreviousFacilityInspection = {
  id: string;
  dateLabel: string;
  citationCount: number;
  sourceUrl: string | null;
};

export type PreviousFacilityAtAddress = {
  id: string;
  name: string;
  licenseNumber: string | null;
  /** Null when the row has no stored license dates. */
  licensedLabel: string | null;
  inspections: PreviousFacilityInspection[];
};

export type AddressSuccessorLink = {
  name: string;
  href: string;
};

export type AddressHistory = {
  previousFacilities: PreviousFacilityAtAddress[];
  successor: AddressSuccessorLink | null;
};

const EMPTY_HISTORY: AddressHistory = { previousFacilities: [], successor: null };

export function successorRowIdFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = SUCCESSOR_ROW.exec(note);
  return match ? match[1].toLowerCase() : null;
}

export function predecessorRowIdsFromNote(note: string | null | undefined): string[] {
  if (!note) return [];
  const block = PREDECESSOR_BLOCK.exec(note);
  if (!block) return [];
  const ids = block[1].match(new RegExp(UUID, "gi")) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** True when this note is an old row naming `facilityId` as the new home. */
export function noteNamesSuccessor(
  note: string | null | undefined,
  facilityId: string,
): boolean {
  const named = successorRowIdFromNote(note);
  return named != null && named === facilityId.toLowerCase();
}

export function licensedDatesLabel(input: {
  initial: string | null;
  expiration: string | null;
  closed: string | null;
}): string | null {
  const start = isoDay(input.initial);
  const closed = isoDay(input.closed);
  const expiration = isoDay(input.expiration);
  const end = closed ?? expiration;
  if (!start && !end) return null;
  if (start && end) return `Licensed ${formatRecordDate(start)} to ${formatRecordDate(end)}`;
  if (start) return `Licensed ${formatRecordDate(start)}`;
  if (closed) return `License closed ${formatRecordDate(closed)}`;
  return `License through ${formatRecordDate(end!)}`;
}

function isoDay(value: string | null | undefined): string | null {
  const day = value?.trim().slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function httpUrl(value: string | null | undefined): string | null {
  const url = value?.trim() ?? "";
  return /^https?:\/\//i.test(url) ? url : null;
}

type PredecessorRow = {
  id: string;
  name: string;
  license_number: string | null;
  license_status_detail: string | null;
  initial_license_date: string | null;
  license_expiration: string | null;
  license_closed_date: string | null;
};

type InspectionHit = {
  id: string;
  facility_id: string;
  inspection_date: string;
  source_url: string | null;
};

type DeficiencyHit = { inspection_id: string };

/**
 * Previous facilities whose status-detail note names this row as the successor,
 * plus a link to the successor when this row is closed and that home is public.
 * Arizona only. Other states are not queried.
 */
export async function loadAddressHistory(input: {
  facilityId: string;
  stateCode: string;
  stateSlug: string;
  licenseStatus: string | null;
  licenseStatusDetail: string | null;
}): Promise<AddressHistory> {
  if (input.stateCode.toUpperCase() !== "AZ") return EMPTY_HISTORY;
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return EMPTY_HISTORY;

  const closed = (input.licenseStatus ?? "").trim().toUpperCase() === "CLOSED";
  const [previousFacilities, successor] = await Promise.all([
    loadPredecessors(input.facilityId),
    closed ? loadSuccessorLink(input.licenseStatusDetail, input.stateSlug) : Promise.resolve(null),
  ]);
  return { previousFacilities, successor };
}

async function loadPredecessors(facilityId: string): Promise<PreviousFacilityAtAddress[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("facilities")
    .select(
      "id, name, license_number, license_status_detail, initial_license_date, license_expiration, license_closed_date",
    )
    .eq("state_code", "AZ")
    .ilike("license_status_detail", `%StarlynnCare row ${facilityId}%`)
    .neq("id", facilityId)
    .limit(12);
  if (error || !data) return [];

  const rows = (data as PredecessorRow[])
    .filter((row) => noteNamesSuccessor(row.license_status_detail, facilityId))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (rows.length === 0) return [];

  const inspections = await loadInspections(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    name: formatFacilityName(row.name),
    licenseNumber: row.license_number,
    licensedLabel: licensedDatesLabel({
      initial: row.initial_license_date,
      expiration: row.license_expiration,
      closed: row.license_closed_date,
    }),
    inspections: inspections.get(row.id) ?? [],
  }));
}

async function loadInspections(
  facilityIds: string[],
): Promise<Map<string, PreviousFacilityInspection[]>> {
  const supabase = tryPublicSupabaseClient();
  const grouped = new Map<string, PreviousFacilityInspection[]>();
  if (!supabase || facilityIds.length === 0) return grouped;

  const today = todayIsoDate();
  const batches = await Promise.all(
    facilityIds.map(async (facilityId) => {
      const { data } = await supabase
        .from("inspections")
        .select("id, facility_id, inspection_date, source_url")
        .eq("facility_id", facilityId)
        .lte("inspection_date", today)
        .order("inspection_date", { ascending: false })
        .limit(50);
      return ((data ?? []) as InspectionHit[]).filter((row) =>
        isUsableInspectionDate(row.inspection_date, today),
      );
    }),
  );
  const perFacility = new Map<string, InspectionHit[]>();
  for (const rows of batches) {
    if (rows.length === 0) continue;
    perFacility.set(rows[0].facility_id, rows);
  }
  const inspections = batches.flat();

  const ids = inspections.map((row) => row.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: defData } = await supabase
      .from("deficiencies")
      .select("inspection_id")
      .in("inspection_id", ids)
      .limit(5000);
    for (const row of (defData ?? []) as DeficiencyHit[]) {
      counts.set(row.inspection_id, (counts.get(row.inspection_id) ?? 0) + 1);
    }
  }

  for (const [facilityId, rows] of perFacility) {
    grouped.set(
      facilityId,
      rows.map((row) => ({
        id: row.id,
        dateLabel: formatRecordDate(row.inspection_date),
        citationCount: counts.get(row.id) ?? 0,
        sourceUrl: httpUrl(row.source_url),
      })),
    );
  }
  return grouped;
}

async function loadSuccessorLink(
  detail: string | null,
  stateSlug: string,
): Promise<AddressSuccessorLink | null> {
  const successorId = successorRowIdFromNote(detail);
  if (!successorId) return null;
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("facilities")
    .select("name, slug, city_slug, publishable")
    .eq("id", successorId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    name: string;
    slug: string | null;
    city_slug: string | null;
    publishable: boolean;
  };
  if (!row.publishable || !row.slug || !row.city_slug) return null;
  return {
    name: formatFacilityName(row.name),
    href: `/${stateSlug}/${row.city_slug}/${row.slug}`,
  };
}
