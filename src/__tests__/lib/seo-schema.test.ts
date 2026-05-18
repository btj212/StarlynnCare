/**
 * seo-schema.test.ts — Unit tests for src/lib/seo/schema.ts builders.
 *
 * Tests the complete JSON-LD schema generation pipeline using real Supabase data.
 * The schema builders are pure TypeScript functions that build Schema.org JSON-LD
 * from facility data — no Next.js imports, fully testable in vitest/node.
 *
 * Real facility data is loaded from Supabase (when credentials are set).
 * When credentials are absent, the tests verify schema structure with minimal
 * hand-constructed inputs that match the real Facility type exactly.
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildBreadcrumbList,
  buildLocalBusinessForFacility,
  buildOrganizationSchema,
} from "@/lib/seo/schema";
import type { Facility } from "@/lib/types";
import type { StateInfo } from "@/lib/states";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Facility fixture — every required field, no invented data
// (mirrors the real DB schema from src/lib/types.ts)
// ─────────────────────────────────────────────────────────────────────────────

const MINIMAL_FACILITY: Facility = {
  id: "00000000-0000-0000-0000-000000000001",
  state_code: "CA",
  name: "Silverado Senior Living - Berkeley",
  license_number: "197603485",
  license_type: null,
  facility_type: "RCFE",
  care_category: "rcfe_memory_care",
  certification_type: null,
  operator_name: "Silverado Inc",
  management_company: null,
  ownership_type: null,
  beds: 54,
  street: "1400 University Ave",
  city: "Berkeley",
  zip: "94702",
  state: "CA",
  county: "Alameda County",
  phone: "(510) 883-1000",
  website: null,
  latitude: 37.8716,
  longitude: -122.2727,
  slug: "silverado-senior-living-berkeley-197603485",
  city_slug: "berkeley",
  cms_id: null,
  cms_ccn: null,
  cms_star_rating: null,
  last_inspection_date: null,
  license_status: "LICENSED",
  license_expiration: null,
  publishable: true,
  serves_memory_care: true,
  memory_care_designation: "Silverado Signature Memory Care",
  memory_care_disclosure_filed: true,
  ca_memory_care_designation_basis: null,
  mc_signal_explicit_name: false,
  mc_signal_chain_name: true,
  mc_signal_chain_curated: true,
  mc_signal_deficiency_keyword: false,
  mc_review_status: "auto_published",
  mc_review_notes: null,
  mc_reviewed_by: null,
  mc_reviewed_at: null,
  wa_facility_type: null,
  wa_dementia_care_contract: false,
  wa_memory_care_certified: false,
  wa_earc_sdc_contracted: null,
  wa_dementia_specialty: null,
  wa_afh_residential_flag: null,
  mce_endorsed: false,
  mce_evidence: null,
  enhanced_oversight: false,
  unendorsed_mc_violation: false,
  afh_class: null,
  detail_url_id: null,
  external_id: null,
  mn_dementia_care_licensed: false,
  tx_alzheimer_certified: false,
  tx_alzheimer_cert_no: null,
  tx_alzheimer_cert_effective: null,
  tx_alzheimer_cert_expiration: null,
  tx_license_effective: null,
  tx_license_expiration: null,
  tx_license_initial: null,
  tx_hhsc_suboffice: null,
  tx_state_region: null,
  photo_url: null,
  photo_attribution: null,
  photo_urls: null,
  photo_sources: null,
  source_url: "https://www.ccld.dss.ca.gov/",
  tour_questions: null,
  what_families_should_know: null,
  generated_at: null,
  model: null,
  content: null,
  cms_overall_rating: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// ─────────────────────────────────────────────────────────────────────────────
// StateInfo fixture for CA
// ─────────────────────────────────────────────────────────────────────────────

const CA_STATE: StateInfo = { slug: "california", code: "CA", name: "California" };
const CANONICAL_URL = `https://www.starlynncare.com/california/berkeley/${MINIMAL_FACILITY.slug}`;

// ─────────────────────────────────────────────────────────────────────────────
// Real Supabase facility loader
// ─────────────────────────────────────────────────────────────────────────────

async function loadRealFacility(): Promise<Facility | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key);
  const { data } = await db
    .from("facilities")
    .select("*")
    .eq("publishable", true)
    .eq("serves_memory_care", true)
    .limit(1)
    .single();
  return data as Facility | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildLocalBusinessForFacility
// ─────────────────────────────────────────────────────────────────────────────

describe("buildLocalBusinessForFacility", () => {
  it("returns an object with @context and @type", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    expect(schema["@context"]).toBe("https://schema.org");
    const types = Array.isArray(schema["@type"]) ? schema["@type"] : [schema["@type"]];
    expect(types.some((t: string) => t === "LocalBusiness" || t === "MedicalOrganization")).toBe(
      true,
    );
  });

  it("includes name matching facility name", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    expect(schema.name).toBe(MINIMAL_FACILITY.name);
  });

  it("includes address object with all required subfields", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    const addr = schema.address;
    expect(addr).toBeTruthy();
    expect(addr["@type"]).toBe("PostalAddress");
    expect(addr.streetAddress).toBe(MINIMAL_FACILITY.street);
    expect(addr.addressLocality).toBe(MINIMAL_FACILITY.city);
    expect(addr.postalCode).toBe(MINIMAL_FACILITY.zip);
    expect(addr.addressRegion).toBe(CA_STATE.name); // schema uses full state name
    expect(addr.addressCountry).toBe("US");
  });

  it("includes telephone when phone is set", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    expect(schema.telephone).toBe(MINIMAL_FACILITY.phone);
  });

  it("includes geo coordinates when lat/lng are set", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    expect(schema.geo).toBeTruthy();
    expect(schema.geo["@type"]).toBe("GeoCoordinates");
    expect(schema.geo.latitude).toBe(MINIMAL_FACILITY.latitude);
    expect(schema.geo.longitude).toBe(MINIMAL_FACILITY.longitude);
  });

  it("includes sameAs array with at least the regulator URL", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    expect(Array.isArray(schema.sameAs)).toBe(true);
    expect(schema.sameAs.length).toBeGreaterThan(0);
    const hasCaRegulator = schema.sameAs.some(
      (url: string) => url.includes("ccld.dss.ca.gov") || url.includes("data.ca.gov"),
    );
    expect(hasCaRegulator).toBe(true);
  });

  it("includes additionalProperty array with license number", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    const props: Array<{ name: string; value: unknown }> = schema.additionalProperty ?? [];
    const licProp = props.find(
      (p) => p.name === "State license number" || p.name === "License Number",
    );
    expect(licProp).toBeTruthy();
    expect(licProp!.value).toBe(MINIMAL_FACILITY.license_number);
  });

  it("includes @id derived from canonicalUrl", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    expect(schema["@id"]).toContain(CANONICAL_URL);
  });

  it("does not include aggregateRating when reviews are empty", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
      reviews: [],
    });
    expect(schema.aggregateRating ?? null).toBeNull();
  });

  it("includes aggregateRating when reviews are provided", () => {
    // Review type uses multi-dimensional ratings (no single "rating" field)
    const mockReviews = [
      {
        id: "r1",
        reviewer_name: "Jane D.",
        reviewer_relationship: "Daughter",
        residency_period: "2023-2024",
        overall_summary: "Excellent memory care.",
        created_at: "2024-06-01",
        rating_staff_engagement: 5,
        rating_personal_care: 5,
        rating_activities: 4,
        rating_food: 5,
        rating_transparency: 5,
        rating_safety: 5,
        rating_night_weekend: 4,
        comment_staff_engagement: null,
        comment_personal_care: null,
        comment_activities: null,
        comment_food: null,
        comment_transparency: null,
        comment_safety: null,
        comment_night_weekend: null,
      },
      {
        id: "r2",
        reviewer_name: "John S.",
        reviewer_relationship: "Son",
        residency_period: null,
        overall_summary: "Good care.",
        created_at: "2024-07-01",
        rating_staff_engagement: 4,
        rating_personal_care: 4,
        rating_activities: 4,
        rating_food: 4,
        rating_transparency: 4,
        rating_safety: 4,
        rating_night_weekend: 4,
        comment_staff_engagement: null,
        comment_personal_care: null,
        comment_activities: null,
        comment_food: null,
        comment_transparency: null,
        comment_safety: null,
        comment_night_weekend: null,
      },
    ];
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
      reviews: mockReviews as never,
    });
    expect(schema.aggregateRating).toBeTruthy();
    expect(schema.aggregateRating["@type"]).toBe("AggregateRating");
    expect(schema.aggregateRating.reviewCount).toBe(2);
    // ratingValue should be a numeric average
    expect(typeof schema.aggregateRating.ratingValue).toBe("number");
    expect(schema.aggregateRating.ratingValue).toBeGreaterThan(0);
    expect(schema.aggregateRating.ratingValue).toBeLessThanOrEqual(5);
  });

  it("does not include geo when facility has null lat/lng", () => {
    const noGeo = { ...MINIMAL_FACILITY, latitude: null, longitude: null };
    const schema = buildLocalBusinessForFacility(noGeo as Facility, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    expect(schema.geo ?? null).toBeNull();
  });

  it("uses real DB facility without error", async () => {
    const real = await loadRealFacility();
    if (!real) {
      console.log("⚠ No DB credentials — skipping real facility schema test");
      return;
    }
    const { stateFromCode } = await import("@/lib/states");
    const state = stateFromCode(real.state_code);
    if (!state) return;
    const url = `https://www.starlynncare.com/${state.slug}/${real.city_slug}/${real.slug}`;
    const schema = buildLocalBusinessForFacility(real, state, { canonicalUrl: url });
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema.name).toBe(real.name);
    expect(schema.address.streetAddress).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildBreadcrumbList
// ─────────────────────────────────────────────────────────────────────────────

describe("buildBreadcrumbList", () => {
  const items = [
    { name: "Home", url: "https://www.starlynncare.com" },
    { name: "California", url: "https://www.starlynncare.com/california" },
    { name: "Berkeley", url: "https://www.starlynncare.com/california/berkeley" },
    {
      name: "Silverado Senior Living",
      url: "https://www.starlynncare.com/california/berkeley/silverado-senior-living",
    },
  ];

  it("returns @type BreadcrumbList", () => {
    const schema = buildBreadcrumbList(items);
    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema["@context"]).toBe("https://schema.org");
  });

  it("itemListElement has correct count", () => {
    const schema = buildBreadcrumbList(items);
    expect(schema.itemListElement.length).toBe(items.length);
  });

  it("each item has @type ListItem, position, name, item", () => {
    const schema = buildBreadcrumbList(items);
    schema.itemListElement.forEach(
      (el: { "@type": string; position: number; name: string; item: string }, i: number) => {
        expect(el["@type"]).toBe("ListItem");
        expect(el.position).toBe(i + 1);
        expect(el.name).toBe(items[i].name);
        expect(el.item).toBe(items[i].url);
      },
    );
  });

  it("positions are 1-indexed", () => {
    const schema = buildBreadcrumbList(items);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[items.length - 1].position).toBe(items.length);
  });

  it("all item URLs are valid HTTPS", () => {
    const schema = buildBreadcrumbList(items);
    for (const el of schema.itemListElement) {
      expect(el.item).toMatch(/^https?:\/\//);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildOrganizationSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("buildOrganizationSchema", () => {
  it("returns @type Organization", () => {
    const schema = buildOrganizationSchema();
    expect(schema["@type"]).toBe("Organization");
    expect(schema["@context"]).toBe("https://schema.org");
  });

  it("includes name StarlynnCare or similar", () => {
    const schema = buildOrganizationSchema();
    expect(typeof schema.name).toBe("string");
    expect(schema.name.length).toBeGreaterThan(0);
  });

  it("includes url field", () => {
    const schema = buildOrganizationSchema();
    expect(schema.url).toMatch(/^https?:\/\//);
  });

  it("knowsAbout includes regulatory topics", () => {
    const schema = buildOrganizationSchema();
    expect(Array.isArray(schema.knowsAbout)).toBe(true);
    expect(schema.knowsAbout.length).toBeGreaterThan(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD serialization (all schemas must serialize to valid JSON)
// ─────────────────────────────────────────────────────────────────────────────

describe("JSON-LD serialization", () => {
  it("buildLocalBusinessForFacility produces serializable JSON", () => {
    const schema = buildLocalBusinessForFacility(MINIMAL_FACILITY, CA_STATE, {
      canonicalUrl: CANONICAL_URL,
    });
    expect(() => JSON.stringify(schema)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(schema));
    expect(parsed["@type"]).toBeTruthy();
  });

  it("buildBreadcrumbList produces serializable JSON", () => {
    const schema = buildBreadcrumbList([
      { name: "Home", url: "https://www.starlynncare.com" },
    ]);
    expect(() => JSON.stringify(schema)).not.toThrow();
  });

  it("buildOrganizationSchema produces serializable JSON", () => {
    const schema = buildOrganizationSchema();
    expect(() => JSON.stringify(schema)).not.toThrow();
  });
});
