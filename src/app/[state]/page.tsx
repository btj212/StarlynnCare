import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
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
      <SiteNav />
      <main className="min-h-[60vh] border-b border-sc-border bg-warm-white">
        <div className="mx-auto max-w-[1120px] px-6 py-14 md:px-8 md:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            {state.name} · Memory care transparency
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight text-navy md:text-[2.75rem] md:leading-tight">
            Memory care in {state.name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
            StarlynnCare covers {state.name} county-by-county. Each region below
            lists publishable facility profiles — only facilities with verified
            state-agency data are shown.
          </p>

          <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-l-2 border-teal pl-5 text-sm text-slate">
            <span>
              <strong className="font-semibold text-ink">
                {totalPublishable}
              </strong>{" "}
              facilities live
            </span>
            <span className="text-muted">{state.name} only</span>
          </div>

          {fetchError && (
            <div
              className="mt-8 rounded-lg border border-amber/30 bg-amber-light px-5 py-4 text-sm text-ink"
              role="status"
            >
              <p className="font-semibold text-amber">Configuration</p>
              <p className="mt-2 leading-relaxed text-slate">{fetchError}</p>
            </div>
          )}

          {counties.length > 0 && (
            <section className="mt-14" aria-labelledby="counties-heading">
              <h2
                id="counties-heading"
                className="border-b border-sc-border pb-3 font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
              >
                Counties we cover
              </h2>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {counties.map((region) => {
                  const n = countyCount(region);
                  const small = countySmallCount(region);
                  return (
                    <li key={region.slug}>
                      <Link
                        href={`/${state.slug}/${region.slug}`}
                        className="group block rounded-lg border border-sc-border bg-white p-5 shadow-card transition hover:border-teal/40 hover:shadow-card-hover"
                      >
                        <span className="font-semibold text-ink group-hover:text-teal">
                          {region.name}
                        </span>
                        <p className="mt-2 text-sm text-muted">
                          {n > 0 ? (
                            <>
                              {n} {n === 1 ? "facility" : "facilities"}
                              {small > 0 && (
                                <span className="ml-1.5 text-xs">
                                  · {small} small care home{small !== 1 ? "s" : ""}
                                </span>
                              )}
                            </>
                          ) : (
                            "Indexing in progress"
                          )}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {cities.length > 0 && (
            <section className="mt-14" aria-labelledby="cities-heading">
              <h2
                id="cities-heading"
                className="border-b border-sc-border pb-3 font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
              >
                Cities
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      <li key={region.slug}>
                        <Link
                          href={`/${state.slug}/${region.slug}`}
                          className="group block rounded-md border border-sc-border bg-white px-4 py-3 text-sm transition hover:border-teal/40"
                        >
                          <span className="font-medium text-ink group-hover:text-teal">
                            {region.name}
                          </span>
                          {n > 0 && (
                            <span className="ml-2 text-muted">{n}</span>
                          )}
                          {small > 0 && (
                            <span className="ml-1 text-xs text-muted/70">
                              +{small} small
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
