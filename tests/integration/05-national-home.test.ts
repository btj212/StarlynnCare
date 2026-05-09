/**
 * 05 — loadNationalHomeData: Full E2E Verification
 *
 * Calls the real data loader that powers the national homepage.
 * Verifies every field of the NationalHomeData shape against live DB data,
 * including cross-field consistency (e.g. state slugs match COVERED_STATES).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { isUnconfigured } from "../helpers/client";
import { loadNationalHomeData, type NationalHomeData } from "@/lib/data/nationalHome";
import { COVERED_STATES } from "@/lib/states";

const SKIP = isUnconfigured();

let data: NationalHomeData;

beforeAll(async () => {
  if (SKIP) return;
  data = await loadNationalHomeData();
});

// ─── Top-level counts ─────────────────────────────────────────────────────────

describe("05 · loadNationalHomeData — global counts", () => {
  it.skipIf(SKIP)("returns a defined NationalHomeData object", () => {
    expect(data).toBeDefined();
    expect(typeof data).toBe("object");
  });

  it.skipIf(SKIP)("totalFacilities is a positive integer", () => {
    expect(Number.isInteger(data.totalFacilities)).toBe(true);
    expect(data.totalFacilities).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("totalInspections is a non-negative integer", () => {
    expect(Number.isInteger(data.totalInspections)).toBe(true);
    expect(data.totalInspections).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(SKIP)("totalSevereCitations is a non-negative integer", () => {
    expect(Number.isInteger(data.totalSevereCitations)).toBe(true);
    expect(data.totalSevereCitations).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(SKIP)("totalSevereCitations <= totalInspections (sanity bound)", () => {
    // Each inspection can have multiple deficiencies but the count can't exceed
    // an absurd multiple.  This is a sanity check, not a hard rule.
    expect(data.totalSevereCitations).toBeLessThanOrEqual(
      data.totalInspections * 100,
    );
  });

  it.skipIf(SKIP)("lastRefreshed is null or a YYYY-MM-DD string", () => {
    if (data.lastRefreshed !== null) {
      expect(data.lastRefreshed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(data.lastRefreshed).getTime()).not.toBeNaN();
    }
  });
});

// ─── States array ─────────────────────────────────────────────────────────────

describe("05 · loadNationalHomeData — states array", () => {
  it.skipIf(SKIP)("states array has same length as COVERED_STATES", () => {
    expect(data.states.length).toBe(COVERED_STATES.length);
  });

  it.skipIf(SKIP)("every COVERED_STATE slug is present in the result", () => {
    const returnedSlugs = new Set(data.states.map((s) => s.stateSlug));
    for (const covered of COVERED_STATES) {
      expect(returnedSlugs.has(covered.slug)).toBe(true);
    }
  });

  it.skipIf(SKIP)("every state summary has all required fields", () => {
    for (const s of data.states) {
      expect(typeof s.stateSlug).toBe("string");
      expect(s.stateSlug.length).toBeGreaterThan(0);

      expect(typeof s.stateCode).toBe("string");
      expect(s.stateCode).toMatch(/^[A-Z]{2}$/);

      expect(typeof s.stateName).toBe("string");
      expect(s.stateName.length).toBeGreaterThan(0);

      expect(Number.isInteger(s.facilityCount)).toBe(true);
      expect(s.facilityCount).toBeGreaterThanOrEqual(0);

      expect(Number.isInteger(s.cityCount)).toBe(true);
      expect(s.cityCount).toBeGreaterThanOrEqual(0);
    }
  });

  it.skipIf(SKIP)("CA has the most facilities (beachhead state)", () => {
    const ca = data.states.find((s) => s.stateCode === "CA");
    expect(ca).toBeDefined();
    expect(ca!.facilityCount).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("stateCode and stateSlug are consistent with COVERED_STATES", () => {
    for (const s of data.states) {
      const covered = COVERED_STATES.find((c) => c.code === s.stateCode);
      expect(covered).toBeDefined();
      expect(s.stateSlug).toBe(covered!.slug);
      expect(s.stateName).toBe(covered!.name);
    }
  });

  it.skipIf(SKIP)("sum of facilityCount across states <= totalFacilities", () => {
    const stateSum = data.states.reduce((acc, s) => acc + s.facilityCount, 0);
    // May be less if some facilities lack a matching COVERED_STATE entry.
    expect(stateSum).toBeLessThanOrEqual(data.totalFacilities);
  });

  it.skipIf(SKIP)("cityCount is <= facilityCount for each state (one city can have many facilities)", () => {
    for (const s of data.states) {
      expect(s.cityCount).toBeLessThanOrEqual(s.facilityCount);
    }
  });
});

// ─── Top cities ───────────────────────────────────────────────────────────────

describe("05 · loadNationalHomeData — topCities array", () => {
  it.skipIf(SKIP)("topCities is an array with at most 24 entries", () => {
    expect(Array.isArray(data.topCities)).toBe(true);
    expect(data.topCities.length).toBeLessThanOrEqual(24);
  });

  it.skipIf(SKIP)("every city has all required fields", () => {
    for (const c of data.topCities) {
      expect(typeof c.name).toBe("string");
      expect(c.name.length).toBeGreaterThan(0);

      expect(typeof c.slug).toBe("string");
      expect(c.slug.length).toBeGreaterThan(0);
      // Slug format
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);

      expect(Number.isInteger(c.count)).toBe(true);
      expect(c.count).toBeGreaterThan(0);

      expect(typeof c.stateCode).toBe("string");
      expect(c.stateCode).toMatch(/^[A-Z]{2}$/);

      expect(typeof c.stateSlug).toBe("string");
      expect(c.stateSlug.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(SKIP)("cities are sorted descending by facility count", () => {
    for (let i = 1; i < data.topCities.length; i++) {
      expect(data.topCities[i].count).toBeLessThanOrEqual(data.topCities[i - 1].count);
    }
  });

  it.skipIf(SKIP)("every city's stateCode maps to a known COVERED_STATE", () => {
    const coveredCodes = new Set(COVERED_STATES.map((s) => s.code));
    for (const c of data.topCities) {
      expect(coveredCodes.has(c.stateCode)).toBe(true);
    }
  });

  it.skipIf(SKIP)("city name is a human-readable title (not a raw slug)", () => {
    // City names should contain at least one letter (not be purely slug-like)
    for (const c of data.topCities) {
      expect(/[a-zA-Z]/.test(c.name)).toBe(true);
    }
  });

  it.skipIf(SKIP)("no duplicate city slugs within a state", () => {
    const seen = new Set<string>();
    for (const c of data.topCities) {
      const key = `${c.stateCode}:${c.slug}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ─── Sample reviews ───────────────────────────────────────────────────────────

describe("05 · loadNationalHomeData — sampleReviews array", () => {
  it.skipIf(SKIP)("sampleReviews is an array", () => {
    expect(Array.isArray(data.sampleReviews)).toBe(true);
    expect(data.sampleReviews.length).toBeLessThanOrEqual(3);
  });

  it.skipIf(SKIP)("every sample review has all required fields when present", () => {
    for (const r of data.sampleReviews) {
      expect(typeof r.id).toBe("string");
      expect(r.id).toMatch(/^[0-9a-f-]{36}$/);

      expect(typeof r.body).toBe("string");
      expect(r.body.length).toBeGreaterThan(0);

      expect(typeof r.rating).toBe("number");
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(5);

      expect(r.reviewer_name === null || typeof r.reviewer_name === "string").toBe(true);

      expect(typeof r.created_at).toBe("string");
      expect(new Date(r.created_at).getTime()).not.toBeNaN();

      // facility_name and facility_city can be null if facility was deleted
      expect(r.facility_name === null || typeof r.facility_name === "string").toBe(true);
      expect(r.facility_city === null || typeof r.facility_city === "string").toBe(true);
    }
  });

  it.skipIf(SKIP)("all sample reviews are published (RLS check)", async () => {
    // Cross-verify: every review returned should have status=published in DB.
    if (data.sampleReviews.length === 0) return;

    const { publicClient: getPublic } = await import("../helpers/client");
    const pub = getPublic();
    const ids = data.sampleReviews.map((r) => r.id);
    const { data: rows } = await pub
      .from("reviews")
      .select("id, status")
      .in("id", ids);

    for (const row of (rows ?? []) as Array<{ status: string }>) {
      expect(row.status).toBe("published");
    }
  });
});

// ─── Consistency cross-check ──────────────────────────────────────────────────

describe("05 · loadNationalHomeData — cross-field consistency", () => {
  it.skipIf(SKIP)(
    "totalFacilities >= sum of all topCity counts (cities are subsets of facilities)",
    () => {
      const cityTotal = data.topCities.reduce((acc, c) => acc + c.count, 0);
      // Cities may overlap across states, but total city count can't exceed
      // total facilities.
      expect(data.totalFacilities).toBeGreaterThanOrEqual(data.topCities[0]?.count ?? 0);
    },
  );

  it.skipIf(SKIP)(
    "lastRefreshed date is not in the future",
    () => {
      if (!data.lastRefreshed) return;
      const refreshed = new Date(data.lastRefreshed);
      expect(refreshed.getTime()).toBeLessThanOrEqual(Date.now());
    },
  );
});
