import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SectionHead } from "@/components/editorial/SectionHead";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { stateFromSlug } from "@/lib/states";
import { regionsForState, type Region } from "@/lib/regions";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { REGULATOR_ABBR, buildStateHubTitle, clipMetaDescription } from "@/lib/seo/meta";
import {
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
  buildStateHubCollectionPage,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";
import { OR_FAQS, WA_FAQS, MN_FAQS, TX_FAQS, CO_FAQS, type FaqItem } from "@/lib/content/stateFaqs";
import { getStateHubConfig } from "@/lib/stateHubConfigs";
import { careSettingCopy } from "@/lib/city-hub/careSetting";
import { quoteHomesOnPage } from "@/lib/city-hub/dedupe";
import { loadPublishableCityRows, loadStateHubData } from "@/lib/data/stateHub";
import { cityHubPageExists } from "@/lib/seo/indexability";
import { StateHubSections } from "@/components/state-hub/StateHubSections";
import {
  SampleFacilityRotationProvider,
} from "@/components/home/SampleFacilityRotation";
import { MobileStickyCtaBar } from "@/components/mobile/MobileStickyCtaBar";
import { MobileStateHubView } from "@/components/mobile/MobileStateHubView";
import { AreaWatchModal } from "@/components/facility/AreaWatchModal";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ state: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const state = stateFromSlug(stateSlug);
  if (!state) return { title: "State not found | StarlynnCare" };
  const canonical = canonicalFor(`/${state.slug}`);
  const reg = REGULATOR_ABBR[state.code] ?? "state";

  // Data-driven snippet — pull live stats (facility count, severe deficiency count,
  // refresh date) from the same loader the page render uses. Falls back to the
  // legacy templated copy when Supabase isn't configured or the loader returns 0.
  const hub = await loadStateHubData(state.code);
  const facilityCount = hub.stats.facilities;
  const severeCount = hub.stats.severeCitations;
  const refreshed = hub.stats.lastRefreshed;

  const dataDriven =
    facilityCount > 0
      ? state.code === "CO"
        ? `${facilityCount} memory care facilities across Colorado. Assisted living records are from CDPHE. Nursing homes are from CMS. The two are not ranked together.`
        : state.code === "AZ"
        ? `${facilityCount} Directed Care licensed homes across ${state.name} — Arizona authorizes these homes to provide memory care services (A.A.C. R9-10-816). ${severeCount} severe deficiencies in the last 24 months (${reg}). Independent ${reg} data, no commissions${refreshed ? `, refreshed ${refreshed}` : ""}.`
        : state.code === "WA"
        ? `${facilityCount} Washington assisted living and adult family homes that serve people with dementia. ${severeCount} severe deficiencies in the last 24 months (${reg}). Independent ${reg} data, no commissions${refreshed ? `, refreshed ${refreshed}` : ""}.`
        : state.code === "PA"
        ? `Pennsylvania personal care home license search and inspection records. ${facilityCount} licensed PCH and ALR homes on file. Official lookup is the DHS provider directory; we publish the inspection record. Independent ${reg} data, no commissions${refreshed ? `, refreshed ${refreshed}` : ""}.`
        : `${facilityCount} licensed memory care facilities across ${state.name}. ${severeCount} severe deficiencies in the last 24 months (${reg}). Independent ${reg} data, no commissions${refreshed ? `, refreshed ${refreshed}` : ""}.`
      : null;

  const fallbackByCode: Record<string, string> = {
    CA: `Inspection records and citation history for every licensed memory care facility in ${state.name} — from primary CDSS data, updated weekly.`,
    TX: `HHSC-sourced inspection listings for Alzheimer-certified assisted living across Texas metro regions — scope and methodology on-site.`,
    OR: `Oregon DHS inspection records for every Memory Care Endorsed ALF and RCF across Oregon — sourced from the DHS LTC Licensing portal.`,
    WA: `DSHS inspection and investigation records for Washington assisted living facilities and adult family homes that serve people with dementia — sourced from the DSHS ALF Reports portal. A Specialized Dementia Care contract is labeled when DSHS records it.`,
    MN: `MDH inspection records for every licensed Assisted Living Facility with Dementia Care across Minnesota — sourced from the MN Department of Health.`,
    CO: `CDPHE assisted-living records and CMS nursing-home surveys for Colorado. The two care settings are not ranked together, and CDPHE does not publish a memory-care roster.`,
  };
  const desc = clipMetaDescription(
    dataDriven ??
      fallbackByCode[state.code] ??
      `Inspection records and citation history for every licensed memory care facility in ${state.name}.`,
  );
  const title = buildStateHubTitle(state.name, reg, state.code);
  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: { title, description: desc, url: canonical, type: "website", images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }] },
    twitter: { card: "summary_large_image", title, description: desc, images: ["/og-default.png"] },
  };
}

