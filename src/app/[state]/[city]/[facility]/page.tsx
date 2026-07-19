import type { Metadata } from "next";
import { redirect, permanentRedirect } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildFacilityDescription, buildFacilityTitle, clipMetaDescription, REGULATOR_ABBR, shortMonthYear } from "@/lib/seo/meta";
import { stateFromSlug } from "@/lib/states";

import { loadFacilityProfile } from "@/lib/facility/loadFacilityProfile";

// Section components
import { FacilitySubNav } from "@/components/facility/profile/FacilitySubNav";
import { FacilityHero } from "@/components/facility/profile/FacilityHero";
import { FacilityQuickFacts } from "@/components/facility/profile/FacilityQuickFacts";
import { FacilitySnapshot } from "@/components/facility/profile/FacilitySnapshot";
import { FacilityPeerRank } from "@/components/facility/profile/FacilityPeerRank";
import { FacilityRecord } from "@/components/facility/profile/FacilityRecord";
import { FacilityRules, type SerializableRuleCard } from "@/components/facility/profile/FacilityRules";
import { FacilityTourPrep } from "@/components/facility/profile/FacilityTourPrep";
import { FacilityWatchPaid } from "@/components/facility/FacilityWatchPaid";
import { FacilityOfferBar } from "@/components/facility/FacilityOfferBar";
import { FacilityOfferProvider } from "@/components/facility/offer/FacilityOfferProvider";
import { FacilityFullInspections } from "@/components/facility/profile/FacilityFullInspections";
import { FacilitySiblings } from "@/components/facility/profile/FacilitySiblings";
import { assignOffer } from "@/lib/facility/offers";
import { shouldShowPaidFacilityWatch } from "@/lib/facility-watch/paidConfig";

import { AuthorByline } from "@/components/editorial/AuthorByline";
import { ShortlistButton } from "@/components/shortlist/ShortlistButton";

/** State-specific guide pages that exist today — omit links for states without a live article. */
function facilityEditorialLinks(
  stateCode: string,
  stateName: string,
): Array<{ href: string; label: string }> {
  const licensingHref: Partial<Record<string, string>> = {
    TX: "/texas/type-a-b-c-licensing",
    OR: "/oregon/memory-care-licensing",
    WA: "/washington/memory-care-licensing",
    MN: "/minnesota/memory-care-licensing",
    PA: "/pennsylvania/memory-care-licensing",
    AZ: "/arizona/memory-care-licensing",
  };
  const vsNursingHref: Partial<Record<string, string>> = {
    TX: "/texas/memory-care-vs-nursing-home",
    OR: "/oregon/memory-care-vs-nursing-home",
    WA: "/washington/memory-care-vs-nursing-home",
    MN: "/minnesota/memory-care-vs-nursing-home",
    PA: "/pennsylvania/memory-care-vs-nursing-home",
    AZ: "/arizona/memory-care-vs-nursing-home",
  };

  const links: Array<{ href: string; label: string }> = [];

  if (stateCode === "CA") {
    links.push({
      href: "/library/type-a-vs-type-b-deficiencies-explained",
      label: "Understanding citations: Type A vs. Type B deficiencies →",
    });
  } else {
    const lic = licensingHref[stateCode];
    if (lic) links.push({ href: lic, label: `Memory care licensing in ${stateName} →` });
  }

  links.push({ href: "/library/when-is-it-time-for-memory-care", label: "When is it time for memory care? →" });
  links.push({ href: "/library/memory-care-vs-nursing-home", label: "Memory care vs. nursing home →" });

  if (stateCode === "CA") {
    links.push({ href: "/california/cost-guide", label: "What memory care costs in California →" });
  } else if (stateCode === "PA") {
    links.push({ href: "/pennsylvania/what-is-a-personal-care-home", label: "What is a personal care home in Pennsylvania? →" });
    links.push({ href: "/pennsylvania/personal-care-home-vs-assisted-living", label: "Personal care home vs. assisted living →" });
    links.push({ href: "/pennsylvania/personal-care-home-cost", label: "What does a PA personal care home cost? →" });
  } else {
    const vs = vsNursingHref[stateCode];
    if (vs) links.push({ href: vs, label: `Memory care vs. nursing home in ${stateName} →` });
  }

  links.push({ href: "/methodology", label: "Our inspection scoring methodology →" });

  return links;
}

// Kept components
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { RelatedFacilities } from "@/components/facility/RelatedFacilities";
import { MetroNearbyFacilities } from "@/components/facility/MetroNearbyFacilities";
import { SameOperatorFacilities } from "@/components/facility/SameOperatorFacilities";
import { FacilityBrowseLinks } from "@/components/facility/FacilityBrowseLinks";
import { ReportListingForm } from "@/components/facility/ReportListingForm";

export const revalidate = 3600;
export const maxDuration = 60;

