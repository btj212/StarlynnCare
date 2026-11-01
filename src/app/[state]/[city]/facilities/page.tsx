import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { FacilityListClient, type ListFacility } from "@/components/facility/FacilityListClient";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList, buildItemListSchema, buildWebPageWithReviewer } from "@/lib/seo/schema";
import { REGULATOR_ABBR, clipMetaDescription } from "@/lib/seo/meta";
import { displayCityName, resolveListingRegion } from "@/lib/resolveListingRegion";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { CITY_BROWSE_PAGE_SIZE } from "@/lib/facility/hubPreview";
import type { CareCategory } from "@/lib/types";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ state: string; city: string }>;
  searchParams: Promise<{ page?: string; q?: string; homes?: string }>;
};

function firstParam(value: string | undefined): string {
  return (value ?? "").trim();
}

function pageNumber(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function browsePath(
  stateSlug: string,
  regionSlug: string,
  options: { page?: number; q?: string; homes?: string },
): string {
  const params = new URLSearchParams();
  if (options.q) params.set("q", options.q);
  if (options.homes === "small") params.set("homes", "small");
  if (options.page && options.page > 1) params.set("page", String(options.page));
  const query = params.toString();
  return `/${stateSlug}/${regionSlug}/facilities${query ? `?${query}` : ""}`;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { state: stateSlug, city: regionSlug } = await params;
  const query = await searchParams;
  const supabase = tryPublicSupabaseClient();
  const region = await resolveListingRegion(stateSlug, regionSlug, supabase);
  if (!region) return { title: "Facilities | StarlynnCare" };

  const page = pageNumber(query.page);
  const q = firstParam(query.q);
  const path = browsePath(region.state.slug, region.slug, {
    page,
    q,
    homes: query.homes,
  });
  const canonical = canonicalFor(path);
  const reg = REGULATOR_ABBR[region.state.code] ?? "state";
  const desc = clipMetaDescription(
    `Browse licensed memory care facilities in ${region.name}, ${region.state.name}. Search by name and filter by size. Independent ${reg} inspection records.`,
  );
  const title = `Memory care facilities in ${region.name}, ${region.state.code}`;
  const filtered = page > 1 || q.length > 0 || query.homes === "small";

  return {
    title,
    description: desc,
    alternates: { canonical },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description: desc,
      url: canonical,
      type: "website",
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
    },
  };
}

