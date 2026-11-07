import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalFor } from "@/lib/seo/canonical";
import { regulatorLicensePageFor } from "@/lib/seo/schema";
import { seriousCitationCutoff } from "@/lib/data/stateMemoryCareStats";

/**
 * One-home lookup for the facility API.
 * A serious finding is a Type A citation or severity 3+, same as
 * countSeriousHomes in stateMemoryCareStats.ts. When half or more of the
 * home's findings in that window have no class and no severity, the serious
 * count is null. A measured zero stays zero.
 * A database error returns ok: false. An empty match list means no home matched.
 */

const MATCH_LIMIT = 5;
const RECENT_INSPECTIONS = 20;
const RECENT_FINDINGS = 3;
const EXCERPT_CHARS = 500;
const MIN_PLAN_CHARS = 40;

/** States whose stored plan text is a real follow-up, not a stub or a parser join. */
const PLAN_EXCERPT_STATES = new Set(["PA", "OR", "UT"]);

const UNMEASURED_NOTE =
  "A serious count is not shown. Half or more of this home's findings in the last 24 months have no citation class and no stored severity.";

export type FacilityLookupFinding = {
  inspection_date: string;
  source_url: string | null;
  excerpt: string | null;
  plan_excerpt: string | null;
};

export type FacilityLookupMatch = {
  name: string;
  url: string;
  license_number: string | null;
  regulator_url: string | null;
  city: string | null;
  beds: number | null;
  last_inspection_date: string | null;
  findings_24_months: number;
  serious_findings: number | null;
  serious_note: string | null;
  recent_findings: FacilityLookupFinding[];
};

export type FacilityLookupResult =
  | { ok: false }
  | { ok: true; matches: FacilityLookupMatch[] };

type FacilityHit = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  city: string | null;
  beds: number | null;
  license_number: string | null;
  last_inspection_date: string | null;
  state_code: string;
};

const FACILITY_COLUMNS =
  "id, name, slug, city_slug, city, beds, license_number, last_inspection_date, state_code";

/** Three to eighty characters, with SQL wildcards treated as spaces. */
export function normalizeLookupQuery(raw: string): string | null {
  const cleaned = raw.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 3 || cleaned.length > 80) return null;
  return cleaned;
}

function excerpt(value: string | null): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text || /^https?:\/\//i.test(text) || text.startsWith("WA DSHS report:")) return null;
  if (text.length <= EXCERPT_CHARS) return text;
  return `${text.slice(0, EXCERPT_CHARS - 1).trimEnd()}…`;
}

function planExcerpt(stateCode: string, value: string | null): string | null {
  if (!PLAN_EXCERPT_STATES.has(stateCode)) return null;
  const text = value?.trim() ?? "";
  if (text.length < MIN_PLAN_CHARS) return null;
  return excerpt(text);
}

async function searchHomes(
  supabase: SupabaseClient,
  stateCode: string,
  query: string,
): Promise<FacilityHit[] | null> {
  const pattern = `%${query}%`;
  const base = () =>
    supabase
      .from("facilities")
      .select(FACILITY_COLUMNS)
      .eq("state_code", stateCode)
      .eq("publishable", true)
      .order("name", { ascending: true })
      .limit(MATCH_LIMIT);

  const [byName, byLicense] = await Promise.all([
    base().ilike("name", pattern),
    base().ilike("license_number", pattern),
  ]);
  if (byName.error || byLicense.error) {
    console.error(
      "[facility-lookup] search failed",
      byName.error?.message ?? byLicense.error?.message,
    );
    return null;
  }

  const seen = new Set<string>();
  const matches: FacilityHit[] = [];
  for (const row of [...(byName.data ?? []), ...(byLicense.data ?? [])] as FacilityHit[]) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    matches.push(row);
    if (matches.length === MATCH_LIMIT) break;
  }
  return matches;
}

async function exactCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number | null> {
  const { count, error } = await query;
  if (error || count == null) {
    console.error("[facility-lookup] count query failed", error?.message ?? "missing count");
    return null;
  }
  return count;
}

