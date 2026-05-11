import type { Review } from "@/components/reviews/ReviewCard";
import type { Facility } from "@/lib/types";
import { stateFromCode, type StateInfo } from "@/lib/states";
import type { Region } from "@/lib/regions";
import {
  STARLYNN_AUTHOR_IMAGE_PATH,
  STARLYNN_AUTHOR_LICENSE,
  STARLYNN_EDITORIAL_REVIEWER,
} from "@/lib/seo/editor";
import { SITE_ORIGIN, canonicalFor } from "@/lib/seo/canonical";
import { buildFacilitySnippet } from "@/lib/seo/meta";

/**
 * Optional snapshot-derived extras the LocalBusiness/MedicalOrganization JSON-LD
 * uses to build a `description` that mirrors the meta tag. When omitted,
 * `facilityDescription` falls back to the legacy location-only sentence.
 */
export type FacilitySchemaExtras = {
  /** Composite letter grade from facility_snapshot RPC. Null when peer-set too thin. */
  grade?: string | null;
  /** Composite percentile 0–100, higher = better. */
  percentile?: number | null;
  /** Total deficiencies on record. */
  citationCount?: number;
  /** ISO yyyy-mm-dd of last non-complaint inspection. */
  lastInspectionDate?: string | null;
};

export type BreadcrumbItem = { name: string; url: string };

/** CDSS Community Care Licensing public facility detail (FacDetail). */
export function cdssLicensePageFor(
  licenseNumber: string | null | undefined,
): string | null {
  if (licenseNumber == null || !String(licenseNumber).trim()) return null;
  const facNum = String(licenseNumber).trim();
  return `https://www.ccld.dss.ca.gov/carefacilitysearch/?rewrite=FacDetail&facNum=${encodeURIComponent(facNum)}`;
}

/**
 * Per-state regulator URL where a family can independently verify the license.
 *
 * Where the regulator publishes a deep link by license/facility ID we use it; where
 * only a search portal exists, we link the portal (the user can paste the displayed
 * license number to find the facility). Used by FacilityHero to make the LIC#
 * clickable and by JSON-LD `sameAs` to chain trust into the structured data graph.
 *
 * - CA → CDSS FacDetail deep link
 * - TX → HHSC LTC Online Search portal (LTC Search; users paste license number)
 * - OR → Oregon DHS LTC Licensing portal
 * - WA → Washington DSHS ALF Public Lookup
 * - MN → Minnesota MDH Licensed/Certified Provider lookup
 */
export function regulatorLicensePageFor(
  stateCode: string,
  licenseNumber: string | null | undefined,
): string | null {
  if (licenseNumber == null || !String(licenseNumber).trim()) return null;
  const code = stateCode.toUpperCase();
  const lic = String(licenseNumber).trim();
  switch (code) {
    case "CA":
      return cdssLicensePageFor(lic);
    case "TX":
      return `https://apps.hhs.texas.gov/LTCSearch/`;
    case "OR":
      return `https://ltclicensing.oregon.gov/Facilities`;
    case "WA":
      return `https://fortress.wa.gov/dshs/adsaapps/lookup/AlfPubLookup.aspx`;
    case "MN":
      return `https://www.health.state.mn.us/facilities/providers/index.html`;
    default:
      return null;
  }
}

/** Short label for the regulator portal a license link goes to. */
export function regulatorLicensePageLabel(stateCode: string): string {
  const code = stateCode.toUpperCase();
  switch (code) {
    case "CA":
      return "Verify on CDSS";
    case "TX":
      return "Verify on HHSC";
    case "OR":
      return "Verify on OR DHS";
    case "WA":
      return "Verify on DSHS";
    case "MN":
      return "Verify on MDH";
    default:
      return "Verify with regulator";
  }
}