export default async function CityFacilitiesPage({ params, searchParams }: PageProps) {
  const { state: stateSlug, city: regionSlug } = await params;
  const query = await searchParams;
  const supabase = tryPublicSupabaseClient();
  const region = await resolveListingRegion(stateSlug, regionSlug, supabase);
  if (!region) notFound();

  let facilities: ListFacility[] = [];
  let fetchError: string | null = null;

  if (!supabase) {
    fetchError = "Supabase is not configured.";
  } else {
    const { data: rawFacilities, error } = await supabase
      .from("facilities")
      .select(
        "id, name, city, street, zip, city_slug, slug, beds, care_category, photo_url, serves_memory_care, memory_care_disclosure_filed, tx_alzheimer_certified, capacity_tier",
      )
      .eq("state_code", region.state.code)
      .eq("publishable", true)
      .in("city_slug", region.citySlugs as unknown as string[])
      .order("name", { ascending: true });

    if (error) {
      fetchError = error.message;
    } else {
      const raw = (rawFacilities ?? []) as Array<{
        id: string;
        name: string;
        city: string | null;
        street: string | null;
        zip: string | null;
        city_slug: string;
        slug: string;
        beds: number | null;
        care_category: string;
        photo_url: string | null;
        serves_memory_care: boolean;
        memory_care_disclosure_filed: boolean;
        tx_alzheimer_certified: boolean | null;
        capacity_tier: "small" | "medium" | "large" | "unknown";
      }>;

      if (raw.length > 0) {
        const ids = raw.map((facility) => facility.id);
        const allInspections: Array<{ id: string; facility_id: string }> = [];
        for (let index = 0; index < ids.length; index += 150) {
          const chunk = ids.slice(index, index + 150);
          const { data, error: chunkError } = await supabase
            .from("inspections")
            .select("id, facility_id")
            .in("facility_id", chunk)
            .limit(5000);
          if (chunkError) {
            console.error("[city facilities] inspections chunk failed:", chunkError.message);
            break;
          }
          if (data) allInspections.push(...(data as typeof allInspections));
        }

        const inspectionCount = new Map<string, number>();
        const inspectionFacility = new Map<string, string>();
        for (const inspection of allInspections) {
          inspectionCount.set(
            inspection.facility_id,
            (inspectionCount.get(inspection.facility_id) ?? 0) + 1,
          );
          inspectionFacility.set(inspection.id, inspection.facility_id);
        }

        const inspectionIds = allInspections.map((inspection) => inspection.id);
        const allDeficiencies: Array<{ inspection_id: string; class: string | null; severity: number | null }> = [];
        for (let index = 0; index < inspectionIds.length; index += 150) {
          const chunk = inspectionIds.slice(index, index + 150);
          const { data, error: chunkError } = await supabase
            .from("deficiencies")
            .select("inspection_id, class, severity")
            .in("inspection_id", chunk)
            .limit(5000);
          if (chunkError) {
            console.error("[city facilities] deficiencies chunk failed:", chunkError.message);
            break;
          }
          if (data) allDeficiencies.push(...(data as typeof allDeficiencies));
        }

        const citationCount = new Map<string, number>();
        const seriousCount = new Map<string, number>();
        for (const deficiency of allDeficiencies) {
          const facilityId = inspectionFacility.get(deficiency.inspection_id);
          if (!facilityId) continue;
          citationCount.set(facilityId, (citationCount.get(facilityId) ?? 0) + 1);
          const serious = deficiency.class === "Type A" || (deficiency.severity ?? 0) >= 3;
          if (serious) seriousCount.set(facilityId, (seriousCount.get(facilityId) ?? 0) + 1);
        }

        facilities = raw.map((facility) => ({
          id: facility.id,
          name: facility.name,
          city: displayCityName(facility.city, facility.city_slug),
          street: facility.street,
          zip: facility.zip,
          city_slug: facility.city_slug,
          slug: facility.slug,
          beds: facility.beds,
          care_category: facility.care_category as CareCategory,
          photo_url: facility.photo_url,
          serves_memory_care: facility.serves_memory_care,
          memory_care_disclosure_filed: facility.memory_care_disclosure_filed,
          tx_alzheimer_certified: facility.tx_alzheimer_certified ?? undefined,
          capacity_tier: facility.capacity_tier,
          inspections: inspectionCount.get(facility.id) ?? 0,
          serious_citations: seriousCount.get(facility.id) ?? 0,
          total_citations: citationCount.get(facility.id) ?? 0,
        }));
      }
    }
  }

  if (!fetchError && facilities.length === 0) notFound();

  const q = firstParam(query.q).toLowerCase();
  const smallOnly = query.homes === "small";
  const smallCount = facilities.filter((facility) => facility.capacity_tier === "small").length;
  const nonSmall = facilities.filter((facility) => facility.capacity_tier !== "small");
  let listed = facilities;
  if (q) {
    listed = facilities.filter((facility) => {
      const name = facility.name.toLowerCase();
      const city = facility.city?.toLowerCase() ?? "";
      return name.includes(q) || city.includes(q);
    });
  } else if (smallOnly) {
    listed = facilities.filter((facility) => facility.capacity_tier === "small");
  } else if (nonSmall.length > 0) {
    listed = nonSmall;
  }

  const pageCount = Math.max(1, Math.ceil(listed.length / CITY_BROWSE_PAGE_SIZE));
  const page = Math.min(pageNumber(query.page), pageCount);
  const start = (page - 1) * CITY_BROWSE_PAGE_SIZE;
  const pageRows = listed.slice(start, start + CITY_BROWSE_PAGE_SIZE);
  const browseCanonical = canonicalFor(
    browsePath(region.state.slug, region.slug, { page, q: firstParam(query.q), homes: query.homes }),
  );
  const itemList = pageRows.slice(0, 50).map((facility) => ({
    name: facility.name,
    url: canonicalFor(`/${region.state.slug}/${facility.city_slug}/${facility.slug}`),
    facilityId: facility.id,
    street: facility.street,
    city: facility.city,
    postalCode: facility.zip,
    addressRegion: region.state.name,
  }));
  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: region.state.name, url: canonicalFor(`/${region.state.slug}`) },
      { name: region.name, url: canonicalFor(`/${region.state.slug}/${region.slug}`) },
      { name: "All facilities", url: browseCanonical },
    ]),
    buildWebPageWithReviewer({
      name: `Memory care facilities in ${region.name}`,
      url: browseCanonical,
      description: `Licensed memory care facilities in ${region.name}, ${region.state.name}.`,
    }),
    ...(itemList.length > 0
      ? [buildItemListSchema(`Memory care facilities in ${region.name}`, browseCanonical, itemList)]
      : []),
  ];

  const pager = (target: number) =>
    browsePath(region.state.slug, region.slug, {
      page: target,
      q: firstParam(query.q),
      homes: query.homes,
    });

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar scope={region.state.code} />
      <SiteNav
        countStateCode={region.state.code}
        badge={region.name}
        ctaHref={`/${region.state.slug}/${region.slug}`}
        ctaLabel={`${region.name} overview`}
        stateNavHref={`/${region.state.slug}`}
      />
      <main style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 md:px-10">
            <p className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-rust">
              {region.state.name} · {region.name}
            </p>
            <h1
              className="mb-4 font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink"
              style={{ fontSize: "clamp(36px, 4.5vw, 58px)", lineHeight: 1.05 }}
            >
              {region.name} — <em className="text-rust not-italic">every licensed facility</em>
            </h1>
            <p className="mt-3 max-w-[52ch] font-[family-name:var(--font-display)] text-[18px] italic leading-[1.5] text-ink-3">
              Search the full {region.name} list. The city overview keeps a shorter first set.
            </p>
            <form action={`/${region.state.slug}/${region.slug}/facilities`} className="mt-6 max-w-md">
              <label className="sr-only" htmlFor="city-facility-search">
                Search facilities in {region.name}
              </label>
              <input
                id="city-facility-search"
                type="search"
                name="q"
                defaultValue={firstParam(query.q)}
                placeholder={`Search facilities in ${region.name}`}
                className="w-full rounded-[14px] border border-clearing-rule-2 bg-clearing-card px-4 py-2.5 text-sm text-ink shadow-[var(--shadow-card)] placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none"
              />
            </form>
            <div className="mt-5 flex flex-wrap items-baseline gap-6 font-[family-name:var(--font-mono)] text-[12px] tracking-[0.04em] text-ink-3">
              <span>
                <strong className="text-[18px] font-semibold text-ink">{listed.length}</strong>{" "}
                {listed.length === 1 ? "facility" : "facilities"} in this list
              </span>
              {smallCount > 0 && !q && (
                <Link
                  href={browsePath(region.state.slug, region.slug, {
                    homes: smallOnly ? undefined : "small",
                  })}
                  className="text-teal underline underline-offset-4"
                >
                  {smallOnly ? "Show larger homes" : `Show ${smallCount} homes of 6 beds or fewer`}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6 md:px-10">
          {fetchError ? (
            <div className="mt-10 border border-gold/30 bg-gold-soft px-5 py-4 text-sm">
              <p className="font-semibold text-gold">Configuration</p>
              <p className="mt-2 text-ink-2">{fetchError}</p>
            </div>
          ) : pageRows.length === 0 ? (
            <p className="mt-12 text-sm text-muted">No facilities match that search.</p>
          ) : (
            <FacilityListClient
              facilities={pageRows}
              stateSlug={region.state.slug}
              regionName={region.name}
              hiddenSmallCount={0}
              resultsOnly
            />
          )}

          {pageCount > 1 && (
            <nav className="mt-10 flex flex-wrap items-center gap-3 text-sm" aria-label="Pages">
              {page > 1 ? (
                <Link href={pager(page - 1)} className="text-teal underline underline-offset-4">
                  Previous
                </Link>
              ) : null}
              <span className="font-[family-name:var(--font-mono)] text-ink-3">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link href={pager(page + 1)} className="text-teal underline underline-offset-4">
                  Next
                </Link>
              ) : null}
            </nav>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
