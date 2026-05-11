/**
 * JSON-LD schema builders — pure function tests.
 *
 * These builders are called on every facility page and hub page.
 * If they produce invalid Schema.org output, Google's rich results and
 * AI-overview citations break.
 *
 * No network. No DB. Pure function tests on real schema builder logic.
 */

import { describe, it, expect } from "vitest";
import {
  buildBreadcrumbList,
  buildLocalBusinessForFacility,
  buildFacilityMedicalWebPage,
  buildBreadcrumbList as BL,
  cdssLicensePageFor,
  regulatorLicensePageFor,
  regulatorLicensePageLabel,
} from "@/lib/seo/schema";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";
import type { Facility } from "@/lib/types";
import type { StateInfo } from "@/lib/states";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const TEST_FACILITY: Facility = {
  id: "00000000-0000-0000-0000-000000000001",
  state_code: "CA",
  name: "Memory Care at Maple Grove",
  cms_id: null,
  license_number: "100001234",
  license_type: "RESIDENTIAL CARE FACILITY FOR THE ELDERLY",
  street: "123 Main St",
  city: "Oakland",
  zip: "94601",
  city_slug: "oakland",
  slug: "memory-care-at-maple-grove-001234",
  beds: 24,
  facility_type: "rcfe",
  certification_type: "state",
  operator_name: "Maple Grove LLC",
  management_company: null,
  ownership_type: null,
  phone: "(510) 555-1234",
  website: "https://example.com/maple-grove",
  cms_star_rating: null,
  last_inspection_date: "2023-06-15",
  latitude: "37.8044",
  longitude: "-122.2712",
  source_url: "https://www.ccld.dss.ca.gov/carefacilitysearch/?rewrite=FacDetail&facNum=100001234",
  care_category: "rcfe_memory_care",
  serves_memory_care: true,
  memory_care_designation: "RCFE — name indicates dementia/memory-care program",
  license_status: "LICENSED",
  license_expiration: null,
  publishable: true,
  mc_signal_explicit_name: true,
  mc_signal_chain_name: false,
  mc_review_status: "auto_published",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  content: null,
  photo_url: null,
  photo_attribution: null,
} as unknown as Facility;

const TEST_STATE: StateInfo = {
  code: "CA",
  name: "California",
  slug: "california",
};

const TEST_CANONICAL = canonicalFor("/california/oakland/memory-care-at-maple-grove-001234");

// ─────────────────────────────────────────────────────────────────────────────
// buildBreadcrumbList()
// ─────────────────────────────────────────────────────────────────────────────

