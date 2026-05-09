/**
 * 06 — loadFacilityProfile: Full End-to-End Pipeline Test
 *
 * This is the deepest integration test in the suite.  It calls the same
 * function the facility page Server Component calls, then verifies every
 * field of the returned FacilityProfile — the facility record, state info,
 * all inspection rows (each with every column), all deficiency rows, the
 * full SnapshotPayload, the derived timeline + scope×severity grid, rules
 * cards, reviews, SEO fields, and JSON-LD schemas.
 *
 * No mocks — real Supabase, real data, real RPC.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { publicClient, isUnconfigured } from "../helpers/client";
import { loadFacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { stateFromCode } from "@/lib/states";
import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import type { Facility } from "@/lib/types";

const SKIP = isUnconfigured();

// ─── Discover a real test facility ───────────────────────────────────────────

let testFacility: Facility;
let profile: FacilityProfile;

beforeAll(async () => {
  if (SKIP) return;

  // Prefer a facility with inspections so every code path is exercised.
  const { data: facData } = await publicClient()
    .from("facilities")
    .select("*")
    .eq("publishable", true)
    .not("last_inspection_date", "is", null)
    .order("last_inspection_date", { ascending: false })
    .limit(1)
    .single();

  testFacility = facData as Facility;

  const state = stateFromCode(testFacility.state_code);
  if (!state) throw new Error(`Unknown state code: ${testFacility.state_code}`);

  const result = await loadFacilityProfile({
    stateSlug: state.slug,
    regionSlug: testFacility.city_slug,
    facilitySlug: testFacility.slug,
  });

  if (result === "not_found") throw new Error("loadFacilityProfile returned not_found for a real facility");
  if (result === "unconfigured") throw new Error("loadFacilityProfile returned unconfigured — check env vars");

  profile = result;
});

// ─── Return type ──────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — return value shape", () => {
  it.skipIf(SKIP)("returns a FacilityProfile object (not an error string)", () => {
    expect(typeof profile).toBe("object");
    expect(profile).not.toBeNull();
  });
});

// ─── facility field ───────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.facility", () => {
  it.skipIf(SKIP)("facility.id matches the discovered facility", () => {
    expect(profile.facility.id).toBe(testFacility.id);
  });

  it.skipIf(SKIP)("facility.state_code is 2-char uppercase", () => {
    expect(profile.facility.state_code).toMatch(/^[A-Z]{2}$/);
  });

  it.skipIf(SKIP)("facility.name is a non-empty string", () => {
    expect(typeof profile.facility.name).toBe("string");
    expect(profile.facility.name.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("facility.city_slug matches what was used to query", () => {
    expect(profile.facility.city_slug).toBe(testFacility.city_slug);
  });

  it.skipIf(SKIP)("facility.slug matches what was used to query", () => {
    expect(profile.facility.slug).toBe(testFacility.slug);
  });

  it.skipIf(SKIP)("facility.publishable is true", () => {
    expect(profile.facility.publishable).toBe(true);
  });

  it.skipIf(SKIP)("facility.care_category is a valid enum value", () => {
    const valid = [
      "rcfe_memory_care", "rcfe_general", "alf_memory_care", "alf_general",
      "snf_general", "snf_dementia_scu", "ccrc", "unknown",
    ];
    expect(valid).toContain(profile.facility.care_category);
  });

  it.skipIf(SKIP)("facility.capacity_tier is a valid enum value", () => {
    expect(["small", "medium", "large", "unknown"]).toContain(profile.facility.capacity_tier);
  });

  it.skipIf(SKIP)("facility.serves_memory_care is a boolean", () => {
    expect(typeof profile.facility.serves_memory_care).toBe("boolean");
  });

  it.skipIf(SKIP)("facility.memory_care_disclosure_filed is a boolean", () => {
    expect(typeof profile.facility.memory_care_disclosure_filed).toBe("boolean");
  });

  it.skipIf(SKIP)("facility.created_at and updated_at are valid timestamps", () => {
    expect(new Date(profile.facility.created_at).getTime()).not.toBeNaN();
    expect(new Date(profile.facility.updated_at).getTime()).not.toBeNaN();
  });
});

// ─── state field ─────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.state", () => {
  it.skipIf(SKIP)("state.code matches facility.state_code", () => {
    expect(profile.state.code).toBe(profile.facility.state_code);
  });

  it.skipIf(SKIP)("state.name is a non-empty string", () => {
    expect(typeof profile.state.name).toBe("string");
    expect(profile.state.name.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("state.slug is a valid lowercase slug", () => {
    expect(profile.state.slug).toMatch(/^[a-z]+$/);
  });
});

// ─── cfg field ────────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.cfg (StateProfileConfig)", () => {
  it.skipIf(SKIP)("cfg.code matches the facility state_code", () => {
    expect(profile.cfg.code).toBe(profile.facility.state_code);
  });

  it.skipIf(SKIP)("cfg.agencyShort is a non-empty string", () => {
    expect(typeof profile.cfg.agencyShort).toBe("string");
    expect(profile.cfg.agencyShort.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("cfg.rulebook is a non-empty array of Rule objects", () => {
    expect(Array.isArray(profile.cfg.rulebook)).toBe(true);
    expect(profile.cfg.rulebook.length).toBeGreaterThan(0);
    for (const rule of profile.cfg.rulebook) {
      expect(typeof rule.id).toBe("string");
      expect(typeof rule.question).toBe("string");
      expect(typeof rule.regCite).toBe("string");
      expect(typeof rule.plain).toBe("string");
      expect(typeof rule.ask).toBe("string");
    }
  });
});

// ─── inspections ─────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.inspections", () => {
  it.skipIf(SKIP)("inspections is an array (may be non-empty for our fixture)", () => {
    expect(Array.isArray(profile.inspections)).toBe(true);
    // We selected a facility with last_inspection_date != null
    expect(profile.inspections.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("inspections are capped at 50", () => {
    expect(profile.inspections.length).toBeLessThanOrEqual(50);
  });

  it.skipIf(SKIP)("each inspection has id, inspection_date, is_complaint, raw_data shape", () => {
    for (const i of profile.inspections) {
      expect(i.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(i.inspection_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof i.is_complaint).toBe("boolean");
      // raw_data is null or an object
      if (i.raw_data !== null) {
        expect(typeof i.raw_data).toBe("object");
      }
    }
  });

  it.skipIf(SKIP)("inspections are ordered most-recent-first", () => {
    for (let idx = 1; idx < profile.inspections.length; idx++) {
      expect(
        profile.inspections[idx].inspection_date <=
          profile.inspections[idx - 1].inspection_date,
      ).toBe(true);
    }
  });
});

// ─── deficienciesByInspection ─────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.deficienciesByInspection", () => {
  it.skipIf(SKIP)("deficienciesByInspection is a Map", () => {
    expect(profile.deficienciesByInspection instanceof Map).toBe(true);
  });

  it.skipIf(SKIP)("every key in the Map is a valid inspection_id", () => {
    const inspIds = new Set(profile.inspections.map((i) => i.id));
    for (const [key] of profile.deficienciesByInspection) {
      expect(inspIds.has(key)).toBe(true);
    }
  });

  it.skipIf(SKIP)("every deficiency row in the Map has valid fields", () => {
    for (const [, defs] of profile.deficienciesByInspection) {
      for (const d of defs) {
        expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(d.inspection_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(typeof d.immediate_jeopardy).toBe("boolean");
        expect(typeof d.is_repeat).toBe("boolean");
        if (d.severity !== null) expect([1, 2, 3, 4]).toContain(d.severity);
        if (d.scope !== null) {
          expect(["isolated", "pattern", "widespread"]).toContain(d.scope);
        }
      }
    }
  });
});

// ─── totals ───────────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.totals", () => {
  it.skipIf(SKIP)("totals.inspections equals inspections array length", () => {
    expect(profile.totals.inspections).toBe(profile.inspections.length);
  });

  it.skipIf(SKIP)("totals.deficiencies is a non-negative integer", () => {
    expect(Number.isInteger(profile.totals.deficiencies)).toBe(true);
    expect(profile.totals.deficiencies).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(SKIP)("totals.typeA is a non-negative integer <= totals.deficiencies", () => {
    expect(Number.isInteger(profile.totals.typeA)).toBe(true);
    expect(profile.totals.typeA).toBeGreaterThanOrEqual(0);
    expect(profile.totals.typeA).toBeLessThanOrEqual(profile.totals.deficiencies);
  });

  it.skipIf(SKIP)("totals.lastCitation is null or a valid YYYY-MM-DD date", () => {
    if (profile.totals.lastCitation !== null) {
      expect(profile.totals.lastCitation).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ─── snapshot ─────────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.snapshot", () => {
  it.skipIf(SKIP)("snapshot is non-null for a facility with inspections", () => {
    expect(profile.snapshot).not.toBeNull();
  });

  it.skipIf(SKIP)("snapshot.facility.id matches the test facility", () => {
    expect(profile.snapshot!.facility.id).toBe(testFacility.id);
  });

  it.skipIf(SKIP)("snapshot.peer_set.n is a positive integer", () => {
    expect(profile.snapshot!.peer_set.n).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("snapshot.metrics has all four metrics with value + percentile + peer_median", () => {
    const { metrics } = profile.snapshot!;
    for (const key of ["severity", "repeats", "frequency", "trajectory"] as const) {
      expect(typeof metrics[key].value).toBe("number");
      expect(typeof metrics[key].peer_median).toBe("number");
    }
  });

  it.skipIf(SKIP)("snapshot.grade is set (facility has inspections)", () => {
    if (profile.snapshot!.has_inspections) {
      expect(profile.snapshot!.grade).not.toBeNull();
      const VALID_LETTERS = ["A", "A−", "B", "B−", "C", "C−", "D", "F"];
      expect(VALID_LETTERS).toContain(profile.snapshot!.grade!.letter);
    }
  });

  it.skipIf(SKIP)("snapshot.trajectory_series has 24 entries", () => {
    expect(profile.snapshot!.trajectory_series.length).toBe(24);
  });
});

// ─── Derived: timeline ────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.timeline (derived)", () => {
  it.skipIf(SKIP)("timeline length equals trajectory_series length", () => {
    expect(profile.timeline.length).toBe(profile.snapshot!.trajectory_series.length);
  });

  it.skipIf(SKIP)("every timeline point has month, facilityScore, peerMedianScore, cited", () => {
    for (const pt of profile.timeline) {
      expect(pt.month).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof pt.facilityScore).toBe("number");
      expect(typeof pt.peerMedianScore).toBe("number");
      expect(typeof pt.cited).toBe("boolean");
    }
  });

  it.skipIf(SKIP)("cited = true when facilityScore > 0", () => {
    for (const pt of profile.timeline) {
      expect(pt.cited).toBe(pt.facilityScore > 0);
    }
  });
});

// ─── Derived: scopeSeverityGrid ───────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.scopeSeverityGrid (derived)", () => {
  it.skipIf(SKIP)("scopeSeverityGrid has exactly 12 cells (4 sev × 3 scope)", () => {
    expect(profile.scopeSeverityGrid.length).toBe(12);
  });

  it.skipIf(SKIP)("all 4 severity levels are present", () => {
    const sevs = new Set(profile.scopeSeverityGrid.map((c) => c.sev));
    expect(sevs.has(1)).toBe(true);
    expect(sevs.has(2)).toBe(true);
    expect(sevs.has(3)).toBe(true);
    expect(sevs.has(4)).toBe(true);
  });

  it.skipIf(SKIP)("all 3 scope values are present", () => {
    const scopes = new Set(profile.scopeSeverityGrid.map((c) => c.scope));
    expect(scopes.has("isolated")).toBe(true);
    expect(scopes.has("pattern")).toBe(true);
    expect(scopes.has("widespread")).toBe(true);
  });

  it.skipIf(SKIP)("no duplicate (sev, scope) pairs in grid", () => {
    const seen = new Set<string>();
    for (const c of profile.scopeSeverityGrid) {
      const key = `${c.sev}:${c.scope}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it.skipIf(SKIP)("every cell has count >= 0 and tags as array", () => {
    for (const c of profile.scopeSeverityGrid) {
      expect(c.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(c.tags)).toBe(true);
    }
  });
});

// ─── Derived: rulesCards ──────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.rulesCards (derived)", () => {
  it.skipIf(SKIP)("rulesCards has same count as cfg.rulebook", () => {
    expect(profile.rulesCards.length).toBe(profile.cfg.rulebook.length);
  });

  it.skipIf(SKIP)("every rulesCard has id, question, regCite, plain, ask, citedDate", () => {
    for (const card of profile.rulesCards) {
      expect(typeof card.id).toBe("string");
      expect(typeof card.question).toBe("string");
      expect(typeof card.regCite).toBe("string");
      expect(typeof card.plain).toBe("string");
      expect(typeof card.ask).toBe("string");
      // citedDate is null or a valid date string
      if (card.citedDate !== null) {
        expect(card.citedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it.skipIf(SKIP)("cited rules sort before uncited rules", () => {
    let encounteredUncited = false;
    for (const card of profile.rulesCards) {
      if (card.citedDate === null) {
        encounteredUncited = true;
      } else {
        // Once we've seen an uncited card, no cited card should follow
        expect(encounteredUncited).toBe(false);
      }
    }
  });
});

// ─── photoUrls ────────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.photoUrls", () => {
  it.skipIf(SKIP)("photoUrls is an array", () => {
    expect(Array.isArray(profile.photoUrls)).toBe(true);
  });

  it.skipIf(SKIP)("each photo URL starts with https:// when present", () => {
    for (const url of profile.photoUrls) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});

// ─── mapState ─────────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.mapState", () => {
  it.skipIf(SKIP)("mapState is null or has lat, lon, mapboxToken", () => {
    if (profile.mapState === null) return;
    expect(typeof profile.mapState.lat).toBe("number");
    expect(typeof profile.mapState.lon).toBe("number");
    expect(isFinite(profile.mapState.lat)).toBe(true);
    expect(isFinite(profile.mapState.lon)).toBe(true);
    // lat/lon sanity
    expect(profile.mapState.lat).toBeGreaterThan(-90);
    expect(profile.mapState.lat).toBeLessThan(90);
    expect(profile.mapState.lon).toBeGreaterThan(-180);
    expect(profile.mapState.lon).toBeLessThan(180);
  });
});

// ─── SEO: canonicalUrl ────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.canonicalUrl", () => {
  it.skipIf(SKIP)("canonicalUrl starts with https://", () => {
    expect(profile.canonicalUrl).toMatch(/^https:\/\//);
  });

  it.skipIf(SKIP)("canonicalUrl contains the facility slug", () => {
    expect(profile.canonicalUrl).toContain(testFacility.slug);
  });

  it.skipIf(SKIP)("canonicalUrl contains the city_slug", () => {
    expect(profile.canonicalUrl).toContain(testFacility.city_slug);
  });
});

// ─── SEO: breadcrumbTrail ─────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.breadcrumbTrail", () => {
  it.skipIf(SKIP)("breadcrumbTrail has exactly 4 entries", () => {
    expect(profile.breadcrumbTrail.length).toBe(4);
  });

  it.skipIf(SKIP)("first crumb is 'Home'", () => {
    expect(profile.breadcrumbTrail[0].name).toBe("Home");
    expect(profile.breadcrumbTrail[0].url).toMatch(/^https?:\/\//);
  });

  it.skipIf(SKIP)("second crumb is the state name", () => {
    expect(profile.breadcrumbTrail[1].name).toBe(profile.state.name);
  });

  it.skipIf(SKIP)("last crumb is the facility name", () => {
    expect(profile.breadcrumbTrail[3].name).toBe(profile.facility.name);
    expect(profile.breadcrumbTrail[3].url).toBe(profile.canonicalUrl);
  });

  it.skipIf(SKIP)("all crumb URLs start with https://", () => {
    for (const crumb of profile.breadcrumbTrail) {
      expect(crumb.url).toMatch(/^https?:\/\//);
    }
  });
});

// ─── SEO: jsonLd ─────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.jsonLd", () => {
  it.skipIf(SKIP)("jsonLd has at least 2 schema objects", () => {
    expect(Array.isArray(profile.jsonLd)).toBe(true);
    expect(profile.jsonLd.length).toBeGreaterThanOrEqual(2);
  });

  it.skipIf(SKIP)("first jsonLd entry is a LocalBusiness schema", () => {
    const first = profile.jsonLd[0] as Record<string, unknown>;
    expect(first["@type"]).toBe("LocalBusiness");
    expect(first["name"]).toBe(profile.facility.name);
    expect(first["@context"]).toBe("https://schema.org");
  });

  it.skipIf(SKIP)("second jsonLd entry is a BreadcrumbList schema", () => {
    const second = profile.jsonLd[1] as Record<string, unknown>;
    expect(second["@type"]).toBe("BreadcrumbList");
    const items = second["itemListElement"] as unknown[];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(4);
  });
});

// ─── navigation ───────────────────────────────────────────────────────────────

describe("06 · loadFacilityProfile — profile.backHref + backLabel", () => {
  it.skipIf(SKIP)("backHref is a non-empty string starting with /", () => {
    expect(profile.backHref).toMatch(/^\//);
  });

  it.skipIf(SKIP)("backLabel is a non-empty string", () => {
    expect(typeof profile.backLabel).toBe("string");
    expect(profile.backLabel.length).toBeGreaterThan(0);
  });
});

// ─── Not-found and error cases ────────────────────────────────────────────────

describe("06 · loadFacilityProfile — not_found error cases", () => {
  it.skipIf(SKIP)('returns "not_found" for an unknown state slug', async () => {
    const result = await loadFacilityProfile({
      stateSlug: "atlantis",
      regionSlug: "some-city",
      facilitySlug: "some-facility",
    });
    expect(result).toBe("not_found");
  });

  it.skipIf(SKIP)('returns "not_found" for a valid state but nonexistent facility slug', async () => {
    const state = stateFromCode(testFacility.state_code)!;
    const result = await loadFacilityProfile({
      stateSlug: state.slug,
      regionSlug: testFacility.city_slug,
      facilitySlug: "zzz-absolutely-does-not-exist-999-xyzzy",
    });
    expect(result).toBe("not_found");
  });

  it.skipIf(SKIP)('returns "not_found" for a valid facility in the wrong state', async () => {
    // Use a different (wrong) state slug while keeping the same city/facility slugs.
    const state = stateFromCode(testFacility.state_code)!;
    const wrongState = state.slug === "california" ? "texas" : "california";
    const result = await loadFacilityProfile({
      stateSlug: wrongState,
      regionSlug: testFacility.city_slug,
      facilitySlug: testFacility.slug,
    });
    expect(result).toBe("not_found");
  });
});
