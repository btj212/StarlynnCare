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
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { resolveListingRegion } from "@/lib/resolveListingRegion";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { getRegulatorPrimer } from "@/lib/content/regulatorPrimer";
import {
  buildBreadcrumbList,
  buildCollectionPageSchema,
  buildItemListSchema,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";
import type { CareCategory } from "@/lib/types";

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
  const canonical = canonicalFor(`/${region.state.slug}/${region.slug}`);
  const desc = `State inspection records, citation history, and quality grades for every licensed memory care facility in ${region.name}. Built from primary CDSS data.`;
  return {
    title: `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`,
      description: desc,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`,
      description: desc,
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
        const { data: inspData } = await supabase
          .from("inspections")
          .select("id, facility_id")
          .in("facility_id", ids);

        const inspCountByFac = new Map<string, number>();
        const inspFacMap = new Map<string, string>();
        for (const i of inspData ?? []) {
          inspCountByFac.set(i.facility_id, (inspCountByFac.get(i.facility_id) ?? 0) + 1);
          inspFacMap.set(i.id, i.facility_id);
        }

        const inspIds = (inspData ?? []).map((i: { id: string }) => i.id);

        // 3. Deficiencies — use severity (replaces broken class field)
        const { data: defData } = await supabase
          .from("deficiencies")
          .select("inspection_id, severity")
          .in("inspection_id", inspIds.length ? inspIds : ["__none__"]);

        const totalCitByFac = new Map<string, number>();
        const seriousCitByFac = new Map<string, number>();
        for (const d of (defData ?? []) as { inspection_id: string; severity: number | null }[]) {
          const fid = inspFacMap.get(d.inspection_id);
          if (!fid) continue;
          totalCitByFac.set(fid, (totalCitByFac.get(fid) ?? 0) + 1);
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

  const pageUrl = canonicalFor(`/${region.state.slug}/${region.slug}`);
  const pageTitle = `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`;
  const pageDesc = `State inspection records, citation history, and quality grades for every licensed memory care facility in ${region.name}. Built from primary CDSS data.`;
  const itemListFacilities = facilities.map((f) => ({
    name: f.name,
    url: canonicalFor(`/${region.state.slug}/${f.city_slug}/${f.slug}`),
    facilityId: f.id,
    street: f.street,
    city: f.city,
    postalCode: f.zip,
    addressRegion: region.state.name,
  }));
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
  ];

  // ── Additional data for content blocks ────────────────────────────────────

  // Severe (Type-A/B) deficiency count for the region
  let severeCount = 0;
  let severeQueryDate = "";
  if (supabase && facilities.length > 0) {
    const ids = facilities.map((f) => f.id);
    const { data: inspRows } = await supabase
      .from("inspections")
      .select("id, facility_id")
      .in("facility_id", ids);
    const inspIds = (inspRows ?? []).map((i: { id: string }) => i.id);
    if (inspIds.length > 0) {
      const { count: sevCount } = await supabase
        .from("deficiencies")
        .select("*", { count: "exact", head: true })
        .in("inspection_id", inspIds)
        .gte("severity", 3);
      severeCount = sevCount ?? 0;
    }
    severeQueryDate = new Date().toISOString().split("T")[0];
  }

  const severePct = totalCount > 0 ? Math.round((severeCount / totalCount) * 100) : 0;

  // Regulator primer (CA-specific)
  const regulatorPrimer = getRegulatorPrimer(region.state.code);

  const regionStatItems: StatItem[] = [
    {
      n: String(totalCount),
      label: `Licensed memory care facilities indexed in ${region.name}`,
      src: "CDSS",
    },
    {
      n: String(severeCount),
      label: "Severe (Type-A or Type-B) deficiency findings on file from the last 24 months",
      src: "CDSS",
      delta: totalCount > 0 ? `${severePct}% of facilities` : undefined,
    },
    {
      n: String(visibleCount),
      label: "Facilities with full CDSS profile published on StarlynnCare",
      src: "StarlynnCare",
    },
  ];

  const isCounty = region.kind === "county";

  return (
    <>
      <JsonLd objects={regionJsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>

        {/* ── Header ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-10 py-12">
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
              State inspection records, citation history, and quality grades for every licensed
              facility — built from primary CDSS data.
            </p>
          </div>
        </div>

        {/* ── Stats / Findings ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-10 py-14">
            {totalCount > 0 ? (
              <>
                <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
                  § Findings
                </div>
                <p className="font-[family-name:var(--font-display)] text-[22px] leading-[1.3] text-ink mb-4">
                  Of the{" "}
                  <strong className="font-normal text-rust">{totalCount}</strong>{" "}
                  licensed memory care facilities indexed in {region.name},{" "}
                  <strong className="font-normal text-rust">{severeCount}</strong>{" "}
                  ({severePct}%) have a Type-A or Type-B deficiency in their state record
                  from the past 24 months.
                </p>
                {severeQueryDate && (
                  <DataFootnote
                    source="CA CDSS Community Care Licensing"
                    refreshed={severeQueryDate}
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
            <div className="mx-auto max-w-[1280px] px-10 py-14">
              <SectionHead
                label="§ How memory care is regulated here"
                title={<>The public record that drives <em>every grade.</em></>}
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
            <div className="mx-auto max-w-[1280px] px-10 py-14">
              <SectionHead
                label="§ Cost"
                title={<>What memory care costs <em>in this city.</em></>}
              />
              <p className="text-[16px] leading-[1.7] text-ink-2 max-w-[60ch]">
                Median monthly cost in {region.name} ranges from approximately{" "}
                <strong className="font-semibold">$5,000–$9,000/month</strong> based on regional
                licensing data. We do not yet collect verified cost data for this specific area —
                see our{" "}
                <Link href="/methodology" className="text-teal underline underline-offset-4">
                  methodology
                </Link>{" "}
                for how cost figures will be sourced and verified when available.
              </p>
              <DataFootnote source="Estimate only · Unverified" note="Verified cost data coming Q3 2026" />
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {fetchError && (
          <div className="mx-auto max-w-[1280px] px-10 py-8">
            <div className="border border-gold/30 bg-gold-soft px-5 py-4 text-sm">
              <p className="font-semibold text-gold">Configuration error</p>
              <p className="mt-2 text-ink-2">{fetchError}</p>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!fetchError && totalCount === 0 && (
          <div className="mx-auto max-w-[1280px] px-10 py-14">
            <p className="font-[family-name:var(--font-display)] text-[24px] text-ink">
              No facilities published yet for {region.name}.
            </p>
            <p className="mt-3 text-ink-3 leading-relaxed max-w-xl">
              The CDSS ingest for this region has not yet produced verifiable records.
            </p>
          </div>
        )}

        {/* ── Facility list ── */}
        {!fetchError && totalCount > 0 && (
          <div className="mx-auto max-w-[1280px] px-10 py-14">
            <SectionHead
              label={isCounty ? `§ ${region.name} Facilities` : "§ All Facilities in this City"}
              title={
                isCounty
                  ? <>{region.name} — <em>every licensed facility, graded.</em></>
                  : <>Memory care options in {region.name}, <em>graded by the public record.</em></>
              }
            />
            <FacilityListClient
              facilities={facilities}
              stateSlug={region.state.slug}
              regionName={region.name}
              hiddenSmallCount={smallCount}
            />
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
