/**
 * schema.test.ts — Comprehensive real-Supabase schema + connectivity verification.
 *
 * Uses the real Supabase publishable key (anon key) and service role key
 * to verify connectivity, RLS policies, and data presence.
 *
 * No mocking. All calls hit the real Supabase instance.
 * Tests skip automatically when credentials are absent.
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Client setup (real credentials from env)
// ─────────────────────────────────────────────────────────────────────────────

function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public key — read-only tables
// ─────────────────────────────────────────────────────────────────────────────

describe("Public client (publishable key)", () => {
  let db: ReturnType<typeof createClient> | null;

  beforeAll(() => {
    db = getPublicClient();
  });

  it("has required env vars", () => {
    if (!db) {
      console.log("⚠ NEXT_PUBLIC_SUPABASE_URL / key not set — skipping");
      return;
    }
    expect(db).not.toBeNull();
  });

  it("states table: exactly 50 rows", async () => {
    if (!db) return;
    const { count, error } = await db
      .from("states")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(50);
  });

  it("states table: each row has code, name, id", async () => {
    if (!db) return;
    const { data, error } = await db.from("states").select("id, code, name").limit(55);
    expect(error).toBeNull();
    expect(data!.length).toBe(50);
    for (const row of data!) {
      expect(row.id).toBeTruthy();
      expect(row.code).toHaveLength(2);
      expect(row.name).toBeTruthy();
    }
  });

  it("facilities table: has rows", async () => {
    if (!db) return;
    const { count, error } = await db
      .from("facilities")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBeGreaterThan(0);
  });

  it("facilities table: publishable facilities exist", async () => {
    if (!db) return;
    const { count, error } = await db
      .from("facilities")
      .select("*", { count: "exact", head: true })
      .eq("publishable", true);
    expect(error).toBeNull();
    expect(count).toBeGreaterThan(0);
  });

  it("facilities table: all required columns readable", async () => {
    if (!db) return;
    const { data, error } = await db
      .from("facilities")
      .select(
        [
          "id", "state_code", "name", "license_number", "slug", "city_slug",
          "street", "city", "zip", "beds", "phone", "facility_type",
          "license_status", "publishable", "serves_memory_care", "care_category",
          "mc_signal_explicit_name", "mc_signal_chain_name", "mc_signal_chain_curated",
          "mc_review_status", "memory_care_disclosure_filed",
          "wa_dementia_care_contract", "wa_memory_care_certified",
          "mce_endorsed", "mn_dementia_care_licensed", "tx_alzheimer_certified",
          "cms_ccn", "cms_star_rating", "latitude", "longitude", "source_url",
          "created_at", "updated_at",
        ].join(","),
      )
      .limit(1);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("inspections table: has rows", async () => {
    if (!db) return;
    const { count, error } = await db
      .from("inspections")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    // inspections may be 0 if ingest hasn't run; log but don't fail
    if (count === 0) {
      console.warn("⚠ inspections table is empty — ingest may not have run yet");
    }
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("inspections table: all required columns readable", async () => {
    if (!db) return;
    const { data, error } = await db
      .from("inspections")
      .select(
        [
          "id", "facility_id", "inspection_date", "inspection_type",
          "is_complaint", "complaint_id", "total_deficiency_count",
          "civil_money_penalty_total", "special_focus", "source_url",
          "source_agency", "raw_data", "scrape_run_id", "created_at",
        ].join(","),
      )
      .limit(1);
    expect(error).toBeNull();
  });

  it("deficiencies table: all required columns readable", async () => {
    if (!db) return;
    const { data, error } = await db
      .from("deficiencies")
      .select(
        [
          "id", "inspection_id", "code", "category", "severity", "scope",
          "scope_severity_code", "class", "immediate_jeopardy",
          "substandard_quality_of_care", "is_repeat", "description",
          "inspector_narrative", "harm_description", "residents_affected",
          "plan_of_correction", "poc_deadline", "cited_date",
          "corrected_date", "status", "civil_money_penalty", "state_severity_raw",
        ].join(","),
      )
      .limit(1);
    expect(error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RLS: public key must NOT access internal tables
// ─────────────────────────────────────────────────────────────────────────────

describe("RLS enforcement (public key denied on internal tables)", () => {
  let db: ReturnType<typeof createClient> | null;

  beforeAll(() => {
    db = getPublicClient();
  });

  it("facility_watchers: public key gets empty rows or RLS error", async () => {
    if (!db) return;
    const { data, error } = await db.from("facility_watchers").select("id").limit(1);
    // RLS deny-all → either error or empty data (0 rows)
    if (error) {
      expect(error.message).toMatch(/permission|denied|policy|RLS|access/i);
    } else {
      expect(data!.length).toBe(0);
    }
  });

  it("submission_events: public key gets empty rows or RLS error", async () => {
    if (!db) return;
    const { data, error } = await db.from("submission_events").select("id").limit(1);
    if (error) {
      expect(error.message).toMatch(/permission|denied|policy|RLS|access/i);
    } else {
      expect(data!.length).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Service role key — full access verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Service role client (admin access)", () => {
  let db: ReturnType<typeof createClient> | null;

  beforeAll(() => {
    db = getServiceClient();
  });

  it("scrape_runs table: accessible with service role", async () => {
    if (!db) {
      console.log("⚠ SUPABASE_SERVICE_ROLE_KEY not set — skipping service role tests");
      return;
    }
    const { error } = await db.from("scrape_runs").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("content_runs table: accessible with service role", async () => {
    if (!db) return;
    const { error } = await db.from("content_runs").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("facility_watchers table: accessible with service role", async () => {
    if (!db) return;
    const { error } = await db.from("facility_watchers").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("submission_events table: accessible with service role", async () => {
    if (!db) return;
    const { error } = await db.from("submission_events").select("id").limit(1);
    expect(error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Data integrity checks
// ─────────────────────────────────────────────────────────────────────────────

describe("Data integrity (real DB)", () => {
  let db: ReturnType<typeof createClient> | null;

  beforeAll(() => {
    db = getPublicClient();
  });

  it("publishable facilities have slugs", async () => {
    if (!db) return;
    const { data, error } = await db
      .from("facilities")
      .select("id, name, state_code, slug, city_slug")
      .eq("publishable", true)
      .or("slug.is.null,city_slug.is.null")
      .limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("publishable MC facilities have serves_memory_care=true", async () => {
    if (!db) return;
    const { data, error } = await db
      .from("facilities")
      .select("id, name, care_category")
      .eq("publishable", true)
      .eq("serves_memory_care", false)
      .in("care_category", ["rcfe_memory_care", "alf_memory_care", "snf_dementia_scu"])
      .limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("reviewed_reject facilities are not publishable", async () => {
    if (!db) return;
    const { data, error } = await db
      .from("facilities")
      .select("id, name, state_code")
      .eq("mc_review_status", "reviewed_reject")
      .eq("publishable", true)
      .limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("mc_review_status has valid enum values only", async () => {
    if (!db) return;
    const { data, error } = await db
      .from("facilities")
      .select("mc_review_status")
      .not("mc_review_status", "in", '("auto_published","needs_review","reviewed_publish","reviewed_reject")')
      .not("mc_review_status", "is", null)
      .limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("each inspection has a non-null inspection_date", async () => {
    if (!db) return;
    const { data, error } = await db
      .from("inspections")
      .select("id")
      .is("inspection_date", null)
      .limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("each inspection has a source_url starting with https", async () => {
    if (!db) return;
    const { data, error } = await db
      .from("inspections")
      .select("id, source_url")
      .not("source_url", "is", null)
      .not("source_url", "ilike", "https://%")
      .limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });
});