function reviewOverallRating(review: Review): number {
  const vals = [
    review.rating_staff_engagement,
    review.rating_personal_care,
    review.rating_activities,
    review.rating_food,
    review.rating_transparency,
    review.rating_safety,
    review.rating_night_weekend,
  ];
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function buildBreadcrumbList(items: BreadcrumbItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

function parseCoord(s: string | null | undefined): number | null {
  if (s == null || !String(s).trim()) return null;
  const n = Number.parseFloat(String(s));
  return Number.isFinite(n) ? n : null;
}

function facilityDescription(
  facility: Facility,
  extras?: FacilitySchemaExtras,
): string {
  if (facility.content?.what_families_should_know) {
    return facility.content.what_families_should_know.slice(0, 5000);
  }
  const stateName = stateFromCode(facility.state_code)?.name ?? facility.state_code;

  // When snapshot data is available, mirror the meta description so the
  // LocalBusiness/MedicalOrganization graph node carries the same differentiator
  // we put in the SERP snippet. Knowledge-panel & AI Overview surfaces lift from here.
  if (
    extras &&
    (extras.grade != null ||
      extras.percentile != null ||
      (extras.citationCount ?? 0) > 0 ||
      extras.lastInspectionDate)
  ) {
    return buildFacilitySnippet({
      facilityName: facility.name,
      stateName,
      stateCode: facility.state_code,
      grade: extras.grade ?? null,
      percentile: extras.percentile ?? null,
      citationCount: extras.citationCount ?? 0,
      lastInspectionDate: extras.lastInspectionDate ?? null,
      variant: "prose",
    });
  }

  const location = facility.city ? `${facility.city}, ${stateName}` : stateName;
  return `Licensed memory care profile for ${facility.name} in ${location}, with state inspection context from StarlynnCare.`;
}

function nestedAggregateFromReviews(reviews: Review[]): object {
  const perReview = reviews.map(reviewOverallRating);
  const ratingValue =
    Math.round((perReview.reduce((a, b) => a + b, 0) / perReview.length) * 10) / 10;
  return {
    "@type": "AggregateRating",
    ratingValue,
    bestRating: 5,
    worstRating: 1,
    ratingCount: reviews.length,
    reviewCount: reviews.length,
  };
}

export function buildLocalBusinessForFacility(
  facility: Facility,
  state: StateInfo,
  opts: {
    canonicalUrl: string;
    reviews?: Review[];
    /** Snapshot-derived extras used to mirror the meta description copy. */
    extras?: FacilitySchemaExtras;
  },
): object {
  const businessId = `${opts.canonicalUrl}#business`;
  const sameAs: string[] = [];
  const regulatorUrl = regulatorLicensePageFor(state.code, facility.license_number);
  if (regulatorUrl) sameAs.push(regulatorUrl);
  if (facility.website?.trim()) sameAs.push(facility.website.trim());

  const additionalProperty: object[] = [];
  if (facility.license_number)
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "State license number",
      value: facility.license_number,
    });
  if (facility.beds != null)
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Licensed capacity (beds)",
      value: String(facility.beds),
    });
  if (facility.license_type)
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "License type",
      value: facility.license_type,
    });
  if (facility.care_category)
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Care category",
      value: facility.care_category,
    });

  const lat = parseCoord(facility.latitude);
  const lng = parseCoord(facility.longitude);

  const orgBlock =
    facility.operator_name?.trim() != null
      ? {
          parentOrganization: {
            "@type": "Organization",
            name: facility.operator_name!.trim(),
          },
        }
      : {};

  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "MedicalOrganization"],
    "@id": businessId,
    name: facility.name,
    url: opts.canonicalUrl,
    description: facilityDescription(facility, opts.extras),
    telephone: facility.phone ?? undefined,
    image: facility.photo_url ?? undefined,
    priceRange: "$$",
    medicalSpecialty: "Geriatric",
    address: {
      "@type": "PostalAddress",
      streetAddress: facility.street ?? undefined,
      addressLocality: facility.city ?? undefined,
      postalCode: facility.zip ?? undefined,
      addressRegion: state.name,
      addressCountry: "US",
    },
    ...(lat != null && lng != null
      ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(additionalProperty.length ? { additionalProperty } : {}),
    ...orgBlock,
    ...(opts.reviews?.length
      ? { aggregateRating: nestedAggregateFromReviews(opts.reviews) }
      : {}),
  };
}

