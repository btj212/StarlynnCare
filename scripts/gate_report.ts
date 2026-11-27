/**
 * Read-only quality-gate report. Prints one block per state and writes JSON
 * to /tmp/gate_report.json. Does not write the database.
 *
 *   npx tsx scripts/gate_report.ts
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL and the publishable (or anon) key.
 * states.last_successful_scrape is the public sync clock. scrape_runs is
 * read only when SUPABASE_SERVICE_ROLE_KEY is set.
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  FRESHNESS_TODO,
  GATE_ENFORCED,
  canonicalLicenseStatus,
  explainIndexability,
  type CanonicalLicenseStatus,
  type GateCondition,
  type GateHome,
  type GateInspection,
} from "../src/lib/quality/gate.ts";

config({ path: path.resolve(process.cwd(), ".env.local") });

const PAGE = 1000;
const CONDITIONS: GateCondition[] = [
  "license_status",
  "inspection",
  "regulator_label",
  "explanation",
  "seo_identity",
  "jsonld",
  "freshness",
];

const FACILITY_COLUMNS = [
  "id",
  "state_code",
  "name",
  "city",
  "city_slug",
  "slug",
  "publishable",
  "license_status",
  "license_type",
  "license_number",
  "updated_at",
  "mce_endorsed",
  "mn_dementia_care_licensed",
  "mn_lic_type",
  "mc_designation_type",
  "secure_beds",
  "il_dementia_program_flag",
  "il_license_subtype",
  "mo_alzheimer_scu",
  "mo_level_of_care",
  "tx_alzheimer_certified",
  "wa_memory_care_certified",
  "wa_dementia_care_contract",
  "wa_earc_sdc_contracted",
  "wa_dementia_specialty",
  "wa_facility_type",
  "wa_afh_residential_flag",
  "ca_cdss_client_served",
  "az_license_level",
  "az_memory_care_endorsed",
  "co_care_setting",
  "mc_signal_apfm_listed",
  "mc_signal_caring_listed",
  "mc_signal_explicit_name",
  "mc_program_confirmed",
  "mc_program_quote",
  "mc_review_notes",
  "memory_care_disclosure_filed",
].join(", ");

type FacilityRow = GateHome & { id: string; publishable: boolean | null };

type StateReport = {
  state: string;
  rows: number;
  licensed: number;
  probation: number;
  closed: number;
  pending: number;
  other: number;
  pass_gate: number;
  currently_indexed: number;
  indexed_pass: number;
  tier_a: number;
  tier_b: number;
  tier_none: number;
  unlabeled: number;
  indexed_tier_a: number;
  indexed_tier_b: number;
  indexed_tier_none: number;
  indexed_unlabeled: number;
  failures_all: Record<GateCondition, number>;
  failures_indexed: Record<GateCondition, number>;
  indexed_directory_signal: number;
  sync_at: string | null;
  sync_source: "scrape_runs" | "states.last_successful_scrape" | "missing";
  freshness_todo: string | null;
};

function emptyFailures(): Record<GateCondition, number> {
  return {
    license_status: 0,
    inspection: 0,
    regulator_label: 0,
    explanation: 0,
    seo_identity: 0,
    jsonld: 0,
    freshness: 0,
  };
}

function emptyReport(state: string): StateReport {
  return {
    state,
    rows: 0,
    licensed: 0,
    probation: 0,
    closed: 0,
    pending: 0,
    other: 0,
    pass_gate: 0,
    currently_indexed: 0,
    indexed_pass: 0,
    tier_a: 0,
    tier_b: 0,
    tier_none: 0,
    unlabeled: 0,
    indexed_tier_a: 0,
    indexed_tier_b: 0,
    indexed_tier_none: 0,
    indexed_unlabeled: 0,
    failures_all: emptyFailures(),
    failures_indexed: emptyFailures(),
    indexed_directory_signal: 0,
    sync_at: null,
    sync_source: "missing",
    freshness_todo: FRESHNESS_TODO,
  };
}

async function eachPage<T>(
  load: (from: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

function stateSlug(code: string): string {
  const slugs: Record<string, string> = {
    AZ: "arizona",
    CA: "california",
    CO: "colorado",
    IL: "illinois",
    MN: "minnesota",
    MO: "missouri",
    OR: "oregon",
    PA: "pennsylvania",
    TX: "texas",
    UT: "utah",
    WA: "washington",
  };
  return slugs[code] ?? code.toLowerCase();
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and a publishable key are required.");
    process.exit(1);
  }

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const service = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const facilities = await eachPage<FacilityRow>((from) =>
    client
      .from("facilities")
      .select(FACILITY_COLUMNS)
      .order("id")
      .range(from, from + PAGE - 1)
      .then((result) => ({
        data: (result.data ?? null) as FacilityRow[] | null,
        error: result.error,
      })),
  );

  const goodInspections = new Set<string>();
  const inspectionRows = await eachPage<{ id: string; facility_id: string }>((from) =>
    client
      .from("inspections")
      .select("id, facility_id, inspection_date, source_url")
      .not("inspection_date", "is", null)
      .not("source_url", "is", null)
      .order("id")
      .range(from, from + PAGE - 1)
      .then((result) => ({
        data: (result.data ?? null) as Array<{
          id: string;
          facility_id: string;
          inspection_date: string | null;
          source_url: string | null;
        }> | null,
        error: result.error,
      })),
  );
  for (const row of inspectionRows as unknown as Array<{
    facility_id: string;
    inspection_date: string | null;
    source_url: string | null;
  }>) {
    const date = row.inspection_date?.trim() ?? "";
    const source = row.source_url?.trim() ?? "";
    if (date && /^https?:\/\//i.test(source)) goodInspections.add(row.facility_id);
  }

  const sync = await loadSync(client, service);
  const byState = new Map<string, StateReport>();
  const now = new Date();

  for (const row of facilities) {
    const code = row.state_code.toUpperCase();
    const report = byState.get(code) ?? emptyReport(code);
    const clock = sync.get(code);
    if (clock) {
      report.sync_at = clock.at;
      report.sync_source = clock.source;
      report.freshness_todo = clock.source === "missing" ? FRESHNESS_TODO : null;
    }
    const status: CanonicalLicenseStatus = canonicalLicenseStatus(row.license_status, code);
    report.rows += 1;
    if (status === "LICENSED") report.licensed += 1;
    else if (status === "PROBATION") report.probation += 1;
    else if (status === "CLOSED") report.closed += 1;
    else if (status === "PENDING") report.pending += 1;
    else report.other += 1;

    const inspections: GateInspection[] = goodInspections.has(row.id)
      ? [{ date: "on-file", sourceUrl: "https://regulator.example/on-file" }]
      : [];
    const slug = stateSlug(code);
    const name = row.name?.trim() || "";
    const city = row.city?.trim() || "";
    const decision = explainIndexability(
      {
        ...row,
        state_code: code,
        sync_at: clock?.at ?? null,
        inspections,
        title: name && city ? `${name}, ${city}` : "",
        h1: name,
        canonical:
          row.city_slug && row.slug
            ? `https://www.starlynncare.com/${slug}/${row.city_slug}/${row.slug}`
            : "",
      },
      now,
    );
    if (decision.indexable) report.pass_gate += 1;
    for (const failure of decision.failures) report.failures_all[failure] += 1;
    if (decision.headline.tier === "A") report.tier_a += 1;
    else if (decision.headline.tier === "B") report.tier_b += 1;
    else if (decision.headline.fromRegulator) report.tier_none += 1;
    else report.unlabeled += 1;

    const indexed = row.publishable === true;
    if (indexed) {
      report.currently_indexed += 1;
      if (decision.indexable) report.indexed_pass += 1;
      for (const failure of decision.failures) report.failures_indexed[failure] += 1;
      if (decision.headline.tier === "A") report.indexed_tier_a += 1;
      else if (decision.headline.tier === "B") report.indexed_tier_b += 1;
      else if (decision.headline.fromRegulator) report.indexed_tier_none += 1;
      else report.indexed_unlabeled += 1;
      if (row.mc_signal_apfm_listed === true || row.mc_signal_caring_listed === true) {
        report.indexed_directory_signal += 1;
      }
    }
    byState.set(code, report);
  }

  const states = [...byState.values()].sort((a, b) => a.state.localeCompare(b.state));
  for (const report of states) {
    if (!sync.has(report.state)) {
      report.sync_source = "missing";
      report.freshness_todo = FRESHNESS_TODO;
    }
    console.log(
      [
        report.state,
        `rows=${report.rows}`,
        `licensed=${report.licensed}`,
        `probation=${report.probation}`,
        `pass_gate=${report.pass_gate}`,
        `indexed=${report.currently_indexed}`,
        `indexed_pass=${report.indexed_pass}`,
        `tierA=${report.tier_a}`,
        `tierB=${report.tier_b}`,
        `tierNone=${report.tier_none}`,
        `unlabeled=${report.unlabeled}`,
      ].join("  "),
    );
    console.log(
      `  indexed failures: ${CONDITIONS.map((condition) => `${condition}=${report.failures_indexed[condition]}`).join("  ")}`,
    );
    console.log(
      `  sync=${report.sync_source}${report.sync_at ? ` ${report.sync_at}` : ""}  directory_signal_indexed=${report.indexed_directory_signal}`,
    );
  }

  const payload = {
    generated_at: now.toISOString(),
    gate_enforced: GATE_ENFORCED,
    project: "fwvrupjgwvvzqiutwwdg",
    freshness_note: FRESHNESS_TODO,
    states,
  };
  const out = "/tmp/gate_report.json";
  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`wrote ${out}`);
}

async function loadSync(
  client: SupabaseClient,
  service: SupabaseClient | null,
): Promise<Map<string, { at: string; source: "scrape_runs" | "states.last_successful_scrape" }>> {
  const clocks = new Map<string, { at: string; source: "scrape_runs" | "states.last_successful_scrape" }>();
  const { data, error } = await client.from("states").select("code, last_successful_scrape");
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ code: string; last_successful_scrape: string | null }>) {
    if (row.last_successful_scrape) {
      clocks.set(row.code, { at: row.last_successful_scrape, source: "states.last_successful_scrape" });
    }
  }
  if (!service) {
    console.log("scrape_runs skipped (no service role). Using states.last_successful_scrape when set.");
    return clocks;
  }
  const runs = await eachPage<{ state_code: string; completed_at: string | null }>((from) =>
    service
      .from("scrape_runs")
      .select("state_code, completed_at, status")
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .range(from, from + PAGE - 1)
      .then((result) => ({
        data: (result.data ?? null) as Array<{ state_code: string; completed_at: string | null }> | null,
        error: result.error,
      })),
  );
  const latest = new Map<string, string>();
  for (const run of runs) {
    if (!run.completed_at) continue;
    const code = run.state_code.toUpperCase();
    const prev = latest.get(code);
    if (!prev || run.completed_at > prev) latest.set(code, run.completed_at);
  }
  for (const [code, at] of latest) {
    const current = clocks.get(code);
    if (!current || at > current.at) clocks.set(code, { at, source: "scrape_runs" });
  }
  return clocks;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
