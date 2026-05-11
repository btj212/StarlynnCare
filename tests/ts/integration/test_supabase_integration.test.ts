/**
 * Supabase integration tests — real DB, no mocks.
 *
 * These tests hit the actual Supabase database using the publishable (anon) key.
 * They validate:
 *   • The Supabase client can be created and connect
 *   • The facilities table is queryable and returns expected fields
 *   • The inspections table is queryable
 *   • The deficiencies table is queryable
 *   • The facility_snapshot() RPC is callable
 *   • Publishable facilities have the expected field shapes
 *   • The data layer (loadFacilityProfile) resolves correctly for real slugs
 *
 * Skips gracefully when NEXT_PUBLIC_SUPABASE_URL is not set.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Client setup
// ─────────────────────────────────────────────────────────────────────────────

let supabase: SupabaseClient | null = null;

beforeAll(() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return; // skip all — handled per-test
  supabase = createClient(url, key);
});

function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("SKIP");
  }
  return supabase;
}

function skipIfNoSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection
// ─────────────────────────────────────────────────────────────────────────────

describe("Supabase connection", () => {
  it("can create client with env vars", () => {
    if (skipIfNoSupabase()) return;
    expect(supabase).not.toBeNull();
  });

  it("can query states table (confirms connection)", async () => {
    if (skipIfNoSupabase()) return;
    const { data, error } = await supabase!.from("states").select("code, name").limit(5);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("states table returns code and name for CA", async () => {
    if (skipIfNoSupabase()) return;
    const { data, error } = await supabase!.from("states").select("code, name").eq("code", "CA").limit(1);
    expect(error).toBeNull();
    const rows = data as Array<{ code: string; name: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe("CA");
    expect(rows[0].name).toBe("California");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// facilities table
// ─────────────────────────────────────────────────────────────────────────────

describe("facilities table (real Supabase)", () => {
  it("returns publishable facilities", async () => {
    if (skipIfNoSupabase()) return;
    const { data, error } = await supabase!
      .from("facilities")
      .select("id, name, state_code, city_slug, slug, beds, care_category, publishable")
      .eq("publishable", true)
      .limit(10);
    expect(error).toBeNull();
    const rows = data as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
  });

  it("publishable facilities all have publishable=true", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("facilities")
      .select("id, publishable")
      .eq("publishable", true)
      .limit(20);
    const rows = data as Array<{ id: string; publishable: boolean }>;
    for (const row of rows) {
      expect(row.publishable).toBe(true);
    }
  });

  it("every publishable facility has required fields non-null", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("facilities")
      .select("id, name, state_code, city_slug, slug")
      .eq("publishable", true)
      .limit(20);
    const rows = data as Array<Record<string, unknown>>;
    for (const row of rows) {
      expect(typeof row["id"]).toBe("string");
      expect(typeof row["name"]).toBe("string");
      expect((row["name"] as string).length).toBeGreaterThan(0);
      expect(typeof row["state_code"]).toBe("string");
      expect(typeof row["city_slug"]).toBe("string");
      expect(typeof row["slug"]).toBe("string");
    }
  });

  it("facility state_codes are 2-char strings", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("facilities")
      .select("state_code")
      .eq("publishable", true)
      .limit(20);
    const rows = data as Array<{ state_code: string }>;
    for (const row of rows) {
      expect(row.state_code).toHaveLength(2);
    }
  });

  it("facility care_category values are from known set", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("facilities")
      .select("care_category")
      .eq("publishable", true)
      .limit(50);
    const validCategories = new Set([
      "rcfe_memory_care", "rcfe_general", "alf_mc", "alf_general",
      "snf_general", "snf_dementia_scu", "ccrc", "unknown",
    ]);
    const rows = data as Array<{ care_category: string | null }>;
    for (const row of rows) {
      if (row.care_category) {
        expect(validCategories.has(row.care_category)).toBe(true);
      }
    }
  });

  it("beds values are positive integers or null", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("facilities")
      .select("beds")
      .eq("publishable", true)
      .limit(50);
    const rows = data as Array<{ beds: number | null }>;
    for (const row of rows) {
      if (row.beds !== null) {
        expect(typeof row.beds).toBe("number");
        expect(row.beds).toBeGreaterThan(0);
      }
    }
  });

  it("capacity_tier is one of expected values", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("facilities")
      .select("capacity_tier")
      .eq("publishable", true)
      .limit(50);
    const valid = new Set(["small", "medium", "large", "unknown"]);
    const rows = data as Array<{ capacity_tier: string | null }>;
    for (const row of rows) {
      if (row.capacity_tier) {
        expect(valid.has(row.capacity_tier)).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// inspections table
// ─────────────────────────────────────────────────────────────────────────────

describe("inspections table (real Supabase)", () => {
  it("returns inspection records", async () => {
    if (skipIfNoSupabase()) return;
    const { data, error } = await supabase!
      .from("inspections")
      .select("id, facility_id, inspection_date, inspection_type, is_complaint, total_deficiency_count")
      .limit(10);
    expect(error).toBeNull();
    const rows = data as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
  });

  it("inspection_date is ISO YYYY-MM-DD format", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("inspections")
      .select("inspection_date")
      .limit(20);
    const rows = data as Array<{ inspection_date: string }>;
    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const row of rows) {
      expect(row.inspection_date).toMatch(isoDateRe);
    }
  });

  it("inspection_type values are from known set", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("inspections")
      .select("inspection_type")
      .limit(50);
    const valid = new Set(["standard", "complaint", "follow-up", "focused", null]);
    const rows = data as Array<{ inspection_type: string | null }>;
    for (const row of rows) {
      if (row.inspection_type !== null) {
        expect(valid.has(row.inspection_type)).toBe(true);
      }
    }
  });

  it("is_complaint is boolean", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("inspections")
      .select("is_complaint")
      .limit(20);
    const rows = data as Array<{ is_complaint: boolean }>;
    for (const row of rows) {
      expect(typeof row.is_complaint).toBe("boolean");
    }
  });

  it("total_deficiency_count is non-negative integer or null", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("inspections")
      .select("total_deficiency_count")
      .limit(50);
    const rows = data as Array<{ total_deficiency_count: number | null }>;
    for (const row of rows) {
      if (row.total_deficiency_count !== null) {
        expect(typeof row.total_deficiency_count).toBe("number");
        expect(row.total_deficiency_count).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deficiencies table
// ─────────────────────────────────────────────────────────────────────────────

describe("deficiencies table (real Supabase)", () => {
  it("returns deficiency records", async () => {
    if (skipIfNoSupabase()) return;
    const { data, error } = await supabase!
      .from("deficiencies")
      .select("id, inspection_id, severity, scope, immediate_jeopardy, is_repeat")
      .limit(10);
    expect(error).toBeNull();
    const rows = data as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
  });

  it("severity values are 1-4 or null", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("deficiencies")
      .select("severity")
      .limit(100);
    const rows = data as Array<{ severity: number | null }>;
    for (const row of rows) {
      if (row.severity !== null) {
        expect(row.severity).toBeGreaterThanOrEqual(1);
        expect(row.severity).toBeLessThanOrEqual(4);
      }
    }
  });

  it("scope values are from known set or null", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("deficiencies")
      .select("scope")
      .limit(100);
    const valid = new Set(["isolated", "pattern", "widespread", null]);
    const rows = data as Array<{ scope: string | null }>;
    for (const row of rows) {
      if (row.scope !== null) {
        expect(valid.has(row.scope)).toBe(true);
      }
    }
  });

  it("immediate_jeopardy is boolean", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("deficiencies")
      .select("immediate_jeopardy")
      .limit(50);
    const rows = data as Array<{ immediate_jeopardy: boolean }>;
    for (const row of rows) {
      expect(typeof row.immediate_jeopardy).toBe("boolean");
    }
  });

  it("is_repeat is boolean", async () => {
    if (skipIfNoSupabase()) return;
    const { data } = await supabase!
      .from("deficiencies")
      .select("is_repeat")
      .limit(50);
    const rows = data as Array<{ is_repeat: boolean }>;
    for (const row of rows) {
      expect(typeof row.is_repeat).toBe("boolean");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// facility_snapshot() RPC
// ─────────────────────────────────────────────────────────────────────────────

describe("facility_snapshot() RPC (real Supabase)", () => {
  it("returns null for non-existent UUID", async () => {
    if (skipIfNoSupabase()) return;
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const { data, error } = await supabase!.rpc("facility_snapshot", {
      p_facility_id: fakeId,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("returns valid snapshot for a real publishable facility", async () => {
    if (skipIfNoSupabase()) return;

    // Get any real publishable facility
    const { data: facRows } = await supabase!
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .limit(1);
    const rows = facRows as Array<{ id: string }> | null;
    if (!rows || rows.length === 0) return; // No publishable facilities yet

    const facilityId = rows[0].id;
    const { data, error } = await supabase!.rpc("facility_snapshot", {
      p_facility_id: facilityId,
    });

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const snap = data as Record<string, unknown>;
    const requiredKeys = ["facility", "peer_set", "metrics", "has_inspections", "trajectory_series", "heatmap"];
    for (const key of requiredKeys) {
      expect(snap).toHaveProperty(key);
    }
  });

  it("trajectory_series always has exactly 24 entries", async () => {
    if (skipIfNoSupabase()) return;

    const { data: facRows } = await supabase!
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .limit(5);
    const rows = facRows as Array<{ id: string }> | null;
    if (!rows || rows.length === 0) return;

    for (const { id } of rows) {
      const { data } = await supabase!.rpc("facility_snapshot", { p_facility_id: id });
      if (!data) continue;
      const snap = data as Record<string, unknown>;
      const series = snap["trajectory_series"] as unknown[];
      expect(series).toHaveLength(24);
    }
  });

  it("metrics block always has all 4 metrics", async () => {
    if (skipIfNoSupabase()) return;

    const { data: facRows } = await supabase!
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .limit(3);
    const rows = facRows as Array<{ id: string }> | null;
    if (!rows || rows.length === 0) return;

    for (const { id } of rows) {
      const { data } = await supabase!.rpc("facility_snapshot", { p_facility_id: id });
      if (!data) continue;
      const snap = data as Record<string, unknown>;
      const metrics = snap["metrics"] as Record<string, unknown>;
      expect(Object.keys(metrics).sort()).toEqual(
        ["frequency", "repeats", "severity", "trajectory"].sort()
      );
    }
  });

  it("grade letter is in valid set when present", async () => {
    if (skipIfNoSupabase()) return;

    const validLetters = new Set(["A", "A−", "B", "B−", "C", "C−", "D", "F"]);

    const { data: facRows } = await supabase!
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .limit(10);
    const rows = facRows as Array<{ id: string }> | null;
    if (!rows || rows.length === 0) return;

    for (const { id } of rows) {
      const { data } = await supabase!.rpc("facility_snapshot", { p_facility_id: id });
      if (!data) continue;
      const snap = data as Record<string, unknown>;
      const grade = snap["grade"] as { letter: string; composite_percentile: number } | null;
      if (grade !== null) {
        expect(validLetters.has(grade.letter)).toBe(true);
        expect(grade.composite_percentile).toBeGreaterThanOrEqual(0);
        expect(grade.composite_percentile).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full page data load — loadFacilityProfile equivalent via Supabase
// ─────────────────────────────────────────────────────────────────────────────

describe("Full facility page data load (real Supabase)", () => {
  it("can fetch facility by state_code + city_slug + slug", async () => {
    if (skipIfNoSupabase()) return;

    // Get a real publishable facility's slugs
    const { data: facRows } = await supabase!
      .from("facilities")
      .select("state_code, city_slug, slug, name, beds, care_category")
      .eq("publishable", true)
      .limit(1);
    const rows = facRows as Array<Record<string, string>> | null;
    if (!rows || rows.length === 0) return;

    const { state_code, city_slug, slug } = rows[0];

    // Query exactly as loadFacilityProfile does
    const { data, error } = await supabase!
      .from("facilities")
      .select("*")
      .eq("state_code", state_code)
      .eq("city_slug", city_slug)
      .eq("slug", slug)
      .eq("publishable", true)
      .limit(1);

    expect(error).toBeNull();
    const facility = (data as Array<Record<string, unknown>>)?.[0];
    expect(facility).toBeDefined();
    expect(facility["name"]).toBe(rows[0]["name"]);
    expect(facility["state_code"]).toBe(state_code);
    expect(facility["city_slug"]).toBe(city_slug);
    expect(facility["slug"]).toBe(slug);
    expect(facility["publishable"]).toBe(true);
  });

  it("can fetch inspections for a real facility", async () => {
    if (skipIfNoSupabase()) return;

    const { data: facRows } = await supabase!
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .limit(1);
    const rows = facRows as Array<{ id: string }> | null;
    if (!rows || rows.length === 0) return;

    const facilityId = rows[0].id;
    const { data, error } = await supabase!
      .from("inspections")
      .select("id, inspection_date, inspection_type, is_complaint, total_deficiency_count, source_url, raw_data")
      .eq("facility_id", facilityId)
      .order("inspection_date", { ascending: false })
      .limit(50);

    expect(error).toBeNull();
    const inspections = data as Array<Record<string, unknown>> | null;
    // May be empty if no inspections for this facility, but the query must succeed
    expect(Array.isArray(inspections)).toBe(true);
  });

  it("can fetch deficiencies for real inspections", async () => {
    if (skipIfNoSupabase()) return;

    const { data: inspRows } = await supabase!
      .from("inspections")
      .select("id")
      .limit(5);
    const rows = inspRows as Array<{ id: string }> | null;
    if (!rows || rows.length === 0) return;

    const inspIds = rows.map((r) => r.id);
    const { data, error } = await supabase!
      .from("deficiencies")
      .select("id, inspection_id, severity, scope, immediate_jeopardy, is_repeat, ftag, description, inspector_narrative")
      .in("inspection_id", inspIds);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("complete facility data pipeline returns consistent snapshot", async () => {
    if (skipIfNoSupabase()) return;

    // Get a facility that has inspections
    const { data: facRows } = await supabase!
      .from("facilities")
      .select("id, name, state_code")
      .eq("publishable", true)
      .limit(20);
    const rows = facRows as Array<{ id: string; name: string; state_code: string }> | null;
    if (!rows || rows.length === 0) return;

    // Find one with inspections
    let facilityWithInspections: { id: string; name: string } | null = null;
    for (const fac of rows) {
      const { data: inspCheck } = await supabase!
        .from("inspections")
        .select("id")
        .eq("facility_id", fac.id)
        .limit(1);
      if (inspCheck && (inspCheck as unknown[]).length > 0) {
        facilityWithInspections = fac;
        break;
      }
    }

    if (!facilityWithInspections) return; // No facility with inspections available

    // Run snapshot
    const { data: snapData } = await supabase!.rpc("facility_snapshot", {
      p_facility_id: facilityWithInspections.id,
    });

    expect(snapData).not.toBeNull();
    const snap = snapData as Record<string, unknown>;

    // has_inspections must be true
    expect(snap["has_inspections"]).toBe(true);

    // Grade should be present
    expect(snap["grade"]).not.toBeNull();

    // Trajectory series 24 months
    const series = snap["trajectory_series"] as unknown[];
    expect(series).toHaveLength(24);

    // At least some months should have nonzero facility_score
    const nonzeroMonths = (series as Array<{ facility_score: number }>)
      .filter((m) => m.facility_score > 0);
    expect(nonzeroMonths.length).toBeGreaterThan(0);

    // Snapshot facility name matches
    const facBlock = snap["facility"] as Record<string, unknown>;
    expect(facBlock["name"]).toBe(facilityWithInspections.name);
  });
});