export function buildReviewSchema(review: Review, businessId: string): object {
  const rv = Math.round(reviewOverallRating(review) * 10) / 10;
  const body =
    review.overall_summary?.trim() ||
    `Verified family review for this facility (${review.reviewer_relationship}).`;
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    author: {
      "@type": "Person",
      name: review.reviewer_name,
    },
    datePublished: new Date(review.created_at).toISOString().split("T")[0],
    reviewBody: body.slice(0, 8000),
    reviewRating: {
      "@type": "Rating",
      ratingValue: rv,
      bestRating: 5,
      worstRating: 1,
    },
    itemReviewed: { "@id": businessId },
  };
}

const FAQ_ANSWER_TEMPLATE =
  "When touring this facility, ask staff this question directly and note how they answer. Compare their response to what California CDSS inspectors documented in the public inspection record for this license.";

export function buildFaqPageSchema(
  questions: string[],
  pageUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: pageUrl,
    mainEntity: questions.map((name) => ({
      "@type": "Question",
      name,
      acceptedAnswer: {
        "@type": "Answer",
        text: FAQ_ANSWER_TEMPLATE,
      },
    })),
  };
}

/**
 * Build a FAQPage schema from Q+A pairs with real answers.
 * Used on the homepage and hub pages where we have full answer text.
 */
export function buildFaqSchemaFromPairs(
  items: Array<{ q: string; a: string }>,
  pageUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: pageUrl,
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export type ItemListFacility = {
  name: string;
  url: string;
  /** Internal UUID for PropertyValue identifier (not a bare string on LocalBusiness). */
  facilityId?: string;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  /** e.g. "California" or "CA" */
  addressRegion?: string | null;
};

function itemListLocalBusiness(f: ItemListFacility): object {
  const street = f.street?.trim() || undefined;
  const locality = f.city?.trim() || undefined;
  const postal = f.postalCode?.trim() || undefined;
  const region = f.addressRegion?.trim() || undefined;

  const hasAddress = Boolean(street || locality || postal || region);

  const address = hasAddress
    ? {
        "@type": "PostalAddress",
        ...(street ? { streetAddress: street } : {}),
        ...(locality ? { addressLocality: locality } : {}),
        ...(postal ? { postalCode: postal } : {}),
        ...(region ? { addressRegion: region } : {}),
        addressCountry: "US",
      }
    : undefined;

  const idBlock =
    f.facilityId?.trim() != null
      ? {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "starlynncare_facility_id",
            value: f.facilityId.trim(),
          },
        }
      : {};

  return {
    "@type": "LocalBusiness",
    name: f.name,
    url: f.url,
    ...(address ? { address } : {}),
    ...idBlock,
  };
}

/** Generic topical CollectionPage (editorial index — not a geographic hub). */
export function buildTopicCollectionPage(input: {
  name: string;
  url: string;
  description?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    isPartOf: {
      "@type": "WebSite",
      name: "StarlynnCare",
      url: SITE_ORIGIN,
    },
  };
}

/** ItemList of editorial WebPages — not LocalBusiness (use for /library hub). */
export function buildSimpleLinkItemListSchema(
  pageName: string,
  pageUrl: string,
  items: Array<{ name: string; url: string }>,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: pageName,
    url: pageUrl,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
      item: {
        "@type": "WebPage",
        name: it.name,
        url: it.url,
      },
    })),
  };
}

