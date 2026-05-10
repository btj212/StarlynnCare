import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { clipMetaDescription } from "@/lib/seo/meta";
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

  // Light load — just need name for the meta title
  const result = await loadFacilityProfile({ stateSlug, regionSlug: citySlug, facilitySlug });
  if (result === "not_found" || result === "unconfigured") {
    return { title: "Facility | StarlynnCare" };
  }

  const { facility } = result;
  const canonical = canonicalFor(`/${state.slug}/${facility.city_slug}/${facility.slug}`);

  const agencyByState: Record<string, string> = {
    CA: "primary CDSS licensing data",
    TX: "HHSC Long-Term Care Regulation records",
    OR: "Oregon DHS LTC Licensing data",
    WA: "Washington DSHS ALF inspection records",
    MN: "Minnesota Department of Health licensing records",
  };
  const agencyDesc = agencyByState[state.code] ?? "primary state licensing data";
  const desc = clipMetaDescription(
    `Inspection records, citation history, and quality context for ${facility.name}${facility.city ? ` in ${facility.city}, ${state.name}` : ""} — verified from ${agencyDesc} by StarlynnCare.`,
  );

  return {
    title: `${facility.name} | StarlynnCare`,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: `${facility.name} | StarlynnCare`,
      description: desc,
      url: canonical,
      type: "website",
      images: [{ url: facility.photo_url ?? "/og-default.png", alt: facility.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${facility.name} | StarlynnCare`,
      description: desc,
      images: [facility.photo_url ?? "/og-default.png"],
    },
  };
}

export default async function FacilityPage({ params }: PageProps) {
  const { state: stateSlug, city: regionSlug, facility: facilitySlug } = await params;

  const result = await loadFacilityProfile({ stateSlug, regionSlug, facilitySlug });

  // Supabase not configured — show a dev hint
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

  const profile = result;
  const { facility, state, county, backHref, backLabel } = profile;

  return (
    <>
      <JsonLd objects={profile.jsonLd} />
      <GovernanceBar />
      <SiteNav countStateCode={facility.state_code} badge={state.name} ctaHref={`/${state.slug}`} ctaLabel={`${state.name} memory care facilities`} />

      <main className="bg-paper">
        {/* Sticky sub-nav */}
        <FacilitySubNav profile={profile} />

        {/* § 00 · Hero */}
        <FacilityHero profile={profile} />

        {/* Quick facts strip */}
        <FacilityQuickFacts profile={profile} />

        {/* § 01 · Snapshot — gallery + map */}
        <FacilitySnapshot profile={profile} />

        {/* § 02 · Peer comparison — dark band */}
        <FacilityPeerRank profile={profile} />

        {/* § 03 · Citation record — timeline + heatmap + inspection list */}
        <FacilityRecord profile={profile} />

        {/* § 04 · Rulebook accordion (hidden when state has no rules configured) */}
        <FacilityRules rulesCards={profile.rulesCards.map(({ id, icon, question, regCite, plain, ask, citedDate }) => ({ id, icon, question, regCite, plain, ask, citedDate } satisfies SerializableRuleCard))} />

        {/* § 05 · Tour prep cards (hidden when < 3 tour questions) */}
        <FacilityTourPrep profile={profile} />

        {/* § 06 · Full verbatim inspection record */}
        <FacilityFullInspections profile={profile} />

        {/* § 07 · Nearby sibling facilities */}
        <FacilitySiblings profile={profile} />

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

      <SiteFooter />
    </>
  );
}
