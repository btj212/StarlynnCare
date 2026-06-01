/**
 * Layer F — Direct Supabase query integration tests.
 *
 * Mirrors the queries that loadFacilityProfile.ts makes, but runs them
 * directly via @supabase/supabase-js OUTSIDE the Next.js runtime so they
 * can be executed in a plain Node.js process (no server required).
 *
 * Tests the full read path: Supabase connection → RLS → PostgREST → data shape.
 * No mocks. No fake data. Real Supabase project only.
 *
 * Run:
 *   npx tsx tests/test_supabase_direct.ts
 *
 * Exit 0 = all passed. Exit 1 = one or more failed.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env loader — reads .env.local from repo root (same pattern as Python scripts)
// ---------------------------------------------------------------------------

function loadEnv(): void {
  const repoRoot = resolve(__dirname, "..");
  for (const name of [".env.local", ".env"]) {
    try {
      const content = readFileSync(resolve(repoRoot, name), "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const rawVal = trimmed.slice(eqIdx + 1).trim();
        const val = rawVal.replace(/^["']|["']$/g, "");
        if (key && !(key in process.env)) {
          process.env[key] = val;
        }
      }
      break; // stop after first found env file
    } catch {
      // file not found — try next
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Test runner (lightweight, no external dependencies)
// ---------------------------------------------------------------------------

type TestFn = (supabase: SupabaseClient) => Promise<void>;

const tests: Array<{ name: string; fn: TestFn }> = [];
let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

async function runAll(supabase: SupabaseClient): Promise<void> {
  console.log("=".repeat(60));
  console.log("StarlynnCare — Layer F: Direct Supabase Query Tests");
  console.log("=".repeat(60));

  for (const t of tests) {
    try {
      await t.fn(supabase);
      console.log(`  PASS  ${t.name}`);
      passed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  FAIL  ${t.name}`);
      console.log(`        ← ${msg}`);
      failed++;
      failures.push(t.name);
    }
  }

  console.log();
  console.log("-".repeat(60));
  console.log(`Summary: ${passed}/${passed + failed} passed`);
  if (failures.length > 0) {
    console.log(`Failed (${failures.length}):`);
    for (const f of failures) console.log(`  • ${f}`);
  }
  console.log("-".repeat(60));
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Test fixtures (from MEMORY.md)
// ---------------------------------------------------------------------------

const CA_OPAL_CARE_LICENSE = "200672";
const CA_OPAL_CARE_CITY_SLUG = "oakland";
const CA_OPAL_CARE_SLUG = "opal-care-llc-200672";
const PA_RITTENHOUSE_LICENSE = "223010";

// States covered by the frontend (from states.ts COVERED_STATES)
const COVERED_STATE_CODES = ["CA", "TX", "OR", "WA", "MN", "UT", "IL"] as const;

// ---------------------------------------------------------------------------
// Tests: basic connectivity
// ---------------------------------------------------------------------------

test("supabase client connects and facilities table is readable", async (sb) => {
  const { count, error } = await sb
    .from("facilities")
    .select("*", { count: "exact", head: true });

  assert(!error, `Supabase query failed: ${error?.message}`);
  assert(count !== null && count > 0, `Expected >0 facilities, got count=${count}`);
});

test("all 50 states are in the states table", async (sb) => {
  const { count, error } = await sb
    .from("states")
    .select("*", { count: "exact", head: true });

  assert(!error, `states query failed: ${error?.message}`);
  assert(count === 50, `Expected 50 states, got ${count}`);
});

test("inspections table is readable", async (sb) => {
  const { count, error } = await sb
    .from("inspections")
    .select("*", { count: "exact", head: true });

  assert(!error, `inspections query failed: ${error?.message}`);
  assert(count !== null && count > 0, `Expected >0 inspections, got ${count}`);
});

test("deficiencies table is readable", async (sb) => {
  const { count, error } = await sb
    .from("deficiencies")
    .select("*", { count: "exact", head: true });

  assert(!error, `deficiencies query failed: ${error?.message}`);
  assert(count !== null && count > 0, `Expected >0 deficiencies, got ${count}`);
});

// ---------------------------------------------------------------------------
// Tests: per-state publishable counts
// ---------------------------------------------------------------------------

for (const stateCode of COVERED_STATE_CODES) {
  test(`${stateCode}: has publishable facilities`, async (sb) => {
    const { count, error } = await sb
      .from("facilities")
      .select("*", { count: "exact", head: true })
      .eq("state_code", stateCode)
      .eq("publishable", true);

    assert(!error, `Query failed for ${stateCode}: ${error?.message}`);
    assert(
      count !== null && count > 0,
      `${stateCode}: 0 publishable facilities found. Ingest or recompute has not run.`,
    );
  });
}

// ---------------------------------------------------------------------------
// Tests: CA Opal Care known fixture
// ---------------------------------------------------------------------------

test("CA Opal Care: facility exists by license number", async (sb) => {
  const { data, error } = await sb
    .from("facilities")
    .select("id, name, license_number, state_code, city_slug, slug, publishable, serves_memory_care, license_status, beds, latitude, longitude")
    .eq("license_number", CA_OPAL_CARE_LICENSE)
    .eq("state_code", "CA")
    .limit(1);

  assert(!error, `Query failed: ${error?.message}`);
  assert(data !== null && data.length === 1, `Opal Care not found (license ${CA_OPAL_CARE_LICENSE})`);
});

test("CA Opal Care: publishable=true", async (sb) => {
  const { data, error } = await sb
    .from("facilities")
    .select("publishable")
    .eq("license_number", CA_OPAL_CARE_LICENSE)
    .eq("state_code", "CA")
    .single();

  assert(!error, error?.message ?? "Query failed");
  assert(data?.publishable === true, `Opal Care publishable=${data?.publishable}`);
});

test("CA Opal Care: serves_memory_care=true", async (sb) => {
  const { data, error } = await sb
    .from("facilities")
    .select("serves_memory_care")
    .eq("license_number", CA_OPAL_CARE_LICENSE)
    .eq("state_code", "CA")
    .single();

  assert(!error, error?.message ?? "Query failed");
  assert(data?.serves_memory_care === true, "Opal Care serves_memory_care is not true");
});

test("CA Opal Care: reachable by slug+city_slug (loadFacilityProfile path)", async (sb) => {
  const { data, error } = await sb
    .from("facilities")
    .select("id, name, slug")
    .eq("state_code", "CA")
    .eq("city_slug", CA_OPAL_CARE_CITY_SLUG)
    .eq("slug", CA_OPAL_CARE_SLUG)
    .eq("publishable", true)
    .limit(1);

  assert(!error, `loadFacilityProfile path query failed: ${error?.message}`);
  assert(
    data !== null && data.length === 1,
    `Opal Care not found at /california/${CA_OPAL_CARE_CITY_SLUG}/${CA_OPAL_CARE_SLUG}`,
  );
});

test("CA Opal Care: has inspections", async (sb) => {
  const { data: facility } = await sb
    .from("facilities")
    .select("id")
    .eq("license_number", CA_OPAL_CARE_LICENSE)
    .eq("state_code", "CA")
    .single();

  assert(facility !== null, "Opal Care not found");

  const { count, error } = await sb
    .from("inspections")
    .select("*", { count: "exact", head: true })
    .eq("facility_id", facility!.id);

  assert(!error, `inspections query failed: ${error?.message}`);
  assert(count !== null && count >= 3, `Opal Care: expected ≥3 inspections, got ${count}`);
});

test("CA Opal Care: has deficiencies", async (sb) => {
  const { data: facility } = await sb
    .from("facilities")
    .select("id")
    .eq("license_number", CA_OPAL_CARE_LICENSE)
    .eq("state_code", "CA")
    .single();

  assert(facility !== null, "Opal Care not found");

  // Fetch inspection IDs
  const { data: inspections } = await sb
    .from("inspections")
    .select("id")
    .eq("facility_id", facility!.id)
    .limit(50);

  assert(inspections !== null && inspections.length > 0, "No inspections found for Opal Care");

  const inspectionIds = inspections!.map((i: { id: string }) => i.id);

  const { count, error } = await sb
    .from("deficiencies")
    .select("*", { count: "exact", head: true })
    .in("inspection_id", inspectionIds);

  assert(!error, `deficiencies query failed: ${error?.message}`);
  assert(count !== null && count >= 10, `Opal Care: expected ≥10 deficiencies, got ${count}`);
});

test("CA Opal Care: inspections have source_agency set", async (sb) => {
  const { data: facility } = await sb
    .from("facilities")
    .select("id")
    .eq("license_number", CA_OPAL_CARE_LICENSE)
    .eq("state_code", "CA")
    .single();

  assert(facility !== null, "Opal Care not found");

  const { data: inspections, error } = await sb
    .from("inspections")
    .select("id, source_agency")
    .eq("facility_id", facility!.id)
    .limit(20);

  assert(!error, error?.message ?? "inspections query failed");
  assert(inspections !== null && inspections.length > 0, "No inspections");

  const missing = inspections!.filter((i: { source_agency: string | null }) => !i.source_agency);
  assert(
    missing.length === 0,
    `${missing.length} Opal Care inspections have no source_agency (ERRORS.md 2026-05)`,
  );
});

test("CA Opal Care: facility_snapshot RPC returns data", async (sb) => {
  const { data: facility } = await sb
    .from("facilities")
    .select("id")
    .eq("license_number", CA_OPAL_CARE_LICENSE)
    .eq("state_code", "CA")
    .single();

  assert(facility !== null, "Opal Care not found");

  const { data, error } = await sb.rpc("facility_snapshot", {
    p_facility_id: facility!.id,
  });

  assert(!error, `facility_snapshot RPC error: ${error?.message}`);
  assert(data !== null, "facility_snapshot returned null for Opal Care");

  // Verify the shape of the snapshot (matches SnapshotPayload type)
  const snap = data as Record<string, unknown>;
  assert("facility" in snap, "snapshot missing 'facility' key");
  assert("peer_set" in snap, "snapshot missing 'peer_set' key");
  assert("metrics" in snap, "snapshot missing 'metrics' key");
  assert("has_inspections" in snap, "snapshot missing 'has_inspections' key");
  assert("trajectory_series" in snap, "snapshot missing 'trajectory_series' key");
  assert("heatmap" in snap, "snapshot missing 'heatmap' key");

  const metrics = snap.metrics as Record<string, unknown>;
  assert("severity" in metrics, "snapshot metrics missing 'severity'");
  assert("repeats" in metrics, "snapshot metrics missing 'repeats'");
  assert("frequency" in metrics, "snapshot metrics missing 'frequency'");
  assert("trajectory" in metrics, "snapshot metrics missing 'trajectory'");
});

// ---------------------------------------------------------------------------
// Tests: PA Rittenhouse known fixture
// ---------------------------------------------------------------------------

test("PA Rittenhouse: facility exists by license number", async (sb) => {
  const { data, error } = await sb
    .from("facilities")
    .select("id, name, license_number, publishable, serves_memory_care, mc_review_status, mc_designation_type, memory_care_disclosure_filed")
    .eq("license_number", PA_RITTENHOUSE_LICENSE)
    .eq("state_code", "PA")
    .limit(1);

  assert(!error, `Query failed: ${error?.message}`);
  assert(
    data !== null && data.length === 1,
    `PA Rittenhouse not found (license ${PA_RITTENHOUSE_LICENSE})`,
  );
});

test("PA Rittenhouse: publishable=true and serves_memory_care=true", async (sb) => {
  const { data, error } = await sb
    .from("facilities")
    .select("publishable, serves_memory_care, mc_review_status")
    .eq("license_number", PA_RITTENHOUSE_LICENSE)
    .eq("state_code", "PA")
    .single();

  assert(!error, error?.message ?? "Query failed");
  assert(data?.publishable === true, "PA Rittenhouse publishable is not true");
  assert(data?.serves_memory_care === true, "PA Rittenhouse serves_memory_care is not true");
  assert(
    data?.mc_review_status === "auto_published",
    `PA Rittenhouse mc_review_status='${data?.mc_review_status}' (expected 'auto_published')`,
  );
});

test("PA Rittenhouse: mc_designation_type is set", async (sb) => {
  const { data, error } = await sb
    .from("facilities")
    .select("mc_designation_type, memory_care_disclosure_filed")
    .eq("license_number", PA_RITTENHOUSE_LICENSE)
    .eq("state_code", "PA")
    .single();

  assert(!error, error?.message ?? "Query failed");
  assert(
    data?.mc_designation_type !== null,
    "PA Rittenhouse mc_designation_type is NULL — PA Tier-1 signal not set",
  );
  assert(
    data?.memory_care_disclosure_filed === true,
    "PA Rittenhouse memory_care_disclosure_filed is not true",
  );
});

// ---------------------------------------------------------------------------
// Tests: API data shape for each covered state
// ---------------------------------------------------------------------------

for (const stateCode of COVERED_STATE_CODES) {
  test(`${stateCode}: facility rows have required API fields`, async (sb) => {
    // This mirrors the SELECT in /api/facilities/[state]/route.ts
    const { data, error } = await sb
      .from("facilities")
      .select(
        "id, name, slug, city_slug, street, city, zip, state_code, " +
        "latitude, longitude, license_number, license_type, beds, " +
        "care_category, serves_memory_care, capacity_tier, " +
        "last_inspection_date, updated_at",
      )
      .eq("state_code", stateCode)
      .eq("publishable", true)
      .limit(5);

    assert(!error, `${stateCode} facilities query failed: ${error?.message}`);
    assert(data !== null && data.length > 0, `${stateCode}: no publishable facilities returned`);

    // Validate required fields on every returned row
    for (const row of data!) {
      const r = row as Record<string, unknown>;
      assert(typeof r.id === "string", `${stateCode}: id is not a string`);
      assert(typeof r.name === "string" && r.name.length > 0, `${stateCode}: name is empty`);
      assert(typeof r.slug === "string" && r.slug.length > 0, `${stateCode}: slug is empty`);
      assert(typeof r.city_slug === "string" && r.city_slug.length > 0, `${stateCode}: city_slug is empty`);
      assert(r.state_code === stateCode, `${stateCode}: state_code mismatch`);
      assert(typeof r.serves_memory_care === "boolean", `${stateCode}: serves_memory_care is not boolean`);
      assert(r.care_category !== null && r.care_category !== undefined, `${stateCode}: care_category is null`);
    }
  });
}

// ---------------------------------------------------------------------------
// Tests: inspections query pattern (chunked, matches ERRORS.md fix)
// ---------------------------------------------------------------------------

test("inspections chunked query returns complete results (ERRORS.md 2026-05 regression)", async (sb) => {
  // Get all CA publishable facility IDs
  const { data: facilities, error: facError } = await sb
    .from("facilities")
    .select("id")
    .eq("state_code", "CA")
    .eq("publishable", true)
    .limit(300);

  assert(!facError, `Facilities query failed: ${facError?.message}`);
  assert(facilities !== null && facilities!.length > 0, "No CA facilities found");

  const facilityIds = facilities!.map((f: { id: string }) => f.id);

  // Chunk by 150 (the fix from ERRORS.md)
  const CHUNK_SIZE = 150;
  let totalInspections = 0;

  for (let i = 0; i < facilityIds.length; i += CHUNK_SIZE) {
    const chunk = facilityIds.slice(i, i + CHUNK_SIZE);
    const { data: inspData, error: inspError } = await sb
      .from("inspections")
      .select("facility_id, total_deficiency_count")
      .in("facility_id", chunk)
      .limit(5000);

    assert(!inspError, `Chunked inspections query failed at chunk ${i}: ${inspError?.message}`);
    totalInspections += inspData?.length ?? 0;
  }

  // Must have more than PostgREST's default 1000-row cap to prove chunking works
  assert(
    totalInspections > 1000,
    `Got ${totalInspections} total CA inspections. Expected >1000 to prove the chunking fix works. ` +
    `ERRORS.md 2026-05: un-chunked query silently truncated at 1000 rows.`,
  );
});

// ---------------------------------------------------------------------------
// Tests: facility_snapshot RPC shape validation
// ---------------------------------------------------------------------------

test("facility_snapshot RPC: returns trajectory_series as array", async (sb) => {
  // Use any CA publishable facility
  const { data: facility } = await sb
    .from("facilities")
    .select("id")
    .eq("state_code", "CA")
    .eq("publishable", true)
    .limit(1)
    .single();

  assert(facility !== null, "No CA publishable facility found");

  const { data, error } = await sb.rpc("facility_snapshot", {
    p_facility_id: facility!.id,
  });

  assert(!error, `facility_snapshot RPC error: ${error?.message}`);
  assert(data !== null, "facility_snapshot returned null");

  const snap = data as Record<string, unknown>;
  assert(Array.isArray(snap.trajectory_series), "trajectory_series must be an array");
  assert(Array.isArray(snap.heatmap), "heatmap must be an array");

  const peerSet = snap.peer_set as Record<string, unknown>;
  assert(typeof peerSet.n === "number", "peer_set.n must be a number");
  assert(typeof peerSet.fallback_level === "number", "peer_set.fallback_level must be a number");
  assert(typeof peerSet.definition === "string", "peer_set.definition must be a string");
});

test("facility_snapshot RPC: trajectory_series entries have required fields", async (sb) => {
  const { data: facility } = await sb
    .from("facilities")
    .select("id")
    .eq("state_code", "CA")
    .eq("publishable", true)
    .limit(1)
    .single();

  assert(facility !== null, "No CA publishable facility found");

  const { data } = await sb.rpc("facility_snapshot", {
    p_facility_id: facility!.id,
  });

  const snap = data as Record<string, unknown>;
  const series = snap.trajectory_series as Array<Record<string, unknown>>;

  if (series.length === 0) return; // facility has no inspection history — still valid

  const first = series[0];
  assert("month" in first, "trajectory_series entry missing 'month'");
  assert("facility_score" in first, "trajectory_series entry missing 'facility_score'");
  assert("peer_median_score" in first, "trajectory_series entry missing 'peer_median_score'");
});

// ---------------------------------------------------------------------------
// Tests: historical city slug redirect data
// ---------------------------------------------------------------------------

test("no facility has current city_slug in historical_city_slugs (would cause redirect loop)", async (sb) => {
  // Check a sample of facilities from each state
  const { data, error } = await sb
    .from("facilities")
    .select("id, city_slug, historical_city_slugs, state_code")
    .not("historical_city_slugs", "is", null)
    .limit(500);

  assert(!error, `Query failed: ${error?.message}`);

  const looping = (data ?? []).filter((f: {
    city_slug: string;
    historical_city_slugs: string[] | null;
  }) =>
    f.historical_city_slugs !== null &&
    f.historical_city_slugs.includes(f.city_slug)
  );

  assert(
    looping.length === 0,
    `${looping.length} facilities have their current city_slug in historical_city_slugs. ` +
    `Would cause redirect loop in loadFacilityProfile.`,
  );
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Add them to .env.local.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await runAll(supabase);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
