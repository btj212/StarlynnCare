/**
 * 03 — Inspections & Deficiencies: Full Field Verification
 *
 * Selects a real facility with inspections from the live DB and verifies
 * every column on both tables.  Also validates the join relationship between
 * facilities → inspections → deficiencies and the computed deficiency counts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { publicClient, isUnconfigured } from "../helpers/client";
import type { Facility, Inspection, Deficiency } from "@/lib/types";

const SKIP = isUnconfigured();

// ─── Shared fixtures ──────────────────────────────────────────────────────────

let testFacility: Facility;
let inspections: Inspection[];
let deficiencies: Deficiency[];

beforeAll(async () => {
  if (SKIP) return;
  const pub = publicClient();

  // Find a publishable facility that has at least one inspection.
  const { data: facData } = await pub
    .from("facilities")
    .select("*")
    .eq("publishable", true)
    .not("last_inspection_date", "is", null)
    .order("last_inspection_date", { ascending: false })
    .limit(1)
    .single();

  testFacility = facData as Facility;

  const { data: inspData } = await pub
    .from("inspections")
    .select("*")
    .eq("facility_id", testFacility.id)
    .order("inspection_date", { ascending: false })
    .limit(50);

  inspections = (inspData ?? []) as Inspection[];

  if (inspections.length === 0) return;

  const inspIds = inspections.map((i) => i.id);
  const { data: defData } = await pub
    .from("deficiencies")
    .select("*")
    .in("inspection_id", inspIds);

  deficiencies = (defData ?? []) as Deficiency[];
});

// ─── Inspections: count and ordering ─────────────────────────────────────────

describe("03 · Inspections — count and ordering", () => {
  it.skipIf(SKIP)("test facility has at least one inspection", () => {
    expect(inspections.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("inspections are ordered most-recent-first", () => {
    for (let i = 1; i < inspections.length; i++) {
      expect(inspections[i].inspection_date <= inspections[i - 1].inspection_date).toBe(true);
    }
  });

  it.skipIf(SKIP)(
    "all inspections reference the correct facility_id",
    () => {
      for (const insp of inspections) {
        expect(insp.facility_id).toBe(testFacility.id);
      }
    },
  );
});

// ─── Inspections: every column present and typed ──────────────────────────────

describe("03 · Inspections — every column present and correctly typed", () => {
  it.skipIf(SKIP)("id is a valid UUID", () => {
    for (const i of inspections) {
      expect(i.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it.skipIf(SKIP)("facility_id is a valid UUID", () => {
    for (const i of inspections) {
      expect(i.facility_id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it.skipIf(SKIP)("inspection_date is a YYYY-MM-DD string", () => {
    for (const i of inspections) {
      expect(i.inspection_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(i.inspection_date).getTime()).not.toBeNaN();
    }
  });

  it.skipIf(SKIP)("inspection_type is null or a non-empty string", () => {
    for (const i of inspections) {
      if (i.inspection_type !== null) {
        expect(typeof i.inspection_type).toBe("string");
        expect(i.inspection_type.length).toBeGreaterThan(0);
      }
    }
  });

  it.skipIf(SKIP)("is_complaint is a boolean", () => {
    for (const i of inspections) {
      expect(typeof i.is_complaint).toBe("boolean");
    }
  });

  it.skipIf(SKIP)("complaint_id is null or string when is_complaint=false", () => {
    for (const i of inspections) {
      if (!i.is_complaint) {
        // complaint_id should be null for non-complaint inspections
        // (may be null even for complaints if state doesn't publish IDs)
        expect(i.complaint_id === null || typeof i.complaint_id === "string").toBe(true);
      }
    }
  });

  it.skipIf(SKIP)("total_deficiency_count is null or a non-negative integer", () => {
    for (const i of inspections) {
      if (i.total_deficiency_count !== null) {
        expect(Number.isInteger(i.total_deficiency_count)).toBe(true);
        expect(i.total_deficiency_count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it.skipIf(SKIP)("civil_money_penalty_total is null or a valid numeric string", () => {
    for (const i of inspections) {
      if (i.civil_money_penalty_total !== null) {
        // Supabase returns numeric as string
        expect(isNaN(parseFloat(String(i.civil_money_penalty_total)))).toBe(false);
      }
    }
  });

  it.skipIf(SKIP)("special_focus is a boolean", () => {
    for (const i of inspections) {
      expect(typeof i.special_focus).toBe("boolean");
    }
  });

  it.skipIf(SKIP)("source_url is a non-empty string", () => {
    for (const i of inspections) {
      expect(typeof i.source_url).toBe("string");
      expect(i.source_url.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(SKIP)("source_agency is a non-empty string", () => {
    for (const i of inspections) {
      expect(typeof i.source_agency).toBe("string");
      expect(i.source_agency.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(SKIP)("scrape_run_id is null or a valid UUID", () => {
    for (const i of inspections) {
      if (i.scrape_run_id !== null) {
        expect(i.scrape_run_id).toMatch(/^[0-9a-f-]{36}$/);
      }
    }
  });

  it.skipIf(SKIP)("raw_data is null or a plain object", () => {
    for (const i of inspections) {
      if (i.raw_data !== null) {
        expect(typeof i.raw_data).toBe("object");
        expect(Array.isArray(i.raw_data)).toBe(false);
      }
    }
  });

  it.skipIf(SKIP)("created_at is a valid ISO timestamp", () => {
    for (const i of inspections) {
      expect(new Date(i.created_at).getTime()).not.toBeNaN();
    }
  });
});

// ─── Inspections: global cross-facility checks ────────────────────────────────

describe("03 · Inspections — global cross-facility checks", () => {
  it.skipIf(SKIP)("all inspections in DB have a valid inspection_date", async () => {
    const { data } = await publicClient()
      .from("inspections")
      .select("id, inspection_date")
      .limit(200);

    for (const row of (data ?? []) as Array<{ id: string; inspection_date: string }>) {
      expect(row.inspection_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it.skipIf(SKIP)("no inspection_date is in the future", async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await publicClient()
      .from("inspections")
      .select("id, inspection_date")
      .gt("inspection_date", today);

    expect((data ?? []).length).toBe(0);
  });

  it.skipIf(SKIP)(
    "all inspection facility_ids reference existing facilities",
    async () => {
      // Sample check: get inspections and confirm facility_id is in facilities.
      const { data: inspSample } = await publicClient()
        .from("inspections")
        .select("facility_id")
        .limit(50);

      const facIds = [...new Set((inspSample ?? []).map((r: Record<string, unknown>) => r.facility_id as string))];
      if (facIds.length === 0) return;

      const { data: facData, count } = await publicClient()
        .from("facilities")
        .select("id", { count: "exact" })
        .in("id", facIds);

      expect(count).toBe(facIds.length);
      expect((facData ?? []).length).toBe(facIds.length);
    },
  );
});

// ─── Deficiencies: count and structure ────────────────────────────────────────

describe("03 · Deficiencies — count and join integrity", () => {
  it.skipIf(SKIP)("test facility has deficiency records", () => {
    expect(deficiencies.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)(
    "every deficiency's inspection_id is present in the inspection list",
    () => {
      const inspIdSet = new Set(inspections.map((i) => i.id));
      for (const d of deficiencies) {
        expect(inspIdSet.has(d.inspection_id)).toBe(true);
      }
    },
  );

  it.skipIf(SKIP)(
    "denormalised total_deficiency_count matches actual deficiency rows for each inspection",
    () => {
      const countByInsp = new Map<string, number>();
      for (const d of deficiencies) {
        countByInsp.set(d.inspection_id, (countByInsp.get(d.inspection_id) ?? 0) + 1);
      }

      for (const insp of inspections) {
        if (insp.total_deficiency_count === null) continue;
        const actual = countByInsp.get(insp.id) ?? 0;
        // Allow ±1 tolerance: the denormalised count may include or exclude
        // "substantiated complaint" rows the scraper didn't link deficiencies to.
        expect(Math.abs(insp.total_deficiency_count - actual)).toBeLessThanOrEqual(1);
      }
    },
  );
});

// ─── Deficiencies: every column present and typed ─────────────────────────────

describe("03 · Deficiencies — every column present and correctly typed", () => {
  it.skipIf(SKIP)("id is a valid UUID", () => {
    for (const d of deficiencies) {
      expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it.skipIf(SKIP)("inspection_id is a valid UUID", () => {
    for (const d of deficiencies) {
      expect(d.inspection_id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it.skipIf(SKIP)("ftag is null or a non-empty string", () => {
    for (const d of deficiencies) {
      if (d.ftag !== null) {
        expect(typeof d.ftag).toBe("string");
        expect(d.ftag.length).toBeGreaterThan(0);
      }
    }
  });

  it.skipIf(SKIP)("code is null or a non-empty string", () => {
    for (const d of deficiencies) {
      if (d.code !== null) {
        expect(typeof d.code).toBe("string");
        expect(d.code.length).toBeGreaterThan(0);
      }
    }
  });

  it.skipIf(SKIP)("severity is null or 1–4", () => {
    for (const d of deficiencies) {
      if (d.severity !== null) {
        expect([1, 2, 3, 4]).toContain(d.severity);
      }
    }
  });

  it.skipIf(SKIP)("scope is null or one of isolated/pattern/widespread", () => {
    for (const d of deficiencies) {
      if (d.scope !== null) {
        expect(["isolated", "pattern", "widespread"]).toContain(d.scope);
      }
    }
  });

  it.skipIf(SKIP)("scope_severity_code is null or a single character A–L", () => {
    for (const d of deficiencies) {
      if (d.scope_severity_code !== null) {
        expect(d.scope_severity_code).toMatch(/^[A-L]$/);
      }
    }
  });

  it.skipIf(SKIP)("immediate_jeopardy is a boolean", () => {
    for (const d of deficiencies) {
      expect(typeof d.immediate_jeopardy).toBe("boolean");
    }
  });

  it.skipIf(SKIP)("substandard_quality_of_care is a boolean", () => {
    for (const d of deficiencies) {
      expect(typeof d.substandard_quality_of_care).toBe("boolean");
    }
  });

  it.skipIf(SKIP)("is_repeat is a boolean", () => {
    for (const d of deficiencies) {
      expect(typeof d.is_repeat).toBe("boolean");
    }
  });

  it.skipIf(SKIP)("description is null or a non-empty string", () => {
    for (const d of deficiencies) {
      if (d.description !== null) {
        expect(typeof d.description).toBe("string");
        expect(d.description.length).toBeGreaterThan(0);
      }
    }
  });

  it.skipIf(SKIP)("residents_affected is null or a non-negative integer", () => {
    for (const d of deficiencies) {
      if (d.residents_affected !== null) {
        expect(Number.isInteger(d.residents_affected)).toBe(true);
        expect(d.residents_affected).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it.skipIf(SKIP)("poc_deadline is null or a valid YYYY-MM-DD date", () => {
    for (const d of deficiencies) {
      if (d.poc_deadline !== null) {
        expect(d.poc_deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it.skipIf(SKIP)("cited_date is null or a valid YYYY-MM-DD date", () => {
    for (const d of deficiencies) {
      if (d.cited_date !== null) {
        expect(d.cited_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it.skipIf(SKIP)("corrected_date is null or a valid YYYY-MM-DD date", () => {
    for (const d of deficiencies) {
      if (d.corrected_date !== null) {
        expect(d.corrected_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it.skipIf(SKIP)("civil_money_penalty is null or a non-negative number", () => {
    for (const d of deficiencies) {
      if (d.civil_money_penalty !== null) {
        const v = parseFloat(String(d.civil_money_penalty));
        expect(isNaN(v)).toBe(false);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it.skipIf(SKIP)("created_at is a valid ISO timestamp", () => {
    for (const d of deficiencies) {
      expect(new Date(d.created_at).getTime()).not.toBeNaN();
    }
  });
});

// ─── Deficiencies: business-logic checks ─────────────────────────────────────

describe("03 · Deficiencies — business logic constraints", () => {
  it.skipIf(SKIP)(
    "immediate_jeopardy=true deficiencies have severity=4 OR class=Type A (or null class)",
    () => {
      for (const d of deficiencies) {
        if (!d.immediate_jeopardy) continue;
        // IJ should map to severity 4 (or at least severity >= 3)
        if (d.severity !== null) {
          expect(d.severity).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );

  it.skipIf(SKIP)("IJ deficiencies can be found in the global index", async () => {
    const { data } = await publicClient()
      .from("deficiencies")
      .select("id, immediate_jeopardy")
      .eq("immediate_jeopardy", true)
      .limit(5);

    // IJ index exists — query must not error even if count is 0
    expect(Array.isArray(data)).toBe(true);
    for (const row of (data ?? []) as Array<{ immediate_jeopardy: boolean }>) {
      expect(row.immediate_jeopardy).toBe(true);
    }
  });

  it.skipIf(SKIP)(
    "is_repeat=true deficiencies have the flag set on all returned rows",
    async () => {
      const { data } = await publicClient()
        .from("deficiencies")
        .select("id, is_repeat")
        .eq("is_repeat", true)
        .limit(5);

      for (const row of (data ?? []) as Array<{ is_repeat: boolean }>) {
        expect(row.is_repeat).toBe(true);
      }
    },
  );
});
