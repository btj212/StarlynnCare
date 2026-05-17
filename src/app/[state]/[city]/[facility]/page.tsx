import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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
import { FacilityWatchSignup } from "@/components/facility/FacilityWatchSignup";
import { FacilityWatchBar } from "@/components/facility/FacilityWatchBar";
import { FacilityWatchModal } from "@/components/facility/FacilityWatchModal";
import { FacilityFullInspections } from "@/components/facility/profile/FacilityFullInspections";
import { FacilitySiblings } from "@/components/facility/profile/FacilitySiblings";

// Kept components
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { RelatedFacilities } from "@/components/facility/RelatedFacilities";
import { MetroNearbyFacilities } from "@/components/facility/MetroNearbyFacilities";
import { SameOperatorFacilities } from "@/components/facility/SameOperatorFacilities";
import { FacilityBrowseLinks } from "@/components/facility/FacilityBrowseLinks";
import { ReportListingForm } from "@/components/facility/ReportListingForm";

export const revalidate = 3600;

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
  // Clean-slug alias — metadata will be generated after the 301 redirect resolves.
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
  // Clean-slug redirect: e.g. /minnesota/north-branch/ecumen-north-branch
  // → /minnesota/north-branch/ecumen-north-branch-mn652
  if (typeof result === "object" && result !== null && "kind" in result && result.kind === "redirect") {
    redirect(`/${stateSlug}/${regionSlug}/${result.canonicalSlug}`);
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

  if (result === "not_found") notFound();

  const profile = result as import("@/lib/facility/loadFacilityProfile").FacilityProfile;
  const { facility, state, county, backHref, backLabel } = profile;

  return (
    <>
      <JsonLd objects={profile.jsonLd} />
      {/* DOM reorder: <main> (H1) is first in source; GovernanceBar+SiteNav use flex order:-1 to appear visually above it. */}
      <div className="flex flex-col">
        <main className="bg-paper">
        {/* Sticky sub-nav */}
        <FacilitySubNav profile={profile} />

        {/* § 00 · Hero */}
        <FacilityHero profile={profile} />
        <FacilityWatchModal facilityId={facility.id} facilityName={facility.name} />

        {/* Quick facts strip */}
        <FacilityQuickFacts profile={profile} />

        {/* § 01 · Snapshot — gallery + map */}
        <FacilitySnapshot profile={profile} />

        {/* § 02 · Peer comparison — dark band */}
        <FacilityPeerRank profile={profile} />

        {/* § 02b · Facility Watch — inline strip (citation-aware copy) */}
        <FacilityWatchSignup
          facilityId={facility.id}
          facilityName={facility.name}
          citationCount={profile.totals.deficiencies}
        />

        {/* § 03 · Citation record — timeline + heatmap + inspection list */}
        <FacilityRecord profile={profile} />

        {/* § 04 · Rulebook accordion (hidden when state has no rules configured) */}
        <FacilityRules rulesCards={profile.rulesCards.map(({ id, icon, question, regCite, plain, ask, citedDate }) => ({ id, icon, question, regCite, plain, ask, citedDate } satisfies SerializableRuleCard))} />

        {/* § 05 · Tour prep cards (hidden when < 3 tour questions) */}
        <FacilityTourPrep profile={profile} />

        {/* § 07 · Full verbatim inspection record */}
        <FacilityFullInspections profile={profile} />

        {/* Free-tier display cap notice */}
        {profile.hiddenOlderCount > 0 && profile.oldestHiddenYear !== null && (
          <div className="mx-auto max-w-[1280px] px-4 md:px-8 pb-2">
            <p className="text-[12.5px] text-ink-3 font-[family-name:var(--font-mono)]">
              {profile.hiddenOlderCount} older inspection{profile.hiddenOlderCount !== 1 ? "s" : ""}{" "}
              ({profile.oldestHiddenYear}–{new Date().getFullYear() - 3}) are available with a premium membership.
            </p>
          </div>
        )}

        {/* § 08 · Nearby sibling facilities */}
        <FacilitySiblings profile={profile} />

        {/* Sticky Watch bar — fixed position, shown at 40% scroll or 20s */}
        <FacilityWatchBar facilityId={facility.id} facilityName={facility.name} />

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
            {([
              facility.state_code === "CA"
                ? { href: "/library/type-a-vs-type-b-deficiencies-explained", label: "Understanding citations: Type A vs. Type B deficiencies →" }
                : { href: `/${state.slug}/memory-care-licensing`, label: `Memory care licensing in ${state.name} →` },
              { href: "/library/when-is-it-time-for-memory-care", label: "When is it time for memory care? →" },
              { href: "/library/memory-care-vs-nursing-home", label: "Memory care vs. nursing home →" },
              facility.state_code === "CA"
                ? { href: "/california/cost-guide", label: "What memory care costs in California →" }
                : { href: `/${state.slug}/memory-care-vs-nursing-home`, label: `Memory care costs in ${state.name} →` },
              { href: "/methodology", label: "Our inspection scoring methodology →" },
            ] as { href: string; label: string }[]).map(({ href, label }) => (
              <a key={href} href={href} className="text-teal hover:underline underline-offset-4">
                {label}
              </a>
            ))}
          </div>

          <ReportListingForm facilityId={facility.id} facilityName={facility.name} />
        </div>
        </main>
        <div className="-order-1">
          <GovernanceBar />
          <SiteNav countStateCode={facility.state_code} badge={state.name} ctaHref={`/${state.slug}/facilities`} ctaLabel={`Browse ${state.name} facilities`} stateNavHref={`/${state.slug}`} />
        </div>
      </div>

      <SiteFooter />
    </>
  );
}
