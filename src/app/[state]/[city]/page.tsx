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
import { REGULATOR_ABBR } from "@/lib/seo/meta";
import { formatFacilityName } from "@/lib/facility/displayName";
import { memoryCareBasis } from "@/lib/facility/memoryCareBasis";
import { careSettingCopy, listCareChip } from "@/lib/city-hub/careSetting";
import {
  cityDirectAnswer,
  cityFaqExtras,
  cityGlanceStats,
  cityHubH1,
  cityHubMetaDescription,
  cityHubTitle,
} from "@/lib/city-hub/copy";
import { computeCityHubGlance, recentSeriousHomes } from "@/lib/city-hub/stats";
import { dedupeHomesByDisplayName } from "@/lib/city-hub/dedupe";
import {
  belongsOnCityPage,
  displayMunicipality,
  paOverrideOrFilter,
  paOverridePageSlugs,
  waOverrideOrFilter,
  waOverridePageSlugs,
} from "@/lib/city-hub/municipality";
import { localHelpFor } from "@/lib/city-hub/localHelp";
import { CityDirectAnswer } from "@/components/city-hub/CityDirectAnswer";
import { CityRelatedGuides } from "@/components/city-hub/CityRelatedGuides";
import { CityLocalHelp } from "@/components/city-hub/CityLocalHelp";
import { CityAreasServed } from "@/components/city-hub/CityAreasServed";
import { findingsCopy } from "@/lib/city-hub/findings";
import { listLicenseLabel } from "@/lib/city-hub/licenseLabel";
import { areasServedFor, displayCountyCrumb, nearbyHubsFor } from "@/lib/city-hub/areas";
import { isSeriousCityFinding } from "@/lib/city-hub/stats";
import { RecentSeriousCitations } from "@/components/city-hub/RecentSeriousCitations";
import type { CareCategory } from "@/lib/types";
import { loadRegionHubSummary } from "@/lib/regionsHubCount";
import { homesForCityIndex, rankHubFacilities } from "@/lib/facility/hubPreview";
import { contentAliasFields } from "@/lib/facility/aliases";
import { CityHomeIndex } from "@/components/facility/CityHomeIndex";
import {
  RecentInspectionReports,
  type RecentReport,
} from "@/components/facility/RecentInspectionReports";
import { displayCityName } from "@/lib/resolveListingRegion";
import { isUsableInspectionDate, todayIsoDate } from "@/lib/data/inspectionDates";
import { parentCountyForCity } from "@/lib/regions";
import { cityIntroForRegion, countyIntroParasForRegion } from "@/lib/content/cityIntros";
import { formatCostRange, formatCurrency, getStateCostBand } from "@/lib/content/stateCostBands";
import { cityMemoryCareBand } from "@/lib/cost/costBand";
import { loadFacilityCosts } from "@/lib/cost/loadFacilityCosts";
import { HubEligibility } from "@/components/hub/HubEligibility";
import { HubDifferentiators, type RegionHubStats } from "@/components/editorial/HubDifferentiators";

export const revalidate = 3600;

const HUB_FACILITY_SELECT =
  "id, name, city, street, zip, city_slug, slug, beds, care_category, photo_url, serves_memory_care, memory_care_disclosure_filed, tx_alzheimer_certified, capacity_tier, content, license_type, wa_dementia_care_contract, wa_earc_sdc_contracted, wa_memory_care_certified, wa_facility_type, wa_contract_types, mc_program_confirmed, mc_program_source_url, wa_county, historical_city_slugs, az_mc_subclass, az_license_level, az_memory_care_endorsed, mce_endorsed, mc_designation_type, memory_care_disclosure_source, mn_dementia_care_licensed, il_dementia_program_flag, mo_alzheimer_scu, mo_level_of_care, ca_cdss_client_served";

