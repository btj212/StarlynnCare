/**
 * Tests: Supabase database integrity via @supabase/supabase-js.
 *
 * These tests call the real Supabase instance over HTTPS and verify the
 * complete data shape, counts, and invariants. They skip when env vars
 * are not configured (see ERRORS.md 2026-06 about legacy key disabling).
 *
 * Run: vitest run tests/typescript/live/supabase_integrity.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient;

beforeAll(() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      "⚠  Skipping live DB tests: NEXT_PUBLIC_SUPABASE_URL or key not set"
    );
    return;
  }

  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

function skipIfNoClient() {
  if (!supabase) {
    return true;
  }
  return false;
}

// ── facilities table ──────────────────────────────────────────────────────────

describe("facilities table", () => {
  it("is accessible and has ≥1,000 publishable rows", async () => {
    if (skipIfNoClient()) return;
    const { count, error } = await supabase
      .from("facilities")
      .select("*", { count: "exact", head: true })
      .eq("publishable", true);
    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(1000);
  });

  it("a publishable facility has all required non-null columns", async () => {
    if (skipIfNoClient()) return;
    const { data, error } = await supabase
      .from("facilities")
      .select("id,state_code,name,city,city_slug,slug,care_category,mc_review_status,serves_memory_care")
      .eq("publishable", true)
      .limit(10)
      .order("updated_at", { ascending: false });

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    for (const row of data!) {
      expect(row.id).toBeTruthy();
      expect(row.state_code).toBeTruthy();
      expect(row.name).toBeTruthy();
      expect(row.city_slug).toBeTruthy();
      expect(row.slug).toBeTruthy();
      expect(row.care_category).toBeTruthy();
      expect(row.mc_review_status).not.toBeNull();
      expect(row.serves_memory_care).toBe(true);
    }
  });

  it("zero publishable facilities have serves_memory_care=false", async () => {
    if (skipIfNoClient()) return;
    const { count, error } = await supabase
      .from("facilities")
      .select("*", { count: "exact", head: true })
      .eq("publishable", true)
      .eq("serves_memory_care", false);

    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it("PA has ≥350 publishable facilities", async () => {
    if (skipIfNoClient()) return;
    const { count, error } = await supabase
      .from("facilities")
      .select("*", { count: "exact", head: true })
      .eq("state_code", "PA")
      .eq("publishable", true);

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(350);
  });
});

// ── inspections table ─────────────────────────────────────────────────────────

describe("inspections table", () => {
  it("has ≥50,000 rows", async () => {
    if (skipIfNoClient()) return;
    const { count, error } = await supabase
      .from("inspections")
      .select("*", { count: "exact", head: true });

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(50000);
  });

  it("recent inspections have valid inspection_date format (YYYY-MM-DD)", async () => {
    if (skipIfNoClient()) return;
    const { data, error } = await supabase
      .from("inspections")
      .select("id,inspection_date,source_agency")
      .order("inspection_date", { ascending: false })
      .limit(50);

    expect(error).toBeNull();
    for (const row of data!) {
      expect(row.id).toBeTruthy();
      expect(row.inspection_date).toBeTruthy();
      // Date must be parseable
      const d = new Date(row.inspection_date);
      expect(isNaN(d.getTime())).toBe(false);
      // Date should not be in the future
      expect(d.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });
});

// ── deficiencies table ────────────────────────────────────────────────────────

describe("deficiencies table", () => {
  it("has ≥500,000 rows", async () => {
    if (skipIfNoClient()) return;
    const { count, error } = await supabase
      .from("deficiencies")
      .select("*", { count: "exact", head: true });

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(500000);
  });

  it("severity values are 1–4 (or null) on a sample", async () => {
    if (skipIfNoClient()) return;
    const { data, error } = await supabase
      .from("deficiencies")
      .select("id,severity,scope")
      .limit(100);

    expect(error).toBeNull();
    for (const row of data!) {
      if (row.severity !== null) {
        expect([1, 2, 3, 4]).toContain(row.severity);
      }
      if (row.scope !== null) {
        expect(["isolated", "pattern", "widespread"]).toContain(row.scope);
      }
    }
  });
});

// ── facility_snapshot RPC ─────────────────────────────────────────────────────

describe("facility_snapshot RPC", () => {
  it("returns a valid snapshot for a publishable CA facility", async () => {
    if (skipIfNoClient()) return;

    // Find a CA facility with inspections
    const { data: facilities } = await supabase
      .from("facilities")
      .select("id")
      .eq("state_code", "CA")
      .eq("publishable", true)
      .limit(5);

    if (!facilities?.length) return;

    let snapshot = null;
    for (const fac of facilities) {
      const { data } = await supabase.rpc("facility_snapshot", {
        p_facility_id: fac.id,
      });
      if (data) {
        snapshot = data;
        break;
      }
    }

    if (!snapshot) return; // Skip if no facility has inspections

    expect(snapshot).toBeTruthy();
    expect(snapshot.facility).toBeTruthy();
    expect(snapshot.peer_set).toBeTruthy();
    expect(snapshot.metrics).toBeTruthy();

    const metrics = snapshot.metrics;
    for (const metricName of ["severity", "repeats", "frequency", "trajectory"]) {
      expect(metrics[metricName]).toBeTruthy();
      expect(typeof metrics[metricName].value).toBe("number");
      expect(typeof metrics[metricName].peer_median).toBe("number");
    }
  });

  it("returns null for a non-existent facility ID", async () => {
    if (skipIfNoClient()) return;
    const { data, error } = await supabase.rpc("facility_snapshot", {
      p_facility_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("grade is A–F or null (never an invalid letter)", async () => {
    if (skipIfNoClient()) return;

    const { data: facilities } = await supabase
      .from("facilities")
      .select("id")
      .eq("state_code", "PA")
      .eq("publishable", true)
      .limit(10);

    if (!facilities?.length) return;

    for (const fac of facilities.slice(0, 3)) {
      const { data } = await supabase.rpc("facility_snapshot", {
        p_facility_id: fac.id,
      });
      if (data?.grade) {
        expect(["A", "B", "C", "D", "F"]).toContain(data.grade.letter);
        expect(data.grade.composite_percentile).toBeGreaterThanOrEqual(0);
        expect(data.grade.composite_percentile).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ── PA reference fixtures ─────────────────────────────────────────────────────

describe("PA reference fixtures", () => {
  const fixtures = [
    { license: "223010", name: "Rittenhouse Village at Lehigh Valley" },
    { license: "231010", name: "Serenity Gardens" },
    { license: "456560", name: "Cambridge Village" },
  ];

  for (const fixture of fixtures) {
    it(`${fixture.name} (license ${fixture.license}) is publishable`, async () => {
      if (skipIfNoClient()) return;
      const { data, error } = await supabase
        .from("facilities")
        .select("id,name,publishable,serves_memory_care")
        .eq("state_code", "PA")
        .eq("license_number", fixture.license)
        .limit(1);

      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
      expect(data![0].publishable).toBe(true);
      expect(data![0].serves_memory_care).toBe(true);
    });
  }
});

// ── hub_content table ─────────────────────────────────────────────────────────

describe("hub_content table", () => {
  it("is accessible via anon key (RLS allows published rows)", async () => {
    if (skipIfNoClient()) return;
    const { error } = await supabase
      .from("hub_content")
      .select("id,state_code,region_slug,status")
      .eq("status", "published")
      .limit(5);

    // If the table doesn't exist yet (pre-migration), skip rather than fail
    if (error?.code === "42P01") return; // table does not exist
    expect(error).toBeNull();
  });
});

// ── states table ──────────────────────────────────────────────────────────────

describe("states table", () => {
  it("has rows for all 8 covered states", async () => {
    if (skipIfNoClient()) return;
    const COVERED = ["CA", "OR", "WA", "TX", "MN", "UT", "IL", "PA"];

    const { data, error } = await supabase
      .from("states")
      .select("code,name")
      .in("code", COVERED);

    expect(error).toBeNull();
    const codes = new Set(data?.map((r) => r.code));
    for (const code of COVERED) {
      expect(codes.has(code)).toBe(true);
    }
  });
});