export default async function StatePage({ params }: PageProps) {
  const { state: stateSlug } = await params;
  const state = stateFromSlug(stateSlug);
  if (!state) notFound();

  // Rich hub: if a per-state config exists, render the full state hub UI.
  const richConfig = getStateHubConfig(stateSlug);
  if (richConfig) {
    const data = await loadStateHubData(state.code);
    const stateJsonLd = [
      buildBreadcrumbList([
        { name: "Home", url: canonicalFor("/") },
        { name: careSettingCopy(state.code).collectionName(state.name), url: canonicalFor(`/${state.slug}`) },
      ]),
      buildWebPageWithReviewer({
        name: buildStateHubTitle(state.name, REGULATOR_ABBR[state.code] ?? "state", state.code),
        url: canonicalFor(`/${state.slug}`),
        description: `Inspection-backed ${careSettingCopy(state.code).hubNoun} across ${state.name} — verified by real state inspection records.`,
        datePublished: data.stats.firstPublishedAt,
        dateModified: data.stats.lastRefreshed,
      }),
      buildStateHubCollectionPage({
        name: careSettingCopy(state.code).collectionName(state.name),
        url: canonicalFor(`/${state.slug}`),
        state,
        datePublished: data.stats.firstPublishedAt,
        dateModified: data.stats.lastRefreshed,
      }),
      buildFaqSchemaFromPairs(richConfig.faqs.map((f) => ({ q: f.q, a: f.a })), canonicalFor(`/${state.slug}`)),
    ];
    return (
      <>
        <JsonLd objects={stateJsonLd} />
        <SampleFacilityRotationProvider facilities={data.gradeCardFacilities}>
          <div className="m-app md:hidden">
            <main>
              <MobileStateHubView data={data} config={richConfig} />
            </main>
          </div>
          <MobileStickyCtaBar />
          <div className="hidden md:block">
            <GovernanceBar scope={state.code} />
            <SiteNav
              countStateCode={state.code}
              badge={state.name}
              ctaHref={`/${state.slug}/facilities`}
              ctaLabel={`${state.name} memory care facilities`}
              stateNavHref={`/${state.slug}`}
            />
            {state.code !== "CO" && (
              <AreaWatchModal areaName={state.name} areaSlug={state.slug} stateCode={state.code} source="state_modal" delayMs={20000} />
            )}
            <main>
              <StateHubSections data={data} config={richConfig} />
            </main>
            <SiteFooter />
          </div>
        </SampleFacilityRotationProvider>
      </>
    );
  }

  const regions = regionsForState(state.code);
  const counties = regions.filter((r) => r.kind === "county");
  const cities = regions.filter((r) => r.kind === "city");

  const supabase = tryPublicSupabaseClient();
  const countsByCity = new Map<string, number>();
  let totalPublishable = 0;
  let fetchError: string | null = null;
  let stateLastRefreshed: string | null = null;
  let stateFirstPublishedAt: string | null = null;

  const slugDisplayName = new Map<string, string>();
  type CitySourceRow = {
    id: string;
    name: string | null;
    zip: string | null;
    city_slug: string | null;
  };
  let sourceRows: CitySourceRow[] = [];

  if (supabase) {
    const [cityRes, refreshRes, firstRes] = await Promise.all([
      loadPublishableCityRows(supabase, state.code),
      supabase.from("facilities").select("updated_at").eq("state_code", state.code).eq("publishable", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("facilities").select("created_at").eq("state_code", state.code).eq("publishable", true).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);
    stateLastRefreshed = (refreshRes.data as { updated_at: string } | null)?.updated_at
      ? new Date((refreshRes.data as { updated_at: string }).updated_at).toISOString().split("T")[0]
      : null;
    stateFirstPublishedAt = (firstRes.data as { created_at: string } | null)?.created_at
      ? new Date((firstRes.data as { created_at: string }).created_at).toISOString()
      : null;
    if (cityRes.error) {
      fetchError = cityRes.error;
    } else {
      sourceRows = cityRes.rows;
      const bySlug = new Map<string, CitySourceRow[]>();
      for (const row of cityRes.rows) {
        const slug = row.city_slug ?? "";
        const cityLabel = row.city?.trim();
        if (!slug) continue;
        if (cityLabel && !slugDisplayName.has(slug)) slugDisplayName.set(slug, cityLabel);
        totalPublishable += 1;
        const list = bySlug.get(slug);
        if (list) list.push(row);
        else bySlug.set(slug, [row]);
      }
      for (const [slug, list] of bySlug) {
        countsByCity.set(
          slug,
          quoteHomesOnPage(
            list.map((row) => ({
              id: row.id,
              name: row.name ?? "",
              zip: row.zip,
              inspections: 0,
              total_citations: 0,
            })),
            state.code,
          ).length,
        );
      }
    }
  }

  const listedInCity = (slug: string) => countsByCity.get(slug) ?? 0;

  const countyCount = (region: Region) => {
    const slugSet = new Set(region.citySlugs);
    return quoteHomesOnPage(
      sourceRows
        .filter((row) => row.city_slug && slugSet.has(row.city_slug))
        .map((row) => ({
          id: row.id,
          name: row.name ?? "",
          zip: row.zip,
          inspections: 0,
          total_citations: 0,
        })),
      state.code,
    ).length;
  };

  const statePageUrl = canonicalFor(`/${state.slug}`);
  const statePageTitle = buildStateHubTitle(state.name, REGULATOR_ABBR[state.code] ?? "state", state.code);
  const stateSetting = careSettingCopy(state.code);
  const statePageDesc = `${stateSetting.hubNoun.charAt(0).toUpperCase()}${stateSetting.hubNoun.slice(1)} in ${state.name}, built from state and federal primary sources.`;

  const STATE_FAQS: Record<string, FaqItem[]> = {
    OR: OR_FAQS,
    WA: WA_FAQS,
    MN: MN_FAQS,
    TX: TX_FAQS,
    CO: CO_FAQS,
  };
  const stateFaqs = STATE_FAQS[state.code] ?? null;

  const stateJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: stateSetting.collectionName(state.name), url: statePageUrl },
    ]),
    buildWebPageWithReviewer({
      name: statePageTitle,
      url: statePageUrl,
      description: statePageDesc,
      datePublished: stateFirstPublishedAt,
      dateModified: stateLastRefreshed,
    }),
    buildStateHubCollectionPage({
      name: stateSetting.collectionName(state.name),
      url: statePageUrl,
      state,
      datePublished: stateFirstPublishedAt,
      dateModified: stateLastRefreshed,
    }),
    ...(stateFaqs
      ? [buildFaqSchemaFromPairs(stateFaqs.map((f) => ({ q: f.q, a: f.a })), statePageUrl)]
      : []),
  ];

  return (
    <>
      <JsonLd objects={stateJsonLd} />
      {/* DOM reorder: <main> (H1) is first in source; GovernanceBar+SiteNav use flex order:-1 to appear visually above it. */}
      <div className="flex flex-col">
        <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>

        {/* ── Header ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-12">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-rust mb-3">
              {state.name} · {stateSetting.h1Topic} records
            </p>
            <h1
              className="font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink mb-4"
              style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1 }}
            >
              {stateSetting.h1Topic} in {state.name}
            </h1>
            <p className="font-[family-name:var(--font-display)] italic text-[20px] leading-[1.4] text-ink-3 max-w-[50ch]">
              StarlynnCare covers {state.name} county-by-county. Each region below
              lists publishable facility profiles — only facilities with verified
              state-agency data are shown.
            </p>
            <div className="mt-5 flex flex-wrap items-baseline gap-6 border-l-2 border-teal pl-5 font-[family-name:var(--font-mono)] text-[12px] text-ink-3 tracking-[0.04em]">
              <span>
                <strong className="font-semibold text-ink text-[18px]">{totalPublishable}</strong>{" "}
                facilities live
              </span>
              <span className="text-ink-4">{state.name} only</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
          {fetchError && (
            <div className="mb-8 border border-gold/30 bg-gold-soft px-5 py-4 text-sm">
              <p className="font-semibold text-gold">Configuration</p>
              <p className="mt-2 text-ink-2">{fetchError}</p>
            </div>
          )}

          {counties.filter((r) => cityHubPageExists(countyCount(r))).length > 0 && (
            <section aria-labelledby="counties-heading">
              <SectionHead
                label="Counties we cover"
                title={<>Browse by county, <em>or jump to a city below.</em></>}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {counties
                  .filter((r) => cityHubPageExists(countyCount(r)))
                  .map((region) => {
                    const n = countyCount(region);
                    return (
                      <Link
                        key={region.slug}
                        href={`/${state.slug}/${region.slug}`}
                        className="block border border-paper-rule p-5 no-underline text-ink hover:border-teal transition-colors"
                        style={{ background: "var(--color-paper-2)" }}
                      >
                        <span className="font-[family-name:var(--font-display)] text-[22px] leading-none tracking-[-0.005em]">
                          {region.name}
                        </span>
                        <p className="mt-2 font-[family-name:var(--font-mono)] text-[12px] text-ink-3 tracking-[0.04em]">
                          {n} {n === 1 ? "facility" : "facilities"}
                        </p>
                      </Link>
                    );
                  })}
              </div>
            </section>
          )}

          {cities.length > 0 && (
            <section className="mt-16" aria-labelledby="cities-heading">
              <SectionHead
                label="Cities"
                title={<>All cities in {state.name} <em>with live profiles.</em></>}
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cities
                  .filter((c) => cityHubPageExists(listedInCity(c.slug)))
                  .map((region) => {
                    const n = listedInCity(region.slug);
                    return (
                      <Link
                        key={region.slug}
                        href={`/${state.slug}/${region.slug}`}
                        className="flex justify-between items-center px-4 py-3 border border-paper-rule no-underline text-ink hover:text-teal hover:border-teal transition-colors"
                        style={{ background: "var(--color-paper)" }}
                      >
                        <span className="font-[family-name:var(--font-display)] text-[18px] leading-none tracking-[-0.005em]">
                          {region.name}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4">
                          {n > 0 ? n : ""}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            </section>
          )}

          {(() => {
            const renderedCitySlugs = new Set(
              cities
                .filter((c) => cityHubPageExists(listedInCity(c.slug)))
                .map((c) => c.slug),
            );
            const allPublishableSlugs = new Set<string>();
            for (const s of countsByCity.keys()) allPublishableSlugs.add(s);
            const extraCitySlugs = [...allPublishableSlugs]
              .filter((s) => cityHubPageExists(listedInCity(s)) && !renderedCitySlugs.has(s))
              .sort((a, b) => {
                const ta = listedInCity(a);
                const tb = listedInCity(b);
                if (tb !== ta) return tb - ta;
                return a.localeCompare(b);
              });
            const titleCaseSlug = (slug: string) =>
              slug
                .split("-")
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(" ");

            if (extraCitySlugs.length === 0) return null;

            return (
              <section className="mt-16" aria-labelledby="more-cities-heading">
                <SectionHead
                  label={`§ More ${state.name} cities`}
                  title={<>Indexed hubs <em>beyond the curated list above.</em></>}
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {extraCitySlugs.map((slug) => {
                    const n = listedInCity(slug);
                    const label = slugDisplayName.get(slug) ?? titleCaseSlug(slug);
                    return (
                      <Link
                        key={slug}
                        href={`/${state.slug}/${slug}`}
                        className="flex justify-between items-center px-4 py-3 border border-paper-rule no-underline text-ink hover:text-teal hover:border-teal transition-colors"
                        style={{ background: "var(--color-paper)" }}
                      >
                        <span className="font-[family-name:var(--font-display)] text-[18px] leading-none tracking-[-0.005em]">
                          {label}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4">
                          {n > 0 ? n : ""}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })()}
        </div>

        {stateFaqs && (
          <div className="border-t border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
              <SectionHead
                label={`§ ${state.name} · FAQ`}
                title={<>Common questions about <em>memory care in {state.name}.</em></>}
              />
              <dl className="mt-8 space-y-6 max-w-[72ch]">
                {stateFaqs.map((faq) => (
                  <div key={faq.q} className="border-l-2 border-teal pl-5">
                    <dt className="font-[family-name:var(--font-display)] text-[17px] font-medium text-ink leading-snug mb-2">
                      {faq.q}
                    </dt>
                    <dd
                      className="text-[14.5px] leading-relaxed text-ink-2"
                      dangerouslySetInnerHTML={{ __html: faq.a }}
                    />
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
        </main>
        <div className="-order-1">
          <GovernanceBar scope={state.code} />
          <SiteNav countStateCode={state.code} badge={state.name} ctaHref={`/${state.slug}/facilities`} ctaLabel={`Browse ${state.name} facilities`} stateNavHref={`/${state.slug}`} hideStateLink />
          {state.code !== "CO" && (
            <AreaWatchModal areaName={state.name} areaSlug={state.slug} stateCode={state.code} source="state_modal" delayMs={20000} />
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
