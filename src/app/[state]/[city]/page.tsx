import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SectionHead } from "@/components/editorial/SectionHead";
import { StatBlock, type StatItem } from "@/components/editorial/StatBlock";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { FacilityListClient, type ListFacility } from "@/components/facility/FacilityListClient";
import { TopGradedFacilities } from "@/components/facility/TopGradedFacilities";
import { HubFaqSection } from "@/components/facility/HubFaqSection";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { resolveListingRegion } from "@/lib/resolveListingRegion";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { getRegulatorPrimer } from "@/lib/content/regulatorPrimer";
import {
  buildBreadcrumbList,
  buildCollectionPageSchema,
  buildFaqSchemaFromPairs,
  buildItemListSchema,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";
import { buildCityFaqs } from "@/lib/content/cityFaqs";
import { clipMetaDescription } from "@/lib/seo/meta";
import type { CareCategory } from "@/lib/types";
import { countPublishableFacilitiesInRegion } from "@/lib/regionsHubCount";
import { cityIntroForSlug } from "@/lib/content/cityIntros";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ state: string; city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state: stateSlug, city: regionSlug } = await params;
  const supabase = tryPublicSupabaseClient();
  const region = await resolveListingRegion(stateSlug, regionSlug, supabase);
  if (!region) return { title: "Region not found | StarlynnCare" };

  // Thin hub guardrail: empty regions 404 — avoids indexing placeholder shells (CA + future states).
  if (supabase) {
    const n = await countPublishableFacilitiesInRegion(supabase, region);
    if (n === 0) notFound();
  }

  const canonical = canonicalFor(`/${region.state.slug}/${region.slug}`);
  const desc = clipMetaDescription(
    `State inspection records and citation history for every licensed memory care facility in ${region.name}, built from primary CDSS data.`,
  );
  return {
    title: `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`,
      description: desc,
      url: canonical,
      type: "website",
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`,
      description: desc,
      images: ["/og-default.png"],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function RegionPage({ params }: PageProps) {
  const { state: stateSlug, city: regionSlug } = await params;

  const supabase = tryPublicSupabaseClient();
  const region = await resolveListingRegion(stateSlug, regionSlug, supabase);
  if (!region) notFound();
  let facilities: ListFacility[] = [];
  let fetchError: string | null = null;

  if (!supabase) {
    fetchError = "Supabase is not configured.";
  } else {
    // 1. Facilities
    const { data: rawFacilities, error } = await supabase
      .from("facilities")
      .select(
        "id, name, city, street, zip, city_slug, slug, beds, care_category, photo_url, serves_memory_care, memory_care_disclosure_filed, capacity_tier",
      )
      .eq("state_code", region.state.code)
      .eq("publishable", true)
      .in("city_slug", region.citySlugs as unknown as string[])
      .order("name", { ascending: true });

    if (error) {
      fetchError = error.message;
    } else {
      const raw = (rawFacilities ?? []) as Array<{
        id: string; name: string; city: string | null; street: string | null;
        zip: string | null; city_slug: string;
        slug: string; beds: number | null; care_category: string;
        photo_url: string | null; serves_memory_care: boolean;
        memory_care_disclosure_filed: boolean;
        capacity_tier: "small" | "medium" | "large" | "unknown";
      }>;

      if (raw.length > 0) {
        const ids = raw.map((f) => f.id);

        // 2. Inspections
        const { data: inspData, error: inspErr } = await supabase
          .from("inspections")
          .select("id, facility_id")
          .in("facility_id", ids);

        if (inspErr) {
          console.error("[hub] inspections query failed:", inspErr.message);
        }

        const inspCountByFac = new Map<string, number>();
        const inspFacMap = new Map<string, string>();
        for (const i of inspData ?? []) {
          inspCountByFac.set(i.facility_id, (inspCountByFac.get(i.facility_id) ?? 0) + 1);
          inspFacMap.set(i.id, i.facility_id);
        }

        const inspIds = (inspData ?? []).map((i: { id: string }) => i.id);

        // 3. Deficiencies — chunked to avoid PostgREST row limits and URL length limits
        //    when inspIds is large (large counties with hundreds of inspections).
        //    severity mapping: Type A → 3 or 4, Type B → 2 (see ccld_citations_ingest.py)
        const DEF_CHUNK = 200;
        const allDefs: Array<{ inspection_id: string; severity: number | null }> = [];
        for (let ci = 0; ci < inspIds.length; ci += DEF_CHUNK) {
          const chunk = inspIds.slice(ci, ci + DEF_CHUNK);
          const { data: chunkData, error: chunkErr } = await supabase
            .from("deficiencies")
            .select("inspection_id, severity")
            .in("inspection_id", chunk);
          if (chunkErr) {
            console.error("[hub] deficiencies chunk query failed:", chunkErr.message, { ci, chunkLen: chunk.length });
            break;
          }
          if (chunkData) allDefs.push(...(chunkData as typeof allDefs));
        }

        const totalCitByFac = new Map<string, number>();
        const seriousCitByFac = new Map<string, number>();
        for (const d of allDefs) {
          const fid = inspFacMap.get(d.inspection_id);
          if (!fid) continue;
          totalCitByFac.set(fid, (totalCitByFac.get(fid) ?? 0) + 1);
          // severity >= 3 = Type A (immediate jeopardy 4, serious 3); severity 2 = Type B
          if ((d.severity ?? 0) >= 3) {
            seriousCitByFac.set(fid, (seriousCitByFac.get(fid) ?? 0) + 1);
          }
        }

        facilities = raw.map((f) => ({
          id: f.id,
          name: f.name,
          city: f.city,
          street: f.street,
          zip: f.zip,
          city_slug: f.city_slug,
          slug: f.slug,
          beds: f.beds,
          care_category: f.care_category as CareCategory,
          photo_url: f.photo_url,
          capacity_tier: f.capacity_tier,
          serves_memory_care: f.serves_memory_care,
          memory_care_disclosure_filed: f.memory_care_disclosure_filed,
          inspections: inspCountByFac.get(f.id) ?? 0,
          total_citations: totalCitByFac.get(f.id) ?? 0,
          serious_citations: seriousCitByFac.get(f.id) ?? 0,
        }));
      }
    }
  }

  const smallCount = facilities.filter((f) => f.capacity_tier === "small").length;
  const visibleCount = facilities.filter((f) => f.capacity_tier !== "small").length;
  const totalCount = facilities.length;

  if (!fetchError && totalCount === 0) {
    notFound();
  }

  type TrendFacility = {
    id: string;
    name: string;
    slug: string;
    city_slug: string;
    typeACount: number;
  };

  let countyTrendRows: TrendFacility[] = [];
  if (
    region.kind === "county" &&
    totalCount > 0 &&
    supabase &&
    region.state.code === "CA" &&
    facilities.length > 0
  ) {
    const ids = facilities.map((f) => f.id);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const isoDate = twelveMonthsAgo.toISOString().split("T")[0];

    const { data: inspRows } = await supabase
      .from("inspections")
      .select("id, facility_id")
      .in("facility_id", ids)
      .gte("inspection_date", isoDate);

    const facilityByInsp = new Map(
      (inspRows ?? []).map((r: { id: string; facility_id: string }) => [r.id, r.facility_id]),
    );
    const inspIds = (inspRows ?? []).map((r: { id: string }) => r.id);

    const typeAByFac = new Map<string, number>();
    const TREND_CHUNK = 200;
    for (let ti = 0; ti < inspIds.length; ti += TREND_CHUNK) {
      const chunk = inspIds.slice(ti, ti + TREND_CHUNK);
      const { data: defs } = await supabase
        .from("deficiencies")
        .select("inspection_id")
        .in("inspection_id", chunk)
        .gte("severity", 3);
      for (const d of defs ?? []) {
        const fid = facilityByInsp.get(d.inspection_id as string);
        if (!fid) continue;
        typeAByFac.set(fid, (typeAByFac.get(fid) ?? 0) + 1);
      }
    }

    const facById = new Map(facilities.map((f) => [f.id, f]));
    countyTrendRows = [...typeAByFac.entries()]
      .filter(([, n]) => n > 0)
      .map(([fid, typeACount]) => {
        const f = facById.get(fid);
        if (!f) return null;
        return {
          id: f.id,
          name: f.name,
          slug: f.slug,
          city_slug: f.city_slug,
          typeACount,
        };
      })
      .filter((x): x is TrendFacility => x != null)
      .sort((a, b) => b.typeACount - a.typeACount || a.name.localeCompare(b.name));
  }

  const pageUrl = canonicalFor(`/${region.state.slug}/${region.slug}`);
  const pageTitle = `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`;
  const pageDesc = `State inspection records and citation history for every licensed memory care facility in ${region.name}, built from primary CDSS data.`;
  const itemListFacilities = facilities.map((f) => ({
    name: f.name,
    url: canonicalFor(`/${region.state.slug}/${f.city_slug}/${f.slug}`),
    facilityId: f.id,
    street: f.street,
    city: f.city,
    postalCode: f.zip,
    addressRegion: region.state.name,
  }));
  // Any deficiency (Type A or Type B) — matches the "§ Findings" label.
  // serious_citations is retained on each facility for card-level red/amber badging.
  const facilitiesWithSeriousDef = facilities.filter((f) => f.total_citations > 0).length;
  const severePct =
    totalCount > 0 ? Math.round((facilitiesWithSeriousDef / totalCount) * 100) : 0;
  const findingsDate = new Date().toISOString().split("T")[0];

  const faqPairs = buildCityFaqs(region, {
    totalCount,
    facilitiesWithDeficiency: facilitiesWithSeriousDef,
  });

  const regionJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: region.state.name, url: canonicalFor(`/${region.state.slug}`) },
      { name: `Memory care in ${region.name}`, url: pageUrl },
    ]),
    buildWebPageWithReviewer({
      name: pageTitle,
      url: pageUrl,
      description: pageDesc,
    }),
    buildCollectionPageSchema({
      name: `Memory care in ${region.name}`,
      url: pageUrl,
      region,
    }),
    buildItemListSchema(
      `Memory care facilities in ${region.name}`,
      pageUrl,
      itemListFacilities,
    ),
    buildFaqSchemaFromPairs(faqPairs, pageUrl),
  ];

  // ── Additional data for content blocks ────────────────────────────────────

  // Regulator primer (CA-specific)
  const regulatorPrimer = getRegulatorPrimer(region.state.code);

  const regionStatItems: StatItem[] = [
    {
      n: String(totalCount),
      label: `Licensed memory care facilities indexed in ${region.name}`,
      src: "CDSS",
    },
    {
      n: String(facilitiesWithSeriousDef),
      label:
        "Facilities with at least one Type-A or Type-B deficiency finding in the indexed inspection record (24 months where dated)",
      src: "CDSS",
      delta: totalCount > 0 ? `${severePct}% of indexed facilities` : undefined,
    },
    {
      n: String(visibleCount),
      label: "Facilities with full CDSS profile published on StarlynnCare",
      src: "StarlynnCare",
    },
  ];

  const isCounty = region.kind === "county";
  const cityIntro = !isCounty ? cityIntroForSlug(region.slug) : null;

  return (
    <>
      <JsonLd objects={regionJsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>

        {/* ── Header ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-12">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 mb-5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href={`/${region.state.slug}`} className="hover:text-teal transition-colors">
                {region.state.name}
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">{region.name}</span>
            </nav>

            <h1
              className="font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink mb-4"
              style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1 }}
            >
              Memory care in {region.name}
            </h1>
            <p
              className="font-[family-name:var(--font-display)] italic text-[20px] leading-[1.4] text-ink-3 max-w-[50ch]"
            >
              State inspection records and citation history for every licensed
              facility — built from primary CDSS data.
            </p>
            {cityIntro && (
              <p className="mt-6 text-[17px] leading-relaxed text-ink-2 max-w-[62ch]">
                {cityIntro}
              </p>
            )}
          </div>
        </div>

        {/* ── Stats / Findings ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
            {totalCount > 0 ? (
              <>
                <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
                  § Findings
                </div>
                <p className="font-[family-name:var(--font-display)] text-[22px] leading-[1.3] text-ink mb-4">
                  Of the{" "}
                  <strong className="font-normal text-rust">{totalCount}</strong>{" "}
                  licensed memory care facilities indexed in {region.name},{" "}
                  <strong className="font-normal text-rust">{facilitiesWithSeriousDef}</strong>{" "}
                  ({severePct}%) have a Type-A or Type-B deficiency in their state record
                  from the past 24 months.
                </p>
                {findingsDate && (
                  <DataFootnote
                    source="CA CDSS Community Care Licensing"
                    refreshed={findingsDate}
                    note="Type-A = immediate health/safety risk; Type-B = lesser violation"
                  />
                )}

                <div className="mt-10">
                  <StatBlock stats={regionStatItems} />
                </div>
              </>
            ) : (
              <p className="text-ink-3 italic">No facilities indexed yet for this region.</p>
            )}
          </div>
        </div>

        {/* ── Regulator primer (city pages only) ── */}
        {!isCounty && (
          <div className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
              <SectionHead
                label="§ How memory care is regulated here"
                title={<>The public record behind <em>every profile.</em></>}
              />
              <div
                className="text-[16px] leading-[1.7] text-ink-2 max-w-[72ch]"
                dangerouslySetInnerHTML={{ __html: regulatorPrimer }}
              />
            </div>
          </div>
        )}

        {/* ── Cost band placeholder (city pages only) ── */}
        {!isCounty && (
          <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
              <SectionHead
                label="§ Cost"
                title={<>What memory care costs <em>in this city.</em></>}
              />
              <p className="text-[16px] leading-[1.7] text-ink-2 max-w-[60ch]">
                Median monthly cost in {region.name} ranges from approximately{" "}
                <strong className="font-semibold">$5,000–$9,000/month</strong> based on regional
                benchmarks. For statewide ranges, financing options, and hidden fees, read{" "}
                <Link href="/california/cost-guide" className="text-teal underline underline-offset-4">
                  What memory care costs in California
                </Link>
                . Methodology for future verified city medians:{" "}
                <Link href="/methodology" className="text-teal underline underline-offset-4">
                  how we source data
                </Link>
                .
              </p>
              <DataFootnote source="Regional estimate · Genworth / operator benchmarks" note="Facility-specific quotes required before signing" />
            </div>
          </div>
        )}

        {/* ── FAQ: county after stats block; city after cost band ── */}
        {isCounty && !fetchError && (
          <HubFaqSection regionName={region.name} faqPairs={faqPairs} />
        )}
        {!isCounty && !fetchError && (
          <HubFaqSection regionName={region.name} faqPairs={faqPairs} />
        )}

        {/* ── Error state ── */}
        {fetchError && (
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-8">
            <div className="border border-gold/30 bg-gold-soft px-5 py-4 text-sm">
              <p className="font-semibold text-gold">Configuration error</p>
              <p className="mt-2 text-ink-2">{fetchError}</p>
            </div>
          </div>
        )}

        {/* ── Top performers rail (county pages only) ── */}
        {isCounty && !fetchError && totalCount > 0 && (
          <TopGradedFacilities
            citySlugs={region.citySlugs}
            stateCode={region.state.code}
            stateSlug={region.state.slug}
            countyName={region.name}
          />
        )}

        {/* ── County citation spotlight (Type-A in last 12 months, CA counties only) ── */}
        {isCounty &&
          !fetchError &&
          countyTrendRows.length > 0 &&
          region.state.code === "CA" && (
            <section className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
              <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
                <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
                  § Recent findings
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[32px] font-normal leading-[1.1] tracking-[-0.01em] text-ink m-0 mb-3">
                  Type-A citations in the last 12 months
                </h2>
                <p className="text-[15px] text-ink-2 max-w-[72ch] leading-relaxed mb-8">
                  Facilities below had at least one Type-A (or immediate jeopardy) deficiency tied to an inspection dated in the rolling year — sourced from published CDSS deficiency records.
                </p>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
                  {countyTrendRows.slice(0, 12).map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/${region.state.slug}/${row.city_slug}/${row.slug}`}
                        className="flex flex-col gap-1 rounded-lg border border-paper-rule bg-paper-2 px-4 py-3 no-underline hover:border-rust/40 transition-colors min-w-0"
                      >
                        <span className="font-[family-name:var(--font-display)] text-[17px] text-ink leading-snug">
                          {row.name}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3 uppercase tracking-[0.06em]">
                          {row.typeACount} Type-A finding{row.typeACount !== 1 ? "s" : ""} (indexed window)
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {countyTrendRows.length > 12 && (
                  <p className="mt-6 text-sm text-ink-3">
                    Showing 12 of {countyTrendRows.length} facilities with Type-A findings in this window.
                  </p>
                )}
              </div>
            </section>
          )}

        {/* ── Facility list ── */}
        {!fetchError && totalCount > 0 && (
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
            <SectionHead
              label={isCounty ? `§ ${region.name} Facilities` : "§ All Facilities in this City"}
              title={
                isCounty
                  ? <>{region.name} — <em>every licensed facility, documented in the public record.</em></>
                  : <>Memory care options in {region.name}, <em>documented in the public record.</em></>
              }
            />
            <FacilityListClient
              facilities={facilities}
              stateSlug={region.state.slug}
              regionName={region.name}
              hiddenSmallCount={smallCount}
              initialShowSmall={visibleCount === 0 && smallCount > 0}
            />
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