export function buildItemListSchema(
  pageName: string,
  pageUrl: string,
  facilities: ItemListFacility[],
): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: pageName,
    url: pageUrl,
    numberOfItems: facilities.length,
    itemListElement: facilities.map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      // name + url at ListItem level required by Google Rich Results validator
      name: f.name,
      url: f.url,
      item: itemListLocalBusiness(f),
    })),
  };
}

export function buildStateHubCollectionPage(input: {
  name: string;
  url: string;
  state: StateInfo;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    url: input.url,
    about: {
      "@type": "AdministrativeArea",
      name: input.state.name,
      containedInPlace: {
        "@type": "Country",
        name: "United States",
      },
    },
  };
}

export function buildCollectionPageSchema(input: {
  name: string;
  url: string;
  region: Region;
}): object {
  const { name, url, region } = input;
  const isCity = region.kind === "city";
  const about = isCity
    ? {
        "@type": "City",
        name: region.name,
        containedInPlace: {
          "@type": "AdministrativeArea",
          name: region.state.name,
        },
      }
    : {
        "@type": "AdministrativeArea",
        name: region.name,
        containedInPlace: {
          "@type": "AdministrativeArea",
          name: region.state.name,
        },
      };

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url,
    about,
  };
}

export function buildWebPageWithReviewer(input: {
  name: string;
  url: string;
  description?: string;
  /**
   * Override reviewer name only when the page is reviewed by someone other than
   * the default Starlynn RN reviewer. Leave undefined for the standard chain
   * which embeds full credentials (RN license, recognizing org) via buildStarlynnPerson().
   */
  reviewerName?: string;
}): object {
  // Default reviewer = full Person node with credentials (RN license, recognizing org).
  // This is the YMYL-strength signal Google's quality guidelines reward on healthcare/eldercare directories.
  const reviewedBy = input.reviewerName
    ? { "@type": "Person", name: input.reviewerName }
    : buildStarlynnPerson();
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    reviewedBy,
    isPartOf: {
      "@type": "WebSite",
      name: "StarlynnCare",
      url: SITE_ORIGIN,
    },
  };
}

export function buildOrganizationSchema(): object {
  const aboutUrl = canonicalFor("/about");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}#organization`,
    name: "StarlynnCare",
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/illustrations/logo-mark.png`,
    description:
      "StarlynnCare publishes verified state inspection records, citations, and family reviews for licensed memory care facilities. Independent and free for families: no referral commissions, lead fees, or paid placements from operators.",
    foundingDate: "2025",
    founder: { "@id": `${SITE_ORIGIN}/about#person-blake-jones` },
    employee: [{ "@id": `${SITE_ORIGIN}#person-starlynn-starkey` }],
    knowsAbout: [
      "Memory care",
      "Dementia care licensing",
      "Assisted living regulation",
      "Skilled nursing facility inspections",
      "California RCFE regulation",
      "Texas HHSC ALF licensing",
      "Oregon DHS Memory Care Endorsement",
      "Washington DSHS Specialized Dementia Care contracts",
      "Minnesota MDH Assisted Living with Dementia Care",
    ],
    funding: {
      "@type": "MonetaryGrant",
      name: "Founder-funded; no operator commissions",
      description:
        "StarlynnCare receives no referral commissions, lead fees, or paid placements from facility operators. Funding comes from the founder; the editorial product is free for families.",
    },
    sameAs: [
      aboutUrl,
      canonicalFor("/methodology"),
      canonicalFor("/data"),
      canonicalFor("/editorial-policy"),
    ],
  };
}

export function buildWebSiteSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}#website`,
    name: "StarlynnCare",
    url: SITE_ORIGIN,
    publisher: { "@id": `${SITE_ORIGIN}#organization` },
  };
}

/**
 * Compose homepage `@graph` linking Organization ↔ WebSite ↔ founder Person ↔ reviewer Person.
 * Use this on the homepage instead of emitting Organization and WebSite separately so search
 * engines can reason about the editorial trust chain (founder, reviewer credentials).
 */
