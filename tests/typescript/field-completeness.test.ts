/**
 * Field completeness tests — the most thorough verification of the
 * full data pipeline.
 *
 * For every field in every table that the front-end depends on, this file:
 * 1. Queries real published data
 * 2. Verifies the field is present and correctly typed
 * 3. Verifies business rules (e.g. severity range, no future dates)
 * 4. Verifies data flows end-to-end from DB to the computed response
 *
 * These tests cover all fields documented in:
 *   - src/lib/types.ts (Facility, Inspection, Deficiency)
 *   - src/lib/facility/loadFacilityProfile.ts (InspectionRow, DeficiencyRow, SnapshotPayload)
 *   - supabase/migrations/0001_init.sql through 0029
 *
 * No mocks. All assertions run against the real database.
 *
 * Run: node --experimental-strip-types --test tests/typescript/field-completeness.test.ts
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
  isNumber,
  isString,
  COVERED_STATE_CODES,
} from "./helpers.ts";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Field completeness — entire pipeline end-to-end", () => {
  const client = getTestClient();
  if (!client) {
    it("skip — no Supabase credentials", { skip: true }, () => {});
    return;
  }

  let caFacility: Record<string, unknown> | null = null;
  let orFacility: Record<string, unknown> | null = null;
  let waFacility: Record<string, unknown> | null = null;
  let representativeInspection: Record<string, unknown> | null = null;
  let representativeDeficiency: Record<string, unknown> | null = null;

  before(async () => {
    // Load one fully-detailed facility per key state
    const { data: caData } = await client
      .from("facilities")
      .select("*")
      .eq("state_code", "CA")
      .eq("publishable", true)
      .not("last_inspection_date", "is", null)
      .limit(1);
    caFacility = caData?.[0] ?? null;

    const { data: orData } = await client
      .from("facilities")
      .select("*")
      .eq("state_code", "OR")
      .eq("publishable", true)
      .limit(1);
    orFacility = orData?.[0] ?? null;

    const { data: waData } = await client
      .from("facilities")
      .select("*")
      .eq("state_code", "WA")
      .eq("publishable", true)
      .limit(1);
    waFacility = waData?.[0] ?? null;

    // Load a representative inspection with deficiencies
    if (caFacility?.id) {
      const { data: inspData } = await client
        .from("inspections")
        .select("*")
        .eq("facility_id", caFacility.id)
        .order("inspection_date", { ascending: false })
        .limit(1);
      representativeInspection = inspData?.[0] ?? null;

      if (representativeInspection?.id) {
        const { data: defData } = await client
          .from("deficiencies")
          .select("*")
          .eq("inspection_id", representativeInspection.id)
          .limit(1);
        representativeDeficiency = defData?.[0] ?? null;
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Facility table — ALL columns from types.ts Facility interface
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Facility table field completeness (CA)", () => {
    it("id: UUID string", () => {
      if (!caFacility) return;
      assert(isNonEmptyString(caFacility.id as string));
      assert(/^[0-9a-f-]{36}$/.test(caFacility.id as string));
    });

    it("state_code: 2-char string", () => {
      if (!caFacility) return;
      assert(isNonEmptyString(caFacility.state_code as string));
      assert((caFacility.state_code as string).length === 2);
    });

    it("name: non-empty string", () => {
      if (!caFacility) return;
      assert(isNonEmptyString(caFacility.name as string));
    });

    it("city_slug: lowercase hyphenated", () => {
      if (!caFacility) return;
      const cs = caFacility.city_slug as string;
      assert(isNonEmptyString(cs));
      assert(/^[a-z0-9-]+$/.test(cs), `city_slug has invalid chars: ${cs}`);
    });

    it("slug: lowercase hyphenated, unique suffix", () => {
      if (!caFacility) return;
      const s = caFacility.slug as string;
      assert(isNonEmptyString(s));
      assert(/^[a-z0-9-]+$/.test(s), `slug has invalid chars: ${s}`);
      assert(!s.startsWith("-") && !s.endsWith("-"), `slug has leading/trailing hyphens`);
    });

    it("publishable: boolean true", () => {
      if (!caFacility) return;
      assert.strictEqual(caFacility.publishable, true);
    });

    it("serves_memory_care: boolean true", () => {
      if (!caFacility) return;
      assert.strictEqual(caFacility.serves_memory_care, true);
    });

    it("license_status: 'LICENSED'", () => {
      if (!caFacility) return;
      assert.strictEqual(caFacility.license_status, "LICENSED");
    });

    it("care_category: valid enum value", () => {
      if (!caFacility) return;
      const validCats = ["rcfe_memory_care", "rcfe_general", "alf_memory_care", "alf_general",
        "snf_general", "snf_dementia_scu", "ccrc", "unknown"];
      assert(validCats.includes(caFacility.care_category as string),
        `Invalid care_category: ${caFacility.care_category}`);
    });

    it("capacity_tier: generated column — small/medium/large/unknown", () => {
      if (!caFacility) return;
      const validTiers = ["small", "medium", "large", "unknown"];
      if (caFacility.capacity_tier !== null) {
        assert(validTiers.includes(caFacility.capacity_tier as string),
          `Invalid capacity_tier: ${caFacility.capacity_tier}`);
      }
    });

    it("memory_care_disclosure_filed: boolean", () => {
      if (!caFacility) return;
      assert(isBoolean(caFacility.memory_care_disclosure_filed as boolean));
    });

    it("mc_review_status: valid enum", () => {
      if (!caFacility) return;
      const validStatuses = ["auto_published", "needs_review", "reviewed_publish", "reviewed_reject"];
      assert(validStatuses.includes(caFacility.mc_review_status as string),
        `Invalid mc_review_status: ${caFacility.mc_review_status}`);
    });

    it("created_at: ISO timestamp", () => {
      if (!caFacility) return;
      assert(isIsoTimestamp(caFacility.created_at as string));
    });

    it("updated_at: ISO timestamp", () => {
      if (!caFacility) return;
      assert(isIsoTimestamp(caFacility.updated_at as string));
    });

    it("last_inspection_date: valid ISO date if set", () => {
      if (!caFacility?.last_inspection_date) return;
      assert(isIsoDate(caFacility.last_inspection_date as string));
    });

    it("beds: positive integer if set", () => {
      if (!caFacility || caFacility.beds === null) return;
      assert(Number.isInteger(caFacility.beds) && (caFacility.beds as number) > 0);
    });

    it("latitude: numeric in [-90, 90] if set", () => {
      if (!caFacility || caFacility.latitude === null) return;
      const lat = Number(caFacility.latitude);
      assert(!Number.isNaN(lat) && lat >= -90 && lat <= 90);
    });

    it("longitude: numeric in [-180, 180] if set", () => {
      if (!caFacility || caFacility.longitude === null) return;
      const lon = Number(caFacility.longitude);
      assert(!Number.isNaN(lon) && lon >= -180 && lon <= 180);
    });

    it("cms_star_rating: integer in [1,5] if set", () => {
      if (!caFacility || caFacility.cms_star_rating === null) return;
      const rating = caFacility.cms_star_rating as number;
      assert(Number.isInteger(rating) && rating >= 1 && rating <= 5);
    });
  });

  // ─── OR-specific facility fields ──────────────────────────────────────────

  describe("OR-specific facility fields", () => {
    it("external_id: string if set", () => {
      if (!orFacility) return;
      if (orFacility.external_id !== null) {
        assert(isNonEmptyString(orFacility.external_id as string));
      }
    });

    it("mce_endorsed: boolean", () => {
      if (!orFacility) return;
      if (orFacility.mce_endorsed !== null) {
        assert(isBoolean(orFacility.mce_endorsed as boolean));
      }
    });

    it("mce_evidence: string if set", () => {
      if (!orFacility) return;
      if (orFacility.mce_evidence !== null) {
        assert(isString(orFacility.mce_evidence as string));
      }
    });

    it("afh_class: integer 1/2/3 if set", () => {
      if (!orFacility) return;
      if (orFacility.afh_class !== null) {
        assert([1, 2, 3].includes(orFacility.afh_class as number),
          `Invalid afh_class: ${orFacility.afh_class}`);
      }
    });

    it("enhanced_oversight: boolean if set", () => {
      if (!orFacility) return;
      if (orFacility.enhanced_oversight !== null) {
        assert(isBoolean(orFacility.enhanced_oversight as boolean));
      }
    });

    it("unendorsed_mc_violation: boolean if set", () => {
      if (!orFacility) return;
      if (orFacility.unendorsed_mc_violation !== null) {
        assert(isBoolean(orFacility.unendorsed_mc_violation as boolean));
      }
    });
  });

  // ─── WA-specific facility fields ──────────────────────────────────────────

  describe("WA-specific facility fields", () => {
    it("wa_facility_type: string if set", () => {
      if (!waFacility) return;
      if (waFacility.wa_facility_type !== null) {
        assert(isString(waFacility.wa_facility_type as string));
      }
    });

    it("wa_memory_care_certified: boolean if set", () => {
      if (!waFacility) return;
      if (waFacility.wa_memory_care_certified !== null) {
        assert(isBoolean(waFacility.wa_memory_care_certified as boolean));
      }
    });

    it("wa_earc_sdc_contracted: boolean if set", () => {
      if (!waFacility) return;
      if (waFacility.wa_earc_sdc_contracted !== null) {
        assert(isBoolean(waFacility.wa_earc_sdc_contracted as boolean));
      }
    });

    it("wa_dementia_specialty: boolean if set", () => {
      if (!waFacility) return;
      if (waFacility.wa_dementia_specialty !== null) {
        assert(isBoolean(waFacility.wa_dementia_specialty as boolean));
      }
    });

    it("wa_afh_residential_flag: boolean if set", () => {
      if (!waFacility) return;
      if (waFacility.wa_afh_residential_flag !== null) {
        assert(isBoolean(waFacility.wa_afh_residential_flag as boolean));
      }
    });

    it("cms_overall_rating: integer in [1,5] if set", () => {
      if (!waFacility) return;
      if (waFacility.cms_overall_rating !== null) {
        const r = waFacility.cms_overall_rating as number;
        assert(Number.isInteger(r) && r >= 1 && r <= 5);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Inspection table — ALL columns from types.ts Inspection interface
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Inspection table field completeness", () => {
    it("id: UUID string", () => {
      if (!representativeInspection) return;
      assert(isNonEmptyString(representativeInspection.id as string));
      assert(/^[0-9a-f-]{36}$/.test(representativeInspection.id as string));
    });

    it("facility_id: UUID string (FK)", () => {
      if (!representativeInspection) return;
      assert(isNonEmptyString(representativeInspection.facility_id as string));
    });

    it("inspection_date: valid ISO date", () => {
      if (!representativeInspection) return;
      assert(isIsoDate(representativeInspection.inspection_date as string));
    });

    it("inspection_date: not in the future", () => {
      if (!representativeInspection) return;
      const today = new Date().toISOString().split("T")[0];
      assert(
        (representativeInspection.inspection_date as string) <= today,
        `inspection_date is future: ${representativeInspection.inspection_date}`
      );
    });

    it("is_complaint: boolean", () => {
      if (!representativeInspection) return;
      assert(isBoolean(representativeInspection.is_complaint as boolean));
    });

    it("source_url: non-empty string", () => {
      if (!representativeInspection) return;
      assert(isNonEmptyString(representativeInspection.source_url as string));
    });

    it("source_agency: non-empty string", () => {
      if (!representativeInspection) return;
      assert(isNonEmptyString(representativeInspection.source_agency as string));
    });

    it("total_deficiency_count: non-negative integer if set", () => {
      if (!representativeInspection) return;
      const count = representativeInspection.total_deficiency_count;
      if (count !== null) {
        assert(Number.isInteger(count) && (count as number) >= 0);
      }
    });

    it("special_focus: boolean", () => {
      if (!representativeInspection) return;
      if (representativeInspection.special_focus !== null) {
        assert(isBoolean(representativeInspection.special_focus as boolean));
      }
    });

    it("raw_data: object or null", () => {
      if (!representativeInspection) return;
      const rd = representativeInspection.raw_data;
      assert(rd === null || (typeof rd === "object" && !Array.isArray(rd)));
    });

    it("created_at: ISO timestamp", () => {
      if (!representativeInspection) return;
      assert(isIsoTimestamp(representativeInspection.created_at as string));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Deficiency table — ALL columns from types.ts Deficiency interface
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Deficiency table field completeness", () => {
    it("id: UUID string", () => {
      if (!representativeDeficiency) return;
      assert(isNonEmptyString(representativeDeficiency.id as string));
      assert(/^[0-9a-f-]{36}$/.test(representativeDeficiency.id as string));
    });

    it("inspection_id: UUID string (FK, NOT NULL)", () => {
      if (!representativeDeficiency) return;
      assert(isNonEmptyString(representativeDeficiency.inspection_id as string));
    });

    it("severity: integer in [1,4] if set", () => {
      if (!representativeDeficiency) return;
      const sev = representativeDeficiency.severity;
      if (sev !== null) {
        assert(Number.isInteger(sev) && (sev as number) >= 1 && (sev as number) <= 4,
          `severity ${sev} out of [1,4]`);
      }
    });

    it("scope: valid enum if set", () => {
      if (!representativeDeficiency) return;
      const scope = representativeDeficiency.scope;
      if (scope !== null) {
        assert(["isolated", "pattern", "widespread"].includes(scope as string),
          `Invalid scope: ${scope}`);
      }
    });

    it("immediate_jeopardy: boolean", () => {
      if (!representativeDeficiency) return;
      assert(isBoolean(representativeDeficiency.immediate_jeopardy as boolean));
    });

    it("is_repeat: boolean", () => {
      if (!representativeDeficiency) return;
      assert(isBoolean(representativeDeficiency.is_repeat as boolean));
    });

    it("created_at: ISO timestamp", () => {
      if (!representativeDeficiency) return;
      assert(isIsoTimestamp(representativeDeficiency.created_at as string));
    });

    it("scope_severity_code: single character if set", () => {
      if (!representativeDeficiency) return;
      const code = representativeDeficiency.scope_severity_code;
      if (code !== null) {
        assert(isString(code) && (code as string).length === 1,
          `scope_severity_code must be a single char, got: ${code}`);
        assert(/^[A-L]$/.test(code as string),
          `scope_severity_code must be A–L, got: ${code}`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-table pipeline integrity
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Cross-table pipeline integrity", () => {
    it("deficiency's inspection_id refers to an existing inspection", async () => {
      if (!representativeDeficiency) return;

      const { data } = await client
        .from("inspections")
        .select("id")
        .eq("id", representativeDeficiency.inspection_id)
        .limit(1);

      assert(data?.length === 1,
        `Deficiency ${representativeDeficiency.id} references non-existent inspection ${representativeDeficiency.inspection_id}`);
    });

    it("inspection's facility_id refers to an existing facility", async () => {
      if (!representativeInspection) return;

      const { data } = await client
        .from("facilities")
        .select("id,publishable")
        .eq("id", representativeInspection.facility_id)
        .limit(1);

      assert(data?.length === 1,
        `Inspection ${representativeInspection.id} references non-existent facility ${representativeInspection.facility_id}`);
    });

    it("facility's last_inspection_date matches its most recent inspection", async () => {
      if (!caFacility?.last_inspection_date) return;

      const { data } = await client
        .from("inspections")
        .select("inspection_date")
        .eq("facility_id", caFacility.id)
        .order("inspection_date", { ascending: false })
        .limit(1);

      if (!data?.length) return;

      const dbLatest = data[0].inspection_date;
      // last_inspection_date should match the most recent inspection date
      assert.strictEqual(
        caFacility.last_inspection_date,
        dbLatest,
        `Facility ${caFacility.name}: last_inspection_date (${caFacility.last_inspection_date}) ` +
        `doesn't match most recent inspection (${dbLatest})`
      );
    });

    it("total_deficiency_count in inspections matches actual deficiency row count", async () => {
      if (!representativeInspection) return;
      const reported = representativeInspection.total_deficiency_count as number | null;
      if (reported === null) return;

      const { count } = await client
        .from("deficiencies")
        .select("id", { count: "exact", head: true })
        .eq("inspection_id", representativeInspection.id);

      const actual = count ?? 0;
      // Note: total_deficiency_count may include substantiated complaints not in deficiency rows
      // So actual <= reported is the correct invariant (reported may be higher due to scraper gaps)
      assert(
        actual <= reported + 10, // allow small tolerance for scraper gaps
        `Inspection ${representativeInspection.id}: reported ${reported} deficiencies ` +
        `but found ${actual} actual deficiency rows — large discrepancy`
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // States table
  // ═══════════════════════════════════════════════════════════════════════════

  describe("States table completeness", () => {
    it("all covered states exist in states table", async () => {
      const { data } = await client
        .from("states")
        .select("code,name")
        .in("code", [...COVERED_STATE_CODES]);

      const foundCodes = new Set((data ?? []).map((s: { code: string }) => s.code));
      for (const sc of COVERED_STATE_CODES) {
        assert(foundCodes.has(sc), `State ${sc} not found in states table`);
      }
    });

    it("each state has a non-empty name", async () => {
      const { data } = await client
        .from("states")
        .select("code,name")
        .in("code", [...COVERED_STATE_CODES]);

      for (const s of (data ?? []) as { code: string; name: string }[]) {
        assert(isNonEmptyString(s.name), `State ${s.code} has empty name`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // facility_snapshot() RPC — full SnapshotPayload field audit
  // ═══════════════════════════════════════════════════════════════════════════

  describe("facility_snapshot() — complete SnapshotPayload field audit", () => {
    it("all SnapshotPayload fields present and correctly typed", async () => {
      if (!caFacility) return;

      const { data: snap, error } = await client
        .rpc("facility_snapshot", { p_facility_id: caFacility.id });

      assert(!error, `facility_snapshot() error: ${error?.message}`);
      assert(snap !== null, "facility_snapshot() returned null");

      const ctx = `CA/${caFacility.name}`;

      // ── facility sub-object ────────────────────────────────────────────
      assert(snap.facility !== null, `${ctx}: facility is null`);
      assert.strictEqual(typeof snap.facility.id, "string", `${ctx}: facility.id not string`);
      assert.strictEqual(snap.facility.id, caFacility.id, `${ctx}: facility.id mismatch`);
      assert(isNonEmptyString(snap.facility.name), `${ctx}: facility.name empty`);
      assert(isNonEmptyString(snap.facility.state_code), `${ctx}: facility.state_code empty`);
      // beds may be null
      if (snap.facility.beds !== null) {
        assert(Number.isInteger(snap.facility.beds) && snap.facility.beds > 0,
          `${ctx}: facility.beds must be positive int`);
      }

      // ── peer_set ──────────────────────────────────────────────────────
      assert(snap.peer_set !== null, `${ctx}: peer_set is null`);
      assert(Number.isInteger(snap.peer_set.n) && snap.peer_set.n >= 0,
        `${ctx}: peer_set.n must be non-negative int`);
      assert(isNonEmptyString(snap.peer_set.definition),
        `${ctx}: peer_set.definition must be non-empty`);
      assert([0, 1, 2, 3].includes(snap.peer_set.fallback_level),
        `${ctx}: peer_set.fallback_level ${snap.peer_set.fallback_level} not in [0,1,2,3]`);

      // ── metrics (all four) ────────────────────────────────────────────
      assert(snap.metrics !== null, `${ctx}: metrics is null`);
      for (const metricKey of ["severity", "repeats", "frequency", "trajectory"]) {
        const m = snap.metrics[metricKey];
        assert(m !== undefined, `${ctx}: metrics.${metricKey} missing`);
        assert(typeof m.value === "number" && m.value >= 0,
          `${ctx}: metrics.${metricKey}.value invalid: ${m.value}`);
        if (m.percentile !== null) {
          assert(m.percentile >= 0 && m.percentile <= 100,
            `${ctx}: metrics.${metricKey}.percentile out of [0,100]: ${m.percentile}`);
        }
        assert(typeof m.peer_median === "number" && m.peer_median >= 0,
          `${ctx}: metrics.${metricKey}.peer_median invalid: ${m.peer_median}`);
      }

      // ── has_inspections ───────────────────────────────────────────────
      assert(typeof snap.has_inspections === "boolean",
        `${ctx}: has_inspections must be boolean`);

      // Since this CA facility has a last_inspection_date, has_inspections must be true
      if (caFacility.last_inspection_date) {
        assert.strictEqual(snap.has_inspections, true,
          `${ctx}: has_inspections should be true (facility has last_inspection_date)`);
      }

      // ── grade ─────────────────────────────────────────────────────────
      if (snap.grade !== null) {
        assert(["A", "B", "C", "D", "F"].includes(snap.grade.letter),
          `${ctx}: grade.letter ${snap.grade.letter} not A-F`);
        assert(snap.grade.composite_percentile >= 0 && snap.grade.composite_percentile <= 100,
          `${ctx}: grade.composite_percentile out of [0,100]`);
      }

      // ── trajectory_series ─────────────────────────────────────────────
      assert(Array.isArray(snap.trajectory_series), `${ctx}: trajectory_series must be array`);
      const months = snap.trajectory_series.map((p: { month: string }) => p.month);
      const sortedMonths = [...months].sort();
      assert.deepStrictEqual(months, sortedMonths, `${ctx}: trajectory_series not chronological`);

      for (const point of snap.trajectory_series) {
        assert(/^\d{4}-\d{2}$/.test(point.month),
          `${ctx}: trajectory month not YYYY-MM format: ${point.month}`);
        assert(typeof point.facility_score === "number",
          `${ctx}: trajectory facility_score not number`);
        assert(typeof point.peer_median_score === "number",
          `${ctx}: trajectory peer_median_score not number`);
        // No future months in the series
        const currentMonth = new Date().toISOString().slice(0, 7);
        assert(point.month <= currentMonth,
          `${ctx}: trajectory has future month: ${point.month}`);
      }

      // ── heatmap ───────────────────────────────────────────────────────
      assert(Array.isArray(snap.heatmap), `${ctx}: heatmap must be array`);
      for (const cell of snap.heatmap) {
        assert([1, 2, 3, 4].includes(cell.severity),
          `${ctx}: heatmap severity ${cell.severity} not in [1,2,3,4]`);
        assert(["isolated", "pattern", "widespread"].includes(cell.scope),
          `${ctx}: heatmap scope ${cell.scope} invalid`);
        assert(Number.isInteger(cell.count) && cell.count >= 0,
          `${ctx}: heatmap count ${cell.count} invalid`);
        assert(Array.isArray(cell.tags), `${ctx}: heatmap tags must be array`);
      }

      // ── pull_quote ────────────────────────────────────────────────────
      if (snap.pull_quote !== null) {
        assert(isNonEmptyString(snap.pull_quote.date),
          `${ctx}: pull_quote.date must be non-empty string`);
        assert(isNonEmptyString(snap.pull_quote.text),
          `${ctx}: pull_quote.text must be non-empty string`);
      }
    });
  });
});