async function findingCounts(
  supabase: SupabaseClient,
  facilityId: string,
  cutoff: string,
): Promise<{ findings: number; serious: number; uncoded: number } | null> {
  const { data, error } = await supabase
    .from("inspections")
    .select("id")
    .eq("facility_id", facilityId)
    .gte("inspection_date", cutoff);
  if (error) {
    console.error("[facility-lookup] inspection ids failed", error.message);
    return null;
  }
  const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
  if (ids.length === 0) return { findings: 0, serious: 0, uncoded: 0 };

  const findings = await exactCount(deficiencyCount(supabase, ids));
  const uncoded = await exactCount(
    deficiencyCount(supabase, ids).is("class", null).is("severity", null),
  );
  const serious = await exactCount(
    deficiencyCount(supabase, ids).or("class.eq.Type A,severity.gte.3"),
  );
  if (findings == null || uncoded == null || serious == null) return null;
  return { findings, serious, uncoded };
}

function deficiencyCount(supabase: SupabaseClient, inspectionIds: string[]) {
  return supabase
    .from("deficiencies")
    .select("id", { count: "exact", head: true })
    .in("inspection_id", inspectionIds);
}

type StoredFinding = {
  description: string | null;
  inspector_narrative: string | null;
  plan_of_correction: string | null;
  cited_date: string | null;
};

type InspectionBundle = {
  inspection_date: string | null;
  source_url: string | null;
  deficiencies: StoredFinding[] | StoredFinding | null;
};

async function recentFindings(
  supabase: SupabaseClient,
  facilityId: string,
  stateCode: string,
  cutoff: string,
): Promise<FacilityLookupFinding[] | null> {
  const { data, error } = await supabase
    .from("inspections")
    .select(
      "inspection_date, source_url, deficiencies(description, inspector_narrative, plan_of_correction, cited_date)",
    )
    .eq("facility_id", facilityId)
    .gte("inspection_date", cutoff)
    .order("inspection_date", { ascending: false })
    .limit(RECENT_INSPECTIONS);
  if (error) {
    console.error("[facility-lookup] recent findings failed", error.message);
    return null;
  }

  const flat: Array<StoredFinding & { inspection_date: string; source_url: string | null }> = [];
  for (const row of (data ?? []) as InspectionBundle[]) {
    if (!row.inspection_date) continue;
    const defs = Array.isArray(row.deficiencies)
      ? row.deficiencies
      : row.deficiencies
        ? [row.deficiencies]
        : [];
    for (const def of defs) {
      flat.push({
        ...def,
        inspection_date: row.inspection_date,
        source_url: row.source_url,
      });
    }
  }
  flat.sort((a, b) => {
    const byVisit = b.inspection_date.localeCompare(a.inspection_date);
    if (byVisit !== 0) return byVisit;
    return (b.cited_date ?? "").localeCompare(a.cited_date ?? "");
  });

  return flat.slice(0, RECENT_FINDINGS).map((def) => ({
    inspection_date: def.inspection_date.slice(0, 10),
    source_url: def.source_url,
    excerpt: excerpt(def.inspector_narrative) ?? excerpt(def.description),
    plan_excerpt: planExcerpt(stateCode, def.plan_of_correction),
  }));
}

export async function lookupFacilities(
  supabase: SupabaseClient,
  input: { stateCode: string; stateSlug: string; query: string },
): Promise<FacilityLookupResult> {
  const homes = await searchHomes(supabase, input.stateCode, input.query);
  if (!homes) return { ok: false };

  const cutoff = seriousCitationCutoff();
  const matches: FacilityLookupMatch[] = [];
  for (const home of homes) {
    const counts = await findingCounts(supabase, home.id, cutoff);
    if (!counts) return { ok: false };
    const recent = await recentFindings(supabase, home.id, input.stateCode, cutoff);
    if (!recent) return { ok: false };

    const unmeasured = counts.findings > 0 && counts.uncoded * 2 >= counts.findings;
    matches.push({
      name: home.name,
      url: canonicalFor(`/${input.stateSlug}/${home.city_slug}/${home.slug}`),
      license_number: home.license_number,
      regulator_url: regulatorLicensePageFor(input.stateCode, home.license_number),
      city: home.city,
      beds: home.beds != null ? Number(home.beds) : null,
      last_inspection_date: home.last_inspection_date
        ? home.last_inspection_date.slice(0, 10)
        : null,
      findings_24_months: counts.findings,
      serious_findings: unmeasured ? null : counts.serious,
      serious_note: unmeasured ? UNMEASURED_NOTE : null,
      recent_findings: recent,
    });
  }
  return { ok: true, matches };
}
