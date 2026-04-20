import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { stateFromSlug } from "@/lib/states";
import { regionsForState, type Region } from "@/lib/regions";

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
  return {
    title: `${state.name} memory care | StarlynnCare`,
    description: `Memory care facility profiles in ${state.name}, built from state and federal primary sources.`,
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
  const countsByCity = new Map<string, number>();
  let totalPublishable = 0;
  let fetchError: string | null = null;

  if (supabase) {
    const { data, error } = await supabase
      .from("facilities")
      .select("city_slug")
      .eq("state_code", state.code)
      .eq("publishable", true);
    if (error) fetchError = error.message;
    else {
      for (const row of data ?? []) {
        const slug = (row as { city_slug: string | null }).city_slug ?? "";
        if (!slug) continue;
        countsByCity.set(slug, (countsByCity.get(slug) ?? 0) + 1);
        totalPublishable += 1;
      }
    }
  }

  const countyCount = (region: Region) =>
    region.citySlugs.reduce((n, s) => n + (countsByCity.get(s) ?? 0), 0);

  return (
    <>
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
                          {n > 0
                            ? `${n} publishable ${n === 1 ? "facility" : "facilities"}`
                            : "Indexing in progress"}
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
                  .filter((c) => (countsByCity.get(c.slug) ?? 0) > 0)
                  .map((region) => (
                    <li key={region.slug}>
                      <Link
                        href={`/${state.slug}/${region.slug}`}
                        className="group block rounded-md border border-sc-border bg-white px-4 py-3 text-sm transition hover:border-teal/40"
                      >
                        <span className="font-medium text-ink group-hover:text-teal">
                          {region.name}
                        </span>
                        <span className="ml-2 text-muted">
                          {countsByCity.get(region.slug)}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
