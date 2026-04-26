import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FacilityListClient, type ListFacility } from "@/components/facility/FacilityListClient";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { resolveListingRegion } from "@/lib/resolveListingRegion";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
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
        "id, name, city, city_slug, slug, beds, care_category, photo_url, serves_memory_care, memory_care_disclosure_filed, capacity_tier",
      )
      .eq("state_code", region.state.code)
      .eq("publishable", true)
      .in("city_slug", region.citySlugs as unknown as string[])
      .order("name", { ascending: true });

    if (error) {
      fetchError = error.message;
    } else {
      const raw = (rawFacilities ?? []) as Array<{
        id: string; name: string; city: string | null; city_slug: string;
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
    identifier: f.id,
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

  return (
    <>
      <JsonLd objects={regionJsonLd} />
      <SiteNav />
      <main className="min-h-[60vh] border-b border-sc-border bg-warm-white">
        <div className="mx-auto max-w-[1120px] px-6 py-10 md:px-8 md:py-14">

          {/* ── Breadcrumb ── */}
          <nav className="flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-teal transition-colors">Home</Link>
            <span aria-hidden>›</span>
            <Link href={`/${region.state.slug}`} className="hover:text-teal transition-colors">
              {region.state.name}
            </Link>
            <span aria-hidden>›</span>
            <span className="text-ink font-medium">Memory care</span>
          </nav>

          {/* ── H1 ── */}
          <h1 className="mt-3 font-[family-name:var(--font-serif)] text-3xl font-semibold tracking-tight text-navy md:text-4xl md:leading-tight">
            Memory care in {region.name}
          </h1>

          {/* ── Stats line ── */}
          {totalCount > 0 && (
            <p className="mt-2 text-sm text-muted">
              <span className="font-semibold text-ink tabular-nums">{visibleCount}</span>{" "}
              {visibleCount === 1 ? "facility" : "facilities"} with verified CDSS records
              {smallCount > 0 && (
                <span>
                  {" "}·{" "}
                  <span className="tabular-nums">{smallCount}</span> small care homes available via filter
                </span>
              )}
            </p>
          )}

          {/* ── Brand callout ── */}
          <p className="mt-1.5 text-xs text-muted flex items-center gap-1">
            <svg className="h-3.5 w-3.5 shrink-0 text-teal" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            Profiles are published only after state-agency data is confirmed.{" "}
            <Link href="/methodology" className="text-teal hover:underline underline-offset-2">
              Our standard →
            </Link>
          </p>

          {/* ── Error state ── */}
          {fetchError && (
            <div className="mt-8 rounded-lg border border-amber/30 bg-amber-light px-5 py-4 text-sm">
              <p className="font-semibold text-amber">Configuration error</p>
              <p className="mt-2 text-slate">{fetchError}</p>
            </div>
          )}

          {/* ── Empty state ── */}
          {!fetchError && totalCount === 0 && (
            <div className="mt-10 rounded-lg border border-sc-border bg-white px-6 py-10 shadow-card">
              <p className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
                No facilities published yet
              </p>
              <p className="mt-3 max-w-xl text-slate leading-relaxed">
                The CDSS ingest for {region.name} has not yet produced verifiable records.
              </p>
            </div>
          )}

          {/* ── Client: search + filters + cards ── */}
          {!fetchError && totalCount > 0 && (
            <FacilityListClient
              facilities={facilities}
              stateSlug={region.state.slug}
              regionName={region.name}
              hiddenSmallCount={smallCount}
            />
          )}

        </div>
      </main>
      <SiteFooter />
    </>
  );
}
