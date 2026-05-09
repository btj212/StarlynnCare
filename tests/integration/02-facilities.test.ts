/**
 * 02 — Facilities Table: Real Data Integrity
 *
 * Queries the live Supabase facilities table and verifies every business-critical
 * field across the full Facility type (types.ts).  Tests use the public (anon)
 * client so they also validate RLS is correct.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { publicClient, isUnconfigured } from "../helpers/client";
import type { Facility } from "@/lib/types";

const SKIP = isUnconfigured();

// ─── Shared fixture ───────────────────────────────────────────────────────────

let sampleFacilities: Facility[];
let caFacility: Facility | undefined;
let facilityWithBeds: Facility | undefined;

beforeAll(async () => {
  if (SKIP) return;
  const pub = publicClient();

  const { data } = await pub
    .from("facilities")
    .select("*")
    .eq("publishable", true)
    .limit(50);

  sampleFacilities = (data ?? []) as Facility[];
  caFacility = sampleFacilities.find((f) => f.state_code === "CA");
  facilityWithBeds = sampleFacilities.find((f) => f.beds !== null);
});

// ─── Count and presence ───────────────────────────────────────────────────────

describe("02 · Facilities — count and presence", () => {
  it.skipIf(SKIP)("at least one publishable facility exists", () => {
    expect(sampleFacilities.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("at least one CA facility exists", () => {
    expect(caFacility).toBeDefined();
  });

  it.skipIf(SKIP)("total publishable count via count:exact matches row fetch", async () => {
    const { count } = await publicClient()
      .from("facilities")
      .select("*", { count: "exact", head: true })
      .eq("publishable", true);
    expect(count).not.toBeNull();
    expect(count!).toBeGreaterThan(0);
    expect(count!).toBeGreaterThanOrEqual(sampleFacilities.length);
  });
});

// ─── Required identity fields ─────────────────────────────────────────────────

describe("02 · Facilities — required identity fields on every publishable row", () => {
  it.skipIf(SKIP)("every facility has a valid UUID id", () => {
    for (const f of sampleFacilities) {
      expect(f.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  it.skipIf(SKIP)("every facility has a 2-char state_code", () => {
    for (const f of sampleFacilities) {
      expect(f.state_code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it.skipIf(SKIP)("every facility has a non-empty name", () => {
    for (const f of sampleFacilities) {
      expect(typeof f.name).toBe("string");
      expect(f.name.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(SKIP)("every publishable facility has city_slug (non-empty string)", () => {
    for (const f of sampleFacilities) {
      expect(typeof f.city_slug).toBe("string");
      expect(f.city_slug.length).toBeGreaterThan(0);
      // Slug format: lowercase letters, digits, hyphens only
      expect(f.city_slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it.skipIf(SKIP)("every publishable facility has slug (non-empty string)", () => {
    for (const f of sampleFacilities) {
      expect(typeof f.slug).toBe("string");
      expect(f.slug.length).toBeGreaterThan(0);
      expect(f.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it.skipIf(SKIP)("publishable flag is true on all returned rows", () => {
    for (const f of sampleFacilities) {
      expect(f.publishable).toBe(true);
    }
  });
});

// ─── Care category and memory care ────────────────────────────────────────────

describe("02 · Facilities — care category and memory care fields", () => {
  const VALID_CARE_CATEGORIES = [
    "rcfe_memory_care", "rcfe_general", "alf_memory_care", "alf_general",
    "snf_general", "snf_dementia_scu", "ccrc", "unknown",
  ];

  it.skipIf(SKIP)("every facility has a valid care_category", () => {
    for (const f of sampleFacilities) {
      expect(VALID_CARE_CATEGORIES).toContain(f.care_category);
    }
  });

  it.skipIf(SKIP)("every facility has serves_memory_care as boolean", () => {
    for (const f of sampleFacilities) {
      expect(typeof f.serves_memory_care).toBe("boolean");
    }
  });

  it.skipIf(SKIP)("every facility has memory_care_disclosure_filed as boolean", () => {
    for (const f of sampleFacilities) {
      expect(typeof f.memory_care_disclosure_filed).toBe("boolean");
    }
  });
});

// ─── Capacity tier (generated column) ────────────────────────────────────────

describe("02 · Facilities — capacity_tier generated column", () => {
  const VALID_TIERS = ["small", "medium", "large", "unknown"];

  it.skipIf(SKIP)("every facility has a valid capacity_tier", () => {
    for (const f of sampleFacilities) {
      expect(VALID_TIERS).toContain(f.capacity_tier);
    }
  });

  it.skipIf(SKIP)("capacity_tier matches beds for facilities with beds set", () => {
    for (const f of sampleFacilities) {
      if (f.beds === null) continue;
      const expected =
        f.beds <= 6 ? "small" : f.beds <= 49 ? "medium" : "large";
      expect(f.capacity_tier).toBe(expected);
    }
  });
});

// ─── MC signal and review status ─────────────────────────────────────────────

describe("02 · Facilities — mc_review_status values", () => {
  const VALID_MC_STATUSES = [
    "auto_published", "needs_review", "reviewed_publish", "reviewed_reject",
  ];

  it.skipIf(SKIP)("every facility has a valid mc_review_status", () => {
    for (const f of sampleFacilities) {
      const status = (f as unknown as Record<string, unknown>).mc_review_status;
      expect(VALID_MC_STATUSES).toContain(status);
    }
  });

  it.skipIf(SKIP)("mc_signal_explicit_name is a boolean on every facility", () => {
    for (const f of sampleFacilities) {
      const v = (f as unknown as Record<string, unknown>).mc_signal_explicit_name;
      expect(typeof v).toBe("boolean");
    }
  });

  it.skipIf(SKIP)("mc_signal_chain_curated is a boolean on every facility", () => {
    for (const f of sampleFacilities) {
      const v = (f as unknown as Record<string, unknown>).mc_signal_chain_curated;
      expect(typeof v).toBe("boolean");
    }
  });
});

// ─── Timestamps ───────────────────────────────────────────────────────────────

describe("02 · Facilities — timestamps", () => {
  it.skipIf(SKIP)("every facility has a valid created_at ISO timestamp", () => {
    for (const f of sampleFacilities) {
      expect(new Date(f.created_at).getTime()).not.toBeNaN();
    }
  });

  it.skipIf(SKIP)("every facility has a valid updated_at ISO timestamp", () => {
    for (const f of sampleFacilities) {
      expect(new Date(f.updated_at).getTime()).not.toBeNaN();
    }
  });

  it.skipIf(SKIP)("updated_at is >= created_at", () => {
    for (const f of sampleFacilities) {
      expect(new Date(f.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(f.created_at).getTime(),
      );
    }
  });
});

// ─── CA-specific fields ───────────────────────────────────────────────────────

describe("02 · Facilities — CA-specific fields (migration 0013)", () => {
  const VALID_BASES = [
    "self_identified", "dementia_training_compliance", "secured_perimeter",
    "hospice_waiver", "multiple", null,
  ];

  it.skipIf(SKIP)(
    "ca_memory_care_designation_basis is null or a valid enum value for CA facilities",
    () => {
      if (!caFacility) return;
      // Run on all CA facilities in the sample
      const caFacilities = sampleFacilities.filter((f) => f.state_code === "CA");
      for (const f of caFacilities) {
        expect(VALID_BASES).toContain(f.ca_memory_care_designation_basis);
      }
    },
  );
});

// ─── Unique constraint: state_code + city_slug + slug ────────────────────────

describe("02 · Facilities — unique routing triple", () => {
  it.skipIf(SKIP)("no two publishable facilities share (state_code, city_slug, slug)", () => {
    const seen = new Set<string>();
    for (const f of sampleFacilities) {
      const key = `${f.state_code}::${f.city_slug}::${f.slug}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ─── Filter by state ──────────────────────────────────────────────────────────

describe("02 · Facilities — state-scoped queries", () => {
  it.skipIf(SKIP)("filtering by state_code=CA returns only CA facilities", async () => {
    const { data } = await publicClient()
      .from("facilities")
      .select("id, state_code")
      .eq("publishable", true)
      .eq("state_code", "CA")
      .limit(20);

    for (const row of (data ?? []) as Array<{ id: string; state_code: string }>) {
      expect(row.state_code).toBe("CA");
    }
  });

  it.skipIf(SKIP)("city_slug + slug query returns the correct single facility", async () => {
    if (!caFacility) return;

    const { data } = await publicClient()
      .from("facilities")
      .select("id, state_code, city_slug, slug")
      .eq("state_code", caFacility.state_code)
      .eq("city_slug", caFacility.city_slug)
      .eq("slug", caFacility.slug)
      .eq("publishable", true)
      .limit(1);

    expect((data ?? []).length).toBe(1);
    const returned = (data as Facility[])[0];
    expect(returned.id).toBe(caFacility.id);
  });
});

// ─── Ownership type ───────────────────────────────────────────────────────────

describe("02 · Facilities — ownership_type enum constraint", () => {
  const VALID_OWNERSHIP = ["for-profit", "non-profit", "government", null];

  it.skipIf(SKIP)("every facility has null or a valid ownership_type", () => {
    for (const f of sampleFacilities) {
      expect(VALID_OWNERSHIP).toContain(f.ownership_type);
    }
  });
});

// ─── last_inspection_date format ──────────────────────────────────────────────

describe("02 · Facilities — last_inspection_date", () => {
  it.skipIf(SKIP)(
    "last_inspection_date is null or a valid YYYY-MM-DD string when present",
    () => {
      for (const f of sampleFacilities) {
        if (f.last_inspection_date === null) continue;
        expect(f.last_inspection_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(f.last_inspection_date).getTime()).not.toBeNaN();
      }
    },
  );

  it.skipIf(SKIP)("at least one facility has a non-null last_inspection_date", () => {
    expect(sampleFacilities.some((f) => f.last_inspection_date !== null)).toBe(true);
  });
});

// ─── CMS star rating ──────────────────────────────────────────────────────────

describe("02 · Facilities — cms_star_rating range", () => {
  it.skipIf(SKIP)("cms_star_rating is null or 1–5 when present", () => {
    for (const f of sampleFacilities) {
      if (f.cms_star_rating === null) continue;
      expect(f.cms_star_rating).toBeGreaterThanOrEqual(1);
      expect(f.cms_star_rating).toBeLessThanOrEqual(5);
    }
  });
});
