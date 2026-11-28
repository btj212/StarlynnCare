import type { Review } from "@/components/reviews/ReviewCard";
import type { Facility } from "@/lib/types";
import { COVERED_STATES, stateFromCode, type StateInfo } from "@/lib/states";
import type { Region } from "@/lib/regions";

/**
 * Free-tier display cap — must match INSPECTION_DISPLAY_YEARS in loadFacilityProfile.ts.
 * Re-declared here to avoid a circular import (loadFacilityProfile → schema → loadFacilityProfile).
 * Any inspection/deficiency data surfaced in JSON-LD builders (via the `extras` arg or similar)
 * is already pre-filtered to this window before being passed in.
 */
const INSPECTION_DISPLAY_YEARS = 3; // eslint-disable-line @typescript-eslint/no-unused-vars
import {
  STARLYNN_AUTHOR_IMAGE_PATH,
  STARLYNN_AUTHOR_LICENSE,
  STARLYNN_EDITORIAL_REVIEWER,
} from "@/lib/seo/editor";
import { SITE_ORIGIN, canonicalFor } from "@/lib/seo/canonical";
import { buildFacilitySnippet } from "@/lib/seo/meta";
import { formatFacilityName } from "@/lib/facility/displayName";
import { facilityAliases, facilityDisplayName } from "@/lib/facility/aliases";
import { regulatorFor } from "@/lib/states/regulators";
import { parsePhone } from "@/lib/facility/phone";
import { linkableFacilityUrl } from "@/lib/facility/aggregatorLink";
import { regulatorPublishesSeverityScale, seriousTermWhenNone } from "@/lib/states/severityScale";
import { texasRecentResultsSentence, texasRecentResultsUnpublished, texasRegulatorRecordUrl } from "@/lib/facility/texasRecord";
import type { MemoryCareBasis } from "@/lib/facility/memoryCareBasis";
import {
  CONFIRMED_ACCEPTS_JSONLD,
  DEMENTIA_CREDENTIAL_JSONLD,
  dementiaAcceptanceTier,
} from "@/lib/facility/memoryCareBasis";
import { medicaidFaqPair, securedUnitFaqPair } from "@/lib/facility/profileFacts";
import { visitKindLabel } from "@/lib/facility/visitLabel";
import { formatRecordDate, type DatePrecision } from "@/lib/format/formatRecordDate";
import { licensedCity } from "@/lib/facility/licensedCity";
import { facilityPageNoun, weightedCitationsPerBedPhrase } from "@/lib/facility/pageCopy";

/**
 * Optional snapshot-derived extras the LocalBusiness/MedicalOrganization JSON-LD
 * uses to build a `description` that mirrors the meta tag. When omitted,
 * `facilityDescription` falls back to the legacy location-only sentence.
 */
export type FacilitySchemaExtras = {
  /** Composite percentile 0–100. Passed through and not printed as a rank. */
  percentile?: number | null;
  /** Deficiency rows inside the 3-year window. */
  citationCount?: number;
  /** Inspections inside the profile window. Texas uses this to avoid a zero-citation claim. */
  inspectionCount?: number;
  /** ISO yyyy-mm-dd of last non-complaint inspection. */
  lastInspectionDate?: string | null;
  /** Profile regulator. Colorado nursing homes are CMS, not the state CDPHE abbreviation. */
  regulatorAbbr?: string | null;
  heldCount?: number | null;
  olderCitation?: boolean;
  lastCitationDate?: string | null;
  earliestInspectionDate?: string | null;
  severityValue?: number | null;
  severityPeerMedian?: number | null;
  windowMonths?: number | null;
};

export type BreadcrumbItem = { name: string; url?: string };

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
 * - OR → Oregon DHS provider record (`/Providers/Details/{license}`)
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
    case "OR":
      return `https://ltclicensing.oregon.gov/Providers/Details/${encodeURIComponent(lic)}`;
    default:
      return regulatorFor(code)?.portalUrl ?? null;
  }
}

