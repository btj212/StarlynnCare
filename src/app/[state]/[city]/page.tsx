import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { regionFromSlug } from "@/lib/regions";
import type { FacilityListRow, CareCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ state: string; city: string }>;
};

/**
 * SEO-optimized intro paragraphs for the 4 Alameda County launch cities.
 * Factual, family-oriented, no superlatives.
 */
const CITY_INTRO: Record<string, { heading: string; body: string }> = {
  oakland: {
    heading: "Memory care facilities in Oakland, CA — state records and inspection history",
    body:
      "Oakland is Alameda County's largest city and home to several state-licensed residential care facilities for the elderly (RCFEs) that specialize in memory care for adults with Alzheimer's disease and related dementias. California's Community Care Licensing Division (CDSS) inspects these facilities annually; the inspection reports and any cited deficiencies appear on the individual facility pages below. Profiles are published only when verified CDSS licensing data is on file.",
  },
  berkeley: {
    heading: "Memory care facilities in Berkeley, CA — CDSS inspection records",
    body:
      "Berkeley has two state-licensed, dedicated memory-care RCFEs—Silverado Senior Living and Elegance Berkeley—as well as several general RCFEs with memory-care capability. All are inspected at least annually by California CDSS evaluators. Deficiency citations, including those under Title 22 §87705 (dementia-specific care standards), appear on each facility's page so families can compare regulatory histories before scheduling tours.",
  },
  alameda: {
    heading: "Memory care in Alameda, CA — CDSS licensing and inspection data",
    body:
      "The city of Alameda, on the island between Oakland and the Bay, is home to Oakmont of Mariner Point, an RCFE with a dedicated memory-care program. California CDSS licensing and inspection data for facilities in Alameda are compiled here from the CDSS Transparency API and updated with each new inspection cycle. Use the profiles below to review deficiency histories before contacting facilities directly.",
  },
  fremont: {
    heading: "Memory care in Fremont, CA — Aegis, Ivy Park, Brookdale, and more",
    body:
      "Fremont has the highest concentration of memory-care RCFEs in southern Alameda County, including Aegis Assisted Living of Fremont, Aegis Gardens, Brookdale North Fremont, and Ivy Park at Hayward (in adjacent Hayward). Combined, these facilities account for a significant portion of licensed memory-care capacity in the county. Inspection deficiency histories—including any Type A (actual-harm) citations—appear on each facility's profile page.",
  },
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
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

function groupByCity(facilities: FacilityListRow[]) {
  const map = new Map<string, FacilityListRow[]>();
  for (const f of facilities) {
    const city = f.city?.trim() || "Unknown city";
    if (!map.has(city)) map.set(city, []);
    map.get(city)!.push(f);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default async function RegionPage({ params }: PageProps) {
  const { state: stateSlug, city: regionSlug } = await params;
  const region = regionFromSlug(stateSlug, regionSlug);
  if (!region) notFound();

  const supabase = tryPublicSupabaseClient();
  let facilities: FacilityListRow[] = [];
  let fetchError: string | null = null;

  if (!supabase) {
    fetchError =
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";
  } else {
    const { data, error } = await supabase
      .from("facilities")
      .select(
        "id, name, city, city_slug, slug, cms_star_rating, beds, last_inspection_date, care_category, serves_memory_care, memory_care_designation, publishable",
      )
      .eq("state_code", region.state.code)
      .eq("publishable", true)
      .in("city_slug", region.citySlugs as unknown as string[])
      .order("city", { ascending: true })
      .order("name", { ascending: true });
    if (error) fetchError = error.message;
    else facilities = (data ?? []) as FacilityListRow[];
  }

  const grouped = groupByCity(facilities);
  const count = facilities.length;
  const memoryCareCount = facilities.filter((f) => f.serves_memory_care).length;
  const cityIntro = CITY_INTRO[regionSlug] ?? null;
  const cityLabel =
    region.kind === "county"
      ? `${region.citySlugs
          .map((s) =>
            s
              .split("-")
              .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
              .join(" "),
          )
          .slice(0, 4)
          .join(", ")}${region.citySlugs.length > 4 ? `, and ${region.citySlugs.length - 4} more` : ""}`
      : region.name;

  return (
    <>
      <SiteNav />
      <main className="min-h-[60vh] border-b border-sc-border bg-warm-white">
        <div className="mx-auto max-w-[1120px] px-6 py-14 md:px-8 md:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            <Link
              href={`/${region.state.slug}`}
              className="hover:text-teal"
            >
              {region.state.name}
            </Link>{" "}
            · Memory care transparency
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight text-navy md:text-[2.75rem] md:leading-tight">
            {cityIntro ? cityIntro.heading : `Memory care in ${region.name}`}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
            {cityIntro
              ? cityIntro.body
              : "Profiles below are published only after a facility has verified state-agency data (CDSS for California RCFEs). Federal CMS data supplements the record when the facility also operates a skilled nursing wing."}
          </p>

          {/* Honest coverage banner */}
          <div className="mt-8 rounded-lg border border-teal/20 bg-teal-light/60 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
              What this page shows
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              Covering {cityLabel}.{" "}
              <strong className="font-semibold text-ink">{count}</strong>{" "}
              {count === 1 ? "facility" : "facilities"} currently publishable
              {memoryCareCount > 0 && (
                <>
                  {" "}(of which{" "}
                  <strong className="font-semibold text-ink">
                    {memoryCareCount}
                  </strong>{" "}
                  serve memory care)
                </>
              )}
              . Inspection and citation history populates each facility page as
              the CDSS ingest runs. Facilities without verified state-agency
              data are intentionally hidden until they have real records to
              cite.
            </p>
          </div>

          {fetchError ? (
            <div
              className="mt-10 rounded-lg border border-amber/30 bg-amber-light px-5 py-4 text-sm text-ink"
              role="status"
            >
              <p className="font-semibold text-amber">Configuration</p>
              <p className="mt-2 leading-relaxed text-slate">{fetchError}</p>
            </div>
          ) : count === 0 ? (
            <div className="mt-14 rounded-lg border border-sc-border bg-white px-6 py-10 shadow-card">
              <p className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
                No facilities published yet
              </p>
              <p className="mt-3 max-w-xl leading-relaxed text-slate">
                The CDSS ingest for {region.name} has not yet produced
                verifiable records. This page will populate once the scraper
                run completes — every profile must have real citation data
                before it goes live.
              </p>
            </div>
          ) : (
            <div className="mt-14 space-y-16">
              {grouped.map(([city, rows]) => (
                <section key={city}>
                  <h2 className="border-b border-sc-border pb-3 font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
                    {city}
                  </h2>
                  <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map((f) => (
                      <li key={f.id}>
                        <Link
                          href={`/${region.state.slug}/${f.city_slug}/${f.slug}`}
                          className="group block rounded-lg border border-sc-border bg-white p-5 shadow-card transition hover:border-teal/40 hover:shadow-card-hover"
                        >
                          <span className="block font-semibold text-ink group-hover:text-teal">
                            {f.name}
                          </span>
                          <span className="mt-1 block text-xs font-medium text-teal">
                            {CATEGORY_LABEL[f.care_category]}
                          </span>
                          {f.memory_care_designation && (
                            <p className="mt-2 text-xs text-muted">
                              {f.memory_care_designation}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {f.beds != null && <span>{f.beds} beds</span>}
                            {f.cms_star_rating != null && (
                              <span>CMS {f.cms_star_rating}★</span>
                            )}
                            {f.last_inspection_date && (
                              <span>
                                Last inspection {f.last_inspection_date}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
