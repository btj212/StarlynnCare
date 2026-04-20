import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { regionFromSlug } from "@/lib/regions";
import type { CareCategory } from "@/lib/types";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ state: string; city: string }>;
};

const CITY_INTRO: Record<string, { heading: string; body: string }> = {
  oakland: {
    heading: "Memory care in Oakland, CA — state records and inspection history",
    body:
      "Oakland is Alameda County's largest city and home to several state-licensed RCFEs specializing in memory care. California CDSS inspects these facilities annually; inspection reports and cited deficiencies appear on each profile page.",
  },
  berkeley: {
    heading: "Memory care in Berkeley, CA — CDSS inspection records",
    body:
      "Berkeley has two dedicated memory-care RCFEs — Silverado Senior Living and Elegance Berkeley — inspected at least annually by California CDSS evaluators. Deficiency citations, including those under Title 22 §87705, appear on each facility page.",
  },
  alameda: {
    heading: "Memory care in Alameda, CA — CDSS licensing and inspection data",
    body:
      "The city of Alameda is home to Oakmont of Mariner Point, an RCFE with a dedicated memory-care program. Licensing and inspection data are sourced from the CDSS Transparency API.",
  },
  fremont: {
    heading: "Memory care in Fremont, CA — Aegis, Brookdale, and more",
    body:
      "Fremont has the highest concentration of memory-care RCFEs in southern Alameda County, including Aegis Assisted Living, Aegis Gardens, and Brookdale North Fremont. Inspection histories — including any Type A citations — appear on each facility profile.",
  },
};

const CATEGORY_LABEL: Record<CareCategory, string> = {
  rcfe_memory_care: "RCFE · Memory care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF · Memory care",
  alf_general: "ALF",
  snf_general: "Nursing home",
  snf_dementia_scu: "Nursing home · Dementia SCU",
  ccrc: "CCRC",
  unknown: "Pending categorization",
};

type FacilityCard = {
  id: string;
  name: string;
  city: string | null;
  city_slug: string;
  slug: string;
  street: string | null;
  beds: number | null;
  care_category: CareCategory;
  photo_url: string | null;
};

type FacilityStats = {
  facility_id: string;
  inspections: number;
  type_a: number;
  type_b: number;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state: stateSlug, city: regionSlug } = await params;
  const region = regionFromSlug(stateSlug, regionSlug);
  if (!region) return { title: "Region not found | StarlynnCare" };
  const cityIntro = CITY_INTRO[regionSlug] ?? null;
  return {
    title: cityIntro
      ? `${cityIntro.heading} | StarlynnCare`
      : `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`,
    description: cityIntro
      ? cityIntro.body.slice(0, 200)
      : `Memory care facility profiles in ${region.name}, built from state (CDSS) and federal (CMS) primary sources.`,
  };
}

