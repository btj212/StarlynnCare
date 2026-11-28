import type { SupabaseClient } from "@supabase/supabase-js";
import { COVERED_STATES } from "@/lib/states";
import { todayIsoDate } from "@/lib/data/inspectionDates";
import { collectInPages } from "@/lib/data/pageSelect";

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
const STATE_WALK_CONCURRENCY = 3;

const facilityIdCache = new Map<string, Promise<string[] | null>>();

/** One published-id list per state per day. A failed read is not kept. */
export function publishedFacilityIds(
  supabase: SupabaseClient,
  code: string,
): Promise<string[] | null> {
  const key = `${code.toUpperCase()}|${todayIsoDate()}`;
  const hit = facilityIdCache.get(key);
  if (hit) return hit;
  const pending = facilityIdsForState(supabase, code).then((ids) => {
    if (ids == null) facilityIdCache.delete(key);
    return ids;
  });
  facilityIdCache.set(key, pending);
  return pending;
}

async function mapAtMost<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Math.min(limit, items.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        out[index] = await fn(items[index]);
      }
    }),
  );
  return out;
}

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
      .order("id", { ascending: true })
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
        .order("id", { ascending: true })
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
      const page = await collectInPages<{
        inspection_id: string;
        class: string | null;
        severity: number | null;
      }>((from, to) =>
        supabase
          .from("deficiencies")
          .select("inspection_id, class, severity")
          .in("inspection_id", inspChunk)
          .order("id", { ascending: true })
          .range(from, to),
      );
      if (page.error) {
        console.error("[stateMemoryCareStats] window deficiencies:", page.error);
        return null;
      }
      for (const d of page.rows) {
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
): Promise<{ homes: number; newest: string | null } | null> {
  const seen = new Set<string>();
  let newest: string | null = null;
  for (const ids of chunk(facilityIds, ID_CHUNK)) {
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("inspections")
        .select("facility_id, inspection_date")
        .in("facility_id", ids)
        .lte("inspection_date", today)
        .not("inspection_date", "is", null)
        .order("id", { ascending: true })
        .range(from, from + ID_PAGE - 1);
      if (error) {
        console.error("[stateMemoryCareStats] withInspection:", error.message);
        return null;
      }
      const page = (data ?? []) as Array<{ facility_id: string; inspection_date: string | null }>;
      for (const row of page) {
        seen.add(row.facility_id);
        const day = row.inspection_date?.slice(0, 10) ?? null;
        if (day && (newest == null || day > newest)) newest = day;
      }
      if (page.length < ID_PAGE) break;
      from += ID_PAGE;
    }
  }
  return { homes: seen.size, newest };
}

function isSerious(d: WindowFinding): boolean {
  return d.class === "Type A" || (d.severity ?? 0) >= 3;
}

let cachedStats: Promise<StateMemoryCareStats | null> | null = null;
let cachedStatsKey: string | null = null;

/** Tests only. A successful walk stays cached for the process otherwise. */
export function clearStateMemoryCareStatsCache(): void {
  cachedStats = null;
  cachedStatsKey = null;
  facilityIdCache.clear();
}

async function walkStateMemoryCareStats(
  supabase: SupabaseClient,
  cutoff: string,
  today: string,
): Promise<StateMemoryCareStats | null> {
  const settled = await mapAtMost(COVERED_STATES, STATE_WALK_CONCURRENCY, async (state) => {
    const facilityIds = await publishedFacilityIds(supabase, state.code);
    if (!facilityIds) {
      console.error(`[stateMemoryCareStats] skipped ${state.code}: facility ids`);
      return null;
    }
    const [withInspection, findings] = await Promise.all([
      countWithInspection(supabase, facilityIds, today),
      windowFindings(supabase, facilityIds, cutoff, today),
    ]);
    if (withInspection == null || findings == null) {
      const failed = [
        withInspection == null ? "withInspection" : "",
        findings == null ? "findings" : "",
      ].filter(Boolean);
      console.error(`[stateMemoryCareStats] skipped ${state.code}: ${failed.join(", ")}`);
      return null;
    }
    const seriousHomes = new Set(findings.filter(isSerious).map((d) => d.facility_id)).size;
    const uncodedFindings = findings.filter((d) => d.class == null && d.severity == null).length;
    const row: StateMemoryCareStat = {
      code: state.code,
      name: state.name,
      slug: state.slug,
      regulatorLong: OFFICES[state.code],
      published: facilityIds.length,
      withInspection: withInspection.homes,
      seriousHomes,
      newestInspection: withInspection.newest,
      findings: findings.length,
      uncodedFindings,
    };
    return row;
  });

  const rows = settled.filter((row): row is StateMemoryCareStat => row != null);
  if (rows.length === 0) return null;
  return { cutoff, rows };
}

export function loadStateMemoryCareStats(
  supabase: SupabaseClient,
): Promise<StateMemoryCareStats | null> {
  const cutoff = seriousCitationCutoff();
  const today = todayIsoDate();
  const key = `${cutoff}|${today}`;
  if (cachedStats && cachedStatsKey === key) return cachedStats;
  cachedStatsKey = key;
  const pending = walkStateMemoryCareStats(supabase, cutoff, today).then((result) => {
    if (result == null && cachedStats === pending) {
      cachedStats = null;
      cachedStatsKey = null;
    }
    return result;
  });
  cachedStats = pending;
  return pending;
}
