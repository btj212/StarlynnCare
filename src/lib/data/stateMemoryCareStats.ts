import type { SupabaseClient } from "@supabase/supabase-js";
import { COVERED_STATES } from "@/lib/states";
import { todayIsoDate } from "@/lib/data/inspectionDates";

/**
 * Live counts for /data. A serious citation is the same rule the city hubs
 * use: a Type A finding, or a finding stored at severity 3 or higher.
 * The serious column counts homes, not findings. Nested PostgREST joins
 * used to fail the whole table; counts now walk facility IDs in chunks,
 * the same way state hubs do. One state's failure no longer blanks /data.
 * findings and uncodedFindings are for the research report. /data does not show them.
 */

export type StateMemoryCareStat = {
  code: string;
  name: string;
  slug: string;
  regulatorLong: string;
  published: number;
  withInspection: number;
  seriousHomes: number;
  newestInspection: string | null;
  /** Findings in the last 24 months. Used to tell an unmeasured count from a measured one. */
  findings: number;
  /** Those findings with no citation class and no stored severity. */
  uncodedFindings: number;
};

export type StateMemoryCareStats = {
  cutoff: string;
  rows: StateMemoryCareStat[];
};

const OFFICES: Record<string, string> = {
  CA: "California Dept. of Social Services · Community Care Licensing",
  TX: "Texas Health and Human Services Commission",
  OR: "Oregon Dept. of Human Services · Office of Aging and People with Disabilities",
  WA: "Washington Dept. of Social and Health Services · ALTSA",
  MN: "Minnesota Dept. of Health",
  UT: "Utah Dept. of Health & Human Services · Division of Licensing and Background Checks",
  IL: "Illinois Dept. of Public Health · Division of Assisted Living",
  PA: "Pennsylvania Dept. of Human Services",
  AZ: "Arizona Dept. of Health Services · Bureau of Residential Facilities Licensing",
  MO: "Missouri Dept. of Health and Senior Services · Section for Long-Term Care Regulation",
  CO: "Colorado Department of Public Health and Environment",
};

const ID_PAGE = 1000;
const ID_CHUNK = 150;

export function seriousCitationCutoff(now = new Date()): string {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
  return cutoff.toISOString().slice(0, 10);
}

/** A stored calendar day, labeled as a date and not as a review. */
export function formatRecordDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const day = iso.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function facilityIdsForState(
  supabase: SupabaseClient,
  code: string,
): Promise<string[] | null> {
  const ids: string[] = [];
  for (let from = 0; ; from += ID_PAGE) {
    const { data, error } = await supabase
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .eq("state_code", code)
      .range(from, from + ID_PAGE - 1);
    if (error) {
      console.error(`[stateMemoryCareStats] facility ids ${code}:`, error.message);
      return null;
    }
    const page = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
    ids.push(...page);
    if (page.length < ID_PAGE) break;
  }
  return ids;
}

type WindowFinding = {
  facility_id: string;
  class: string | null;
  severity: number | null;
};

async function windowFindings(
  supabase: SupabaseClient,
  facilityIds: string[],
  cutoff: string,
  today: string,
): Promise<WindowFinding[] | null> {
  const findings: WindowFinding[] = [];
  for (const ids of chunk(facilityIds, ID_CHUNK)) {
    let from = 0;
    const inspRows: Array<{ id: string; facility_id: string }> = [];
    for (;;) {
      const { data, error } = await supabase
        .from("inspections")
        .select("id, facility_id")
        .in("facility_id", ids)
        .gte("inspection_date", cutoff)
        .lte("inspection_date", today)
        .range(from, from + ID_PAGE - 1);
      if (error) {
        console.error("[stateMemoryCareStats] window inspections:", error.message);
        return null;
      }
      const page = (data ?? []) as Array<{ id: string; facility_id: string }>;
      inspRows.push(...page);
      if (page.length < ID_PAGE) break;
      from += ID_PAGE;
    }
    if (inspRows.length === 0) continue;
    const inspFac = new Map(inspRows.map((i) => [i.id, i.facility_id]));
    for (const inspChunk of chunk(inspRows.map((i) => i.id), ID_CHUNK)) {
      const { data, error } = await supabase
        .from("deficiencies")
        .select("inspection_id, class, severity")
        .in("inspection_id", inspChunk)
        .limit(5000);
      if (error) {
        console.error("[stateMemoryCareStats] window deficiencies:", error.message);
        return null;
      }
      for (const d of (data ?? []) as Array<{
        inspection_id: string;
        class: string | null;
        severity: number | null;
      }>) {
        const facility_id = inspFac.get(d.inspection_id);
        if (!facility_id) continue;
        findings.push({ facility_id, class: d.class, severity: d.severity });
      }
    }
  }
  return findings;
}