export default async function RegionPage({ params }: PageProps) {
  const { state: stateSlug, city: regionSlug } = await params;
  const region = regionFromSlug(stateSlug, regionSlug);
  if (!region) notFound();

  const supabase = tryPublicSupabaseClient();
  let facilities: FacilityCard[] = [];
  let statsMap = new Map<string, FacilityStats>();
  let fetchError: string | null = null;

  if (!supabase) {
    fetchError = "Supabase is not configured.";
  } else {
    const { data, error } = await supabase
      .from("facilities")
      .select("id, name, city, city_slug, slug, street, beds, care_category, photo_url")
      .eq("state_code", region.state.code)
      .eq("publishable", true)
      .in("city_slug", region.citySlugs as unknown as string[])
      .order("name", { ascending: true });

    if (error) {
      fetchError = error.message;
    } else {
      facilities = (data ?? []) as FacilityCard[];

      // One aggregation query for all facilities' inspection/deficiency counts
      if (facilities.length > 0) {
        const ids = facilities.map((f) => f.id);
        const { data: inspData } = await supabase
          .from("inspections")
          .select("id, facility_id")
          .in("facility_id", ids);

        const inspIds = (inspData ?? []).map((i) => i.id);
        const inspByFacility = new Map<string, number>();
        for (const i of inspData ?? []) {
          inspByFacility.set(i.facility_id, (inspByFacility.get(i.facility_id) ?? 0) + 1);
        }

        const { data: defData } = await supabase
          .from("deficiencies")
          .select("inspection_id, class")
          .in("inspection_id", inspIds.length ? inspIds : ["__none__"]);

        // Build inspection→facility map
        const inspFacMap = new Map<string, string>();
        for (const i of inspData ?? []) inspFacMap.set(i.id, i.facility_id);

        const typeAByFacility = new Map<string, number>();
        const typeBByFacility = new Map<string, number>();
        for (const d of defData ?? []) {
          const fid = inspFacMap.get(d.inspection_id);
          if (!fid) continue;
          if (d.class === "Type A")
            typeAByFacility.set(fid, (typeAByFacility.get(fid) ?? 0) + 1);
          if (d.class === "Type B")
            typeBByFacility.set(fid, (typeBByFacility.get(fid) ?? 0) + 1);
        }

        for (const fac of facilities) {
          statsMap.set(fac.id, {
            facility_id: fac.id,
            inspections: inspByFacility.get(fac.id) ?? 0,
            type_a: typeAByFacility.get(fac.id) ?? 0,
            type_b: typeBByFacility.get(fac.id) ?? 0,
          });
        }
      }
    }
  }

  const count = facilities.length;
  const cityIntro = CITY_INTRO[regionSlug] ?? null;

  return (
    <>
      <SiteNav />
      <main className="min-h-[60vh] border-b border-sc-border bg-warm-white">
        <div className="mx-auto max-w-[1120px] px-6 py-10 md:px-8 md:py-14">

          {/* ── Header ── */}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <Link href={`/${region.state.slug}`} className="hover:text-teal">
              {region.state.name}
            </Link>{" "}
            · Memory care transparency
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-serif)] text-3xl font-semibold tracking-tight text-navy md:text-4xl md:leading-tight">
            {cityIntro ? cityIntro.heading : `Memory care in ${region.name}`}
          </h1>
          {cityIntro && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">
              {cityIntro.body}
            </p>
          )}

          {/* ── Compact coverage strip ── */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-teal/20 bg-teal-light/50 px-4 py-3 text-sm text-slate">
            <span>
              <strong className="font-semibold text-ink">{count}</strong>{" "}
              {count === 1 ? "facility" : "facilities"} with verified CDSS records
            </span>
            <span className="hidden sm:inline text-teal/40">·</span>
            <span className="text-xs text-muted">
              Profiles hidden until state-agency data is confirmed
            </span>
          </div>

          {/* ── Error state ── */}
          {fetchError && (
            <div className="mt-8 rounded-lg border border-amber/30 bg-amber-light px-5 py-4 text-sm">
              <p className="font-semibold text-amber">Configuration</p>
              <p className="mt-2 text-slate">{fetchError}</p>
            </div>
          )}

          {/* ── Empty state ── */}
          {!fetchError && count === 0 && (
            <div className="mt-10 rounded-lg border border-sc-border bg-white px-6 py-10 shadow-card">
              <p className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
                No facilities published yet
              </p>
              <p className="mt-3 max-w-xl text-slate leading-relaxed">
                The CDSS ingest for {region.name} has not yet produced
                verifiable records. This page will populate once the scraper
                run completes.
              </p>
            </div>
          )}

          {/* ── Facility card grid ── */}
          {!fetchError && count > 0 && (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {facilities.map((f) => {
                const stats = statsMap.get(f.id);
                const hasTypeA = (stats?.type_a ?? 0) > 0;
                const hasTypeB = !hasTypeA && (stats?.type_b ?? 0) > 0;
                const href = `/${region.state.slug}/${f.city_slug}/${f.slug}`;

                return (
                  <Link
                    key={f.id}
                    href={href}
                    className={`group flex flex-col overflow-hidden rounded-xl border bg-white shadow-card card-lift ${
                      hasTypeA
                        ? "border-red-200"
                        : hasTypeB
                        ? "border-orange-200"
                        : "border-sc-border"
                    }`}
                  >
                    {/* Photo or placeholder */}
                    {f.photo_url ? (
                      <div className="relative h-36 w-full overflow-hidden bg-sc-border/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.photo_url}
                          alt={`Exterior of ${f.name}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                        {/* Severity ribbon over photo */}
                        {hasTypeA && (
                          <span className="absolute top-2 left-2 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white shadow-sm">
                            Type A on file
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-sc-border/20">
                        <svg
                          className="h-10 w-10 text-sc-border"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Card body */}
                    <div className="flex flex-1 flex-col p-4 gap-3">
                      {/* Name + category */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink leading-snug group-hover:text-teal transition-colors">
                            {f.name}
                          </p>
                          {f.city && (
                            <p className="mt-0.5 text-xs text-muted">
                              {f.city}{f.beds != null ? ` · ${f.beds} beds` : ""}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 inline-flex items-center rounded-full bg-teal-light px-2.5 py-0.5 text-[10px] font-semibold text-teal">
                          {CATEGORY_LABEL[f.care_category]}
                        </span>
                      </div>

                      {/* Stats row */}
                      {stats && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="text-muted">
                            {stats.inspections} inspection{stats.inspections !== 1 ? "s" : ""} on file
                          </span>
                          {stats.type_a > 0 && (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100">
                                Type A
                              </span>
                              {stats.type_a}
                            </span>
                          )}
                          {stats.type_a === 0 && stats.type_b > 0 && (
                            <span className="inline-flex items-center gap-1 font-medium text-orange-600">
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-orange-50">
                                Type B
                              </span>
                              {stats.type_b}
                            </span>
                          )}
                          {stats.type_a === 0 && stats.type_b === 0 && (
                            <span className="text-teal font-medium">No citations on file</span>
                          )}
                        </div>
                      )}

                      {/* CTA */}
                      <p className="mt-auto pt-1 text-xs font-semibold text-teal group-hover:underline underline-offset-2">
                        View full profile →
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