export function buildHomeOrganizationGraph(input: {
  founderPersonNode: object;
}): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationSchema(),
      buildWebSiteSchema(),
      buildStarlynnPerson(),
      input.founderPersonNode,
    ],
  };
}

export function buildDatasetSchema(input: {
  pageUrl: string;
  methodologyUrl: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "California Memory Care Inspection & Quality Records",
    description:
      "Deficiency findings, complaint outcomes, and quality context for licensed memory care facilities in California, derived from CA CDSS Community Care Licensing inspection transparency data and CMS Care Compare where applicable.",
    url: input.pageUrl,
    creator: { "@type": "Organization", name: "StarlynnCare" },
    isAccessibleForFree: true,
    spatialCoverage: {
      "@type": "Place",
      name: "California, USA",
    },
    temporalCoverage: "2024-01-01/..",
    variableMeasured: [
      "Deficiency type and class",
      "Citation severity",
      "Inspection frequency",
      "Complaint substantiation",
      "Licensed capacity",
    ],
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/html",
        contentUrl: input.methodologyUrl,
      },
    ],
  };
}

/** Person JSON-LD for Rebecca Lynn Starkey (clinical author / reviewer). */
export function buildStarlynnPerson(): object {
  const img = `${SITE_ORIGIN}${STARLYNN_AUTHOR_IMAGE_PATH}`;
  return {
    "@type": "Person",
    "@id": `${SITE_ORIGIN}#person-starlynn-starkey`,
    name: STARLYNN_EDITORIAL_REVIEWER,
    jobTitle: "Registered Nurse",
    image: img,
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "license",
      recognizedBy: {
        "@type": "Organization",
        name: "California Board of Registered Nursing",
      },
      identifier: STARLYNN_AUTHOR_LICENSE,
    },
    worksFor: { "@type": "Organization", name: "StarlynnCare", url: SITE_ORIGIN },
  };
}

export function buildArticleSchema(input: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  /** Optional extra types e.g. FAQPage handled separately */
}): object {
  const ogImage = `${SITE_ORIGIN}/og-default.png`;
  const dateModified = input.dateModified ?? input.datePublished;
  return {
    "@context": "https://schema.org",
    "@type": ["Article", "MedicalWebPage"],
    "@id": `${input.url}#article`,
    headline: input.headline,
    description: input.description,
    url: input.url,
    image: ogImage,
    datePublished: input.datePublished,
    dateModified,
    lastReviewed: dateModified,
    medicalAudience: { "@type": "MedicalAudience", audienceType: "Patient" },
    author: buildStarlynnPerson(),
    reviewedBy: buildStarlynnPerson(),
    publisher: {
      "@type": "Organization",
      name: "StarlynnCare",
      url: SITE_ORIGIN,
      logo: {
        "@type": "ImageObject",
        url: ogImage,
        width: 1200,
        height: 630,
      },
    },
    isPartOf: { "@type": "WebSite", name: "StarlynnCare", url: SITE_ORIGIN },
  };
}

/** Generic Person JSON-LD for founders / contributors (About page). */
export function buildPersonSchema(input: {
  name: string;
  jobTitle: string;
  description?: string;
  image?: string;
  url?: string;
  /** Stable node id for JSON-LD @graph (e.g. `${SITE_ORIGIN}/about#person-blake`). */
  id?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    ...(input.id ? { "@id": input.id } : {}),
    name: input.name,
    jobTitle: input.jobTitle,
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: `${SITE_ORIGIN}${input.image.startsWith("/") ? input.image : `/${input.image}`}` } : {}),
    ...(input.url ? { url: input.url } : {}),
    worksFor: { "@type": "Organization", name: "StarlynnCare", url: SITE_ORIGIN },
  };
}

/** Container for glossary entries — reference from each DefinedTerm via `inDefinedTermSet`. */
export function buildDefinedTermSetSchema(input: {
  id: string;
  name: string;
  description?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": input.id,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
  };
}

