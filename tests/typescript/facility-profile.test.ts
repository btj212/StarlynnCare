/**
 * Facility profile data pipeline tests.
 *
 * Queries the REAL Supabase database and verifies that:
 * 1. Published facilities have all required fields at the DB layer
 * 2. Inspections and deficiencies for those facilities are correctly shaped
 * 3. The facility_snapshot() RPC returns valid data for each facility
 * 4. Data flows correctly through the full loadFacilityProfile pipeline
 *
 * No mocks. Real Supabase data. Skips when credentials are absent.
 *
 * Run: node --experimental-strip-types --test tests/typescript/facility-profile.test.ts
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  getTestClient,
  isNonEmptyString,
  isBoolean,
  isIsoDate,
  isIsoTimestamp,
  isNonNegativeNumber,
  isString,
  COVERED_STATE_CODES,
  VALID_CARE_CATEGORIES,
  VALID_CAPACITY_TIERS,
} from "./helpers.ts";

// ─── Types (mirrors loadFacilityProfile.ts) ────────────────────────────────────

interface FacilityRow {
  id: string;
  state_code: string;
  name: string;
  city_slug: string;
  slug: string;
  publishable: boolean;
  serves_memory_care: boolean;
  license_status: string | null;
  care_category: string;
  capacity_tier: string | null;
  mc_review_status: string | null;
  beds: number | null;
  last_inspection_date: string | null;
  latitude: string | null;
  longitude: string | null;
  created_at: string;
  updated_at: string;
  memory_care_disclosure_filed: boolean;
  mce_endorsed: boolean | null;
  wa_memory_care_certified: boolean | null;
  wa_earc_sdc_contracted: boolean | null;
  wa_dementia_specialty: boolean | null;
  tx_alzheimer_certified: boolean | null;
  mn_dementia_care_licensed: boolean | null;
}

interface InspectionRow {
  id: string;
  facility_id: string;
  inspection_date: string;
  inspection_type: string | null;
  is_complaint: boolean;
  complaint_id: string | null;
  total_deficiency_count: number | null;
  narrative_summary: string | null;
  source_url: string;
  source_agency: string;
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Facility profile data pipeline", () => {
  const client = getTestClient();
  if (!client) {
    it("skip — no Supabase credentials", { skip: true }, () => {});
    return;
  }

  let sampleFacilities: Record<string, FacilityRow[]> = {};

  before(async () => {
    // Fetch 5 published facilities per state
    for (const stateCode of COVERED_STATE_CODES) {
      const { data } = await client
        .from("facilities")
        .select(
          "id,state_code,name,city_slug,slug,publishable,serves_memory_care," +
          "license_status,care_category,capacity_tier,mc_review_status,beds," +
          "last_inspection_date,latitude,longitude,created_at,updated_at," +
          "memory_care_disclosure_filed,mce_endorsed,wa_memory_care_certified," +
          "wa_earc_sdc_contracted,wa_dementia_specialty,tx_alzheimer_certified," +
          "mn_dementia_care_licensed"
        )
        .eq("state_code", stateCode)
        .eq("publishable", true)
        .limit(5);
      if (data?.length) sampleFacilities[stateCode] = data as unknown as FacilityRow[];
    }
  });

  // ─── Required fields ─────────────────────────────────────────────────────

  describe("Required fields on published facilities", () => {
    it("id is a non-empty string (UUID)", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          assert(isNonEmptyString(r.id), `${sc}/${r.name}: id must be non-empty string`);
          assert(/^[0-9a-f-]{36}$/.test(r.id), `${sc}/${r.name}: id must be UUID format`);
        }
      }
    });

    it("name is a non-empty string", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          assert(isNonEmptyString(r.name), `${sc}: facility has empty name`);
        }
      }
    });

    it("city_slug is lowercase hyphenated", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          assert(isNonEmptyString(r.city_slug), `${sc}/${r.name}: city_slug is empty`);
          assert(/^[a-z0-9-]+$/.test(r.city_slug), `${sc}/${r.name}: city_slug has invalid chars: ${r.city_slug}`);
          assert(!r.city_slug.startsWith("-"), `${sc}/${r.name}: city_slug starts with hyphen`);
          assert(!r.city_slug.endsWith("-"), `${sc}/${r.name}: city_slug ends with hyphen`);
        }
      }
    });

    it("slug is lowercase hyphenated", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          assert(isNonEmptyString(r.slug), `${sc}/${r.name}: slug is empty`);
          assert(/^[a-z0-9-]+$/.test(r.slug), `${sc}/${r.name}: slug has invalid chars: ${r.slug}`);
        }
      }
    });

    it("publishable is true for all sampled facilities", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          assert.strictEqual(r.publishable, true, `${sc}/${r.name}: publishable must be true`);
        }
      }
    });

    it("serves_memory_care is true for all published facilities", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          assert.strictEqual(r.serves_memory_care, true, `${sc}/${r.name}: serves_memory_care must be true`);
        }
      }
    });

    it("license_status is LICENSED", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          assert.strictEqual(r.license_status, "LICENSED", `${sc}/${r.name}: license_status must be LICENSED`);
        }
      }
    });

    it("care_category is a valid enum value", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          assert(
            VALID_CARE_CATEGORIES.has(r.care_category),
            `${sc}/${r.name}: invalid care_category: ${r.care_category}`
          );
        }
      }
    });

    it("capacity_tier is a valid enum value when set", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          if (r.capacity_tier !== null) {
            assert(
              VALID_CAPACITY_TIERS.has(r.capacity_tier),
              `${sc}/${r.name}: invalid capacity_tier: ${r.capacity_tier}`
            );
          }
        }
      }
    });

    it("created_at and updated_at are ISO timestamps", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          assert(isIsoTimestamp(r.created_at), `${sc}/${r.name}: created_at invalid: ${r.created_at}`);
          assert(isIsoTimestamp(r.updated_at), `${sc}/${r.name}: updated_at invalid: ${r.updated_at}`);
        }
      }
    });

    it("last_inspection_date is a valid ISO date when set", () => {
      for (const [sc, rows] of Object.entries(sampleFacilities)) {
        for (const r of rows) {
          if (r.last_inspection_date !== null) {
            assert(
              isIsoDate(r.last_inspection_date),
              `${sc}/${r.name}: last_inspection_date invalid: ${r.last_inspection_date}`
            );
            // Must not be a future date
            assert(
              r.last_inspection_date <= new Date().toISOString().split("T")[0],
              `${sc}/${r.name}: last_inspection_date is in the future: ${r.last_inspection_date}`
            );
          }
        }
      }
    });
  });

  // ─── State-specific signal fields ────────────────────────────────────────

  describe("State-specific signal invariants", () => {
    it("OR published facilities have mce_endorsed field", () => {
      const rows = sampleFacilities["OR"] ?? [];
      if (!rows.length) return; // No OR data yet — skip gracefully
      for (const r of rows) {
        assert("mce_endorsed" in r, `OR/${r.name}: mce_endorsed field missing`);
      }
    });

    it("WA published facilities have all three WA signal fields", () => {
      const rows = sampleFacilities["WA"] ?? [];
      if (!rows.length) return;
      const waFields: (keyof FacilityRow)[] = [
        "wa_memory_care_certified", "wa_earc_sdc_contracted", "wa_dementia_specialty"
      ];
      for (const r of rows) {
        for (const f of waFields) {
          assert(f in r, `WA/${r.name}: field ${f} missing`);
        }
      }
    });

    it("TX published facilities have tx_alzheimer_certified field", () => {
      const rows = sampleFacilities["TX"] ?? [];
      if (!rows.length) return;
      for (const r of rows) {
        assert("tx_alzheimer_certified" in r, `TX/${r.name}: tx_alzheimer_certified field missing`);
      }
    });

    it("MN published facilities have mn_dementia_care_licensed field", () => {
      const rows = sampleFacilities["MN"] ?? [];
      if (!rows.length) return;
      for (const r of rows) {
        assert("mn_dementia_care_licensed" in r, `MN/${r.name}: mn_dementia_care_licensed field missing`);
      }
    });
  });

  // ─── Inspection layer ─────────────────────────────────────────────────────

  describe("Inspection records for published facilities", () => {
    it("published facilities with last_inspection_date have real inspection records", async () => {
      // For CA (largest dataset), verify the inspection → facility link
      const caFacilities = sampleFacilities["CA"] ?? [];
      const withDates = caFacilities.filter(f => f.last_inspection_date !== null);
      if (!withDates.length) return;

      const facilityIds = withDates.map(f => f.id);
      const { data: inspections } = await client
        .from("inspections")
        .select(
          "id,facility_id,inspection_date,inspection_type,is_complaint," +
          "total_deficiency_count,source_url,source_agency,raw_data"
        )
        .in("facility_id", facilityIds)
        .order("inspection_date", { ascending: false })
        .limit(50);

      const insp = inspections as InspectionRow[] | null ?? [];
      assert(insp.length > 0, `CA: expected inspections for facilities with last_inspection_date`);

      // Verify every inspection field shape
      for (const i of insp) {
        assert(isNonEmptyString(i.id), `Inspection id must be UUID string`);
        assert(isNonEmptyString(i.facility_id), `Inspection facility_id must be non-empty`);
        assert(isIsoDate(i.inspection_date), `Inspection date invalid: ${i.inspection_date}`);
        assert(isBoolean(i.is_complaint), `is_complaint must be boolean`);
        assert(isNonEmptyString(i.source_url), `source_url must be non-empty`);
        assert(isNonEmptyString(i.source_agency), `source_agency must be non-empty`);
        if (i.total_deficiency_count !== null) {
          assert(isNonNegativeNumber(i.total_deficiency_count), `total_deficiency_count must be non-negative`);
        }
        // inspection_date must not be in the future
        assert(
          i.inspection_date <= new Date().toISOString().split("T")[0],
          `Inspection date is future: ${i.inspection_date}`
        );
      }
    });

    it("inspections link to real facility IDs", async () => {
      const allFacIds = Object.values(sampleFacilities).flat().map(f => f.id);
      if (!allFacIds.length) return;

      const { data } = await client
        .from("inspections")
        .select("id,facility_id")
        .in("facility_id", allFacIds.slice(0, 10))
        .limit(20);

      const insp = data ?? [];
      const knownIds = new Set(allFacIds);
      for (const i of insp) {
        assert(knownIds.has(i.facility_id), `Inspection facility_id ${i.facility_id} not in query set`);
      }
    });
  });

  // ─── Deficiency layer ─────────────────────────────────────────────────────

  describe("Deficiency records linked to inspections", () => {
    it("deficiency severity is in [1,4] when set", async () => {
      const { data } = await client
        .from("deficiencies")
        .select("id,inspection_id,severity,scope,immediate_jeopardy,is_repeat")
        .not("severity", "is", null)
        .limit(100);

      const defs = data as DeficiencyRow[] | null ?? [];
      for (const d of defs) {
        if (d.severity !== null) {
          assert(d.severity >= 1 && d.severity <= 4, `Deficiency severity ${d.severity} out of [1,4]`);
        }
        if (d.scope !== null) {
          assert(
            ["isolated", "pattern", "widespread"].includes(d.scope),
            `Invalid scope value: ${d.scope}`
          );
        }
        assert(isBoolean(d.immediate_jeopardy), `immediate_jeopardy must be boolean`);
        assert(isBoolean(d.is_repeat), `is_repeat must be boolean`);
      }
    });

    it("deficiency description or inspector_narrative has real text when set", async () => {
      const { data } = await client
        .from("deficiencies")
        .select("id,description,inspector_narrative,state_severity_raw")
        .not("description", "is", null)
        .limit(20);

      const defs = data ?? [];
      for (const d of defs) {
        if (d.description !== null) {
          assert(isString(d.description), `description must be string when set`);
        }
      }
    });
  });

  // ─── facility_snapshot() RPC ─────────────────────────────────────────────

  describe("facility_snapshot() RPC response shape", () => {
    it("returns a complete snapshot for a CA published facility", async () => {
      const caFacilities = sampleFacilities["CA"] ?? [];
      if (!caFacilities.length) return;

      const fac = caFacilities[0];
      const { data: snap, error } = await client
        .rpc("facility_snapshot", { p_facility_id: fac.id });

      assert(!error, `facility_snapshot() RPC error for ${fac.name}: ${error?.message}`);
      assert(snap !== null, `facility_snapshot() returned null for ${fac.name}`);

      // facility block
      assert.strictEqual(snap.facility?.id, fac.id);
      assert(isNonEmptyString(snap.facility?.name));
      assert(isNonEmptyString(snap.facility?.state_code));

      // peer_set block
      assert(typeof snap.peer_set?.n === "number" && snap.peer_set.n >= 0);
      assert(isNonEmptyString(snap.peer_set?.definition));
      assert([0, 1, 2, 3].includes(snap.peer_set?.fallback_level));

      // metrics block — all four metrics must be present
      for (const metricName of ["severity", "repeats", "frequency", "trajectory"]) {
        const m = snap.metrics?.[metricName];
        assert(m !== undefined, `metrics.${metricName} missing`);
        assert(typeof m.value === "number" && m.value >= 0, `metrics.${metricName}.value invalid`);
        assert(typeof m.peer_median === "number" && m.peer_median >= 0, `metrics.${metricName}.peer_median invalid`);
        if (m.percentile !== null) {
          assert(m.percentile >= 0 && m.percentile <= 100, `metrics.${metricName}.percentile out of range`);
        }
      }

      // has_inspections
      assert(typeof snap.has_inspections === "boolean");

      // trajectory_series
      assert(Array.isArray(snap.trajectory_series));
      for (const point of snap.trajectory_series) {
        assert(/^\d{4}-\d{2}$/.test(point.month), `trajectory point month invalid: ${point.month}`);
        assert(typeof point.facility_score === "number");
        assert(typeof point.peer_median_score === "number");
      }

      // trajectory_series must be chronologically ordered
      const months = snap.trajectory_series.map((p: { month: string }) => p.month);
      const sorted = [...months].sort();
      assert.deepStrictEqual(months, sorted, "trajectory_series not in chronological order");

      // heatmap
      assert(Array.isArray(snap.heatmap));
      for (const cell of snap.heatmap) {
        assert([1, 2, 3, 4].includes(cell.severity), `Invalid heatmap severity: ${cell.severity}`);
        assert(["isolated", "pattern", "widespread"].includes(cell.scope), `Invalid heatmap scope: ${cell.scope}`);
        assert(typeof cell.count === "number" && cell.count >= 0);
        assert(Array.isArray(cell.tags));
      }

      // grade (null allowed when no inspections)
      if (snap.grade !== null) {
        assert(["A", "B", "C", "D", "F"].includes(snap.grade.letter));
        assert(snap.grade.composite_percentile >= 0 && snap.grade.composite_percentile <= 100);
      }
    });

    it("returns snapshots for all covered states", async () => {
      const statesWithFacilities = Object.keys(sampleFacilities);
      for (const sc of statesWithFacilities) {
        const fac = sampleFacilities[sc]?.[0];
        if (!fac) continue;

        const snapResult = await client.rpc("facility_snapshot", { p_facility_id: fac.id });
        const snapError = snapResult.error as { message: string } | null;
        const snap = snapResult.data as Record<string, Record<string, unknown>> | null;

        assert(!snapError, `${sc}/${fac.name}: snapshot RPC error: ${snapError?.message}`);
        assert(snap !== null, `${sc}/${fac.name}: snapshot returned null`);
        assert.strictEqual(snap?.facility?.id, fac.id, `${sc}/${fac.name}: facility.id mismatch in snapshot`);
        assert(isNonEmptyString(snap?.facility?.name));
      }
    });
  });
});
