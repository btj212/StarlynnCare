import type { SupabaseClient } from "@supabase/supabase-js";
import { COVERED_STATES } from "@/lib/states";

/**
 * Live counts for /data. A serious citation is the same rule the city hubs
 * use: a Type A finding, or a finding stored at severity 3 or higher.
 * The serious column counts homes, not findings. A query that errors returns
 * null so the page does not print a zero it did not measure.
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

async function countPublished(supabase: SupabaseClient, code: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("facilities")
    .select("id", { count: "exact", head: true })
    .eq("publishable", true)
    .eq("state_code", code);
  if (error || count == null) return null;
  return count;
}

async function countWithInspection(supabase: SupabaseClient, code: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("facilities")
    .select("id, inspections!inner(id)", { count: "exact", head: true })
    .eq("publishable", true)
    .eq("state_code", code);
  if (error || count == null) return null;
  return count;
}

async function countSeriousHomes(
  supabase: SupabaseClient,
  code: string,
  cutoff: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("facilities")
    .select("id, inspections!inner(inspection_date, deficiencies!inner(id))", {
      count: "exact",
      head: true,
    })
    .eq("publishable", true)
    .eq("state_code", code)
    .gte("inspections.inspection_date", cutoff)
    .or("class.eq.Type A,severity.gte.3", { referencedTable: "inspections.deficiencies" });
  if (error || count == null) return null;
  return count;
}

function findingsQuery(supabase: SupabaseClient, code: string, cutoff: string) {
  return supabase
    .from("deficiencies")
    .select("id, inspections!inner(inspection_date, facilities!inner(state_code, publishable))", {
      count: "exact",
      head: true,
    })
    .eq("inspections.facilities.state_code", code)
    .eq("inspections.facilities.publishable", true)
    .gte("inspections.inspection_date", cutoff);
}

async function countFindings(
  supabase: SupabaseClient,
  code: string,
  cutoff: string,
): Promise<number | null> {
  const { count, error } = await findingsQuery(supabase, code, cutoff);
  if (error || count == null) return null;
  return count;
}

async function countUncodedFindings(
  supabase: SupabaseClient,
  code: string,
  cutoff: string,
): Promise<number | null> {
  const { count, error } = await findingsQuery(supabase, code, cutoff)
    .is("class", null)
    .is("severity", null);
  if (error || count == null) return null;
  return count;
}

async function newestInspection(
  supabase: SupabaseClient,
  code: string,
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from("inspections")
    .select("inspection_date, facilities!inner(state_code, publishable)")
    .eq("facilities.state_code", code)
    .eq("facilities.publishable", true)
    .order("inspection_date", { ascending: false })
    .limit(1);
  if (error) return undefined;
  const row = data?.[0] as { inspection_date?: string | null } | undefined;
  return row?.inspection_date ? row.inspection_date.slice(0, 10) : null;
}

export async function loadStateMemoryCareStats(
  supabase: SupabaseClient,
): Promise<StateMemoryCareStats | null> {
  const cutoff = seriousCitationCutoff();
  const rows: StateMemoryCareStat[] = [];

  for (const state of COVERED_STATES) {
    const [published, withInspection, seriousHomes, newest, findings, uncodedFindings] =
      await Promise.all([
        countPublished(supabase, state.code),
        countWithInspection(supabase, state.code),
        countSeriousHomes(supabase, state.code, cutoff),
        newestInspection(supabase, state.code),
        countFindings(supabase, state.code, cutoff),
        countUncodedFindings(supabase, state.code, cutoff),
      ]);
    if (
      published == null ||
      withInspection == null ||
      seriousHomes == null ||
      newest === undefined ||
      findings == null ||
      uncodedFindings == null
    ) {
      const failed = [
        published == null ? "published" : "",
        withInspection == null ? "withInspection" : "",
        seriousHomes == null ? "seriousHomes" : "",
        newest === undefined ? "newest" : "",
        findings == null ? "findings" : "",
        uncodedFindings == null ? "uncoded" : "",
      ].filter(Boolean);
      console.error(`[stateMemoryCareStats] count failed for ${state.code}: ${failed.join(", ")}`);
      return null;
    }
    rows.push({
      code: state.code,
      name: state.name,
      slug: state.slug,
      regulatorLong: OFFICES[state.code],
      published,
      withInspection,
      seriousHomes,
      newestInspection: newest,
      findings,
      uncodedFindings,
    });
  }

  return { cutoff, rows };
}
