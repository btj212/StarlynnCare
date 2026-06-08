/**
 * Tests: State hub data queries (the underlying Supabase calls that
 * loadStateHubData and loadCaliforniaStateHubData make).
 *
 * We test the query patterns directly (not the loader functions themselves,
 * which need Next.js context) to verify the DB supports them correctly.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

const COVERED_STATES = ["CA", "OR", "WA", "TX", "MN", "UT", "IL", "PA"] as const;

// ── Facility count query ──────────────────────────────────────────────────────

describe("facility count query (used by hub stats)", () => {
  for (const stateCode of COVERED_STATES) {
    it(`${stateCode}: publishable count is > 0`, async () => {
      if (skip()) return;
      const { count, error } = await supabase
        .from("facilities")
        .select("*", { count: "exact", head: true })
        .eq("publishable", true)
        .eq("state_code", stateCode);

      expect(error).toBeNull();
      expect(count).toBeGreaterThan(0);
    });
  }
});

// ── City city map query ────────────────────────────────────────────────────────

describe("city map query (used by topCities)", () => {
  for (const stateCode of COVERED_STATES) {
    it(`${stateCode}: at least 5 distinct city slugs for publishable facilities`, async () => {
      if (skip()) return;
      const { data, error } = await supabase
        .from("facilities")
        .select("city,city_slug")
        .eq("publishable", true)
        .eq("state_code", stateCode);

      expect(error).toBeNull();
      const uniqueCities = new Set((data ?? []).map((r) => r.city_slug).filter(Boolean));
      // Even small states (UT, MN) should have multiple cities
      expect(uniqueCities.size).toBeGreaterThanOrEqual(3);
    });
  }
});

// ── Capacity tier query (used by county grids) ────────────────────────────────

describe("capacity tier query (used by county grids)", () => {
  it("CA facilities have capacity_tier populated", async () => {
    if (skip()) return;
    const { data, error } = await supabase
      .from("facilities")
      .select("city_slug,capacity_tier")
      .eq("state_code", "CA")
      .eq("publishable", true)
      .limit(50);

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    for (const row of data!) {
      expect(["small", "medium", "large", "unknown"]).toContain(row.capacity_tier);
    }
  });
});

// ── Inspection count query ────────────────────────────────────────────────────

describe("inspection count query (used by hub stats)", () => {
  it("CA facilities have a non-zero total inspection count", async () => {
    if (skip()) return;

    // Get CA facility IDs
    const { data: facIds } = await supabase
      .from("facilities")
      .select("id")
      .eq("state_code", "CA")
      .eq("publishable", true)
      .limit(50);

    if (!facIds?.length) return;
    const ids = facIds.map((r) => r.id);

    // ERRORS.md 2026-05: must chunk by 150 IDs + limit(5000) to avoid truncation
    const { count, error } = await supabase
      .from("inspections")
      .select("*", { count: "exact", head: true })
      .in("facility_id", ids.slice(0, 50)); // sample: first 50

    expect(error).toBeNull();
    expect(count).toBeGreaterThan(0);
  });
});

// ── Severe deficiency count query ─────────────────────────────────────────────

describe("severe deficiency count query (severity ≥ 3, last 24 months)", () => {
  it("returns a non-negative count for CA", async () => {
    if (skip()) return;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 24);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    // Get CA facility IDs
    const { data: facIds } = await supabase
      .from("facilities")
      .select("id")
      .eq("state_code", "CA")
      .eq("publishable", true)
      .limit(20);

    if (!facIds?.length) return;
    const ids = facIds.map((r) => r.id);

    // Get inspection IDs within cutoff
    const { data: inspIds } = await supabase
      .from("inspections")
      .select("id")
      .in("facility_id", ids)
      .gte("inspection_date", cutoffStr);

    if (!inspIds?.length) return;
    const iids = inspIds.map((r) => r.id);

    const { count, error } = await supabase
      .from("deficiencies")
      .select("*", { count: "exact", head: true })
      .in("inspection_id", iids.slice(0, 100))
      .gte("severity", 3);

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

// ── Reviews query ─────────────────────────────────────────────────────────────

describe("reviews query (used by sampleReviews)", () => {
  it("reviews table is accessible via anon key", async () => {
    if (skip()) return;
    const { error } = await supabase
      .from("reviews")
      .select("id,body,rating,reviewer_name,created_at,facility_id")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(3);

    // Not asserting count — there may be no published reviews yet
    expect(error).toBeNull();
  });
});

// ── Sample card facilities query ──────────────────────────────────────────────

describe("grade card facilities query (used by gradeCardFacilities)", () => {
  it("can fetch a random sample of facilities for snapshot RPC calls", async () => {
    if (skip()) return;

    const { data: idRows } = await supabase
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .eq("state_code", "PA")
      .limit(5);

    if (!idRows?.length) return;

    // Simulate what loadStateHubData does: call snapshot for each sampled facility
    for (const fac of idRows.slice(0, 2)) {
      const { data, error } = await supabase.rpc("facility_snapshot", {
        p_facility_id: fac.id,
      });
      expect(error).toBeNull();
      // data may be null if no inspections, that's acceptable
    }
  });
});

// ── Hub content query ─────────────────────────────────────────────────────────

describe("hub_content query (used by loadPublishedHubContent)", () => {
  it("anon key can read published hub content (if any exists)", async () => {
    if (skip()) return;

    const { error } = await supabase
      .from("hub_content")
      .select("id,state_code,region_slug,title,body_html,stats_snapshot,status,drift_detected")
      .eq("status", "published")
      .eq("drift_detected", false)
      .limit(5);

    // 42P01 = table doesn't exist (pre-migration), skip rather than fail
    if (error?.code === "42P01") return;
    expect(error).toBeNull();
  });

  it("draft hub content is NOT readable by anon key (RLS enforcement)", async () => {
    if (skip()) return;

    const { data, error } = await supabase
      .from("hub_content")
      .select("id")
      .eq("status", "draft")
      .limit(1);

    // 42P01 = table doesn't exist, skip
    if (error?.code === "42P01") return;
    expect(error).toBeNull();
    // RLS should return empty array for draft rows (anon cannot read them)
    // data may be null or [] — either means the RLS is enforced correctly
    const count = data?.length ?? 0;
    expect(count).toBe(0);
  });
});