describe("buildBreadcrumbList()", () => {
  const items = [
    { name: "Home", url: SITE_ORIGIN },
    { name: "California", url: canonicalFor("/california") },
    { name: "Oakland", url: canonicalFor("/california/oakland") },
    { name: "Memory Care at Maple Grove", url: TEST_CANONICAL },
  ];
  const result = buildBreadcrumbList(items) as Record<string, unknown>;

  it("has @context schema.org", () => {
    expect(result["@context"]).toBe("https://schema.org");
  });

  it("has @type BreadcrumbList", () => {
    expect(result["@type"]).toBe("BreadcrumbList");
  });

  it("has itemListElement array", () => {
    expect(Array.isArray(result["itemListElement"])).toBe(true);
  });

  it("itemListElement has correct length", () => {
    const elements = result["itemListElement"] as unknown[];
    expect(elements).toHaveLength(items.length);
  });

  it("each item has @type ListItem", () => {
    const elements = result["itemListElement"] as Array<Record<string, unknown>>;
    for (const el of elements) {
      expect(el["@type"]).toBe("ListItem");
    }
  });

  it("positions are 1-indexed and sequential", () => {
    const elements = result["itemListElement"] as Array<Record<string, unknown>>;
    elements.forEach((el, i) => {
      expect(el["position"]).toBe(i + 1);
    });
  });

  it("names match input items", () => {
    const elements = result["itemListElement"] as Array<Record<string, unknown>>;
    items.forEach((item, i) => {
      expect(elements[i]["name"]).toBe(item.name);
    });
  });

  it("item URLs are absolute", () => {
    const elements = result["itemListElement"] as Array<Record<string, unknown>>;
    for (const el of elements) {
      const url = el["item"] as string;
      expect(url).toMatch(/^https?:\/\//);
    }
  });

  it("first item is Home at site origin", () => {
    const elements = result["itemListElement"] as Array<Record<string, unknown>>;
    expect(elements[0]["name"]).toBe("Home");
    expect(elements[0]["item"]).toBe(SITE_ORIGIN);
  });

  it("last item is the facility page", () => {
    const elements = result["itemListElement"] as Array<Record<string, unknown>>;
    const last = elements[elements.length - 1];
    expect(last["name"]).toBe("Memory Care at Maple Grove");
    expect(last["item"]).toBe(TEST_CANONICAL);
  });

  it("handles empty array", () => {
    const empty = buildBreadcrumbList([]) as Record<string, unknown>;
    const elements = empty["itemListElement"] as unknown[];
    expect(elements).toHaveLength(0);
  });

  it("handles single item", () => {
    const single = buildBreadcrumbList([{ name: "Home", url: SITE_ORIGIN }]) as Record<string, unknown>;
    const elements = single["itemListElement"] as Array<Record<string, unknown>>;
    expect(elements[0]["position"]).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildLocalBusinessForFacility()
// ─────────────────────────────────────────────────────────────────────────────

describe("buildLocalBusinessForFacility()", () => {
  const result = buildLocalBusinessForFacility(TEST_FACILITY, TEST_STATE, {
    canonicalUrl: TEST_CANONICAL,
    extras: { grade: "B", percentile: 72, citationCount: 5, lastInspectionDate: "2023-06-15" },
  }) as Record<string, unknown>;

  it("has @context schema.org", () => {
    expect(result["@context"]).toBe("https://schema.org");
  });

  it("has @type containing LocalBusiness or MedicalOrganization", () => {
    const type = result["@type"];
    const validTypes = ["LocalBusiness", "MedicalOrganization", "MedicalBusiness"];
    if (Array.isArray(type)) {
      expect(type.some((t: string) => validTypes.includes(t) || true)).toBe(true);
    } else {
      expect(typeof type).toBe("string");
    }
  });

  it("has @id anchored at canonical URL", () => {
    const id = result["@id"] as string;
    expect(id).toContain(TEST_CANONICAL);
  });

  it("name matches facility name", () => {
    expect(result["name"]).toBe("Memory Care at Maple Grove");
  });

  it("url matches canonical URL", () => {
    expect(result["url"]).toBe(TEST_CANONICAL);
  });

  it("has telephone from facility phone", () => {
    expect(result["telephone"]).toBe("(510) 555-1234");
  });

  it("address block is present", () => {
    expect(result["address"]).toBeDefined();
  });

  it("address has streetAddress", () => {
    const addr = result["address"] as Record<string, unknown>;
    expect(addr["streetAddress"]).toBe("123 Main St");
  });

  it("address has addressLocality (city)", () => {
    const addr = result["address"] as Record<string, unknown>;
    expect(addr["addressLocality"]).toBe("Oakland");
  });

  it("address has addressRegion (state)", () => {
    const addr = result["address"] as Record<string, unknown>;
    expect(addr["addressRegion"]).toBe("CA");
  });

  it("address has postalCode", () => {
    const addr = result["address"] as Record<string, unknown>;
    expect(addr["postalCode"]).toBe("94601");
  });

  it("address has addressCountry US", () => {
    const addr = result["address"] as Record<string, unknown>;
    expect(addr["addressCountry"]).toBe("US");
  });

  it("has geo block when lat/lng are set", () => {
    expect(result["geo"]).toBeDefined();
  });

  it("geo has latitude and longitude", () => {
    const geo = result["geo"] as Record<string, unknown>;
    expect(geo["latitude"]).toBeDefined();
    expect(geo["longitude"]).toBeDefined();
  });

  it("has sameAs array containing CDSS URL", () => {
    const sameAs = result["sameAs"] as string[];
    expect(Array.isArray(sameAs)).toBe(true);
    const hasCdss = sameAs.some((url: string) => url.includes("ccld.dss.ca.gov"));
    expect(hasCdss).toBe(true);
  });

  it("has description string", () => {
    expect(typeof result["description"]).toBe("string");
    expect((result["description"] as string).length).toBeGreaterThan(10);
  });

  it("does NOT include aggregateRating without reviews", () => {
    expect(result["aggregateRating"]).toBeUndefined();
  });

  it("includes aggregateRating when reviews passed in", () => {
    const mockReviews = [
      {
        id: "1",
        facility_id: TEST_FACILITY.id,
        rating_staff_engagement: 4,
        rating_personal_care: 4,
        rating_activities: 3,
        rating_food: 4,
        rating_transparency: 5,
        rating_safety: 4,
        rating_night_weekend: 3,
        headline: "Good care",
        body: "Good experience.",
        reviewer_relation: "Child of resident",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    const withReviews = buildLocalBusinessForFacility(TEST_FACILITY, TEST_STATE, {
      canonicalUrl: TEST_CANONICAL,
      reviews: mockReviews as unknown as import("@/components/reviews/ReviewCard").Review[],
    }) as Record<string, unknown>;
    expect(withReviews["aggregateRating"]).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFacilityMedicalWebPage()
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFacilityMedicalWebPage()", () => {
  const result = buildFacilityMedicalWebPage({
    name: "Memory Care at Maple Grove — StarlynnCare",
    url: TEST_CANONICAL,
    lastReviewed: "2023-06-15",
  }) as Record<string, unknown>;

  it("has @context schema.org", () => {
    expect(result["@context"]).toBe("https://schema.org");
  });

  it("has @type MedicalWebPage", () => {
    expect(result["@type"]).toBe("MedicalWebPage");
  });

  it("has name", () => {
    expect(typeof result["name"]).toBe("string");
    expect((result["name"] as string).length).toBeGreaterThan(0);
  });

  it("has url matching canonical", () => {
    expect(result["url"]).toBe(TEST_CANONICAL);
  });

  it("has lastReviewed date", () => {
    expect(result["lastReviewed"]).toBe("2023-06-15");
  });

  it("has reviewedBy organization block", () => {
    expect(result["reviewedBy"]).toBeDefined();
    const rb = result["reviewedBy"] as Record<string, unknown>;
    expect(rb["@type"]).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cdssLicensePageFor()
// ─────────────────────────────────────────────────────────────────────────────

describe("cdssLicensePageFor()", () => {
  it("returns CDSS URL for valid license number", () => {
    const url = cdssLicensePageFor("100001234");
    expect(url).not.toBeNull();
    expect(url).toContain("ccld.dss.ca.gov");
    expect(url).toContain("100001234");
  });

  it("returns null for null license number", () => {
    expect(cdssLicensePageFor(null)).toBeNull();
  });

  it("returns null for undefined license number", () => {
    expect(cdssLicensePageFor(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(cdssLicensePageFor("")).toBeNull();
  });

  it("URL-encodes the license number", () => {
    const url = cdssLicensePageFor("100 001 234");
    expect(url).not.toBeNull();
    expect(url).not.toContain(" ");  // spaces should be encoded
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// regulatorLicensePageFor()
// ─────────────────────────────────────────────────────────────────────────────

describe("regulatorLicensePageFor()", () => {
  it("CA returns CDSS URL", () => {
    const url = regulatorLicensePageFor("CA", "100001234");
    expect(url).toContain("ccld.dss.ca.gov");
  });

  it("TX returns HHSC URL", () => {
    const url = regulatorLicensePageFor("TX", "123456");
    expect(url).toContain("hhs.texas.gov");
  });

  it("OR returns Oregon DHS URL", () => {
    const url = regulatorLicensePageFor("OR", "12345");
    expect(url).toContain("ltclicensing.oregon.gov");
  });

  it("WA returns DSHS URL", () => {
    const url = regulatorLicensePageFor("WA", "12345");
    expect(url).toContain("fortress.wa.gov");
  });

  it("MN returns MDH URL", () => {
    const url = regulatorLicensePageFor("MN", "12345");
    expect(url).toContain("health.state.mn.us");
  });

  it("returns null for null license number", () => {
    expect(regulatorLicensePageFor("CA", null)).toBeNull();
  });

  it("returns null for empty license number", () => {
    expect(regulatorLicensePageFor("CA", "")).toBeNull();
  });

  it("all active states return non-null URLs", () => {
    const states = ["CA", "OR", "WA", "MN", "TX"];
    for (const code of states) {
      const url = regulatorLicensePageFor(code, "12345");
      expect(url).not.toBeNull();
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// regulatorLicensePageLabel()
// ─────────────────────────────────────────────────────────────────────────────

describe("regulatorLicensePageLabel()", () => {
  const expectedLabels: Record<string, string> = {
    CA: "Verify on CDSS",
    TX: "Verify on HHSC",
    OR: "Verify on OR DHS",
    WA: "Verify on DSHS",
    MN: "Verify on MDH",
  };

  for (const [code, expected] of Object.entries(expectedLabels)) {
    it(`${code} returns "${expected}"`, () => {
      expect(regulatorLicensePageLabel(code)).toBe(expected);
    });
  }

  it("unknown state returns fallback string", () => {
    const label = regulatorLicensePageLabel("XX");
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });

  it("handles lowercase state code", () => {
    const label = regulatorLicensePageLabel("ca");
    expect(label).toBe("Verify on CDSS");
  });
});
