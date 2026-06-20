import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SectionHead } from "@/components/editorial/SectionHead";
import { StatBlock, type StatItem } from "@/components/editorial/StatBlock";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { UpdatedStamp } from "@/components/editorial/UpdatedStamp";
import { FacilityListClient, type ListFacility } from "@/components/facility/FacilityListClient";
import { AreaWatchModal } from "@/components/facility/AreaWatchModal";
import { TopGradedFacilities } from "@/components/facility/TopGradedFacilities";
import { SiblingCityHubLinks } from "@/components/facility/SiblingCityHubLinks";
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
  buildSpeakableSchema,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";
import { buildCityFaqs } from "@/lib/content/cityFaqs";
import { REGULATOR_ABBR, clipMetaDescription } from "@/lib/seo/meta";
import type { CareCategory } from "@/lib/types";
import { loadRegionHubSummary } from "@/lib/regionsHubCount";
import { parentCountyForCity } from "@/lib/regions";
import { cityIntroForRegion, countyIntroParasForRegion } from "@/lib/content/cityIntros";
import { loadPublishedHubContent, sanitizeHubHtml } from "@/lib/content/loadHubContent";
import { formatCostRange, getStateCostBand } from "@/lib/content/stateCostBands";
import { HubEligibility } from "@/components/hub/HubEligibility";
import { HubDifferentiators, type RegionHubStats } from "@/components/editorial/HubDifferentiators";

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
  // We also reuse the same query path to derive the data-driven SERP snippet.
  let totalCount = 0;
  let withDeficiency = 0;
  let findingsDate: string | null = null;
  let metaFirstPublishedAt: string | null = null;
  if (supabase) {
    const summary = await loadRegionHubSummary(supabase, region);
    if (summary.totalCount === 0) notFound();
    totalCount = summary.totalCount;
    withDeficiency = summary.withDeficiency;
    findingsDate = summary.findingsDate;
    metaFirstPublishedAt = summary.firstPublishedAt;
  }

  const canonical = canonicalFor(`/${region.state.slug}/${region.slug}`);
  const reg = REGULATOR_ABBR[region.state.code] ?? "state";
  const facilityNoun = region.state.code === "TX" ? "ALFs" : "facilities";
  const isCounty = region.kind === "county";

  // Title: lead with the "Best X, ranked by inspection records" frame — this matches
  // dominant search intent (comparison/selection) while keeping the watchdog differentiation
  // in the subtitle and body. The citation hook becomes proof of rigor, not the headline.
  const stateAbbr = region.state.code;
  let metaTitle: string;
  if (isCounty) {
    const candidates = [
      `Best Memory Care in ${region.name}, ${stateAbbr} — Ranked by Inspections`,
      `Best Memory Care in ${region.name}, ${stateAbbr}`,
      `Memory Care in ${region.name}, ${region.state.name} - Rankings`,
      `Memory Care in ${region.name}, ${region.state.name}`,
    ];
    metaTitle = candidates.find((c) => c.length <= 60) ?? candidates.at(-1)!;
  } else {
    const candidates = [
      `Best Memory Care in ${region.name}, ${stateAbbr} — Ranked by Inspections`,
      `Best Memory Care in ${region.name}, ${stateAbbr}`,
      `Memory Care in ${region.name}, ${region.state.name} - Inspection Records`,
      `Memory Care in ${region.name}, ${region.state.name}`,
    ];
    metaTitle = candidates.find((c) => c.length <= 60) ?? candidates.at(-1)!;
  }

  // Data-driven description: lead with ranking promise — count + record basis — then
  // cite the citation stat as proof of rigor rather than the headline of doom.
  const dataDriven =
    totalCount > 0
      ? `${totalCount} memory care ${facilityNoun} in ${region.name}, ranked by ${reg} inspection records. ${withDeficiency > 0 ? `${withDeficiency} have citations on file.` : "Includes full citation history."}`
      : null;

  const fallbackByState: Record<string, string> = {
    CA: `State inspection records and citation history for every licensed memory care facility in ${region.name}, built from primary CDSS data.`,
    TX: `HHSC-sourced inspection listings for Alzheimer-certified assisted living in ${region.name}, Texas — built from public LTCR records.`,
    OR: `Oregon DHS inspection records for every Memory Care Endorsed ALF and RCF in ${region.name} — sourced directly from the DHS LTC Licensing portal.`,
    WA: `DSHS inspection and investigation records for every Specialized Dementia Care ALF in ${region.name}, Washington — sourced from the DSHS ALF Reports portal.`,
    MN: `MDH inspection records for every licensed Assisted Living Facility with Dementia Care in ${region.name}, Minnesota — sourced from the MN Department of Health.`,
  };
  const desc = clipMetaDescription(
    dataDriven ??
      fallbackByState[region.state.code] ??
      `State inspection records for licensed memory care facilities in ${region.name}, ${region.state.name}.`,
  );
  return {
    title: metaTitle,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: metaTitle,
      description: desc,
      url: canonical,
      type: "website",
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
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
  const isCounty = region.kind === "county";
  const reg = REGULATOR_ABBR[region.state.code] ?? "state";
  // For city pages: look up parent county so we can show a county breadcrumb link
  const parentCounty = !isCounty
    ? parentCountyForCity(region.state.code, region.slug)
    : null;
  let facilities: ListFacility[] = [];
  let fetchError: string | null = null;
  // PA county IJ tracker — populated inside the supabase block, used outside.
  const ijCitByFac = new Map<string, number>();

  if (!supabase) {
    fetchError = "Supabase is not configured.";
  } else {
    // 1. Facilities
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
        id: string; name: string; city: string | null; street: string | null;
        zip: string | null; city_slug: string;
        slug: string; beds: number | null; care_category: string;
        photo_url: string | null; serves_memory_care: boolean;
        memory_care_disclosure_filed: boolean;
        tx_alzheimer_certified: boolean | null;
        capacity_tier: "small" | "medium" | "large" | "unknown";
      }>;

      if (raw.length > 0) {
        const ids = raw.map((f) => f.id);

        // 2. Inspections — chunked to avoid URL-length limits and PostgREST's
        //    default 1000-row cap. Large county pages can have 100+ facilities
        //    with hundreds of inspections each; without chunking the counts are
        //    silently truncated and citation badges show 0.
        const INSP_CHUNK = 150;
        const allInspData: Array<{ id: string; facility_id: string; inspection_date: string }> = [];
        for (let ci = 0; ci < ids.length; ci += INSP_CHUNK) {
          const chunk = ids.slice(ci, ci + INSP_CHUNK);
          const { data: chunkData, error: chunkErr } = await supabase
            .from("inspections")
            .select("id, facility_id, inspection_date")
            .in("facility_id", chunk)
            .limit(5000);
          if (chunkErr) {
            console.error("[hub] inspections chunk failed:", chunkErr.message);
            break;
          }
          if (chunkData) allInspData.push(...(chunkData as typeof allInspData));
        }

        const cutoff3y = new Date();
        cutoff3y.setFullYear(cutoff3y.getFullYear() - 3);
        const cutoff3yStr = cutoff3y.toISOString().split("T")[0];

        const inspCountByFac = new Map<string, number>();
        const recentInspCountByFac = new Map<string, number>();
        const inspFacMap = new Map<string, string>();
        for (const i of allInspData) {
          inspCountByFac.set(i.facility_id, (inspCountByFac.get(i.facility_id) ?? 0) + 1);
          inspFacMap.set(i.id, i.facility_id);
          if (i.inspection_date >= cutoff3yStr) {
            recentInspCountByFac.set(i.facility_id, (recentInspCountByFac.get(i.facility_id) ?? 0) + 1);
          }
        }

        const inspIds = allInspData.map((i) => i.id);

        // 3. Deficiencies — chunked to avoid URL-length limits on the IN clause.
        //    Each chunk query uses a high explicit limit (5000) to bypass PostgREST's
        //    default 1000-row cap, which otherwise silently truncates large cities.
        //    Serious = Type A class OR severity >= 3 (whichever is populated by the ingest).
        const DEF_CHUNK = 150;
        const allDefs: Array<{ inspection_id: string; class: string | null; severity: number | null }> = [];
        for (let ci = 0; ci < inspIds.length; ci += DEF_CHUNK) {
          const chunk = inspIds.slice(ci, ci + DEF_CHUNK);
          const { data: chunkData, error: chunkErr } = await supabase
            .from("deficiencies")
            .select("inspection_id, class, severity")
            .in("inspection_id", chunk)
            .limit(5000);
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
          // Type A class OR severity >= 3 — handles whichever field the ingest populates.
          const isSerious = d.class === "Type A" || (d.severity ?? 0) >= 3;
          if (isSerious) {
            seriousCitByFac.set(fid, (seriousCitByFac.get(fid) ?? 0) + 1);
          }
          if ((d.severity ?? 0) >= 4) {
            ijCitByFac.set(fid, (ijCitByFac.get(fid) ?? 0) + 1);
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
          tx_alzheimer_certified: Boolean(f.tx_alzheimer_certified),
          inspections: inspCountByFac.get(f.id) ?? 0,
          total_citations: totalCitByFac.get(f.id) ?? 0,
          serious_citations: seriousCitByFac.get(f.id) ?? 0,
          limitedHistory: (recentInspCountByFac.get(f.id) ?? 0) < 4,
        }));
      }
    }
  }

  // Hub differentiators RPC — runs in parallel with the date queries below.
  // Returns a single row; result is null when Supabase is unavailable.
  let hubStats: RegionHubStats | null = null;
  if (supabase) {
    const { data: hubStatsRows } = await supabase
      .rpc("region_hub_stats", {
        p_state_code: region.state.code,
        p_city_slugs: region.citySlugs as unknown as string[],
      })
      .limit(1);
    hubStats = (hubStatsRows as RegionHubStats[] | null)?.[0] ?? null;
  }

  const smallCount = facilities.filter((f) => f.capacity_tier === "small").length;
  const visibleCount = facilities.filter((f) => f.capacity_tier !== "small").length;
  const totalCount = facilities.length;

  // PA county record stats — derived from already-fetched data, no extra queries.
  const paTotalDeficiencies = facilities.reduce((s, f) => s + f.total_citations, 0);
  const paTotalSevere = facilities.reduce((s, f) => s + f.serious_citations, 0);
  const paTotalIj = facilities.reduce((s, f) => s + (ijCitByFac.get(f.id) ?? 0), 0);
  const paAvgSevere =
    totalCount > 0 ? Math.round((paTotalSevere / totalCount) * 10) / 10 : 0;

  // Most-cited on record for the "both directions" mini-list (PA county only).
  const paMostCited = [...facilities]
    .sort((a, b) => b.serious_citations - a.serious_citations || b.total_citations - a.total_citations)
    .slice(0, 5)
    .filter((f) => f.serious_citations > 0);

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

    // Chunk to avoid URL-length limits; date filter reduces rows but county
    // pages can still have 100+ facilities in scope.
    const TREND_INSP_CHUNK = 150;
    const trendInspRows: Array<{ id: string; facility_id: string }> = [];
    for (let ci = 0; ci < ids.length; ci += TREND_INSP_CHUNK) {
      const chunk = ids.slice(ci, ci + TREND_INSP_CHUNK);
      const { data: chunkData } = await supabase
        .from("inspections")
        .select("id, facility_id")
        .in("facility_id", chunk)
        .gte("inspection_date", isoDate)
        .limit(5000);
      if (chunkData) trendInspRows.push(...(chunkData as typeof trendInspRows));
    }

    const facilityByInsp = new Map(
      trendInspRows.map((r) => [r.id, r.facility_id]),
    );
    const inspIds = trendInspRows.map((r) => r.id);

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
  const pageTitleCandidates = isCounty
    ? [
        `Best Memory Care in ${region.name}, ${region.state.code} — Ranked by Inspections`,
        `Best Memory Care in ${region.name}, ${region.state.code}`,
        `Memory Care in ${region.name}, ${region.state.name} - Rankings`,
        `Memory Care in ${region.name}, ${region.state.name}`,
      ]
    : [
        `Best Memory Care in ${region.name}, ${region.state.code} — Ranked by Inspections`,
        `Best Memory Care in ${region.name}, ${region.state.code}`,
        `Memory Care in ${region.name}, ${region.state.name} - Inspection Records`,
        `Memory Care in ${region.name}, ${region.state.name}`,
      ];
  const pageTitle = pageTitleCandidates.find((c) => c.length <= 60) ?? pageTitleCandidates.at(-1)!;
  const pageDesc =
    region.state.code === "TX"
      ? `${totalCount} Alzheimer-certified assisted living facilities in ${region.name}, ranked by HHSC inspection records — public LTCR data where published.`
      : region.state.code === "AZ"
        ? `${totalCount} licensed memory care facilities in ${region.name}, ranked by ADHS inspection records. AZ Care Check inspection history for every facility.`
        : `${totalCount} licensed memory care facilities in ${region.name}, ranked by state inspection records. Full CDSS citation history for every facility.`;

  // Data source label for stat blocks — state-specific regulator attribution.
  const stateDataSrc =
    region.state.code === "AZ" ? "ADHS / AZ Care Check"
    : region.state.code === "WA" ? "DSHS"
    : region.state.code === "MN" ? "MDH"
    : region.state.code === "OR" ? "OHA"
    : region.state.code === "UT" ? "DLBC"
    : region.state.code === "IL" ? "IDPH"
    : "CDSS";

  // States where we have row-level deficiency data (deficiencies table populated).
  // AZ, IL, UT currently store only inspection-level totals — hide the "§ Findings"
  // section to avoid showing a misleading "0 (0%)" for those states.
  const HAS_DEFICIENCY_TABLE = new Set(["CA", "WA", "OR", "MN", "PA"]);
  // For PA county pages, sort the ItemList JSON-LD by record rank (most severe first)
  // so ItemList positions reflect the displayed "By record" ordering.
  const sortedFacilitiesForItemList =
    region.state.code === "PA" && isCounty
      ? [...facilities].sort(
          (a, b) => b.serious_citations - a.serious_citations || b.total_citations - a.total_citations,
        )
      : facilities;
  const itemListFacilities = sortedFacilitiesForItemList.map((f) => ({
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

  // Real ingest-derived "as of" date — the latest `facilities.updated_at` for this region's
  // publishable rows. Falls back to null if Supabase is unreachable so the footnote omits
  // a date rather than misleadingly showing the build/deploy date.
  let findingsDate: string | null = null;
  let firstPublishedAt: string | null = null;
  if (supabase) {
    const [refreshRow, firstRow] = await Promise.all([
      supabase
        .from("facilities")
        .select("updated_at")
        .eq("state_code", region.state.code)
        .eq("publishable", true)
        .in("city_slug", region.citySlugs as unknown as string[])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("facilities")
        .select("created_at")
        .eq("state_code", region.state.code)
        .eq("publishable", true)
        .in("city_slug", region.citySlugs as unknown as string[])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const row = refreshRow.data as { updated_at: string } | null;
    findingsDate = row?.updated_at
      ? new Date(row.updated_at).toISOString().split("T")[0]
      : null;
    const firstRow2 = firstRow.data as { created_at: string } | null;
    firstPublishedAt = firstRow2?.created_at
      ? new Date(firstRow2.created_at).toISOString()
      : null;
  }

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
      datePublished: firstPublishedAt,
      dateModified: findingsDate,
    }),
    buildCollectionPageSchema({
      name: `Memory care in ${region.name}`,
      url: pageUrl,
      region,
      datePublished: firstPublishedAt,
      dateModified: findingsDate,
    }),
    buildItemListSchema(
      `Memory care facilities in ${region.name}`,
      pageUrl,
      itemListFacilities,
    ),
    buildFaqSchemaFromPairs(faqPairs, pageUrl),
    buildSpeakableSchema({ url: pageUrl, cssSelectors: ["#hub-lede", "#hub-stats"] }),
  ];

  // ── Additional data for content blocks ────────────────────────────────────

  // Regulator primer (CA-specific)
  const regulatorPrimer = getRegulatorPrimer(region.state.code);

  const regionStatItems: StatItem[] =
    region.state.code === "TX"
      ? [
          {
            n: String(totalCount),
            label: `Alzheimer-certified assisted living facilities indexed in ${region.name}`,
            src: "HHSC ALF directory",
          },
          {
            n: String(facilitiesWithSeriousDef),
            label:
              "Facilities with at least one cited deficiency in the indexed LTCR inspection record on file",
            src: "HHSC LTCR",
            delta: totalCount > 0 ? `${severePct}% of indexed facilities` : undefined,
          },
          {
            n: String(visibleCount),
            label: "Facilities with full StarlynnCare profile published",
            src: "StarlynnCare",
          },
        ]
      : region.state.code === "PA" && isCounty
      ? [
          {
            n: String(totalCount),
            label: `Licensed PCH / ALR memory care facilities indexed in ${region.name} County`,
            src: "PA DHS OLTL",
          },
          {
            n: String(paTotalDeficiencies),
            label: `Total PA DHS citations on record across all ${region.name} facilities`,
            src: "PA DHS OLTL",
            delta: totalCount > 0 ? `avg ${Math.round(paTotalDeficiencies / totalCount)} per facility` : undefined,
          },
          {
            n: String(paTotalSevere),
            label: "Severe findings (PA DHS severity ≥ 3) on record",
            src: "PA DHS OLTL",
            delta: `avg ${paAvgSevere} per facility`,
          },
          {
            n: String(paTotalIj),
            label: "Immediate-jeopardy findings on record",
            src: "PA DHS OLTL",
          },
        ]
      : [
          {
            n: String(totalCount),
            label: `Licensed memory care facilities indexed in ${region.name}`,
            src: stateDataSrc,
          },
          ...(HAS_DEFICIENCY_TABLE.has(region.state.code)
            ? [
                {
                  n: String(facilitiesWithSeriousDef),
                  label:
                    "Facilities with at least one Type-A or Type-B deficiency finding in the indexed inspection record (24 months where dated)",
                  src: stateDataSrc,
                  delta: totalCount > 0 ? `${severePct}% of indexed facilities` : undefined,
                },
              ]
            : []),
          {
            n: String(visibleCount),
            label: `Facilities with full ${stateDataSrc} profile published on StarlynnCare`,
            src: "StarlynnCare",
          },
        ];

  // Live, human-approved editorial body (city hubs). Falls back to the
  // hand-authored intro when no published/non-drifted row exists.
  const dbCityHub = !isCounty
    ? await loadPublishedHubContent(region.state.code, region.slug)
    : null;
  const cityIntro =
    !isCounty && !dbCityHub
      ? cityIntroForRegion(region.state.code, region.slug)
      : null;
  const countyIntroParas = isCounty ? countyIntroParasForRegion(region.state.code, region.slug) : null;

  return (
    <>
      <JsonLd objects={regionJsonLd} />
      {/* DOM reorder: <main> (H1) is first in source; GovernanceBar+SiteNav use flex order:-1 to appear visually above it. SiteNav sticky top-0 still functions since sticky is relative to the viewport scroll container, not the flex parent. */}
      <div className="flex flex-col">
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
              {parentCounty && (
                <>
                  <span aria-hidden>›</span>
                  <Link href={`/${region.state.slug}/${parentCounty.slug}`} className="hover:text-teal transition-colors">
                    {parentCounty.name}
                  </Link>
                </>
              )}
              <span aria-hidden>›</span>
              <span className="text-ink-3">{region.name}</span>
            </nav>

            <h1
              className="font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink mb-4"
              style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1 }}
            >
              Best memory care in {region.name}
            </h1>
            <p
              id="hub-lede"
              className="font-[family-name:var(--font-display)] italic text-[20px] leading-[1.4] text-ink-3 max-w-[50ch]"
            >
              {region.state.code === "TX" ? (
                <>
                  {totalCount} Alzheimer-certified facilities, ranked by HHSC inspection
                  records — every finding drawn from Long-Term Care Regulation (LTCR).
                </>
              ) : (
                <>
                  {totalCount > 0 ? `${totalCount} licensed facilities, ` : ""}ranked by
                  state inspection records — every citation from primary{" "}
                  {reg} data, no referral fees.
                </>
              )}
            </p>
            {findingsDate && <UpdatedStamp isoDate={findingsDate} />}
            {dbCityHub ? (
              <div
                className="mt-6 text-[17px] leading-relaxed text-ink-2 max-w-[62ch] [&_p]:mt-4 [&_p:first-child]:mt-0 [&_a]:text-teal [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: sanitizeHubHtml(dbCityHub.bodyHtml) }}
              />
            ) : cityIntro ? (
              <p className="mt-6 text-[17px] leading-relaxed text-ink-2 max-w-[62ch]">
                {cityIntro}
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Stats / Findings ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
            {totalCount > 0 ? (
              <>
                {HAS_DEFICIENCY_TABLE.has(region.state.code) && (
                  <>
                    <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
                      § Findings
                    </div>
                    <p className="font-[family-name:var(--font-display)] text-[22px] leading-[1.3] text-ink mb-4">
                      {region.state.code === "TX" ? (
                        <>
                          Of the{" "}
                          <strong className="font-normal text-rust">{totalCount}</strong>{" "}
                          Alzheimer-certified facilities indexed in {region.name},{" "}
                          <strong className="font-normal text-rust">{facilitiesWithSeriousDef}</strong>{" "}
                          ({severePct}%) have at least one cited deficiency in the inspection data on
                          file. Texas ALF license Type A/B/C is a <em>capacity</em> class on the
                          license — not the same as California&rsquo;s Type-A/Type-B{" "}
                          <em>deficiency</em> labels.
                        </>
                      ) : (
                        <>
                          Of the{" "}
                          <strong className="font-normal text-rust">{totalCount}</strong>{" "}
                          licensed memory care facilities indexed in {region.name},{" "}
                          <strong className="font-normal text-rust">{facilitiesWithSeriousDef}</strong>{" "}
                          ({severePct}%) have a Type-A or Type-B deficiency in their state record
                          from the past 24 months.
                        </>
                      )}
                    </p>
                    {findingsDate && (
                      <DataFootnote
                        source={
                          region.state.code === "TX"
                            ? "Texas HHSC Long-Term Care Regulation"
                            : "CA CDSS Community Care Licensing"
                        }
                        refreshed={findingsDate}
                        note={
                          region.state.code === "TX"
                            ? "Deficiency labels are shown as published by HHSC; see methodology for scope"
                            : "Type-A = immediate health/safety risk; Type-B = lesser violation"
                        }
                      />
                    )}
                  </>
                )}

                <div id="hub-stats" className="mt-10">
                  <StatBlock stats={regionStatItems} />
                </div>
              </>
            ) : (
              <p className="text-ink-3 italic">No facilities indexed yet for this region.</p>
            )}
          </div>
        </div>

        {/* ── Top performers rail — positioned before the full list so it anchors the
            "ranked by inspection record" frame before the user hits the grid ── */}
        {!fetchError && totalCount > 0 && (
          <>
            {/* Hub differentiation block — unique-per-city computed stats */}
            {hubStats && (
              <HubDifferentiators
                stats={hubStats}
                regionName={region.name}
                stateSlug={region.state.slug}
                stateName={region.state.name}
              />
            )}

            <TopGradedFacilities
              citySlugs={region.citySlugs}
              stateCode={region.state.code}
              stateSlug={region.state.slug}
              countyName={region.name}
              isCity={!isCounty}
            />

            {/* PA county: most-cited on record (the other direction) */}
            {region.state.code === "PA" && isCounty && paMostCited.length > 0 && (
              <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 mt-10 pb-10">
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
                  Most-cited on record · {region.name} County · PA DHS OLTL
                </p>
                <ol className="space-y-2">
                  {paMostCited.map((f, i) => (
                    <li key={f.id} className="flex items-center gap-3 text-[14px]">
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 w-4 text-right shrink-0">
                        {i + 1}.
                      </span>
                      <Link
                        href={`/${region.state.slug}/${f.city_slug}/${f.slug}`}
                        className="text-ink hover:text-teal underline underline-offset-2 truncate"
                      >
                        {f.name}
                      </Link>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-rust shrink-0">
                        {f.serious_citations} severe
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}

        {/* ── Facility list ── */}
        {!fetchError && totalCount > 0 && (
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
            <SectionHead
              label={isCounty ? `§ ${region.name} — All Facilities` : "§ All Facilities"}
              title={
                isCounty
                  ? <>{region.name} — <em>every licensed facility ranked by inspection record.</em></>
                  : <>All memory care in {region.name}, <em>ranked by inspection record.</em></>
              }
            />
            <aside className="mb-6 text-[13px] font-[family-name:var(--font-mono)] text-ink-3">
              Use <strong className="font-semibold text-ink-2">By record</strong> to sort fewest citations first.
              Tier badges reflect inspection severity, repeat citations, and citation frequency relative to
              peers in {region.name}.{" "}
              <Link href="/methodology" className="text-teal underline underline-offset-4">
                See methodology
              </Link>
              .
            </aside>
            <FacilityListClient
              facilities={facilities}
              stateSlug={region.state.slug}
              regionName={region.name}
              hiddenSmallCount={smallCount}
              initialShowSmall={smallCount > 0}
            />
          </div>
        )}

        {/* ── County editorial intro — below grid for UX; preserved for AEO/GEO ── */}
        {isCounty && countyIntroParas && countyIntroParas.length > 0 && (
          <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-10">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust mb-5 border-t-2 border-ink pt-2.5 inline-block">
                About {region.name}
              </p>
              <div className="space-y-4 max-w-[72ch]">
                <p className="text-[17px] leading-[1.65] text-ink-2">{countyIntroParas[0]}</p>
              </div>
              {countyIntroParas.length > 1 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-[14px] text-teal hover:underline select-none list-none [&::-webkit-details-marker]:hidden">
                    Read more ↓
                  </summary>
                  <div className="mt-4 space-y-4 max-w-[72ch]">
                    {countyIntroParas.slice(1).map((para, i) => (
                      <p key={i} className="text-[17px] leading-[1.65] text-ink-2">
                        {para}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}

        {/* ── Regulator primer (all city + county pages, all states) ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
            <SectionHead
              label="How memory care is regulated here"
              title={<>The public record behind <em>every profile.</em></>}
            />
            <div
              className="text-[16px] leading-[1.7] text-ink-2 max-w-[72ch]"
              dangerouslySetInnerHTML={{ __html: regulatorPrimer }}
            />
          </div>
        </div>

        {/* ── Cost band placeholder (city pages only) ── */}
        {!isCounty && (
          <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
              <SectionHead
                label="Cost"
                title={<>What memory care costs <em>in this city.</em></>}
              />
              <p className="text-[16px] leading-[1.7] text-ink-2 max-w-[60ch]">
                Median monthly cost in {region.name} ranges from approximately{" "}
                <strong className="font-semibold">{formatCostRange(region.state.code, "city")}</strong>{" "}
                based on regional benchmarks.{" "}
                {region.state.code === "CA" ? (
                  <>
                    For statewide ranges, financing options, and hidden fees, read{" "}
                    <Link href="/california/cost-guide" className="text-teal underline underline-offset-4">
                      What memory care costs in California
                    </Link>
                    . Methodology for future verified city medians:{" "}
                  </>
                ) : (
                  <>For how we separate pricing estimates from inspection-derived facts, see </>
                )}
                <Link href="/methodology" className="text-teal underline underline-offset-4">
                  how we source data
                </Link>
                .
              </p>
              <DataFootnote
                source={`Regional estimate · ${getStateCostBand(region.state.code).source}`}
                note="Facility-specific quotes required before signing"
              />
            </div>
          </div>
        )}

        {/* ── Eligibility section (all regions, state-specific Medicaid/waiver content) ── */}
        {!fetchError && (
          <HubEligibility stateCode={region.state.code} regionName={region.name} />
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
                <p className="text-[15px] leading-[1.7] text-ink-2 mb-4 max-w-[72ch]">
                  In the last 12 months,{" "}
                  <strong>{countyTrendRows.length}</strong>{" "}
                  {countyTrendRows.length === 1 ? "facility" : "facilities"} in {region.name}{" "}
                  had at least one Type-A citation — the most serious deficiency class under
                  California Health &amp; Safety Code §1569. The full record for each facility
                  is published on{" "}
                  <a
                    href="https://www.ccld.dss.ca.gov/carefacilitysearch/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal underline underline-offset-4"
                  >
                    CDSS Community Care Licensing
                  </a>
                  .
                </p>
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

        {!isCounty && !fetchError && totalCount > 0 && (
          <SiblingCityHubLinks
            stateSlug={region.state.slug}
            stateCode={region.state.code}
            currentCitySlug={region.slug}
          />
        )}

        </main>
        <div className="-order-1">
          <GovernanceBar />
          <SiteNav countStateCode={region.state.code} badge={region.state.name} ctaHref={`/${region.state.slug}/facilities`} ctaLabel={`Browse ${region.state.name} facilities`} stateNavHref={`/${region.state.slug}`} />
          <AreaWatchModal areaName={region.name} areaSlug={region.slug} source="city_modal" />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
