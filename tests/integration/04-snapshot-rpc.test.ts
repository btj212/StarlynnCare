/**
 * 04 — facility_snapshot() RPC: Full JSON Schema Verification
 *
 * Calls the live PostgreSQL RPC against a real facility with inspections
 * and verifies EVERY field in the response JSON.  Also tests the "no
 * inspections" branch (grade = null, has_inspections = false).
 *
 * The RPC is the most complex query in the pipeline: peer-set derivation,
 * four benchmarked metrics with percentile ranks, composite letter grade,
 * 24-month sparkline, 4×3 scope×severity heatmap, and pull-quote selection.
 * Every piece is verified here.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { publicClient, isUnconfigured } from "../helpers/client";
import type { SnapshotPayload } from "@/lib/facility/loadFacilityProfile";

const SKIP = isUnconfigured();

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let facilityWithInspections: { id: string; name: string; state_code: string; beds: number | null };
let facilityNoInspections: { id: string } | null;
let snapshotWith: SnapshotPayload;
let snapshotWithout: SnapshotPayload | null;

beforeAll(async () => {
  if (SKIP) return;
  const pub = publicClient();

  // Facility WITH inspections
  const { data: withInsp } = await pub
    .from("facilities")
    .select("id, name, state_code, beds")
    .eq("publishable", true)
    .not("last_inspection_date", "is", null)
    .order("last_inspection_date", { ascending: false })
    .limit(1)
    .single();

  facilityWithInspections = withInsp as typeof facilityWithInspections;

  const { data: snapWith, error: errWith } = await pub.rpc("facility_snapshot", {
    p_facility_id: facilityWithInspections.id,
  });

  if (errWith) throw new Error(`facility_snapshot RPC failed: ${errWith.message}`);
  snapshotWith = snapWith as SnapshotPayload;

  // Facility WITHOUT inspections (may not exist)
  const { data: noInspFac } = await pub
    .from("facilities")
    .select("id")
    .eq("publishable", true)
    .is("last_inspection_date", null)
    .limit(1)
    .maybeSingle();

  facilityNoInspections = noInspFac as { id: string } | null;

  if (facilityNoInspections) {
    const { data: snapWithout } = await pub.rpc("facility_snapshot", {
      p_facility_id: facilityNoInspections.id,
    });
    snapshotWithout = snapWithout as SnapshotPayload | null;
  }
});

// ─── Top-level structure ──────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — top-level structure", () => {
  it.skipIf(SKIP)("RPC returns a non-null object", () => {
    expect(snapshotWith).not.toBeNull();
    expect(typeof snapshotWith).toBe("object");
  });

  it.skipIf(SKIP)("top-level keys are exactly: facility, peer_set, metrics, grade, has_inspections, trajectory_series, heatmap, pull_quote", () => {
    const keys = Object.keys(snapshotWith).sort();
    expect(keys).toEqual(
      [
        "facility", "grade", "has_inspections", "heatmap",
        "metrics", "peer_set", "pull_quote", "trajectory_series",
      ].sort(),
    );
  });
});

// ─── facility sub-object ──────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — facility sub-object", () => {
  it.skipIf(SKIP)("facility.id matches the queried facility UUID", () => {
    expect(snapshotWith.facility.id).toBe(facilityWithInspections.id);
  });

  it.skipIf(SKIP)("facility.name matches the DB name", () => {
    expect(snapshotWith.facility.name).toBe(facilityWithInspections.name);
  });

  it.skipIf(SKIP)("facility.state_code matches", () => {
    expect(snapshotWith.facility.state_code).toBe(facilityWithInspections.state_code);
  });

  it.skipIf(SKIP)("facility.beds is null or a non-negative integer", () => {
    const beds = snapshotWith.facility.beds;
    if (beds !== null) {
      expect(Number.isInteger(beds)).toBe(true);
      expect(beds).toBeGreaterThanOrEqual(0);
    }
  });

  it.skipIf(SKIP)("facility.license_type is null or a string", () => {
    const lt = snapshotWith.facility.license_type;
    expect(lt === null || typeof lt === "string").toBe(true);
  });
});

// ─── peer_set sub-object ──────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — peer_set sub-object", () => {
  it.skipIf(SKIP)("peer_set.definition is a non-empty string", () => {
    expect(typeof snapshotWith.peer_set.definition).toBe("string");
    expect(snapshotWith.peer_set.definition.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("peer_set.n is a positive integer (at least 1 — the facility itself)", () => {
    expect(Number.isInteger(snapshotWith.peer_set.n)).toBe(true);
    expect(snapshotWith.peer_set.n).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(SKIP)("peer_set.fallback_level is 0, 1, or 2", () => {
    expect([0, 1, 2]).toContain(snapshotWith.peer_set.fallback_level);
  });
});

// ─── metrics sub-object ───────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — metrics sub-object (all four)", () => {
  const METRIC_KEYS = ["severity", "repeats", "frequency", "trajectory"] as const;

  for (const key of METRIC_KEYS) {
    it.skipIf(SKIP)(`metrics.${key}.value is a finite number`, () => {
      const m = snapshotWith.metrics[key];
      expect(typeof m.value).toBe("number");
      expect(isFinite(m.value)).toBe(true);
    });

    it.skipIf(SKIP)(`metrics.${key}.peer_median is a finite non-negative number`, () => {
      const m = snapshotWith.metrics[key];
      expect(typeof m.peer_median).toBe("number");
      expect(isFinite(m.peer_median)).toBe(true);
      expect(m.peer_median).toBeGreaterThanOrEqual(0);
    });

    it.skipIf(SKIP)(`metrics.${key}.percentile is null or 0–100 integer`, () => {
      const m = snapshotWith.metrics[key];
      if (m.percentile !== null) {
        expect(Number.isInteger(m.percentile)).toBe(true);
        expect(m.percentile).toBeGreaterThanOrEqual(0);
        expect(m.percentile).toBeLessThanOrEqual(100);
      }
    });
  }

  it.skipIf(SKIP)("severity metric value is non-negative (weighted sum / beds)", () => {
    expect(snapshotWith.metrics.severity.value).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(SKIP)("repeats metric value is 0–1 (repeat fraction)", () => {
    expect(snapshotWith.metrics.repeats.value).toBeGreaterThanOrEqual(0);
    expect(snapshotWith.metrics.repeats.value).toBeLessThanOrEqual(1);
  });

  it.skipIf(SKIP)("frequency metric value is non-negative (defs / routine inspections)", () => {
    expect(snapshotWith.metrics.frequency.value).toBeGreaterThanOrEqual(0);
  });
});

// ─── grade sub-object ─────────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — grade (facility has inspections)", () => {
  it.skipIf(SKIP)("has_inspections is true for the test facility", () => {
    expect(snapshotWith.has_inspections).toBe(true);
  });

  it.skipIf(SKIP)("grade is non-null when has_inspections=true", () => {
    expect(snapshotWith.grade).not.toBeNull();
  });

  it.skipIf(SKIP)("grade.letter is one of the eight valid letter grades", () => {
    const VALID_LETTERS = ["A", "A−", "B", "B−", "C", "C−", "D", "F"];
    expect(VALID_LETTERS).toContain(snapshotWith.grade!.letter);
  });

  it.skipIf(SKIP)("grade.composite_percentile is an integer 0–100", () => {
    expect(Number.isInteger(snapshotWith.grade!.composite_percentile)).toBe(true);
    expect(snapshotWith.grade!.composite_percentile).toBeGreaterThanOrEqual(0);
    expect(snapshotWith.grade!.composite_percentile).toBeLessThanOrEqual(100);
  });
});

// ─── trajectory_series ────────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — trajectory_series (24-month sparkline)", () => {
  it.skipIf(SKIP)("trajectory_series is an array", () => {
    expect(Array.isArray(snapshotWith.trajectory_series)).toBe(true);
  });

  it.skipIf(SKIP)("trajectory_series has exactly 24 entries", () => {
    expect(snapshotWith.trajectory_series.length).toBe(24);
  });

  it.skipIf(SKIP)("each entry has month (YYYY-MM), facility_score, peer_median_score", () => {
    for (const pt of snapshotWith.trajectory_series) {
      expect(pt.month).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof pt.facility_score).toBe("number");
      expect(typeof pt.peer_median_score).toBe("number");
    }
  });

  it.skipIf(SKIP)("months are in ascending chronological order", () => {
    const months = snapshotWith.trajectory_series.map((p) => p.month);
    for (let i = 1; i < months.length; i++) {
      expect(months[i] >= months[i - 1]).toBe(true);
    }
  });

  it.skipIf(SKIP)("all scores are non-negative", () => {
    for (const pt of snapshotWith.trajectory_series) {
      expect(pt.facility_score).toBeGreaterThanOrEqual(0);
      expect(pt.peer_median_score).toBeGreaterThanOrEqual(0);
    }
  });

  it.skipIf(SKIP)("most-recent month is current calendar month or last month", () => {
    const last = snapshotWith.trajectory_series[23].month;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    expect([currentMonth, prevMonth]).toContain(last);
  });

  it.skipIf(SKIP)("first month is ~23 months before the last month", () => {
    const first = new Date(snapshotWith.trajectory_series[0].month + "-01");
    const last = new Date(snapshotWith.trajectory_series[23].month + "-01");
    const diffMonths =
      (last.getFullYear() - first.getFullYear()) * 12 +
      (last.getMonth() - first.getMonth());
    expect(diffMonths).toBe(23);
  });
});

// ─── heatmap ─────────────────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — heatmap (4×3 scope×severity grid)", () => {
  it.skipIf(SKIP)("heatmap is an array", () => {
    expect(Array.isArray(snapshotWith.heatmap)).toBe(true);
  });

  it.skipIf(SKIP)("all heatmap cells have severity in 1–4", () => {
    for (const cell of snapshotWith.heatmap) {
      expect([1, 2, 3, 4]).toContain(cell.severity);
    }
  });

  it.skipIf(SKIP)("all heatmap cells have scope in isolated/pattern/widespread", () => {
    for (const cell of snapshotWith.heatmap) {
      expect(["isolated", "pattern", "widespread"]).toContain(cell.scope);
    }
  });

  it.skipIf(SKIP)("all heatmap cells have count > 0", () => {
    for (const cell of snapshotWith.heatmap) {
      expect(cell.count).toBeGreaterThan(0);
    }
  });

  it.skipIf(SKIP)("heatmap cell tags are null or an array of strings", () => {
    for (const cell of snapshotWith.heatmap) {
      if (cell.tags !== null) {
        expect(Array.isArray(cell.tags)).toBe(true);
        for (const tag of cell.tags ?? []) {
          expect(typeof tag).toBe("string");
        }
      }
    }
  });

  it.skipIf(SKIP)("no duplicate (severity, scope) pairs in heatmap", () => {
    const seen = new Set<string>();
    for (const cell of snapshotWith.heatmap) {
      const key = `${cell.severity}:${cell.scope}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it.skipIf(SKIP)("heatmap has at most 12 cells (4 severities × 3 scopes)", () => {
    expect(snapshotWith.heatmap.length).toBeLessThanOrEqual(12);
  });
});

// ─── pull_quote ────────────────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — pull_quote", () => {
  it.skipIf(SKIP)("pull_quote is null or a valid object", () => {
    const pq = snapshotWith.pull_quote;
    if (pq === null) return;
    expect(typeof pq).toBe("object");
  });

  it.skipIf(SKIP)("pull_quote.date is a valid date string when present", () => {
    if (!snapshotWith.pull_quote) return;
    expect(snapshotWith.pull_quote.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.skipIf(SKIP)("pull_quote.text is a non-empty string when present", () => {
    if (!snapshotWith.pull_quote) return;
    expect(typeof snapshotWith.pull_quote.text).toBe("string");
    expect(snapshotWith.pull_quote.text.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("pull_quote.tag is null or a non-empty string", () => {
    if (!snapshotWith.pull_quote) return;
    const tag = snapshotWith.pull_quote.tag;
    expect(tag === null || (typeof tag === "string" && tag.length > 0)).toBe(true);
  });
});

// ─── No-inspections branch ────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — facility with no inspections", () => {
  it.skipIf(SKIP || !facilityNoInspections)(
    "has_inspections is false",
    () => {
      expect(snapshotWithout).not.toBeNull();
      expect(snapshotWithout!.has_inspections).toBe(false);
    },
  );

  it.skipIf(SKIP || !facilityNoInspections)(
    "grade is null when facility has no inspections",
    () => {
      expect(snapshotWithout!.grade).toBeNull();
    },
  );

  it.skipIf(SKIP || !facilityNoInspections)(
    "trajectory_series still has 24 entries (all zeros)",
    () => {
      expect(snapshotWithout!.trajectory_series.length).toBe(24);
      for (const pt of snapshotWithout!.trajectory_series) {
        expect(pt.facility_score).toBe(0);
      }
    },
  );

  it.skipIf(SKIP || !facilityNoInspections)(
    "heatmap is empty array when no deficiencies",
    () => {
      expect(snapshotWithout!.heatmap.length).toBe(0);
    },
  );

  it.skipIf(SKIP || !facilityNoInspections)(
    "pull_quote is null when no deficiencies",
    () => {
      expect(snapshotWithout!.pull_quote).toBeNull();
    },
  );
});

// ─── Grade boundary checks ────────────────────────────────────────────────────

describe("04 · facility_snapshot RPC — grade boundary sanity", () => {
  it.skipIf(SKIP)(
    "composite_percentile maps correctly to grade letter boundaries",
    () => {
      if (!snapshotWith.grade) return;
      const { letter, composite_percentile: cp } = snapshotWith.grade;
      if (letter === "A") expect(cp).toBeGreaterThanOrEqual(90);
      else if (letter === "A−") {
        expect(cp).toBeGreaterThanOrEqual(80);
        expect(cp).toBeLessThan(90);
      } else if (letter === "B") {
        expect(cp).toBeGreaterThanOrEqual(70);
        expect(cp).toBeLessThan(80);
      } else if (letter === "B−") {
        expect(cp).toBeGreaterThanOrEqual(60);
        expect(cp).toBeLessThan(70);
      } else if (letter === "C") {
        expect(cp).toBeGreaterThanOrEqual(50);
        expect(cp).toBeLessThan(60);
      } else if (letter === "C−") {
        expect(cp).toBeGreaterThanOrEqual(40);
        expect(cp).toBeLessThan(50);
      } else if (letter === "D") {
        expect(cp).toBeGreaterThanOrEqual(30);
        expect(cp).toBeLessThan(40);
      } else {
        // F
        expect(cp).toBeLessThan(30);
      }
    },
  );
});
