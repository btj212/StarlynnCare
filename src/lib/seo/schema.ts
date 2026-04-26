import type { Review } from "@/components/reviews/ReviewCard";
import type { Facility } from "@/lib/types";
import type { StateInfo } from "@/lib/states";
import type { Region } from "@/lib/regions";
import { STARLYNN_EDITORIAL_REVIEWER } from "@/lib/seo/editor";
import { SITE_ORIGIN, canonicalFor } from "@/lib/seo/canonical";

export type BreadcrumbItem = { name: string; url: string };

/** CDSS Community Care Licensing public facility detail (FacDetail). */
export function cdssLicensePageFor(
  licenseNumber: string | null | undefined,
): string | null {
  if (licenseNumber == null || !String(licenseNumber).trim()) return null;
  const facNum = String(licenseNumber).trim();
  return `https://www.ccld.dss.ca.gov/carefacilitysearch/?rewrite=FacDetail&facNum=${encodeURIComponent(facNum)}`;
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

function facilityDescription(facility: Facility): string {
  const parts: string[] = [];
  if (facility.content?.headline) parts.push(facility.content.headline);
  else if (facility.content?.intro) parts.push(facility.content.intro.slice(0, 500));
  else {
    parts.push(
      `Licensed memory care profile for ${facility.name}${facility.city ? ` in ${facility.city}, California` : ""}, with state inspection context from StarlynnCare.`,
    );
  }
  return parts.join(" ").slice(0, 5000);
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
  opts: { canonicalUrl: string; reviews?: Review[] },
): object {
  const businessId = `${opts.canonicalUrl}#business`;
  const sameAs: string[] = [];
  const cdss = cdssLicensePageFor(facility.license_number);
  if (cdss) sameAs.push(cdss);
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
    description: facilityDescription(facility),
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
  reviewerName?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    reviewedBy: {
      "@type": "Person",
      name: input.reviewerName ?? STARLYNN_EDITORIAL_REVIEWER,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "StarlynnCare",
      url: SITE_ORIGIN,
    },
  };
}

export function buildOrganizationSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "StarlynnCare",
    url: SITE_ORIGIN,
    description:
      "StarlynnCare publishes verified California CDSS inspection records and family reviews for licensed memory care facilities.",
    sameAs: [canonicalFor("/methodology"), canonicalFor("/data")],
  };
}

export function buildWebSiteSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "StarlynnCare",
    url: SITE_ORIGIN,
    publisher: { "@type": "Organization", name: "StarlynnCare" },
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