export function buildDefinedTermSchema(input: {
  name: string;
  description: string;
  url: string;
  termCode?: string;
  termSetId: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.termCode ? { termCode: input.termCode } : {}),
    inDefinedTermSet: { "@id": input.termSetId },
  };
}

/**
 * MedicalWebPage JSON-LD for facility profile pages — the YMYL-strength
 * WebPage node that city/state hubs have always emitted but facility profiles
 * were missing. Includes `reviewedBy` (RN reviewer) and `lastReviewed`
 * (most-recent inspection date or today's ISO date as fallback).
 */
export function buildFacilityMedicalWebPage(input: {
  name: string;
  url: string;
  description?: string;
  /** ISO yyyy-mm-dd. Use most-recent non-complaint inspection date, fallback to today. */
  lastReviewed: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    lastReviewed: input.lastReviewed,
    reviewedBy: buildStarlynnPerson(),
    isPartOf: {
      "@type": "WebSite",
      name: "StarlynnCare",
      url: SITE_ORIGIN,
    },
  };
}

/**
 * Build a FAQPage schema for facility profiles using real facility data.
 *
 * Generates data-driven Q&A pairs (inspection count, quality grade) so
 * every facility page has unique FAQ content — preventing Google from
 * suppressing rich results due to identical boilerplate answers.
 *
 * Tour questions (from facility.content.tour_questions) are included as
 * additional FAQ entries whose answers incorporate facility-specific facts
 * rather than the identical template text that applied to all facilities.
 *
 * Returns null when no meaningful Q&A can be generated (no data, no tour
 * questions), so callers can skip emitting the FAQPage node entirely.
 */
export function buildFacilityFaqSchema(input: {
  facilityName: string;
  stateName: string;
  pageUrl: string;
  inspectionCount: number;
  deficiencyCount: number;
  lastInspectionDate: string | null;
  grade: string | null;
  tourQuestions: string[];
}): object | null {
  const pairs: Array<{ q: string; a: string }> = [];

  const lastDateStr = input.lastInspectionDate
    ? `, most recently on ${input.lastInspectionDate}`
    : "";

  if (input.inspectionCount > 0) {
    const inspPlural = input.inspectionCount !== 1 ? "inspections" : "inspection";
    const defPlural = input.deficiencyCount !== 1 ? "deficiencies" : "deficiency";
    pairs.push({
      q: `How many inspections has ${input.facilityName} had?`,
      a: `${input.facilityName} has ${input.inspectionCount} ${inspPlural} on record with ${input.stateName} regulators${lastDateStr}, with ${input.deficiencyCount} ${defPlural} documented across those inspections.`,
    });
  }

  if (input.grade) {
    pairs.push({
      q: `What is ${input.facilityName}'s quality grade?`,
      a: `${input.facilityName} received a grade of ${input.grade} from StarlynnCare based on deficiency severity, repeat citations, inspection frequency, and peer comparison across ${input.stateName} memory care facilities.`,
    });
  }

  // Tour questions with facility-specific context so answers are not identical
  // across all facilities. Each answer includes the facility's real inspection
  // stats before directing families to ask staff directly.
  const contextPrefix =
    input.inspectionCount > 0
      ? `${input.facilityName} has ${input.deficiencyCount} ${input.deficiencyCount !== 1 ? "deficiencies" : "deficiency"} documented across ${input.inspectionCount} ${input.stateName} regulator ${input.inspectionCount !== 1 ? "inspections" : "inspection"}${lastDateStr}. `
      : "";
  for (const q of input.tourQuestions) {
    pairs.push({
      q,
      a: `${contextPrefix}Ask staff this question directly and compare their response to ${input.facilityName}'s public inspection record on StarlynnCare.`,
    });
  }

  if (!pairs.length) return null;
  return buildFaqSchemaFromPairs(pairs, input.pageUrl);
}