async function countWithInspection(
  supabase: SupabaseClient,
  facilityIds: string[],
  today: string,
): Promise<number | null> {
  const seen = new Set<string>();
  for (const ids of chunk(facilityIds, ID_CHUNK)) {
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("inspections")
        .select("facility_id")
        .in("facility_id", ids)
        .lte("inspection_date", today)
        .not("inspection_date", "is", null)
        .range(from, from + ID_PAGE - 1);
      if (error) {
        console.error("[stateMemoryCareStats] withInspection:", error.message);
        return null;
      }
      const page = (data ?? []) as Array<{ facility_id: string }>;
      for (const row of page) seen.add(row.facility_id);
      if (page.length < ID_PAGE) break;
      from += ID_PAGE;
    }
  }
  return seen.size;
}

async function newestInspection(
  supabase: SupabaseClient,
  code: string,
  today: string,
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from("inspections")
    .select("inspection_date, facilities!inner(state_code, publishable)")
    .eq("facilities.state_code", code)
    .eq("facilities.publishable", true)
    .lte("inspection_date", today)
    .order("inspection_date", { ascending: false })
    .limit(1);
  if (error) {
    console.error(`[stateMemoryCareStats] newest ${code}:`, error.message);
    return undefined;
  }
  const row = data?.[0] as { inspection_date?: string | null } | undefined;
  return row?.inspection_date ? row.inspection_date.slice(0, 10) : null;
}

function isSerious(d: WindowFinding): boolean {
  return d.class === "Type A" || (d.severity ?? 0) >= 3;
}

export async function loadStateMemoryCareStats(
  supabase: SupabaseClient,
): Promise<StateMemoryCareStats | null> {
  const cutoff = seriousCitationCutoff();
  const today = todayIsoDate();
  const rows: StateMemoryCareStat[] = [];

  for (const state of COVERED_STATES) {
    const facilityIds = await facilityIdsForState(supabase, state.code);
    if (!facilityIds) {
      console.error(`[stateMemoryCareStats] skipped ${state.code}: facility ids`);
      continue;
    }
    const [withInspection, newest, findings] = await Promise.all([
      countWithInspection(supabase, facilityIds, today),
      newestInspection(supabase, state.code, today),
      windowFindings(supabase, facilityIds, cutoff, today),
    ]);
    if (withInspection == null || findings == null) {
      const failed = [
        withInspection == null ? "withInspection" : "",
        findings == null ? "findings" : "",
      ].filter(Boolean);
      console.error(`[stateMemoryCareStats] skipped ${state.code}: ${failed.join(", ")}`);
      continue;
    }
    const seriousHomes = new Set(findings.filter(isSerious).map((d) => d.facility_id)).size;
    const uncodedFindings = findings.filter((d) => d.class == null && d.severity == null).length;
    rows.push({
      code: state.code,
      name: state.name,
      slug: state.slug,
      regulatorLong: OFFICES[state.code],
      published: facilityIds.length,
      withInspection,
      seriousHomes,
      newestInspection: newest ?? null,
      findings: findings.length,
      uncodedFindings,
    });
  }

  if (rows.length === 0) return null;
  return { cutoff, rows };
}
