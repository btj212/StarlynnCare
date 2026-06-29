/**
 * TypeScript integration tests — live Next.js API route validation.
 *
 * Calls the actual deployed production API routes using Node.js fetch (no mocks).
 * Tests every field in the /api/facilities/{state} response for all 10 states.
 *
 * This is the TypeScript parallel to tests/integration/api/test_api_routes.py,
 * verifying that the production Next.js route handlers work correctly from
 * the same client environment as a browser or API consumer.
 */

import { describe, it, expect } from "vitest";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.starlynncare.com";

const COVERED_STATES = [
  { code: "CA", slug: "california" },
  { code: "OR", slug: "oregon" },
  { code: "WA", slug: "washington" },
  { code: "MN", slug: "minnesota" },
  { code: "TX", slug: "texas" },
  { code: "UT", slug: "utah" },
  { code: "IL", slug: "illinois" },
  { code: "PA", slug: "pennsylvania" },
  { code: "AZ", slug: "arizona" },
  { code: "MO", slug: "missouri" },
] as const;

// Required top-level fields in the API payload
const PAYLOAD_TOP_LEVEL = [
  "schema",
  "state_code",
  "state_name",
  "generated_at",
  "count",
  "methodology_url",
  "facilities",
] as const;

// All fields declared in the StateFacility type (route.ts)
const FACILITY_REQUIRED_FIELDS = [
  "id",
  "name",
  "url",
  "state_code",
  "care_category",
  "serves_memory_care",
  "total_deficiency_count",
] as const;

// Fields that must be present (may be null for some facilities)
const FACILITY_NULLABLE_FIELDS = [
  "street",
  "city",
  "postal_code",
  "latitude",
  "longitude",
  "license_number",
  "license_type",
  "beds",
  "capacity_tier",
  "regulator_url",
  "last_inspection_date",
  "updated_at",
] as const;

const VALID_CARE_CATEGORIES = new Set([
  "assisted_living_memory_care",
  "memory_care_only",
  "nursing_home_memory_care",
  "assisted_living",
  "residential_care",
  "adult_family_home",
  "board_and_care",
]);

type FacilityRow = {
  id: string;
  name: string;
  url: string;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  state_code: string;
  latitude: number | null;
  longitude: number | null;
  license_number: string | null;
  license_type: string | null;
  beds: number | null;
  care_category: string;
  serves_memory_care: boolean;
  capacity_tier: string | null;
  regulator_url: string | null;
  last_inspection_date: string | null;
  total_deficiency_count: number;
  updated_at: string | null;
};

type ApiPayload = {
  schema: string;
  state_code: string;
  state_name: string;
  generated_at: string;
  count: number;
  methodology_url: string;
  facilities: FacilityRow[];
};

