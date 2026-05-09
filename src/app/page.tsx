import type { Metadata } from "next";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";
import {
  buildHomeOrganizationGraph,
  buildPersonSchema,
} from "@/lib/seo/schema";
import {
  SampleFacilityRotationProvider,
} from "@/components/home/SampleFacilityRotation";
import { MobileStickyCtaBar } from "@/components/mobile/MobileStickyCtaBar";
import { MobileNationalHomeView } from "@/components/mobile/MobileNationalHomeView";
import { NationalHomeSections } from "@/components/national-home/NationalHomeSections";
import { loadNationalHomeData } from "@/lib/data/nationalHome";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { seededShuffle, SAMPLE_CARD_ROTATION_COUNT } from "@/lib/data/stateHub";
import type { HomeSampleFacility } from "@/components/home/homeSampleFacilityTypes";
import type { CareCategory } from "@/lib/types";

export const revalidate = 3600;

const homeCanonical = canonicalFor("/");

export const metadata: Metadata = {
  title: "Memory care facilities, ranked by state inspectors | StarlynnCare",
  description:
    "No paid ads. No sales calls. Public inspection data from 5 states — California, Oregon, Washington, Minnesota, and Texas — analyzed and ranked for families.",
  alternates: { canonical: homeCanonical },
  openGraph: {
    title: "Memory care facilities, ranked by state inspectors | StarlynnCare",
    description:
      "No paid ads. No sales calls. Public inspection data from 5 states — California, Oregon, Washington, Minnesota, and Texas — analyzed and ranked for families.",
    url: homeCanonical,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-default.png"],
  },
};

async function loadGradeCardFacilities(): Promise<HomeSampleFacility[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const { data: idRows } = await supabase
    .from("facilities")
    .select("id")
    .eq("publishable", true);

  const allIds = (idRows ?? []).map((r: { id: string }) => r.id);
  const hourSeed = Math.floor(Date.now() / 3600000);
  const pickedIds = seededShuffle(allIds, hourSeed).slice(0, SAMPLE_CARD_ROTATION_COUNT);
  if (pickedIds.length === 0) return [];

  const { data: pickedRows } = await supabase
    .from("facilities")
    .select("id, name, city, state_code, slug, city_slug, license_number, beds, care_category")
    .in("id", pickedIds);

  const rowById = new Map((pickedRows ?? []).map((r) => [r.id as string, r]));
  const ordered = pickedIds.map((id) => rowById.get(id)).filter((r): r is NonNullable<typeof r> => r != null);

  return (
    await Promise.all(
      ordered.map(async (picked) => {
        const { data: snap } = await supabase.rpc("facility_snapshot", { p_facility_id: picked.id });
        const s = snap as null | {
          grade?: { letter: string; composite_percentile: number } | null;
          metrics?: { severity: { percentile: number }; repeats: { percentile: number }; frequency: { percentile: number } } | null;
        };
        return {
          ...picked,
          care_category: picked.care_category as CareCategory,
          grade: s?.grade?.letter ?? null,
          composite: s?.grade?.composite_percentile ?? null,
          sev_pct: s?.metrics?.severity?.percentile ?? null,
          rep_pct: s?.metrics?.repeats?.percentile ?? null,
          freq_pct: s?.metrics?.frequency?.percentile ?? null,
        } satisfies HomeSampleFacility;
      }),
    )
  ).filter(Boolean);
}

export default async function Home() {
  const [data, gradeCardFacilities] = await Promise.all([
    loadNationalHomeData(),
    loadGradeCardFacilities(),
  ]);

  // Single homepage @graph chains Organization ↔ WebSite ↔ founder ↔ reviewer Person
  // so search engines can read the editorial trust chain in one node graph.
  const founderPersonNode = buildPersonSchema({
    id: `${SITE_ORIGIN}/about#person-blake-jones`,
    name: "Blake Jones",
    jobTitle: "Co-founder, StarlynnCare",
    description:
      "Co-founder leading product narrative, data partnerships, and responsible distribution of state licensing records.",
    image: "/images/about/blake-jones.png",
    url: `${SITE_ORIGIN}/about#person-blake-jones`,
  });
  const homeJsonLd = [buildHomeOrganizationGraph({ founderPersonNode })];

  return (
    <>
      <JsonLd objects={homeJsonLd} />

      <SampleFacilityRotationProvider facilities={gradeCardFacilities}>
        <div className="m-app md:hidden">
          <MobileNationalHomeView data={data} />
        </div>
        <MobileStickyCtaBar />

        <div className="hidden md:block">
          <GovernanceBar scope="national" />
          <SiteNav
            countStateCode={undefined}
            badge={undefined}
            ctaHref="/states"
            ctaLabel="memory care facilities nationwide"
            national
          />

          <main>
            <NationalHomeSections data={data} />
          </main>

          <SiteFooter />
        </div>
      </SampleFacilityRotationProvider>
    </>
  );
}
