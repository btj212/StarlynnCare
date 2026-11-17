import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { SectionHead } from "@/components/editorial/SectionHead";
import {
  InspectionFullText,
  inspectionFacts,
} from "@/components/facility/profile/inspectionBlocks";
import { loadFacilityProfile, type FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { visitKindLabel } from "@/lib/facility/visitLabel";
import { formatFacilityName } from "@/lib/facility/displayName";
import { displayCityName } from "@/lib/resolveListingRegion";
import { canonicalFor } from "@/lib/seo/canonical";
import { facilityMarkedNoindex } from "@/lib/seo/indexability";
import { buildFacilityReportsTitle, clipMetaDescription } from "@/lib/seo/meta";
import { buildBreadcrumbList, buildWebPageWithReviewer } from "@/lib/seo/schema";
import { stateFromSlug } from "@/lib/states";

export const revalidate = 3600;
export const maxDuration = 60;

type PageProps = {
  params: Promise<{ state: string; city: string; facility: string }>;
};

function isProfile(result: Awaited<ReturnType<typeof loadFacilityProfile>>): result is FacilityProfile {
  return typeof result === "object" && result !== null && "facility" in result;
}

function hasPrintableFindings(profile: FacilityProfile): boolean {
  return profile.inspections.some((insp) =>
    inspectionFacts(insp, profile.deficienciesByInspection.get(insp.id) ?? []).hasFullCitationBody,
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state: stateSlug, city: citySlug, facility: facilitySlug } = await params;
  const state = stateFromSlug(stateSlug);
  const result = await loadFacilityProfile({ stateSlug, regionSlug: citySlug, facilitySlug });
  if (!state || !isProfile(result)) {
    return { title: "Inspection reports | StarlynnCare", robots: { index: false, follow: true } };
  }

  const { facility } = result;
  const city = displayCityName(facility.city, facility.city_slug) || state.name;
  const name = formatFacilityName(facility.name);
  const title = buildFacilityReportsTitle({ name, stateName: state.name, city });
  const canonical = canonicalFor(
    `/${state.slug}/${facility.city_slug}/${facility.slug}/inspections`,
  );
  const description = clipMetaDescription(
    `Every citation ${result.cfg.agencyShort} wrote at ${name} in ${city} over the last three years, in the inspector's words, with the home's plan of correction where the state publishes one.`,
  );

  const tourQs = (facility.content as { tour_questions?: string[] } | null)?.tour_questions;
  const noindex =
    facilityMarkedNoindex({
      stateCode: facility.state_code,
      beds: facility.beds,
      deficiencyCount: result.totals.allTimeDeficiencies,
      inspectionCount: result.totals.inspections,
      reviewCount: result.reviews.length,
      tourQuestionCount: tourQs?.length ?? 0,
      photoCount: result.photoUrls.length,
    }) || !hasPrintableFindings(result);

  return {
    title,
    description,
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

export default async function FacilityInspectionsPage({ params }: PageProps) {
  const { state: stateSlug, city: regionSlug, facility: facilitySlug } = await params;
  const result = await loadFacilityProfile({ stateSlug, regionSlug, facilitySlug });

  if (typeof result === "object" && result !== null && "kind" in result && result.kind === "redirect") {
    const canonicalCity = result.canonicalCitySlug ?? regionSlug;
    permanentRedirect(`/${stateSlug}/${canonicalCity}/${result.canonicalSlug}/inspections`);
  }
  if (result === "not_found") redirect(`/${stateSlug}/${regionSlug}`);
  if (!isProfile(result)) notFound();

  const profile = result;
  const { facility, state, cfg, inspections, deficienciesByInspection } = profile;
  const name = formatFacilityName(facility.name);
  const city = displayCityName(facility.city, facility.city_slug) || state.name;
  const profileHref = `/${state.slug}/${facility.city_slug}/${facility.slug}`;
  const pageUrl = canonicalFor(`${profileHref}/inspections`);

  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: state.name, url: canonicalFor(`/${state.slug}`) },
      { name: city, url: canonicalFor(`/${state.slug}/${facility.city_slug}`) },
      { name, url: canonicalFor(profileHref) },
      { name: "Inspection reports", url: pageUrl },
    ]),
    buildWebPageWithReviewer({
      name: `${name}: inspection reports and citations`,
      url: pageUrl,
    }),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar scope={facility.state_code} />
      <SiteNav
        countStateCode={facility.state_code}
        badge={state.name}
        ctaHref={`/${state.slug}/facilities`}
        ctaLabel={`Browse ${state.name} facilities`}
        stateNavHref={`/${state.slug}`}
      />
      <main className="bg-paper">
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 md:px-[60px]">
            <nav
              aria-label="Breadcrumb"
              className="mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink-3"
            >
              <Link href={`/${state.slug}`} className="hover:text-ink">{state.name}</Link>
              {" / "}
              <Link href={`/${state.slug}/${facility.city_slug}`} className="hover:text-ink">{city}</Link>
              {" / "}
              <Link href={profileHref} className="hover:text-ink">{name}</Link>
            </nav>
            <h1
              className="mb-4 font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink"
              style={{ fontSize: "clamp(32px, 4.2vw, 52px)", lineHeight: 1.07 }}
            >
              {name}: <em className="text-rust not-italic">inspection reports</em>
            </h1>
            <p className="max-w-[62ch] text-[17px] leading-relaxed text-ink-3">
              The {cfg.agencyShort} record for {name} in {city}, {state.code}: every visit in the last
              three years, with each citation in the inspector&rsquo;s own words.{" "}
              <Link href={profileHref} className="font-semibold text-teal underline underline-offset-4">
                Back to the profile and its summaries
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 md:px-[60px]">
          {inspections.length === 0 ? (
            <p className="text-[15px] text-ink-3">
              No inspection visits in the last three years are on file for this home.
            </p>
          ) : (
            <>
              <SectionHead
                label="Full record"
                title={
                  <>
                    {inspections.length} {inspections.length === 1 ? "visit" : "visits"}, <em>most recent first.</em>
                  </>
                }
              />
              <div className="space-y-6">
                {inspections.map((insp) => {
                  const defs = deficienciesByInspection.get(insp.id) ?? [];
                  return (
                    <section
                      key={insp.id}
                      id={`inspection-${insp.id}`}
                      className="scroll-mt-28 rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-5 py-5 shadow-[var(--shadow-card)] md:px-7"
                    >
                      <h2 className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.04em] text-ink-2">
                          {insp.inspection_date}
                        </span>
                        <span className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] text-ink">
                          {visitKindLabel(insp)}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-ink-3">
                          {defs.length === 0
                            ? "No findings"
                            : `${defs.length} ${defs.length === 1 ? "finding" : "findings"}`}
                        </span>
                      </h2>
                      <InspectionFullText insp={insp} defs={defs} cfg={cfg} />
                    </section>
                  );
                })}
              </div>
            </>
          )}
          {cfg.regulatorPortalUrl && (
            <p className="mt-8 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.06em] text-ink-3">
              Source: {cfg.agencyLong}.{" "}
              <a
                href={cfg.regulatorPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-b border-rust pb-px text-rust"
              >
                {cfg.agencyShort} inspection portal →
              </a>
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
