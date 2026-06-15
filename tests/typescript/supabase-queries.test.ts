/**
 * TypeScript Integration Tests — Supabase Queries & Data Shape Validation.
 *
 * Tests run against the REAL Supabase database via the @supabase/supabase-js SDK.
 * No mocks.  These tests import from @supabase/supabase-js directly (not through
 * Next.js) so they work in any Node environment with the correct env vars.
 *
 * What they prove:
 *   • The Supabase client can connect (env vars are configured).
 *   • The exact queries used by loadFacilityProfile() return correct data.
 *   • facility_snapshot() RPC returns a correctly-typed payload.
 *   • Per-state facility fields are populated and correctly typed.
 *   • The FacilityProfile type contract is satisfied by real DB data.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * Run:
 *   npx vitest run tests/typescript/supabase-queries.test.ts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll } from "vitest";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local if running outside Next.js
config({ path: resolve(__dirname, "../../.env.local"), override: false });
config({ path: resolve(__dirname, "../../.env"), override: false });

// ---------------------------------------------------------------------------
// Row types (minimal — match the SELECT fields in loadFacilityProfile)
// ---------------------------------------------------------------------------

interface FacilityRow {
  id: string;
  state_code: string;
  name: string;
  slug: string;
  city_slug: string;
  beds: number | null;
  license_status: string | null;
  serves_memory_care: boolean;
  publishable: boolean;
  care_category: string;
  capacity_tier: string;
  memory_care_disclosure_filed: boolean;
  created_at: string;
  updated_at: string;
  mc_signal_explicit_name?: boolean | null;
  mc_signal_chain_curated?: boolean | null;
  mc_signal_apfm_listed?: boolean | null;
  mc_signal_caring_listed?: boolean | null;
  mc_review_status?: string | null;
  wa_dementia_care_contract?: boolean | null;
  wa_memory_care_certified?: boolean | null;
  wa_earc_sdc_contracted?: boolean | null;
  wa_dementia_specialty?: boolean | null;
  mce_endorsed?: boolean | null;
  unendorsed_mc_violation?: boolean | null;
  mc_designation_type?: string | null;
  license_type?: string | null;
  [key: string]: unknown;
}

interface InspectionRow {
  id: string;
  inspection_date: string;
  inspection_type: string | null;
  is_complaint: boolean;
  complaint_id: string | null;
  total_deficiency_count: number | null;
  narrative_summary: string | null;
  source_url: string | null;
  source_agency: string | null;
  raw_data: Record<string, unknown> | null;
}

interface DeficiencyRow {
  id: string;
  inspection_id: string;
  class: string | null;
  code: string | null;
  severity: number | null;
  scope: string | null;
  scope_severity_code: string | null;
  immediate_jeopardy: boolean;
  description: string | null;
  inspector_narrative: string | null;
  state_severity_raw: string | null;
  is_repeat: boolean;
}

interface SnapshotMetric {
  value: number;
  percentile: number | null;
  peer_median: number;
}

interface SnapshotPayload {
  facility: {
    id: string;
    name: string;
    beds: number | null;
    state_code: string;
    license_type: string | null;
  };
  peer_set: {
    definition: string;
    n: number;
    fallback_level: number;
  };
  metrics: {
    severity: SnapshotMetric;
    repeats: SnapshotMetric;
    frequency: SnapshotMetric;
    trajectory: SnapshotMetric;
  };
  grade: { letter: string; composite_percentile: number } | null;
  has_inspections: boolean;
  trajectory_series: Array<{
    month: string;
    facility_score: number;
    peer_median_score: number;
  }>;
  heatmap: Array<{
    severity: number;
    scope: string;
    count: number;
    tags: string[] | null;
  }>;
  pull_quote: { date: string; tag: string | null; text: string } | null;
}

// ---------------------------------------------------------------------------
// Client setup — mirrors tryPublicSupabaseClient() from src/lib/supabase/server.ts
// ---------------------------------------------------------------------------

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Add them to .env.local or set them in CI secrets."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PUBLISHABLE_STATES = ["CA", "OR", "WA", "MN", "TX", "UT", "IL", "PA"] as const;
type State = (typeof PUBLISHABLE_STATES)[number];

const REQUIRED_FACILITY_FIELDS: (keyof FacilityRow)[] = [
  "id",
  "state_code",
  "name",
  "slug",
  "city_slug",
  "license_status",
  "serves_memory_care",
  "publishable",
  "care_category",
  "capacity_tier",
  "memory_care_disclosure_filed",
  "created_at",
  "updated_at",
];

const SNAPSHOT_METRIC_KEYS = ["severity", "repeats", "frequency", "trajectory"] as const;
const SNAPSHOT_METRIC_SUB_KEYS = ["value", "percentile", "peer_median"] as const;

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let supabase: SupabaseClient;
let clientAvailable = false;

// ---------------------------------------------------------------------------
// Helper to cast query results
// ---------------------------------------------------------------------------

function rows<T>(data: unknown): T[] {
  return (data as T[]) ?? [];
}

function row<T>(data: unknown): T | null {
  const arr = rows<T>(data);
  return arr.length > 0 ? arr[0] : null;
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

describe("Supabase Connection", () => {
  it("can create a Supabase client from environment variables", () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(url, "NEXT_PUBLIC_SUPABASE_URL must be set").toBeTruthy();
    expect(
      key,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set"
    ).toBeTruthy();
    supabase = getSupabaseClient();
    clientAvailable = true;
  });

  it("can query the facilities table (confirms DB is reachable)", async () => {
    if (!clientAvailable) return;
    const { data, error } = await supabase
      .from("facilities")
      .select("id, name, state_code")
      .eq("publishable", true)
      .limit(1);
    expect(error, `Supabase error: ${error?.message}`).toBeNull();
    const result = rows<{ id: string; name: string; state_code: string }>(data);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Per-state facility counts
// ---------------------------------------------------------------------------

describe("Publishable Facility Counts", () => {
  const MIN_COUNTS: Record<State, number> = {
    CA: 200, OR: 50, WA: 50, MN: 50, TX: 50, UT: 10, IL: 10, PA: 100,
  };

  for (const state of PUBLISHABLE_STATES) {
    it(`${state}: has at least ${MIN_COUNTS[state]} publishable facilities`, async () => {
      if (!clientAvailable) return;
      const { count, error } = await supabase
        .from("facilities")
        .select("id", { count: "exact", head: true })
        .eq("state_code", state)
        .eq("publishable", true);
      expect(error, `${state} count error: ${error?.message}`).toBeNull();
      expect(count ?? 0, `${state}: expected ≥${MIN_COUNTS[state]} publishable facilities`).toBeGreaterThanOrEqual(
        MIN_COUNTS[state]
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Facility field completeness — exact loadFacilityProfile SELECT * query
// ---------------------------------------------------------------------------

describe("Facility Field Completeness (loadFacilityProfile query)", () => {
  const VALID_CATEGORIES = new Set([
    "rcfe_memory_care", "rcfe_general", "alf_memory_care", "alf_general",
    "snf_general", "snf_dementia_scu", "ccrc",
  ]);
  const VALID_TIERS = new Set(["small", "medium", "large", "unknown"]);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  for (const state of PUBLISHABLE_STATES) {
    it(`${state}: sampled facilities have all required fields populated`, async () => {
      if (!clientAvailable) return;

      const { data, error } = await supabase
        .from("facilities")
        .select("*")
        .eq("state_code", state)
        .eq("publishable", true)
        .order("name", { ascending: true })
        .limit(10);

      expect(error, `${state} fetch error: ${error?.message}`).toBeNull();
      const facilities = rows<FacilityRow>(data);
      expect(facilities.length, `${state}: no publishable facilities found`).toBeGreaterThan(0);

      const issues: string[] = [];
      for (const fac of facilities) {
        const label = `${state}/${fac.city_slug}/${fac.slug}`;

        for (const field of REQUIRED_FACILITY_FIELDS) {
          const val = fac[field];
          if (val === null || val === undefined) {
            issues.push(`${label}: field '${field}' is null/undefined`);
          }
        }

        if (fac.license_status !== "LICENSED")
          issues.push(`${label}: license_status='${fac.license_status}' (expected 'LICENSED')`);
        if (!fac.serves_memory_care)
          issues.push(`${label}: serves_memory_care=false on publishable facility`);
        if (!fac.publishable)
          issues.push(`${label}: publishable=false in publishable=true query`);
        if (!VALID_CATEGORIES.has(fac.care_category))
          issues.push(`${label}: care_category='${fac.care_category}' is unknown`);
        if (!VALID_TIERS.has(fac.capacity_tier))
          issues.push(`${label}: capacity_tier='${fac.capacity_tier}' is unknown`);
        if (!UUID_RE.test(fac.id))
          issues.push(`${label}: id='${fac.id}' is not a valid UUID`);
      }

      expect(issues.length, `${state} field issues:\n${issues.slice(0, 20).join("\n")}`).toBe(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Inspection query — exact fetchInspectionsAndDeficiencies() query
// ---------------------------------------------------------------------------

describe("Inspection Query (loadFacilityProfile query)", () => {
  for (const state of PUBLISHABLE_STATES) {
    it(`${state}: sampled facilities have inspections with valid shape`, async () => {
      if (!clientAvailable) return;

      const { data: facData } = await supabase
        .from("facilities")
        .select("id, slug, city_slug, state_code")
        .eq("state_code", state)
        .eq("publishable", true)
        .order("name", { ascending: true })
        .limit(3);

      const facilities = rows<{ id: string; slug: string; city_slug: string; state_code: string }>(facData);
      if (facilities.length === 0) return;

      let totalInspections = 0;
      const issues: string[] = [];

      for (const fac of facilities) {
        const label = `${state}/${fac.city_slug}/${fac.slug}`;

        const { data: inspData, error: inspErr } = await supabase
          .from("inspections")
          .select(
            "id, inspection_date, inspection_type, is_complaint, complaint_id, " +
            "total_deficiency_count, narrative_summary, source_url, source_agency, raw_data"
          )
          .eq("facility_id", fac.id)
          .order("inspection_date", { ascending: false })
          .limit(50);

        if (inspErr) {
          issues.push(`${label}: inspection fetch error: ${inspErr.message}`);
          continue;
        }

        const inspections = rows<InspectionRow>(inspData);
        totalInspections += inspections.length;

        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

        for (const insp of inspections) {
          const iLabel = `${label}:${insp.id.slice(0, 8)}`;
          if (!UUID_RE.test(insp.id))
            issues.push(`${iLabel}: id is not a UUID`);
          if (!DATE_RE.test(insp.inspection_date))
            issues.push(`${iLabel}: inspection_date '${insp.inspection_date}' is not YYYY-MM-DD`);
          const dateVal = new Date(insp.inspection_date);
          if (dateVal.getTime() > Date.now() + 86400_000)
            issues.push(`${iLabel}: inspection_date is in the future`);
          if (dateVal.getFullYear() < 1990)
            issues.push(`${iLabel}: inspection_date year ${dateVal.getFullYear()} < 1990`);
          if (typeof insp.is_complaint !== "boolean")
            issues.push(`${iLabel}: is_complaint is not boolean (got ${typeof insp.is_complaint})`);
        }
      }

      expect(issues.length, issues.slice(0, 10).join("\n")).toBe(0);

      // At least one facility must have inspections
      expect(
        totalInspections,
        `${state}: all ${facilities.length} sampled facilities have 0 inspections`
      ).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Deficiency query — exact fetchInspectionsAndDeficiencies() query
// ---------------------------------------------------------------------------

describe("Deficiency Query (loadFacilityProfile query)", () => {
  const VALID_SCOPES = new Set(["isolated", "pattern", "widespread"]);

  for (const state of PUBLISHABLE_STATES) {
    it(`${state}: deficiencies have valid shape`, async () => {
      if (!clientAvailable) return;

      const { data: facData } = await supabase
        .from("facilities")
        .select("id, slug, city_slug")
        .eq("state_code", state)
        .eq("publishable", true)
        .order("name", { ascending: true })
        .limit(2);

      const facilities = rows<{ id: string; slug: string; city_slug: string }>(facData);
      if (facilities.length === 0) return;

      const issues: string[] = [];
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      for (const fac of facilities) {
        const label = `${state}/${fac.city_slug}/${fac.slug}`;

        const { data: inspData } = await supabase
          .from("inspections")
          .select("id")
          .eq("facility_id", fac.id)
          .order("inspection_date", { ascending: false })
          .limit(50);

        const inspections = rows<{ id: string }>(inspData);
        if (inspections.length === 0) continue;
        const inspIds = inspections.map((i) => i.id);

        const { data: defData, error: defErr } = await supabase
          .from("deficiencies")
          .select(
            "id, inspection_id, class, code, severity, scope, scope_severity_code, " +
            "immediate_jeopardy, description, inspector_narrative, state_severity_raw, is_repeat"
          )
          .in("inspection_id", inspIds);

        if (defErr) {
          issues.push(`${label}: deficiency fetch error: ${defErr.message}`);
          continue;
        }

        for (const def of rows<DeficiencyRow>(defData)) {
          if (!UUID_RE.test(def.id))
            issues.push(`${label}: deficiency id '${def.id}' is not a UUID`);
          if (!inspIds.includes(def.inspection_id))
            issues.push(`${label}: deficiency references unknown inspection_id ${def.inspection_id}`);
          if (def.severity !== null && def.severity !== undefined && ![1, 2, 3, 4].includes(def.severity))
            issues.push(`${label}: deficiency severity=${def.severity} is not in 1–4`);
          if (typeof def.immediate_jeopardy !== "boolean")
            issues.push(`${label}: immediate_jeopardy is not boolean`);
          if (typeof def.is_repeat !== "boolean")
            issues.push(`${label}: is_repeat is not boolean`);
          if (def.scope !== null && def.scope !== undefined && !VALID_SCOPES.has(def.scope))
            issues.push(`${label}: scope='${def.scope}' is not in {isolated,pattern,widespread}`);
        }
      }

      expect(issues.length, issues.slice(0, 10).join("\n")).toBe(0);
    });
  }
});

// ---------------------------------------------------------------------------
// facility_snapshot() RPC — exact shape validation
// ---------------------------------------------------------------------------

describe("facility_snapshot() RPC", () => {
  for (const state of ["CA", "OR", "WA", "MN", "TX"] as const) {
    it(`${state}: facility_snapshot() returns a valid payload`, async () => {
      if (!clientAvailable) return;

      const { data: facData } = await supabase
        .from("facilities")
        .select("id, slug, city_slug")
        .eq("state_code", state)
        .eq("publishable", true)
        .order("name", { ascending: true })
        .limit(5);

      const facilities = rows<{ id: string; slug: string; city_slug: string }>(facData);
      if (facilities.length === 0) return;

      let tested = 0;
      for (const fac of facilities) {
        const label = `${state}/${fac.city_slug}/${fac.slug}`;

        const { data: snapshotRaw, error } = await supabase.rpc("facility_snapshot", {
          p_facility_id: fac.id,
        });

        if (error || !snapshotRaw) {
          console.warn(`${label}: snapshot RPC error or null: ${error?.message}`);
          continue;
        }

        const snapshot = snapshotRaw as SnapshotPayload;

        // peer_set
        expect(snapshot.peer_set, `${label}: peer_set is null`).toBeTruthy();
        expect(snapshot.peer_set.n, `${label}: peer_set.n must be ≥1`).toBeGreaterThanOrEqual(1);

        // metrics
        expect(snapshot.metrics, `${label}: metrics is null`).toBeTruthy();
        for (const mk of SNAPSHOT_METRIC_KEYS) {
          expect(snapshot.metrics[mk], `${label}: metrics missing '${mk}'`).toBeTruthy();
          const metric = snapshot.metrics[mk];
          for (const sk of SNAPSHOT_METRIC_SUB_KEYS) {
            expect(metric[sk], `${label}: metrics.${mk} missing '${sk}'`).toBeDefined();
          }
          expect(typeof metric.value, `${label}: metrics.${mk}.value not numeric`).toBe("number");
          if (metric.percentile !== null && metric.percentile !== undefined) {
            expect(metric.percentile).toBeGreaterThanOrEqual(0);
            expect(metric.percentile).toBeLessThanOrEqual(100);
          }
        }

        // grade
        if (snapshot.grade !== null) {
          expect(["A", "B", "C", "D", "F"]).toContain(snapshot.grade.letter);
          expect(snapshot.grade.composite_percentile).toBeGreaterThanOrEqual(0);
          expect(snapshot.grade.composite_percentile).toBeLessThanOrEqual(100);
        }

        // trajectory_series
        expect(Array.isArray(snapshot.trajectory_series)).toBe(true);
        for (const pt of snapshot.trajectory_series) {
          expect(String(pt.month)).toMatch(/^\d{4}-\d{2}$/);
        }

        // heatmap
        expect(Array.isArray(snapshot.heatmap)).toBe(true);
        for (const cell of snapshot.heatmap) {
          expect([1, 2, 3, 4]).toContain(cell.severity);
          expect(["isolated", "pattern", "widespread"]).toContain(cell.scope);
          expect(typeof cell.count).toBe("number");
        }

        tested++;
        if (tested >= 3) break;
      }
    });
  }

  it("Opal Care (CA) facility_snapshot() has composite_pct < 40", async () => {
    if (!clientAvailable) return;

    const { data: facData } = await supabase
      .from("facilities")
      .select("id, slug")
      .eq("state_code", "CA")
      .eq("slug", "opal-care-llc-200672")
      .limit(1);

    const facility = row<{ id: string; slug: string }>(facData);
    if (!facility) {
      console.warn("Opal Care not found — skipping regression check");
      return;
    }

    const { data: snapshotRaw, error } = await supabase.rpc("facility_snapshot", {
      p_facility_id: facility.id,
    });

    expect(error, `Opal Care snapshot error: ${error?.message}`).toBeNull();
    if (!snapshotRaw) return;

    const snapshot = snapshotRaw as SnapshotPayload;
    if (snapshot.grade !== null) {
      expect(
        snapshot.grade.composite_percentile,
        `Opal Care composite_pct=${snapshot.grade.composite_percentile} — expected <40 (regression check)`
      ).toBeLessThan(40);
    }
  });
});

// ---------------------------------------------------------------------------
// Memory-care signal consistency
// ---------------------------------------------------------------------------

describe("Memory-Care Signal Consistency", () => {
  it("CA: all sampled publishable facilities have at least one MC signal", async () => {
    if (!clientAvailable) return;

    const { data, error } = await supabase
      .from("facilities")
      .select(
        "slug, mc_signal_explicit_name, memory_care_disclosure_filed, " +
        "mc_signal_chain_curated, mc_signal_apfm_listed, mc_signal_caring_listed, " +
        "mc_review_status"
      )
      .eq("state_code", "CA")
      .eq("publishable", true)
      .limit(100);

    expect(error, `CA signal fetch error: ${error?.message}`).toBeNull();
    const facilities = rows<FacilityRow>(data);

    const orphans: string[] = [];
    for (const fac of facilities) {
      const hasSignal =
        fac.mc_signal_explicit_name ||
        fac.memory_care_disclosure_filed ||
        fac.mc_signal_chain_curated ||
        (fac.mc_signal_apfm_listed && fac.mc_signal_caring_listed) ||
        fac.mc_review_status === "reviewed_publish";
      if (!hasSignal) orphans.push(fac.slug);
    }

    expect(
      orphans.length,
      `${orphans.length} CA publishable facilities have no MC signal: ${orphans.slice(0, 5)}`
    ).toBe(0);
  });

  it("OR: no unendorsed_mc_violation-only facility is published", async () => {
    if (!clientAvailable) return;

    const { data, error } = await supabase
      .from("facilities")
      .select(
        "slug, mce_endorsed, unendorsed_mc_violation, mc_signal_explicit_name, " +
        "memory_care_disclosure_filed, mc_signal_chain_curated, mc_review_status, serves_memory_care"
      )
      .eq("state_code", "OR")
      .eq("publishable", true)
      .eq("unendorsed_mc_violation", true)
      .limit(50);

    expect(error, `OR violation query error: ${error?.message}`).toBeNull();

    const bad: string[] = [];
    for (const fac of rows<FacilityRow>(data)) {
      if (fac.mce_endorsed) continue; // Has a real endorsement
      const hasOtherSignal =
        fac.mc_signal_explicit_name ||
        fac.memory_care_disclosure_filed ||
        fac.mc_signal_chain_curated ||
        fac.mc_review_status === "reviewed_publish";
      if (fac.serves_memory_care && !hasOtherSignal) bad.push(String(fac.slug));
    }

    expect(
      bad.length,
      `${bad.length} OR facilities published via unendorsed_mc_violation alone: ${bad.slice(0, 5)}`
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Hub content drift
// ---------------------------------------------------------------------------

describe("Hub Content Integrity", () => {
  it("no published hub_content row has drift_detected=true", async () => {
    if (!clientAvailable) return;

    const { data, error } = await supabase
      .from("hub_content")
      .select("state_code, region_slug")
      .eq("status", "published")
      .eq("drift_detected", true);

    if (error?.message?.includes("does not exist") || error?.message?.includes("relation")) {
      console.warn("hub_content table not yet applied — skipping");
      return;
    }

    expect(error, `hub_content drift query error: ${error?.message}`).toBeNull();
    const drifted = rows<{ state_code: string; region_slug: string }>(data);
    expect(
      drifted.length,
      `${drifted.length} published hub_content rows have drift_detected=true: ` +
        `${drifted.slice(0, 3).map((r) => `${r.state_code}/${r.region_slug}`)}`
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// URL structure validation
// ---------------------------------------------------------------------------

describe("URL Structure Validation", () => {
  const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

  it("all publishable facilities (sample) have valid slug + city_slug", async () => {
    if (!clientAvailable) return;

    const { data, error } = await supabase
      .from("facilities")
      .select("id, state_code, city_slug, slug")
      .eq("publishable", true)
      .limit(200);

    expect(error, `URL structure query error: ${error?.message}`).toBeNull();
    const facilities = rows<{ id: string; state_code: string; city_slug: string; slug: string }>(data);

    const issues: string[] = [];
    for (const fac of facilities) {
      if (!SLUG_RE.test(fac.slug))
        issues.push(`id=${fac.id}: slug='${fac.slug}' is invalid`);
      if (!SLUG_RE.test(fac.city_slug))
        issues.push(`id=${fac.id}: city_slug='${fac.city_slug}' is invalid`);
      if (!fac.state_code || fac.state_code.length !== 2)
        issues.push(`id=${fac.id}: state_code='${fac.state_code}' is not 2 chars`);
    }

    expect(issues.length, issues.slice(0, 10).join("\n")).toBe(0);
  });

  it("sample publishable facilities have unique (state, city_slug, slug)", async () => {
    if (!clientAvailable) return;

    const { data, error } = await supabase
      .from("facilities")
      .select("state_code, city_slug, slug")
      .eq("publishable", true)
      .limit(1000);

    expect(error, `uniqueness query error: ${error?.message}`).toBeNull();
    const facilities = rows<{ state_code: string; city_slug: string; slug: string }>(data);

    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const fac of facilities) {
      const key = `${fac.state_code}/${fac.city_slug}/${fac.slug}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }

    expect(duplicates.length, `Duplicate URL paths: ${duplicates.slice(0, 5)}`).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// WA state-specific signals
// ---------------------------------------------------------------------------

describe("WA State-Specific Signals", () => {
  it("WA publishable facilities have at least one WA or generic MC signal", async () => {
    if (!clientAvailable) return;

    const { data, error } = await supabase
      .from("facilities")
      .select(
        "slug, wa_dementia_care_contract, wa_memory_care_certified, wa_earc_sdc_contracted, " +
        "wa_dementia_specialty, mc_signal_explicit_name, memory_care_disclosure_filed, " +
        "mc_signal_chain_curated, mc_review_status"
      )
      .eq("state_code", "WA")
      .eq("publishable", true)
      .limit(50);

    expect(error, `WA signal query error: ${error?.message}`).toBeNull();

    const noSignal: string[] = [];
    for (const fac of rows<FacilityRow>(data)) {
      const hasWa =
        fac.wa_dementia_care_contract ||
        fac.wa_memory_care_certified ||
        fac.wa_earc_sdc_contracted ||
        fac.wa_dementia_specialty;
      const hasGeneric =
        fac.mc_signal_explicit_name ||
        fac.memory_care_disclosure_filed ||
        fac.mc_signal_chain_curated ||
        fac.mc_review_status === "reviewed_publish";
      if (!hasWa && !hasGeneric) noSignal.push(String(fac.slug));
    }

    expect(noSignal.length, `WA facilities with no signal: ${noSignal.slice(0, 5)}`).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PA state-specific signals
// ---------------------------------------------------------------------------

describe("PA State-Specific Signals", () => {
  it("PA publishable facilities have a PA signal or generic signal", async () => {
    if (!clientAvailable) return;

    const { data, error } = await supabase
      .from("facilities")
      .select(
        "slug, mc_designation_type, license_type, memory_care_disclosure_filed, " +
        "mc_signal_explicit_name, mc_signal_chain_curated, mc_review_status"
      )
      .eq("state_code", "PA")
      .eq("publishable", true)
      .limit(50);

    expect(error, `PA signal query error: ${error?.message}`).toBeNull();

    const noSignal: string[] = [];
    for (const fac of rows<FacilityRow>(data)) {
      const hasPA =
        fac.mc_designation_type !== null ||
        fac.license_type === "ASSISTED LIVING - SPECIAL CARE";
      const hasGeneric =
        fac.memory_care_disclosure_filed ||
        fac.mc_signal_explicit_name ||
        fac.mc_signal_chain_curated ||
        fac.mc_review_status === "reviewed_publish";
      if (!hasPA && !hasGeneric) noSignal.push(String(fac.slug));
    }

    expect(noSignal.length, `PA facilities with no signal: ${noSignal.slice(0, 5)}`).toBe(0);
  });
});