type HubFacilityRow = {
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
  content: unknown;
  license_type: string | null;
  wa_dementia_care_contract: boolean | null;
  wa_earc_sdc_contracted: boolean | null;
  wa_memory_care_certified: boolean | null;
  wa_facility_type: string | null;
  wa_contract_types?: string[] | null;
  mc_program_confirmed?: boolean | null;
  mc_program_source_url?: string | null;
  wa_county?: string | null;
  historical_city_slugs?: string[] | null;
  az_mc_subclass: boolean | null;
  az_license_level: string | null;
  az_memory_care_endorsed: boolean | null;
  mce_endorsed: boolean | null;
  mc_designation_type: string | null;
  memory_care_disclosure_source: string | null;
  ca_cdss_client_served?: string[] | null;
  mn_dementia_care_licensed: boolean | null;
  il_dementia_program_flag: boolean | null;
  mo_alzheimer_scu: boolean | null;
  mo_level_of_care: string | null;
};

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
  let dementiaLicenseCount = 0;
  let hubNoindex = false;
  if (supabase) {
    const summary = await loadRegionHubSummary(supabase, region);
    // Only 404 on a confirmed empty hub. A transient Supabase error used to
    // return totalCount: 0 and get cached as not-found for up to revalidate.
    if (!summary.fetchError && summary.totalCount === 0) notFound();
    totalCount = summary.indexableFacilityCount;
    withDeficiency = summary.withDeficiency;
    dementiaLicenseCount = summary.dementiaLicenseCount;
    hubNoindex =
      !summary.fetchError &&
      summary.totalCount > 0 &&
      summary.indexableFacilityCount === 0;
  }

  const canonical = canonicalFor(`/${region.state.slug}/${region.slug}`);
  const reg = REGULATOR_ABBR[region.state.code] ?? "state";
  const metaTitle = cityHubTitle(region, totalCount, { dementiaLicenseCount });
  const desc = cityHubMetaDescription({
    region,
    listedCount: totalCount,
    withCitation: withDeficiency,
    regulatorAbbr: reg,
  });
  return {
    title: metaTitle,
    description: desc,
    alternates: { canonical },
    ...(hubNoindex ? { robots: { index: false, follow: true } } : {}),
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
  // Newest cited visit per home, for the "Recent reports" block on city pages.
  let recentReports: RecentReport[] = [];
  const allInspData: Array<{ id: string; facility_id: string; inspection_date: string }> = [];
  const allDefs: Array<{ inspection_id: string; class: string | null; severity: number | null }> = [];

  if (!supabase) {
    fetchError = "Supabase is not configured.";
  } else {
    // 1. Facilities
    const { data: rawFacilities, error } = await supabase
      .from("facilities")
      .select(HUB_FACILITY_SELECT)
      .eq("state_code", region.state.code)
      .eq("publishable", true)
      .in("city_slug", region.citySlugs as unknown as string[])
      .order("name", { ascending: true });

    if (error) {
      fetchError = error.message;
    } else {
      const seen = new Map<string, HubFacilityRow>();
      for (const row of (rawFacilities ?? []) as HubFacilityRow[]) seen.set(row.id, row);

      if (
        !isCounty &&
        region.state.code === "PA" &&
        paOverridePageSlugs().includes(region.slug)
      ) {
        const { data: extraRows } = await supabase
          .from("facilities")
          .select(HUB_FACILITY_SELECT)
          .eq("state_code", "PA")
          .eq("publishable", true)
          .or(paOverrideOrFilter());
        for (const row of (extraRows ?? []) as HubFacilityRow[]) {
          if (!seen.has(row.id)) seen.set(row.id, row);
        }
      }

      if (
        !isCounty &&
        region.state.code === "WA" &&
        waOverridePageSlugs().includes(region.slug)
      ) {
        const { data: extraRows } = await supabase
          .from("facilities")
          .select(HUB_FACILITY_SELECT)
          .eq("state_code", "WA")
          .eq("publishable", true)
          .or(waOverrideOrFilter());
        for (const row of (extraRows ?? []) as HubFacilityRow[]) {
          if (!seen.has(row.id)) seen.set(row.id, row);
        }
      }

      const raw = [...seen.values()].filter((row) =>
        isCounty
          ? true
          : belongsOnCityPage(
              {
                stateCode: region.state.code,
                zip: row.zip,
                name: row.name,
                citySlug: row.city_slug,
                county: row.wa_county,
                historicalCitySlugs: row.historical_city_slugs,
              },
              region.slug,
            ),
      );

      if (raw.length > 0) {
        const ids = raw.map((f) => f.id);

        // 2. Inspections — chunked to avoid URL-length limits and PostgREST's
        //    default 1000-row cap. Large county pages can have 100+ facilities
        //    with hundreds of inspections each; without chunking the counts are
        //    silently truncated and citation badges show 0.
        const INSP_CHUNK = 150;
        for (let ci = 0; ci < ids.length; ci += INSP_CHUNK) {
          const chunk = ids.slice(ci, ci + INSP_CHUNK);
          const { data: chunkData, error: chunkErr } = await supabase
            .from("inspections")
            .select("id, facility_id, inspection_date")
            .in("facility_id", chunk)
            .lte("inspection_date", todayIsoDate())
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
          if (!isUsableInspectionDate(i.inspection_date)) continue;
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
          const isSerious = isSeriousCityFinding(d, region.state.code);
          if (isSerious) {
            seriousCitByFac.set(fid, (seriousCitByFac.get(fid) ?? 0) + 1);
          }
          if ((d.severity ?? 0) >= 4) {
            ijCitByFac.set(fid, (ijCitByFac.get(fid) ?? 0) + 1);
          }
        }

        // A home's latest visit in the last three years that cited something. Same
        // window and same test as the sitemap rule for its /inspections page.
        const findingsByInsp = new Map<string, number>();
        for (const d of allDefs) {
          findingsByInsp.set(d.inspection_id, (findingsByInsp.get(d.inspection_id) ?? 0) + 1);
        }
        const latestCited = new Map<string, { date: string; findings: number }>();
        for (const i of allInspData) {
          const findings = findingsByInsp.get(i.id) ?? 0;
          if (findings === 0 || i.inspection_date < cutoff3yStr) continue;
          const best = latestCited.get(i.facility_id);
          if (!best || i.inspection_date > best.date || (i.inspection_date === best.date && findings > best.findings)) {
            latestCited.set(i.facility_id, { date: i.inspection_date, findings });
          }
        }
        recentReports = raw
          .flatMap((f) => {
            const latest = latestCited.get(f.id);
            return latest
              ? [{ id: f.id, name: f.name, slug: f.slug, city_slug: f.city_slug, ...latest }]
              : [];
          })
          .sort((a, b) => b.date.localeCompare(a.date) || b.findings - a.findings)
          .slice(0, 8);

        facilities = raw.map((f) => {
          const basis = memoryCareBasis({
            state_code: region.state.code,
            memory_care_disclosure_source: f.memory_care_disclosure_source,
            ca_cdss_client_served: f.ca_cdss_client_served ?? null,
            mc_designation_type: f.mc_designation_type,
            mce_endorsed: f.mce_endorsed,
            wa_memory_care_certified: f.wa_memory_care_certified,
            wa_earc_sdc_contracted: f.wa_earc_sdc_contracted,
            wa_dementia_care_contract: f.wa_dementia_care_contract,
            wa_facility_type: f.wa_facility_type,
            wa_contract_types: f.wa_contract_types,
            mc_program_confirmed: f.mc_program_confirmed,
            mc_program_source_url: f.mc_program_source_url,
            tx_alzheimer_certified: f.tx_alzheimer_certified,
            il_dementia_program_flag: f.il_dementia_program_flag,
            mn_dementia_care_licensed: f.mn_dementia_care_licensed,
            mo_alzheimer_scu: f.mo_alzheimer_scu,
            az_memory_care_endorsed: f.az_memory_care_endorsed,
            az_mc_subclass: f.az_mc_subclass,
            az_license_level: f.az_license_level,
          });
          const muni = displayMunicipality({
            stateCode: region.state.code,
            zip: f.zip,
            name: f.name,
            citySlug: f.city_slug,
          });
          return {
            id: f.id,
            name: formatFacilityName(f.name),
            city: muni?.name ?? displayCityName(f.city, f.city_slug),
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
            careChip: listCareChip({ stateCode: region.state.code, basis }),
            licenseLabel: listLicenseLabel({
              stateCode: region.state.code,
              care_category: f.care_category as CareCategory,
              license_type: f.license_type,
              mo_level_of_care: f.mo_level_of_care,
              mn_dementia_care_licensed: f.mn_dementia_care_licensed,
            }),
            license_type: f.license_type,
            mo_level_of_care: f.mo_level_of_care,
            mn_dementia_care_licensed: f.mn_dementia_care_licensed,
            wa_dementia_care_contract: f.wa_dementia_care_contract,
            wa_earc_sdc_contracted: f.wa_earc_sdc_contracted,
            az_mc_subclass: f.az_mc_subclass,
            az_license_level: f.az_license_level,
            az_memory_care_endorsed: f.az_memory_care_endorsed,
            mc_designation_type: f.mc_designation_type,
            ...contentAliasFields(f.content),
          };
        });
        recentReports = recentReports.map((r) => ({ ...r, name: formatFacilityName(r.name) }));
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
  const totalCount = facilities.length;
  const indexedHomes = homesForCityIndex(facilities, region.state.code);
  const listedHomes =
    region.state.code === "PA"
      ? dedupeHomesByDisplayName(indexedHomes)
      : indexedHomes;
  const listedCount = listedHomes.length;
  const excludedCount = Math.max(0, totalCount - listedCount);
  const glance = computeCityHubGlance({
    listed: listedHomes,
    publishableCount: totalCount,
    inspections: allInspData,
    deficiencies: allDefs,
    stateCode: region.state.code,
  });
  const recentSerious = !isCounty
    ? recentSeriousHomes(listedHomes, allInspData, allDefs, 8, region.state.code)
    : [];
  const setting = careSettingCopy(region.state.code);
  const localHelp = !isCounty ? localHelpFor(region.state.code, region.slug) : null;
  const cityCostEarly =
    !isCounty && !fetchError && region.state.code !== "CO"
      ? cityMemoryCareBand(await loadFacilityCosts(facilities.map((f) => f.id)))
      : null;
  const answer = !isCounty
    ? cityDirectAnswer({
        region,
        glance,
        regulatorAbbr: reg,
        listedPrice: cityCostEarly
          ? {
              low: formatCurrency(cityCostEarly.band.low),
              high: formatCurrency(cityCostEarly.band.high),
              homes: cityCostEarly.homes,
            }
          : null,
      })
    : null;

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
  const pageTitle = cityHubTitle(region, listedCount, {
    dementiaLicenseCount: glance.dementiaLicenseCount,
  });
  const pageDesc = cityHubMetaDescription({
    region,
    listedCount,
    withCitation: glance.withCitation,
    homesWithSeriousLast12: glance.severityMeasured ? glance.homesWithSeriousLast12 : undefined,
    homesWithTypeALast12: glance.homesWithTypeALast12,
    regulatorAbbr: reg,
  });

  const findingsVocab = findingsCopy(region.state.code);

  // Data source label for stat blocks — state-specific regulator attribution.
  const stateDataSrc =
    region.state.code === "AZ" ? "ADHS / AZ Care Check"
    : region.state.code === "WA" ? "DSHS"
    : region.state.code === "MN" ? "MDH"
    : region.state.code === "OR" ? "OR DHS"
    : region.state.code === "UT" ? "DLBC"
    : region.state.code === "IL" ? "IDPH"
    : region.state.code === "PA" ? "PA DHS"
    : region.state.code === "MO" ? "DHSS"
    : region.state.code === "CO" ? "CDPHE / CMS"
    : "CDSS";

  // States where we have row-level deficiency data (deficiencies table populated).
  const HAS_DEFICIENCY_TABLE = new Set(["CA", "WA", "OR", "MN", "PA", "AZ", "MO", "CO"]);
  const hubRank = rankHubFacilities(listedHomes);
  const itemListFacilities = listedHomes.map((f) => ({
    name: f.name,
    url: canonicalFor(`/${region.state.slug}/${f.city_slug}/${f.slug}`),
    facilityId: f.id,
    street: f.street,
    city: f.city ?? displayCityName(f.city, f.city_slug),
    postalCode: f.zip,
    addressRegion: region.state.name,
  }));
  const hubPreview = hubRank.preview.map((f) => ({
    ...f,
    city: f.city ?? displayCityName(f.city, f.city_slug),
  }));
  // Any deficiency (Type A or Type B) — matches the "§ Findings" label.
  // serious_citations is retained on each facility for card-level red/amber badging.
  const facilitiesWithSeriousDef = listedHomes.filter((f) => f.total_citations > 0).length;
  const cityCost = cityCostEarly;
  const severePct =
    listedCount > 0 ? Math.round((facilitiesWithSeriousDef / listedCount) * 100) : 0;

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
    const updated = row?.updated_at
      ? new Date(row.updated_at).toISOString().split("T")[0]
      : null;
    // Prefer the newest inspection on listed homes so a stale facilities.updated_at
    // (St. Paul still said May 2026 while visits ran through October) does not win.
    findingsDate =
      glance.newestInspection && (!updated || glance.newestInspection > updated)
        ? glance.newestInspection
        : updated;
    const firstRow2 = firstRow.data as { created_at: string } | null;
    firstPublishedAt = firstRow2?.created_at
      ? new Date(firstRow2.created_at).toISOString()
      : null;
  } else if (glance.newestInspection) {
    findingsDate = glance.newestInspection;
  }

  const faqPairs = [
    ...cityFaqExtras({ region, glance }),
    ...buildCityFaqs(region, {
      totalCount: listedCount,
      facilitiesWithDeficiency: facilitiesWithSeriousDef,
    }),
  ];

  const displayCounty = !parentCounty
    ? displayCountyCrumb(region.state.code, region.slug)
    : null;
  const countyCrumb = parentCounty
    ? { name: parentCounty.name, url: canonicalFor(`/${region.state.slug}/${parentCounty.slug}`) }
    : displayCounty
      ? { name: displayCounty.name, url: displayCounty.href ?? undefined }
      : null;
  const regionJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: region.state.name, url: canonicalFor(`/${region.state.slug}`) },
      ...(countyCrumb ? [countyCrumb] : []),
      { name: region.name, url: pageUrl },
    ]),
    buildWebPageWithReviewer({
      name: pageTitle,
      url: pageUrl,
      description: pageDesc,
      datePublished: firstPublishedAt,
      dateModified: findingsDate,
    }),
    buildCollectionPageSchema({
      name: setting.collectionName(region.name),
      url: pageUrl,
      region,
      datePublished: firstPublishedAt,
      dateModified: findingsDate,
    }),
    buildItemListSchema(
      setting.collectionName(region.name),
      pageUrl,
      itemListFacilities,
    ),
    buildFaqSchemaFromPairs(faqPairs, pageUrl),
    buildSpeakableSchema({ url: pageUrl, cssSelectors: ["#hub-lede", "#city-answer", "#hub-stats"] }),
  ];

  // ── Additional data for content blocks ────────────────────────────────────

  // Regulator primer (CA-specific)
  const regulatorPrimer = getRegulatorPrimer(region.state.code);

  const regionStatItems: StatItem[] = !isCounty
    ? cityGlanceStats(region, glance, stateDataSrc)
    : region.state.code === "TX"
      ? [
          {
            n: String(listedCount),
            label: `Alzheimer-certified assisted living facilities listed in ${region.name}`,
            src: "HHSC ALF directory",
          },
          {
            n: String(facilitiesWithSeriousDef),
            label:
              "Facilities with at least one cited deficiency in the indexed LTCR inspection record on file",
            src: "HHSC LTCR",
            delta: listedCount > 0 ? `${severePct}% of listed facilities` : undefined,
          },
          ...(excludedCount > 0
            ? [
                {
                  n: String(excludedCount),
                  label:
                    "Licensed homes not listed here (no inspection on file, or Arizona homes of 10 beds or fewer with no citations)",
                  src: "Listing rules",
                },
              ]
            : []),
        ]
      : region.state.code === "PA" && isCounty
      ? [
          {
            n: String(listedCount),
            label: `Licensed PCH / ALR memory care facilities listed in ${region.name} County`,
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
            label: "Severity-4 findings on record (includes substantiated abuse; not CMS Immediate Jeopardy)",
            src: "PA DHS OLTL",
          },
        ]
      : [
          {
            n: String(listedCount),
            label: `${setting.hubNoun} listed in ${region.name}`,
            src: stateDataSrc,
          },
          ...(HAS_DEFICIENCY_TABLE.has(region.state.code)
            ? [
                {
                  n: String(facilitiesWithSeriousDef),
                  label: findingsVocab.anyFindingLabel,
                  src: stateDataSrc,
                  delta: listedCount > 0 ? `${severePct}% of listed facilities` : undefined,
                },
              ]
            : []),
          ...(excludedCount > 0
            ? [
                {
                  n: String(excludedCount),
                  label:
                    "Licensed homes not listed here (no inspection on file, or Arizona homes of 10 beds or fewer with no citations)",
                  src: "Listing rules",
                },
              ]
            : []),
        ];

  // Live, human-approved editorial body (city hubs). Falls back to the
  // hand-authored intro when no published/non-drifted row exists.
  // Hand-authored intros only. Published hub_content rows have hardcoded
  // counts that drift from the listed set (San Diego 23 vs 22).
  const cityIntro = !isCounty ? cityIntroForRegion(region.state.code, region.slug) : null;
  const countyIntroParas = isCounty ? countyIntroParasForRegion(region.state.code, region.slug) : null;

  return (
    <>
      <JsonLd objects={regionJsonLd} />
      {/* DOM reorder: <main> (H1) is first in source; GovernanceBar+SiteNav use flex order:-1 to appear visually above it. SiteNav sticky top-0 still functions since sticky is relative to the viewport scroll container, not the flex parent. */}
      <div className="flex flex-col">
        <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>

        {/* ── Header ── */}
        <div
          className="border-b border-clearing-rule"
          style={{
            background:
              "linear-gradient(180deg, var(--color-clearing-tint) 0%, var(--color-clearing-bg) 100%)",
          }}
        >
          <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 md:px-[60px]">
            {/* Breadcrumb */}
            <nav className="mb-5 flex items-center gap-1.5 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-4" aria-label="Breadcrumb">
              <Link href="/" className="transition-colors hover:text-teal">Home</Link>
              <span aria-hidden>›</span>
              <Link href={`/${region.state.slug}`} className="transition-colors hover:text-teal">
                {region.state.name}
              </Link>
              {parentCounty && (
                <>
                  <span aria-hidden>›</span>
                  <Link href={`/${region.state.slug}/${parentCounty.slug}`} className="transition-colors hover:text-teal">
                    {parentCounty.name}
                  </Link>
                </>
              )}
              {!parentCounty && displayCounty && (
                <>
                  <span aria-hidden>›</span>
                  <span className="text-ink-4">{displayCounty.name}</span>
                </>
              )}
              <span aria-hidden>›</span>
              <span className="text-ink-3">{region.name}</span>
            </nav>

            <h1
              className="mb-4 font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink"
              style={{ fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1.05 }}
            >
              {cityHubH1(region, listedCount)}
            </h1>
            <p
              id="hub-lede"
              className="max-w-[50ch] font-[family-name:var(--font-sans)] text-[18px] leading-[1.5] text-ink-3 sm:text-[19px]"
            >
              {listedCount > 0 ? `${listedCount} ${setting.hubNoun}, ` : ""}
              ranked by {reg} inspection records — every citation from primary data, no
              referral fees.
            </p>
            {answer && (
              <div id="city-answer">
                <CityDirectAnswer q={answer.q} a={answer.a} />
              </div>
            )}
            {findingsDate && <UpdatedStamp isoDate={findingsDate} />}

            <nav
              aria-label="On this page"
              className="mt-6 flex flex-wrap gap-x-5 gap-y-2"
            >
              {!isCounty ? (
                <a
                  href="#all-homes"
                  className="font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal underline underline-offset-4"
                >
                  Compare homes
                </a>
              ) : null}
              <a
                href="#hub-stats"
                className="font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal underline underline-offset-4"
              >
                View inspection findings
              </a>
              <a
                href="#hub-faq"
                className="font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal underline underline-offset-4"
              >
                Questions
              </a>
            </nav>

            <form
              action={`/${region.state.slug}/${region.slug}/facilities`}
              className="mt-5 max-w-md"
            >
              <label className="sr-only" htmlFor="city-hub-search">
                Search homes in {region.name}
              </label>
              <input
                id="city-hub-search"
                type="search"
                name="q"
                placeholder={`Search homes in ${region.name}`}
                className="w-full rounded-[14px] border border-clearing-rule-2 bg-clearing-card px-4 py-2.5 text-sm text-ink shadow-[var(--shadow-card)] placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none"
              />
            </form>

            {/* Mobile-only Browse CTA — visible in the header without scrolling */}
            <Link
              href={`/${region.state.slug}/facilities`}
              className="mt-6 flex w-full items-center justify-between rounded-xl bg-teal px-5 py-4 font-[family-name:var(--font-sans)] text-[14px] font-semibold tracking-[0.02em] text-paper no-underline md:hidden"
            >
              <span>Browse {region.state.name} facilities</span>
              <span aria-hidden>→</span>
            </Link>
            {cityIntro ? (
              <p className="mt-6 text-[17px] leading-relaxed text-ink-2 max-w-[62ch]">
                {cityIntro}
              </p>
            ) : null}
            {glance.ccrcCount > 0 && (
              <p className="mt-4 max-w-[62ch] font-[family-name:var(--font-sans)] text-[14px] leading-relaxed text-ink-3">
                Licensed-bed totals include {glance.ccrcCount} continuing-care campus
                {glance.ccrcCount === 1 ? "" : "es"} whose published capacity is campus-wide, not
                dementia-care beds only.
              </p>
            )}
          </div>
        </div>

        {/* ── Stats / Findings ── */}
        <div className="border-b border-clearing-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-14">
            {totalCount > 0 ? (
              <>
                {HAS_DEFICIENCY_TABLE.has(region.state.code) && (
                  <>
                    <div className="mb-3 inline-block font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal">
                      § Findings
                    </div>
                    <p className="font-[family-name:var(--font-display)] text-[22px] leading-[1.3] text-ink mb-4">
                      {region.state.code === "TX" ? (
                        <>
                          Of the{" "}
                          <strong className="font-normal text-rust">{listedCount}</strong>{" "}
                          Alzheimer-certified facilities indexed in {region.name},{" "}
                          <strong className="font-normal text-rust">{facilitiesWithSeriousDef}</strong>{" "}
                          ({severePct}%) have at least one cited deficiency in the inspection data on
                          file. Texas ALF license Type A/B/C is a <em>capacity</em> class on the
                          license — not the same as California&rsquo;s Type-A/Type-B{" "}
                          <em>deficiency</em> labels.
                        </>
                      ) : region.state.code === "CO" ? (
                        <>
                          Of the{" "}
                          <strong className="font-normal text-rust">{listedCount}</strong>{" "}
                          memory care facilities indexed in {region.name},{" "}
                          <strong className="font-normal text-rust">{facilitiesWithSeriousDef}</strong>{" "}
                          ({severePct}%) have at least one higher-severity finding on file.
                          Assisted living findings use CDPHE Levels A–E. Nursing-home findings use CMS letters.
                          Those scales are not combined into one rank.
                        </>
                      ) : (
                        <>
                          Of the{" "}
                          <strong className="font-normal text-rust">{listedCount}</strong>{" "}
                          {setting.hubNoun} indexed in {region.name},{" "}
                          <strong className="font-normal text-rust">{facilitiesWithSeriousDef}</strong>{" "}
                          ({severePct}%) have a {findingsVocab.findingPhrase} on file.
                          {region.state.code === "MN" && glance.citationsLast12 === 0
                            ? " None of those findings is dated in the last 12 months."
                            : ""}
                        </>
                      )}
                    </p>
                    {findingsDate && (
                      <DataFootnote
                        source={findingsVocab.source}
                        refreshed={findingsDate}
                        note={findingsVocab.note}
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
                inspectionsLast12={glance.inspectionsLast12}
                newestInspection={glance.newestInspection}
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
              <div className="mx-auto mt-10 max-w-[1280px] px-4 pb-10 sm:px-6 md:px-[60px]">
                <p className="mb-4 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                  Most-cited on record · {region.name} County · PA DHS OLTL
                </p>
                <ol className="space-y-2">
                  {paMostCited.map((f, i) => (
                    <li key={f.id} className="flex items-center gap-3 rounded-[14px] border border-clearing-rule-2 bg-clearing-card px-3 py-2.5 text-[14px] shadow-[var(--shadow-card)]">
                      <span className="w-4 shrink-0 text-right font-[family-name:var(--font-sans)] text-[12px] text-ink-4">
                        {i + 1}.
                      </span>
                      <Link
                        href={`/${region.state.slug}/${f.city_slug}/${f.slug}`}
                        className="truncate text-ink underline underline-offset-2 hover:text-teal"
                      >
                        {f.name}
                      </Link>
                      <span className="shrink-0 font-[family-name:var(--font-sans)] text-[12px] font-semibold text-teal">
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
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-14">
            <SectionHead
              label={isCounty ? `§ ${region.name} — Facilities` : "§ Facilities"}
              title={
                <>
                  {setting.h1Topic} in {region.name}, <em>starting with the fullest public records.</em>
                </>
              }
            />
            <aside className="mb-6 font-[family-name:var(--font-sans)] text-[13px] text-ink-3">
              This first set is the homes with the most inspection history
              {smallCount > 0 && !hubRank.onlySmallHomes
                ? `, leaving out ${smallCount} homes of 6 beds or fewer`
                : ""}
              .{" "}
              <a
                href="#all-homes"
                className="font-semibold text-teal underline underline-offset-4"
              >
                Browse all {listedCount} facilities in {region.name}
              </a>
              .{" "}
              <Link href="/methodology" className="text-teal underline underline-offset-4">
                See methodology
              </Link>
              .
            </aside>
            <FacilityListClient
              facilities={hubPreview}
              stateSlug={region.state.slug}
              regionName={region.name}
              hiddenSmallCount={0}
              initialShowSmall={hubRank.onlySmallHomes}
            />
          </div>
        )}

        {!fetchError && !isCounty && (
          <RecentSeriousCitations
            homes={recentSerious}
            stateSlug={region.state.slug}
            regionName={region.name}
          />
        )}

        {/* ── Newest cited visits — city pages only ── */}
        {!fetchError && !isCounty && (
          <RecentInspectionReports
            reports={recentReports}
            stateSlug={region.state.slug}
            regionName={region.name}
            agency={reg}
          />
        )}

        {/* ── Every home, A to Z — city pages only; counties link to their cities ── */}
        {!fetchError && !isCounty && (
          <CityHomeIndex
            homes={listedHomes}
            stateSlug={region.state.slug}
            regionName={region.name}
          />
        )}

        {/* ── County editorial intro — below grid for UX; preserved for AEO/GEO ── */}
        {isCounty && countyIntroParas && countyIntroParas.length > 0 && (
          <div className="border-b border-clearing-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-10">
              <p className="mb-5 inline-block font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal">
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
        <div className="border-b border-clearing-rule" style={{ background: "var(--color-paper)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-14">
            <SectionHead
              label="How these homes are regulated"
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
          <div className="border-b border-clearing-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-14">
              <SectionHead
                label="Cost"
                title={<>What listed prices look like <em>in this city.</em></>}
              />
              <p className="text-[16px] leading-[1.7] text-ink-2 max-w-[60ch]">
                {region.state.code === "CO" ? (
                  <>
                    CDPHE does not publish a monthly rate for assisted living in {region.name}.
                    The price on a tour is the home&apos;s quote. A nursing home is priced under a different program.
                  </>
                ) : cityCost ? (
                  <>
                    Homes in {region.name} that list a price mostly fall between{" "}
                    <strong className="font-semibold">
                      {formatCurrency(cityCost.band.low)}&ndash;{formatCurrency(cityCost.band.high)}
                    </strong>{" "}
                    a month. That is the middle half of {cityCost.homes} homes with a listed price. A listed
                    price is not a quote, so ask each home for its current rate.{" "}
                    <Link href="/methodology" className="text-teal underline underline-offset-4">
                      how we source data
                    </Link>
                    .
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </p>
              <DataFootnote
                source={
                  region.state.code === "CO"
                    ? "CDPHE does not publish assisted-living rates"
                    : cityCost
                      ? "Listed prices on Caring.com and SeniorAdvisor"
                      : `Regional estimate · ${getStateCostBand(region.state.code).source}`
                }
                note="Facility-specific quotes required before signing"
              />
            </div>
          </div>
        )}

        {/* ── Eligibility section (all regions, state-specific Medicaid/waiver content) ── */}
        {!fetchError && (
          <HubEligibility stateCode={region.state.code} regionName={region.name} />
        )}

        {!isCounty && !fetchError && (() => {
          const areas = areasServedFor(region.state.code, region.slug);
          return areas ? (
            <CityAreasServed spec={areas} zips={listedHomes.map((h) => h.zip)} />
          ) : null;
        })()}

        {!isCounty && !fetchError && localHelp && <CityLocalHelp help={localHelp} />}

        {!fetchError && (
          <CityRelatedGuides stateCode={region.state.code} stateName={region.state.name} />
        )}

        {/* ── FAQ: county after stats block; city after cost band ── */}
        {!fetchError && (
          <HubFaqSection regionName={region.name} faqPairs={faqPairs} />
        )}

        {/* ── Error state ── */}
        {fetchError && (
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-8">
            <div className="rounded-[16px] border border-gold/30 bg-gold-soft px-5 py-4 text-sm shadow-[var(--shadow-card)]">
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
            <section className="border-b border-clearing-rule" style={{ background: "var(--color-paper)" }}>
              <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-14">
                <div className="mb-3 inline-block font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal">
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
                  Facilities below had at least one Type A deficiency tied to an inspection dated in the rolling year — sourced from published CDSS deficiency records. Immediate Jeopardy is a CMS term and is not used for a CDSS Type A citation.
                </p>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
                  {countyTrendRows.slice(0, 12).map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/${region.state.slug}/${row.city_slug}/${row.slug}`}
                        className="flex min-w-0 flex-col gap-1 rounded-[16px] border border-clearing-rule-2 bg-clearing-card px-4 py-3 no-underline shadow-[var(--shadow-card)] transition-colors hover:border-teal/40"
                      >
                        <span className="font-[family-name:var(--font-display)] text-[17px] leading-snug text-ink">
                          {row.name}
                        </span>
                        <span className="font-[family-name:var(--font-sans)] text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
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
            stateName={region.state.name}
            currentCitySlug={region.slug}
            preferredNearby={nearbyHubsFor(region.state.code, region.slug)}
          />
        )}

        </main>
        <div className="-order-1">
          <GovernanceBar scope={region.state.code} />
          <SiteNav countStateCode={region.state.code} badge={region.state.name} ctaHref={`/${region.state.slug}/facilities`} ctaLabel={`Browse ${region.state.name} facilities`} stateNavHref={`/${region.state.slug}`} />
          {region.state.code !== "CO" && (
            <AreaWatchModal areaName={region.name} areaSlug={region.slug} stateCode={region.state.code} source="city_modal" />
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
