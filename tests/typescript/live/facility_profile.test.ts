/**
 * Tests: loadFacilityProfile() for representative facilities from all 8 states.
 *
 * This function is the critical data-assembly layer for every facility page.
 * It calls Supabase, the facility_snapshot RPC, and multiple derivation functions.
 * A wrong shape here means family members see broken data.
 *
 * These tests skip when Supabase env vars are not configured.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// We can't call loadFacilityProfile directly (it uses Next.js internals like notFound()).
// Instead, we test the underlying Supabase queries and shape assertions directly.
// The full integration test for the rendered page is in api_routes.test.ts.

// What we DO test here:
//   1. fetchFacility: a publishable facility can be looked up by state+city+slug
//   2. fetchInspectionsAndDeficiencies: returns InspectionRow[] + DeficiencyRow[]
//   3. facility_snapshot RPC: returns SnapshotPayload with correct shape
//   4. The deficienciesByInspection map is consistent
//   5. State-specific signal columns (waMcSignals, orMcSignals) are present

let supabase: SupabaseClient;

beforeAll(() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

function skip() {
  return !supabase;
}

// ── Helper: find a publishable facility with inspections ──────────────────────

async function findFacilityWithInspections(stateCode: string): Promise<{
  id: string;
  slug: string;
  city_slug: string;
  name: string;
} | null> {
  if (!supabase) return null;
  const { data: facs } = await supabase
    .from("facilities")
    .select("id,slug,city_slug,name")
    .eq("state_code", stateCode)
    .eq("publishable", true)
    .limit(10)
    .order("updated_at", { ascending: false });

  if (!facs?.length) return null;

  for (const fac of facs) {
    const { data: insps } = await supabase
      .from("inspections")
      .select("id")
      .eq("facility_id", fac.id)
      .limit(1);
    if (insps?.length) return fac;
  }
  return null;
}

// ── Facility lookup ───────────────────────────────────────────────────────────

describe("facility lookup by slug", () => {
  it("fetchFacility-equivalent query returns a publishable facility for each state", async () => {
    if (skip()) return;
    const states = ["CA", "OR", "WA", "TX", "MN", "IL", "PA"];
    for (const stateCode of states) {
      const fac = await findFacilityWithInspections(stateCode);
      if (!fac) continue; // skip if no facilities found for this state

      // Simulate the fetchFacility query
      const { data, error } = await supabase
        .from("facilities")
        .select("*")
        .eq("state_code", stateCode)
        .eq("city_slug", fac.city_slug)
        .eq("slug", fac.slug)
        .eq("publishable", true)
        .limit(1);

      expect(error).toBeNull();
      expect(data?.length).toBe(1);
      const row = data![0];
      expect(row.state_code).toBe(stateCode);
      expect(row.publishable).toBe(true);
      expect(row.serves_memory_care).toBe(true);
    }
  });
});

// ── Inspection + deficiency data ──────────────────────────────────────────────

describe("fetchInspectionsAndDeficiencies equivalent", () => {
  it("inspections query returns InspectionRow shape", async () => {
    if (skip()) return;
    const fac = await findFacilityWithInspections("CA");
    if (!fac) return;

    const { data, error } = await supabase
      .from("inspections")
      .select(
        "id,inspection_date,inspection_type,is_complaint,complaint_id,total_deficiency_count,narrative_summary,source_url,source_agency,raw_data"
      )
      .eq("facility_id", fac.id)
      .order("inspection_date", { ascending: false })
      .limit(50);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    if (!data?.length) return;

    for (const insp of data) {
      expect(typeof insp.id).toBe("string");
      expect(typeof insp.inspection_date).toBe("string");
      expect(typeof insp.is_complaint).toBe("boolean");
      // source_agency may be null for old records
    }
  });

  it("deficiencies query returns DeficiencyRow shape", async () => {
    if (skip()) return;
    const fac = await findFacilityWithInspections("PA");
    if (!fac) return;

    const { data: insps } = await supabase
      .from("inspections")
      .select("id")
      .eq("facility_id", fac.id)
      .limit(10);

    if (!insps?.length) return;
    const inspIds = insps.map((i) => i.id);

    const { data, error } = await supabase
      .from("deficiencies")
      .select(
        "id,inspection_id,class,code,severity,scope,scope_severity_code,immediate_jeopardy,description,inspector_narrative,state_severity_raw,is_repeat"
      )
      .in("inspection_id", inspIds);

    expect(error).toBeNull();
    if (!data?.length) return;

    for (const def of data.slice(0, 10)) {
      expect(typeof def.id).toBe("string");
      expect(typeof def.inspection_id).toBe("string");
      // severity is 1–4 or null
      if (def.severity !== null) {
        expect([1, 2, 3, 4]).toContain(def.severity);
      }
      // is_repeat is boolean
      expect(typeof def.is_repeat).toBe("boolean");
    }
  });

  it("deficienciesByInspection map is consistent (no orphan deficiencies)", async () => {
    if (skip()) return;
    const fac = await findFacilityWithInspections("OR");
    if (!fac) return;

    const { data: insps } = await supabase
      .from("inspections")
      .select("id")
      .eq("facility_id", fac.id)
      .limit(20);

    if (!insps?.length) return;
    const inspIds = new Set(insps.map((i) => i.id));

    const { data: defs } = await supabase
      .from("deficiencies")
      .select("id,inspection_id")
      .in("inspection_id", Array.from(inspIds));

    if (!defs?.length) return;

    for (const def of defs) {
      expect(inspIds.has(def.inspection_id)).toBe(true);
    }
  });
});

// ── Per-state signal columns ──────────────────────────────────────────────────

describe("WA-specific signal columns", () => {
  it("WA facilities have wa_memory_care_certified column", async () => {
    if (skip()) return;
    const { data, error } = await supabase
      .from("facilities")
      .select("id,wa_memory_care_certified,wa_earc_sdc_contracted,wa_dementia_specialty")
      .eq("state_code", "WA")
      .eq("publishable", true)
      .limit(5);

    expect(error).toBeNull();
    if (!data?.length) return;
    for (const row of data) {
      // Columns exist (not undefined)
      expect("wa_memory_care_certified" in row).toBe(true);
      expect("wa_earc_sdc_contracted" in row).toBe(true);
      expect("wa_dementia_specialty" in row).toBe(true);
    }
  });

  it("every publishable WA facility has at least one MC signal set", async () => {
    if (skip()) return;
    const { data, error } = await supabase
      .from("facilities")
      .select("id,name,wa_memory_care_certified,wa_earc_sdc_contracted,wa_dementia_specialty")
      .eq("state_code", "WA")
      .eq("publishable", true)
      .limit(20);

    expect(error).toBeNull();
    if (!data?.length) return;
    for (const row of data) {
      const hasSignal =
        row.wa_memory_care_certified ||
        row.wa_earc_sdc_contracted ||
        row.wa_dementia_specialty;
      expect(hasSignal).toBe(true);
    }
  });
});

describe("OR-specific signal columns", () => {
  it("publishable OR facilities have mce_endorsed=true", async () => {
    if (skip()) return;
    const { data, error } = await supabase
      .from("facilities")
      .select("id,name,mce_endorsed,memory_care_disclosure_filed")
      .eq("state_code", "OR")
      .eq("publishable", true)
      .limit(10);

    expect(error).toBeNull();
    if (!data?.length) return;
    for (const row of data) {
      // OR publishable facilities must have the endorsement
      expect(row.mce_endorsed).toBe(true);
      // And the unified column mirrors it
      expect(row.memory_care_disclosure_filed).toBe(true);
    }
  });
});

// ── Snapshot payload shape ─────────────────────────────────────────────────────

describe("facility_snapshot payload shape for all states", () => {
  const STATES = ["CA", "OR", "WA", "TX", "MN", "IL", "PA"];

  for (const stateCode of STATES) {
    it(`snapshot for ${stateCode} facility has required top-level keys`, async () => {
      if (skip()) return;
      const fac = await findFacilityWithInspections(stateCode);
      if (!fac) return;

      const { data, error } = await supabase.rpc("facility_snapshot", {
        p_facility_id: fac.id,
      });

      expect(error).toBeNull();
      if (!data) return; // Some facilities may have no inspections yet

      const requiredKeys = ["facility", "peer_set", "metrics", "trajectory_series", "heatmap"];
      for (const key of requiredKeys) {
        expect(data).toHaveProperty(key);
      }

      // Metrics shape
      const metrics = data.metrics;
      for (const metric of ["severity", "repeats", "frequency", "trajectory"]) {
        expect(metrics).toHaveProperty(metric);
        expect(typeof metrics[metric].value).toBe("number");
        expect(typeof metrics[metric].peer_median).toBe("number");
      }

      // Trajectory series is an array
      expect(Array.isArray(data.trajectory_series)).toBe(true);

      // Grade is valid if present
      if (data.grade) {
        expect(["A", "B", "C", "D", "F"]).toContain(data.grade.letter);
        expect(data.grade.composite_percentile).toBeGreaterThanOrEqual(0);
        expect(data.grade.composite_percentile).toBeLessThanOrEqual(100);
      }
    });
  }
});
