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
import {
  buildBreadcrumbList,
  buildStateHubCollectionPage,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";

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
  const desc = `Memory care facility profiles in ${state.name}, built from state and federal primary sources.`;
  return {
    title: `${state.name} memory care | StarlynnCare`,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: `${state.name} memory care | StarlynnCare`,
      description: desc,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${state.name} memory care | StarlynnCare`,
      description: desc,
    },
  };
}

export default async function StatePage({ params }: PageProps) {
  const { state: stateSlug } = await params;
  const state = stateFromSlug(stateSlug);
  if (!state) notFound();

  const regions = regionsForState(state.code);
  const counties = regions.filter((r) => r.kind === "county");
  const cities = regions.filter((r) => r.kind === "city");

  const supabase = tryPublicSupabaseClient();
  // Track 7+ bed facilities (medium/large/unknown tier) and small (≤6) separately
  const countsByCity = new Map<string, number>();         // 7+ bed publishable
  const smallCountsByCity = new Map<string, number>();    // ≤6 bed publishable
  let totalPublishable = 0;
  let fetchError: string | null = null;

  if (supabase) {
    const { data, error } = await supabase
      .from("facilities")
      .select("city_slug, capacity_tier")
      .eq("state_code", state.code)
      .eq("publishable", true);
    if (error) {
      fetchError = error.message;
    } else {
      for (const row of data ?? []) {
        const slug = (row as { city_slug: string | null; capacity_tier: string | null }).city_slug ?? "";
        const tier = (row as { city_slug: string | null; capacity_tier: string | null }).capacity_tier ?? "unknown";
        if (!slug) continue;
        totalPublishable += 1;
        if (tier === "small") {
          smallCountsByCity.set(slug, (smallCountsByCity.get(slug) ?? 0) + 1);
        } else {
          countsByCity.set(slug, (countsByCity.get(slug) ?? 0) + 1);
        }
      }
    }
  }

  const countyCount = (region: Region) =>
    region.citySlugs.reduce((n, s) => n + (countsByCity.get(s) ?? 0), 0);
  const countySmallCount = (region: Region) =>
    region.citySlugs.reduce((n, s) => n + (smallCountsByCity.get(s) ?? 0), 0);

  const statePageUrl = canonicalFor(`/${state.slug}`);
  const statePageTitle = `${state.name} memory care | StarlynnCare`;
  const statePageDesc = `Memory care facility profiles in ${state.name}, built from state and federal primary sources.`;
  const stateJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: `${state.name} memory care`, url: statePageUrl },
    ]),
    buildWebPageWithReviewer({
      name: statePageTitle,
      url: statePageUrl,
      description: statePageDesc,
    }),
    buildStateHubCollectionPage({
      name: `Memory care in ${state.name}`,
      url: statePageUrl,
      state,
    }),
  ];

  return (
    <>
      <JsonLd objects={stateJsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>

        {/* ── Header ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-12">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-rust mb-3">
              {state.name} · Memory care transparency
            </p>
            <h1
              className="font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink mb-4"
              style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1 }}
            >
              Memory care in {state.name}
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

          {counties.length > 0 && (
            <section aria-labelledby="counties-heading">
              <SectionHead
                label="§ Counties we cover"
                title={<>Browse by county, <em>or jump to a city below.</em></>}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {counties.map((region) => {
                  const n = countyCount(region);
                  const small = countySmallCount(region);
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
                        {n > 0 ? (
                          <>
                            {n} {n === 1 ? "facility" : "facilities"}
                            {small > 0 && (
                              <span className="ml-1.5 text-[10.5px]">
                                · {small} small care home{small !== 1 ? "s" : ""}
                              </span>
                            )}
                          </>
                        ) : (
                          "Indexing in progress"
                        )}
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
                label="§ Cities"
                title={<>All cities in {state.name} <em>with live profiles.</em></>}
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cities
                  .filter(
                    (c) =>
                      (countsByCity.get(c.slug) ?? 0) > 0 ||
                      (smallCountsByCity.get(c.slug) ?? 0) > 0
                  )
                  .map((region) => {
                    const n = countsByCity.get(region.slug) ?? 0;
                    const small = smallCountsByCity.get(region.slug) ?? 0;
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
                          {small > 0 ? ` +${small}` : ""}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