/** Short label for the regulator portal a license link goes to. */
export function regulatorLicensePageLabel(stateCode: string): string {
  const regulator = regulatorFor(stateCode);
  return regulator ? `Verify on ${regulator.short}` : "Verify with regulator";
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
      ...(it.url ? { item: it.url } : {}),
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
  memoryCare?: MemoryCareBasis,
): string {
  if (facility.content?.what_families_should_know) {
    return facility.content.what_families_should_know.slice(0, 5000);
  }
  const stateName = stateFromCode(facility.state_code)?.name ?? facility.state_code;

  // When snapshot data is available, mirror the meta description so the
  // LocalBusiness/MedicalOrganization graph node carries the same differentiator
  // we put in the SERP snippet. Knowledge-panel & AI Overview surfaces lift from here.
  if (
    texasRecentResultsUnpublished(
      facility.state_code,
      extras?.inspectionCount ?? 0,
      extras?.citationCount ?? 0,
    )
  ) {
    return texasRecentResultsSentence(texasRegulatorRecordUrl());
  }

  if (
    extras &&
    (extras.percentile != null ||
      (extras.citationCount ?? 0) > 0 ||
      extras.lastInspectionDate)
  ) {
    return buildFacilitySnippet({
      facilityName: facility.name,
      stateName,
      stateCode: facility.state_code,
      grade: null,
      percentile: extras.percentile ?? null,
      citationCount: extras.citationCount ?? 0,
      inspectionCount: extras.inspectionCount,
      lastInspectionDate: extras.lastInspectionDate ?? null,
      variant: "prose",
      regulatorAbbr: extras.regulatorAbbr,
      heldCount: extras.heldCount,
      olderCitation: extras.olderCitation,
      lastCitationDate: extras.lastCitationDate,
      earliestInspectionDate: extras.earliestInspectionDate,
      severityValue: extras.severityValue,
      severityPeerMedian: extras.severityPeerMedian,
      windowMonths: extras.windowMonths,
    });
  }

  const location = facility.city ? `${facility.city}, ${stateName}` : stateName;
  const noun = facilityPageNoun({
    stateCode: facility.state_code,
    basisRecorded: memoryCare?.recorded === true,
  });
  const label = noun.charAt(0).toUpperCase() + noun.slice(1);
  return `${label} profile for ${facility.name} in ${location}, with state inspection context from StarlynnCare.`;
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
    memoryCare?: MemoryCareBasis;
  },
): object {
  const businessId = `${opts.canonicalUrl}#business`;
  const sameAs: string[] = [];
  const regulatorUrl = regulatorLicensePageFor(state.code, facility.license_number);
  if (regulatorUrl) sameAs.push(regulatorUrl);
  const website = linkableFacilityUrl(facility.website);
  if (website) sameAs.push(website);

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
  if (opts.memoryCare && opts.memoryCare.kind !== "none") {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: opts.memoryCare.kind === "care-level" ? "Care level" : "Memory care basis",
      value: opts.memoryCare.label,
    });
    if (opts.memoryCare.sourceUrl) {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: opts.memoryCare.kind === "care-level" ? "License source" : "Memory care source",
        value: opts.memoryCare.sourceUrl,
      });
    }
  }
  const acceptanceTier = dementiaAcceptanceTier(facility);
  if (
    opts.memoryCare?.kind !== "memory-care" &&
    (acceptanceTier === "confirmed-accepts" || acceptanceTier === "credential")
  ) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Dementia care",
      value:
        acceptanceTier === "confirmed-accepts"
          ? CONFIRMED_ACCEPTS_JSONLD
          : DEMENTIA_CREDENTIAL_JSONLD,
    });
  }
  if (facility.state_code === "AZ" && facility.mc_program_confirmed === true) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Memory care program confirmed",
      value: facility.mc_program_source_url?.trim() || "true",
    });
  }

  const lat = parseCoord(facility.latitude);
  const lng = parseCoord(facility.longitude);

  const orgBlock =
    facility.operator_name?.trim() != null
      ? {
          parentOrganization: {
            "@type": "Organization",
            name: formatFacilityName(facility.operator_name!.trim()),
          },
        }
      : {};

  const aliases = facilityAliases(facility);
  const displayName = facilityDisplayName(facility);
  const legalName = formatFacilityName(facility.name);
  const isNursingHome =
    facility.care_category === "snf_general" || facility.care_category === "snf_dementia_scu";
  const alternateNames = [
    ...(aliases.marketingName && legalName && aliases.marketingName !== legalName ? [legalName] : []),
    ...aliases.aliases.map((alias) => formatFacilityName(alias)),
  ].filter((name) => name && name !== displayName);

  const licenseValue = facility.license_number?.trim() || "";
  const regulator = regulatorFor(facility.state_code);
  const licenseIdentifier = licenseValue
    ? {
        identifier: {
          "@type": "PropertyValue",
          name: "State license number",
          propertyID: regulator ? `${regulator.short} license` : "State license",
          value: licenseValue,
        },
      }
    : {};
  const telephone = parsePhone(facility.phone)?.display ?? "";

  return {
    "@context": "https://schema.org",
    "@type": isNursingHome ? ["NursingHome", "LocalBusiness"] : ["LocalBusiness", "MedicalOrganization"],
    "@id": businessId,
    name: displayName,
    ...(aliases.marketingName ? { legalName } : {}),
    ...(alternateNames.length === 1
      ? { alternateName: alternateNames[0] }
      : alternateNames.length > 1
        ? { alternateName: alternateNames }
        : {}),
    url: opts.canonicalUrl,
    description: facilityDescription(facility, opts.extras, opts.memoryCare),
    ...(telephone ? { telephone } : {}),
    image: facility.photo_url ?? undefined,
    medicalSpecialty: "Geriatric",
    ...licenseIdentifier,
    address: {
      "@type": "PostalAddress",
      streetAddress: facility.street ?? undefined,
      addressLocality: licensedCity(facility).locality || facility.city || undefined,
      postalCode: facility.zip ?? undefined,
      addressRegion: state.name,
      addressCountry: "US",
    },
    ...(lat != null && lng != null
      ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(additionalProperty.length ? { additionalProperty } : {}),
    ...(opts.memoryCare?.kind === "memory-care"
      ? {
          amenityFeature: [
            {
              "@type": "LocationFeatureSpecification",
              name:
                facility.state_code === "AZ"
                  ? "Memory care services (A.A.C. R9-10-816)"
                  : "Memory care",
              value: true,
            },
          ],
        }
      : {}),
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
  datePublished?: string | null;
  dateModified?: string | null;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    url: input.url,
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
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
  datePublished?: string | null;
  dateModified?: string | null;
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
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
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
  /** ISO 8601 — first time this page's data was published. */
  datePublished?: string | null;
  /** ISO 8601 — last data refresh or content edit. */
  dateModified?: string | null;
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
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
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
      "StarlynnCare publishes verified state inspection records, citations, and family reviews for licensed memory care facilities. Independent of operators: no referral commissions, lead fees, or paid placements from facilities.",
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
        "StarlynnCare receives no referral commissions, lead fees, or paid placements from facility operators. Funding comes from the founder and optional reader services such as Facility Watch.",
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
  const stateNames = COVERED_STATES.map((state) => state.name);
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Memory Care Inspection Records (${COVERED_STATES.length} States)`,
    description:
      `Deficiency findings, complaint outcomes, and quality context for licensed memory care facilities in ${stateNames.join(", ")}, derived from each state's license office and CMS Care Compare where a home has a federal identifier.`,
    url: input.pageUrl,
    creator: { "@type": "Organization", name: "StarlynnCare" },
    isAccessibleForFree: true,
    spatialCoverage: stateNames.map((name) => ({
      "@type": "Place",
      name: `${name}, USA`,
    })),
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

/** The /data state table. Counts stay on the page; this names what is measured. */
export function buildStateMemoryCareStatsDataset(input: {
  pageUrl: string;
  stateNames: string[];
  cutoff: string;
  newestInspection: string | null;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "State memory care record counts",
    description: `Published memory care homes, homes with an inspection on file, homes with a serious citation on or after ${input.cutoff}, and the newest inspection date stored, for ${input.stateNames.join(", ")}. A serious citation is a Type A finding or a finding stored at severity 3 or higher. The serious figure counts homes, not findings.`,
    url: input.pageUrl,
    creator: { "@type": "Organization", name: "StarlynnCare" },
    isAccessibleForFree: true,
    spatialCoverage: input.stateNames.map((name) => ({ "@type": "Place", name })),
    ...(input.newestInspection
      ? { temporalCoverage: `../${input.newestInspection}` }
      : {}),
    variableMeasured: [
      "Published homes",
      "Homes with an inspection on file",
      "Homes with a serious citation in 24 months",
      "Newest inspection date",
    ],
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/html",
        contentUrl: input.pageUrl,
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
  /** Absolute image URL. Defaults to the site Open Graph image. */
  image?: string;
  /** Optional extra types e.g. FAQPage handled separately */
}): object {
  const ogImage = input.image ?? `${SITE_ORIGIN}/og-default.png`;
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
 * were missing. Includes `reviewedBy` (RN reviewer). `lastReviewed` is the
 * most recent non-complaint inspection date when we have one. It is omitted
 * when we do not. Do not fill it with today's date.
 */
export function buildFacilityMedicalWebPage(input: {
  name: string;
  url: string;
  description?: string;
  /** ISO yyyy-mm-dd. Most recent non-complaint inspection. Omit when none. */
  lastReviewed?: string | null;
  /** ISO 8601 — facility.created_at, the first time this facility was published. */
  datePublished?: string | null;
  /** ISO 8601 — facility.updated_at or last inspection date, whichever is more recent. */
  dateModified?: string | null;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.lastReviewed ? { lastReviewed: input.lastReviewed } : {}),
    reviewedBy: buildStarlynnPerson(),
    isPartOf: {
      "@type": "WebSite",
      name: "StarlynnCare",
      url: SITE_ORIGIN,
    },
  };
}

export type FacilityFaqPair = { q: string; a: string };

export type FacilityFaqInput = {
  facilityName: string;
  stateName: string;
  stateCode: string;
  /**
   * When set, overrides the state default. Washington nursing homes pass
   * true because they use the CMS grid. Washington assisted living does not.
   */
  publishesSeverityScale?: boolean;
  pageUrl: string;
  inspectionCount: number;
  deficiencyCount: number;
  /** True when older inspections exist outside the three-year display window. */
  countsCoverThreeYears: boolean;
  lastInspectionDate: string | null;
  lastInspectionType: string | null;
  /** Matches the inspection list: complaints stay complaints. Other non-complaint visits use that list's label. */
  lastInspectionIsComplaint: boolean;
  /** WA DSHS often posts a month, not a day. */
  lastInspectionPrecision?: DatePrecision;
  /**
   * Washington only. Newest complaint investigation, kept off the inspection
   * question. Other states omit it.
   */
  lastComplaintDate?: string | null;
  lastComplaintPrecision?: DatePrecision;
  seriousFindings: Array<{ label: string; count: number }>;
  /**
   * California only. Exact Type A rows in the window, from the same head
   * count as the headline. When set, the tagged sentence does not use
   * `seriousFindings`, which may be only the newest 25 visits.
   */
  classTypeACount?: number;
  /**
   * True only when every in-window citation carries the state's scale.
   * A "None are tagged" sentence needs this. A positive count does not.
   */
  severityFullyMeasured?: boolean;
  /** CMS or CDPHE grid, when this home uses one. Personal-care pages omit it. */
  severityScope?: "cms" | "cdphe" | null;
  /** Washington complaint investigations inside the window. Other states omit it. */
  complaintCount?: number;
  /** Kept for callers. The comparison answer uses the measured value, not this number. */
  percentile: number | null;
  severityValue?: number | null;
  severityPeerMedian?: number | null;
  peerWindowMonths?: number | null;
  memoryCareLabel: string;
  /**
   * When false, skip "Does … provide memory care?" — that question implies
   * the home might. Rank copy uses the state's peer-set phrase, not
   * "memory care facilities".
   */
  servesMemoryCare?: boolean;
  /**
   * Confirmed Washington answer. When set, ask whether the home accepts
   * residents with dementia, and do not also ask "provide memory care?".
   */
  acceptsDementiaAnswer?: string | null;
  /**
   * Staff-training credential. When set, ask whether the home has that
   * credential. Do not ask whether it accepts residents or provides memory care.
   */
  dementiaCredentialAnswer?: string | null;
  /** Oregon DHS roster flag. Null omits the Medicaid question. */
  orAcceptsMedicaid?: boolean | null;
  mcDesignationType?: string | null;
  secureBeds?: number | null;
  waMemoryCareCertified?: boolean | null;
  mcProgramQuote?: string | null;
  mcReviewNotes?: string | null;
  licenseNumber: string | null;
  licenseUrl: string | null;
  /** DSHS Forms page for a prior license when the URL still uses the old number. */
  previousLicenseUrl?: string | null;
  regulatorName: string;
  /** Short name used in “cited by ADHS?” — same agency the page names. */
  regulatorAbbr: string;
};

function visitPhrase(type: string | null, isComplaint: boolean): string {
  const label = visitKindLabel({
    is_complaint: isComplaint || type?.trim().toLowerCase() === "complaint",
    inspection_type: type,
  });
  if (label === "Other Visit") return "filed as other";
  const phrase = label.toLowerCase();
  const article = /^[aeiou]/.test(phrase) ? "an" : "a";
  return `${article} ${phrase}`;
}

function proseTag(label: string): string {
  if (label === "Immediate Jeopardy (CMS)" || label.startsWith("IJ ")) return "immediate jeopardy (CMS)";
  if (label === "IJ") return "immediate jeopardy (CMS)";
  if (label === "Immediate Jeopardy") return "immediate jeopardy (CMS)";
  if (label === "Type A" || label === "Type 1") return label;
  return label.toLowerCase();
}

function joinOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

function seriousSentence(
  findings: Array<{ label: string; count: number }>,
  stateCode: string,
  publishesSeverityScale: boolean | undefined,
  fullyMeasured: boolean | undefined,
  scope: "cms" | "cdphe" | null | undefined,
  classTypeACount?: number,
): string {
  const allowed = publishesSeverityScale ?? regulatorPublishesSeverityScale(stateCode, scope);
  if (!allowed) return "";
  if (stateCode.toUpperCase() === "CA" && classTypeACount != null) {
    if (classTypeACount === 0) {
      if (!fullyMeasured) return "";
      return `None are tagged ${seriousTermWhenNone(stateCode, scope)}.`;
    }
    return `${classTypeACount} ${classTypeACount === 1 ? "is" : "are"} tagged Type A.`;
  }
  const total = findings.reduce((sum, finding) => sum + finding.count, 0);
  if (total === 0) {
    if (!fullyMeasured) return "";
    return `None are tagged ${seriousTermWhenNone(stateCode, scope)}.`;
  }
  const labels = [...new Set(findings.map((finding) => proseTag(finding.label)))];
  return `${total} ${total === 1 ? "is" : "are"} tagged ${joinOr(labels)}.`;
}

/**
 * Visible FAQ pairs for a facility page. The JSON-LD uses the same pairs.
 * A question is included only when the fact it answers is on the record.
 * Tour prompts stay in the tour section. They are not answers.
 */
export function buildFacilityFaqPairs(input: FacilityFaqInput): FacilityFaqPair[] {
  const pairs: FacilityFaqPair[] = [];
  const name = input.facilityName;

  if (input.acceptsDementiaAnswer?.trim()) {
    pairs.push({
      q: `Does ${name} accept residents with dementia?`,
      a: input.acceptsDementiaAnswer.trim(),
    });
  } else if (input.dementiaCredentialAnswer?.trim()) {
    pairs.push({
      q: `Does ${name} have a dementia credential?`,
      a: input.dementiaCredentialAnswer.trim(),
    });
  } else if (input.servesMemoryCare !== false) {
    pairs.push({
      q: `Does ${name} provide memory care?`,
      a: input.memoryCareLabel,
    });
  }

  if (input.lastInspectionDate) {
    const precision = input.lastInspectionPrecision ?? "day";
    const date = formatRecordDate(input.lastInspectionDate, precision);
    const visit = visitPhrase(input.lastInspectionType, input.lastInspectionIsComplaint);
    const prep = precision === "month" ? "in" : "on";
    pairs.push({
      q: `When was ${name} last inspected?`,
      a: `${name} was last inspected ${prep} ${date}. That visit is ${visit}.`,
    });
  }

  if (input.stateCode === "WA" && input.lastComplaintDate) {
    const precision = input.lastComplaintPrecision ?? "month";
    const date = formatRecordDate(input.lastComplaintDate, precision);
    pairs.push({
      q: `When was the most recent DSHS complaint investigation at ${name}?`,
      a: `The most recent DSHS complaint investigation report posted for ${name} is dated ${date}. A complaint investigation responds to a complaint. It is not a routine inspection.`,
    });
  }

  if (
    texasRecentResultsUnpublished(input.stateCode, input.inspectionCount, input.deficiencyCount)
  ) {
    pairs.push({
      q: `Has ${name} published inspection results?`,
      a: texasRecentResultsSentence(input.licenseUrl ?? texasRegulatorRecordUrl()),
    });
  } else if (input.inspectionCount > 0 || (input.complaintCount ?? 0) > 0) {
    const defWord = input.deficiencyCount === 1 ? "deficiency" : "deficiencies";
    const inspWord = input.inspectionCount === 1 ? "inspection" : "inspections";
    const window = input.countsCoverThreeYears ? " in the last three years" : "";
    const complaints = input.complaintCount ?? 0;
    const complaintPhrase =
      complaints > 0
        ? ` and ${complaints} complaint ${complaints === 1 ? "investigation" : "investigations"}`
        : "";
    const cited =
      input.stateCode === "TX" && input.deficiencyCount === 0
        ? "HHSC has not published a citation count for this home in the last 3 years."
        : input.deficiencyCount === 0
          ? `No. ${name} has no ${input.regulatorAbbr} citations${window}.`
          : `Yes. ${name} has ${input.deficiencyCount} ${defWord} from ${input.regulatorAbbr}${window}.`;
    const severity = seriousSentence(
      input.seriousFindings,
      input.stateCode,
      input.publishesSeverityScale,
      input.severityFullyMeasured,
      input.severityScope,
      input.classTypeACount,
    );
    pairs.push({
      q: `Has ${name} been cited by ${input.regulatorAbbr}?`,
      a: input.deficiencyCount > 0 && severity ? `${cited} ${severity}` : cited,
    });
    let answer =
      input.stateCode === "TX" && input.deficiencyCount === 0
        ? "HHSC has not published a citation count for this home in the last 3 years."
        : `${name} has ${input.deficiencyCount} ${defWord} across ${input.inspectionCount} ${inspWord}${complaintPhrase}${window}.`;
    if (input.deficiencyCount > 0 && severity) answer += ` ${severity}`;
    pairs.push({
      q: `How many citations does ${name} have?`,
      a: answer,
    });
  }

  if (input.licenseNumber?.trim()) {
    const license = input.licenseNumber.trim();
    const link = input.licenseUrl ? ` State record: ${input.licenseUrl}` : "";
    const prior = input.previousLicenseUrl
      ? ` Previous license: ${input.previousLicenseUrl}`
      : "";
    const certifies = /medicare|cms/i.test(input.regulatorName);
    pairs.push({
      q: certifies ? `Who certifies ${name}?` : `Who licenses ${name}?`,
      a: certifies
        ? `${input.regulatorName} certifies ${name}. The certification number is ${license}.${link}${prior}`
        : `${input.regulatorName} licenses ${name}. The license number is ${license}.${link}${prior}`,
    });
  }

  const medicaid = medicaidFaqPair({
    name,
    stateCode: input.stateCode,
    orAcceptsMedicaid: input.orAcceptsMedicaid,
  });
  if (medicaid) pairs.push(medicaid);

  const secured = securedUnitFaqPair({
    name,
    stateCode: input.stateCode,
    mcDesignationType: input.mcDesignationType,
    secureBeds: input.secureBeds,
    waMemoryCareCertified: input.waMemoryCareCertified,
    mcProgramQuote: input.mcProgramQuote,
    mcReviewNotes: input.mcReviewNotes,
  });
  if (secured) pairs.push(secured);

  const peer = weightedCitationsPerBedPhrase({
    value: input.severityValue,
    peerMedian: input.severityPeerMedian,
    agencyShort: input.regulatorAbbr,
    windowMonths: input.peerWindowMonths,
  });
  if (peer) {
    pairs.push({
      q: `How does ${name} compare to similar ${input.stateName} facilities?`,
      a: `${peer}. The measure weights each citation by severity. It compares public records; it is not a quality rating.`,
    });
  }

  return pairs;
}

export function buildFacilityFaqSchema(input: FacilityFaqInput): object | null {
  const pairs = buildFacilityFaqPairs(input);
  if (!pairs.length) return null;
  return buildFaqSchemaFromPairs(pairs, input.pageUrl);
}

/**
 * SpeakableSpecification — tells voice / agent surfaces which sections of a
 * hub page are safe to read aloud verbatim. Selectors must match real DOM ids
 * on the rendered page (e.g. #hub-lede, #hub-stats).
 */
export function buildSpeakableSchema(input: {
  url: string;
  cssSelectors: string[];
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: input.url,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: input.cssSelectors,
    },
  };
}