type PageProps = {
  params: Promise<{ state: string; city: string; facility: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state: stateSlug, city: citySlug, facility: facilitySlug } = await params;
  const state = stateFromSlug(stateSlug);
  if (!state) return { title: "Facility | StarlynnCare" };

  const result = await loadFacilityProfile({ stateSlug, regionSlug: citySlug, facilitySlug });
  if (result === "not_found" || result === "unconfigured") {
    return { title: "Facility | StarlynnCare" };
  }
  // Redirect (clean-slug alias or city-slug rewrite) — metadata generated after resolution.
  if (typeof result === "object" && "kind" in result && result.kind === "redirect") {
    return { title: "Facility | StarlynnCare" };
  }

  const profile = result as import("@/lib/facility/loadFacilityProfile").FacilityProfile;
  const { facility } = profile;
  const canonical = canonicalFor(`/${state.slug}/${facility.city_slug}/${facility.slug}`);

  // Data-driven meta title + description.
  const lastInspectionDate =
    profile.inspections.find((i) => !i.is_complaint)?.inspection_date ?? null;
  const compositePercentile = profile.snapshot?.grade?.composite_percentile ?? null;

  const title = buildFacilityTitle({
    name: facility.name,
    stateName: state.name,
    percentile: compositePercentile,
    city: facility.city ?? state.name,
    citationCount: profile.totals.deficiencies,
  });

  const desc = clipMetaDescription(
    buildFacilityDescription({
      name: facility.name,
      percentile: compositePercentile,
      stateName: state.name,
      city: facility.city ?? state.name,
      citationCount: profile.totals.deficiencies,
      agency: REGULATOR_ABBR[state.code] ?? state.code,
      lastInspected: shortMonthYear(lastInspectionDate),
    }),
  );

  // Thin-page guardrail: only noindex when the page has effectively no content
  // (no inspections, no reviews, no tour Q&A, no photo). Verified <1% of the
  // publishable index meets this bar across CA/TX/OR/WA/MN, so this stays a
  // future-proof guard rather than removing live pages from search.
  const tourQs = (facility.content as { tour_questions?: string[] } | null)
    ?.tour_questions;
  const isThin =
    profile.totals.inspections === 0 &&
    profile.reviews.length === 0 &&
    (tourQs?.length ?? 0) === 0 &&
    profile.photoUrls.length === 0;

  return {
    title,
    description: desc,
    alternates: { canonical },
    ...(isThin ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description: desc,
      url: canonical,
      type: "website",
      images: [{ url: facility.photo_url ?? "/og-default.png", alt: facility.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [facility.photo_url ?? "/og-default.png"],
    },
  };
}

export default async function FacilityPage({ params }: PageProps) {
  const { state: stateSlug, city: regionSlug, facility: facilitySlug } = await params;

  const result = await loadFacilityProfile({ stateSlug, regionSlug, facilitySlug });

  // Supabase not configured — show a dev hint
  // Permanent redirect: covers two cases:
  //   1. Clean-slug alias → canonical suffixed slug (same city, e.g. ecumen-north-branch → ecumen-north-branch-mn652)
  //   2. City-slug rewrite after Census Geocoder (e.g. /utah/salt-lake-city/monument-… → /utah/taylorsville/monument-…)
  if (typeof result === "object" && result !== null && "kind" in result && result.kind === "redirect") {
    const canonicalCity = result.canonicalCitySlug ?? regionSlug;
    permanentRedirect(`/${stateSlug}/${canonicalCity}/${result.canonicalSlug}`);
  }

  if (result === "unconfigured") {
    return (
      <>
        <SiteNav badge="" />
        <main className="border-b border-sc-border bg-paper px-6 py-20 md:px-8">
          <div className="mx-auto max-w-[680px] rounded-lg border border-gold/30 bg-gold-soft px-5 py-4 text-sm text-ink-2">
            <p className="font-semibold text-gold">Configuration</p>
            <p className="mt-2">
              Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  // Unpublished or missing facility — redirect to city hub rather than hard 404.
  // Preserves crawl budget for the ~550 previously-crawled-but-unpublishable URLs.
  if (result === "not_found") redirect(`/${stateSlug}/${regionSlug}`);

  const profile = result as import("@/lib/facility/loadFacilityProfile").FacilityProfile;
  const { facility, state, county, backHref, backLabel } = profile;
  const offer = assignOffer(facility.id, facility.state_code);
  const showPaidWatch = shouldShowPaidFacilityWatch(facility.state_code);

  return (
    <>
      <JsonLd objects={profile.jsonLd} />
      {/* DOM reorder: <main> (H1) is first in source; GovernanceBar+SiteNav use flex order:-1 to appear visually above it. */}
      <div className="flex flex-col">
        <FacilityOfferProvider
          offer={offer}
          facilityId={facility.id}
          facilityName={facility.name}
        >
        <main className="bg-paper">
        {/* Sticky sub-nav */}
        <FacilitySubNav profile={profile} />

        {/* § 00 · Hero */}
        <FacilityHero profile={profile} />

        {/*
          Mobile-first ordering. High-intent mobile visitors must reach the hard
          facts (peer rank + citation record) before the photo/map context.
          Below md we reorder via CSS `order`; at md+ everything resets to the
          editorial source order (QuickFacts → Snapshot → Peer → CTAs → Record).
          DOM order is unchanged, so SEO/E-E-A-T crawl order is preserved.
        */}
        <div className="flex flex-col">
          {/* Quick facts strip */}
          <div className="order-1 md:order-none">
            <FacilityQuickFacts profile={profile} />
          </div>

          {/* § 01 · Snapshot — gallery + map (deferred below the facts on mobile) */}
          <div className="order-6 md:order-none">
            <FacilitySnapshot profile={profile} />
          </div>

          {/* § 02 · Peer comparison — dark band */}
          <div className="order-2 md:order-none">
            <FacilityPeerRank profile={profile} />
          </div>

          {/* § 02b · Facility Watch Premium — replaces free enrollment */}
          {showPaidWatch && (
            <div className="order-4 md:order-none">
              <FacilityWatchPaid
                facilityId={facility.id}
                facilityName={facility.name}
              />
            </div>
          )}

          {/* Shortlist save — shown alongside watch; both are conversion actions */}
          <div className="order-5 md:order-none border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-4 flex items-center gap-4">
              <span className="text-sm text-ink-3">Save for comparison:</span>
              <ShortlistButton
                pill
                item={{
                  id: facility.id,
                  name: facility.name,
                  slug: facility.slug,
                  city_slug: facility.city_slug,
                  state_slug: state.slug,
                  city: facility.city ?? null,
                  beds: facility.beds ?? null,
                  total_citations: profile.totals.deficiencies,
                  serious_citations: profile.totals.typeA,
                  inspections: profile.totals.inspections,
                  care_category: facility.care_category,
                }}
              />
            </div>
          </div>

          {/* § 03 · Citation record — timeline + heatmap + inspection list */}
          <div className="order-3 md:order-none">
            <FacilityRecord profile={profile} />
          </div>
        </div>

        {/* § 04 · Rulebook accordion (hidden when state has no rules configured) */}
        <FacilityRules rulesCards={profile.rulesCards.map(({ id, icon, question, regCite, plain, ask, citedDate }) => ({ id, icon, question, regCite, plain, ask, citedDate } satisfies SerializableRuleCard))} />

        {/* § 05 · Tour prep cards (hidden when < 3 tour questions) */}
        <FacilityTourPrep profile={profile} />

        {/* § 07 · Full verbatim inspection record */}
        <FacilityFullInspections profile={profile} />

        {/* Methodology credibility cap — RN reviewer, placed after the verbatim
            findings (the "View raw inspection records" target). Kept in DOM for
            E-E-A-T; sits below the data as an editorial sign-off, not a top byline. */}
        <div className="border-y border-paper-rule bg-paper-2">
          <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-8 md:py-9">
            <AuthorByline bare />
          </div>
        </div>

        {/* § 08 · Nearby sibling facilities */}
        <FacilitySiblings profile={profile} />

        {/* Sticky Watch bar — fixed position, shown at 40% scroll or 20s */}
        <FacilityOfferBar />

        {/* Reviews, discovery, and correction form */}
        <div className="mx-auto max-w-[1280px] space-y-14 px-4 pb-20 pt-14 md:px-8">
          <ReviewsSection
            facilityId={facility.id}
            initialReviews={profile.reviews}
          />

          <FacilityBrowseLinks
            cityDisplayName={
              facility.city ??
              facility.city_slug
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())
            }
            citySlug={facility.city_slug}
            stateSlug={state.slug}
            stateDisplayName={state.name}
            county={county}
          />

          <RelatedFacilities
            facilityId={facility.id}
            citySlug={facility.city_slug}
            stateSlug={state.slug}
          />

          <MetroNearbyFacilities
            facilityId={facility.id}
            citySlug={facility.city_slug}
            stateSlug={state.slug}
          />

          <SameOperatorFacilities
            facilityId={facility.id}
            operatorName={facility.operator_name}
            stateSlug={state.slug}
          />

          {/* Editorial resource links */}
          <div className="border-t border-paper-rule pt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6 text-[13.5px]">
            {facilityEditorialLinks(facility.state_code, state.name).map(({ href, label }) => (
              <a key={href} href={href} className="text-teal hover:underline underline-offset-4">
                {label}
              </a>
            ))}
          </div>

          <ReportListingForm facilityId={facility.id} facilityName={facility.name} />
        </div>
        </main>
        </FacilityOfferProvider>
        <div className="-order-1">
          <GovernanceBar />
          <SiteNav countStateCode={facility.state_code} badge={state.name} ctaHref={`/${state.slug}/facilities`} ctaLabel={`Browse ${state.name} facilities`} stateNavHref={`/${state.slug}`} />
        </div>
      </div>

      <SiteFooter />
    </>
  );
}