async function fetchState(slug: string): Promise<{ status: number; payload?: ApiPayload }> {
  const url = `${BASE_URL}/api/facilities/${slug}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "StarlynnCare-TestBot/1.0 (+https://starlynn.care)",
    },
  });
  if (!res.ok) {
    return { status: res.status };
  }
  const payload = (await res.json()) as ApiPayload;
  return { status: res.status, payload };
}

// ── Top-level payload structure ───────────────────────────────────────────────

describe("API /api/facilities/{state} — payload structure", () => {
  it.each(COVERED_STATES)("$code: returns 200 and correct top-level fields", async ({ slug, code }) => {
    const { status, payload } = await fetchState(slug);
    expect(status).toBe(200);
    expect(payload).toBeDefined();

    for (const field of PAYLOAD_TOP_LEVEL) {
      expect(payload, `missing top-level field '${field}'`).toHaveProperty(field);
    }

    expect(payload!.schema).toBe("https://schema.org/Dataset");
    expect(payload!.state_code).toBe(code);
    expect(payload!.state_name).toBeTruthy();
    expect(payload!.count).toBe(payload!.facilities.length);
    expect(payload!.methodology_url).toMatch(/^https?:\/\//);
    expect(payload!.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(payload!.count).toBeGreaterThan(0);
  });
});

// ── Per-facility field presence ───────────────────────────────────────────────

describe("API /api/facilities/{state} — per-facility field presence", () => {
  it.each(COVERED_STATES)("$code: every facility has all required fields", async ({ slug, code }) => {
    const { status, payload } = await fetchState(slug);
    expect(status).toBe(200);
    if (!payload) return;

    const facilities = payload.facilities;
    expect(facilities.length).toBeGreaterThan(0);

    for (const fac of facilities) {
      for (const field of FACILITY_REQUIRED_FIELDS) {
        expect(fac, `facility '${fac.id}' missing field '${field}'`).toHaveProperty(field);
      }
      for (const field of FACILITY_NULLABLE_FIELDS) {
        // Key must exist in the object (value may be null)
        expect(fac, `facility '${fac.id}' missing nullable field '${field}'`).toHaveProperty(field);
      }
    }
  });
});

// ── Per-facility type correctness ─────────────────────────────────────────────

describe("API /api/facilities/{state} — per-facility type correctness", () => {
  // Only test CA in depth to avoid 10× slow network calls in the type suite;
  // the Python suite tests all states for full field validation.
  it("CA: all facility objects pass type validation", async () => {
    const { status, payload } = await fetchState("california");
    expect(status).toBe(200);
    if (!payload) return;

    for (const fac of payload.facilities) {
      // Required string fields
      expect(typeof fac.id).toBe("string");
      expect(typeof fac.name).toBe("string");
      expect(fac.name.length).toBeGreaterThan(0);
      expect(typeof fac.url).toBe("string");
      expect(fac.url).toMatch(new RegExp(`^${BASE_URL.replace(".", "\\.")}/`));

      // state_code must match the route
      expect(fac.state_code).toBe("CA");

      // care_category must be a known value
      expect(VALID_CARE_CATEGORIES.has(fac.care_category)).toBe(true);

      // serves_memory_care must be a boolean
      expect(typeof fac.serves_memory_care).toBe("boolean");

      // total_deficiency_count must be a non-negative integer
      expect(typeof fac.total_deficiency_count).toBe("number");
      expect(fac.total_deficiency_count).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(fac.total_deficiency_count)).toBe(true);

      // Nullable numeric fields must be number or null (not undefined)
      if (fac.latitude !== null) {
        expect(typeof fac.latitude).toBe("number");
      }
      if (fac.longitude !== null) {
        expect(typeof fac.longitude).toBe("number");
      }
      if (fac.beds !== null) {
        expect(typeof fac.beds).toBe("number");
        expect(fac.beds).toBeGreaterThan(0);
      }

      // last_inspection_date, if set, must look like an ISO date
      if (fac.last_inspection_date !== null) {
        expect(fac.last_inspection_date).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }

      // regulator_url, if set, must be an HTTP URL
      if (fac.regulator_url !== null) {
        expect(fac.regulator_url).toMatch(/^https?:\/\//);
      }
    }
  });
});

// ── Response consistency ──────────────────────────────────────────────────────

describe("API /api/facilities/{state} — response consistency", () => {
  it("CA: no duplicate facility IDs", async () => {
    const { payload } = await fetchState("california");
    if (!payload) return;

    const ids = payload.facilities.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("CA: all memory-care facilities have non-empty names", async () => {
    const { payload } = await fetchState("california");
    if (!payload) return;

    const mcFacilities = payload.facilities.filter((f) => f.serves_memory_care);
    expect(mcFacilities.length).toBeGreaterThan(0);
    for (const f of mcFacilities) {
      expect(f.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("CA: all facility URLs contain the correct 3-segment path", async () => {
    const { payload } = await fetchState("california");
    if (!payload) return;

    const urlPattern = /\/california\/[a-z0-9-]+\/[a-z0-9-]+$/;
    const invalidUrls = payload.facilities
      .filter((f) => !urlPattern.test(f.url))
      .slice(0, 5);

    expect(invalidUrls).toHaveLength(0);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("API /api/facilities/{state} — error handling", () => {
  it.each(["mars", "canada", "not-a-state", "ca123"])(
    "'%s' returns HTTP 404 with error body",
    async (slug) => {
      const url = `${BASE_URL}/api/facilities/${slug}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      expect(res.status).toBe(404);

      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      expect(body).not.toBeNull();
      expect(body!.error).toBeTruthy();
    },
  );
});

// ── HTTP headers ──────────────────────────────────────────────────────────────

describe("API /api/facilities/{state} — HTTP headers", () => {
  it("CA: response has correct CORS and caching headers", async () => {
    const url = `${BASE_URL}/api/facilities/california`;
    const res = await fetch(url);

    // CORS open for LLM/GEO consumers
    expect(res.headers.get("access-control-allow-origin")).toBe("*");

    // Cache control must be set
    expect(res.headers.get("cache-control")).toBeTruthy();

    // Must not be indexed by search engines
    expect(res.headers.get("x-robots-tag")?.toLowerCase()).toBe("noindex");
  });
});
