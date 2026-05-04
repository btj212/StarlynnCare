import type { Metadata } from "next";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import {
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
  buildStateHubCollectionPage,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";
import { CA_FAQS } from "@/lib/content/stateFaqs";
import { stateFromSlug } from "@/lib/states";
import {
  SampleFacilityRotationProvider,
} from "@/components/home/SampleFacilityRotation";
import { loadCaliforniaStateHubData, getSeasonAndYear } from "@/lib/data/stateHub";
import { californiaStatItems, CALIFORNIA_EDITORIAL_CARDS } from "@/lib/stateHubConfig";
import { CaliforniaStateHubSections } from "@/components/state-hub/CaliforniaStateHubSections";
import { MobileHomeView } from "@/components/mobile/MobileHomeView";
import { MobileStickyCtaBar } from "@/components/mobile/MobileStickyCtaBar";

export const revalidate = 3600;

const pageCanonical = canonicalFor("/california");
const PAGE_TITLE = "California memory care directory | StarlynnCare";
const PAGE_DESC =
  "Inspection-backed memory care facility profiles across California — CDSS citations, peer benchmarks, and county-by-county browse.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: pageCanonical },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESC,
    url: pageCanonical,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESC,
    images: ["/og-default.png"],
  },
};

export default async function CaliforniaHubPage() {
  const data = await loadCaliforniaStateHubData();
  const state = stateFromSlug("california")!;
  const { season, year } = getSeasonAndYear();
  const statItems = californiaStatItems(data.stats);

  const stateJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: `${state.name} memory care`, url: pageCanonical },
    ]),
    buildWebPageWithReviewer({
      name: PAGE_TITLE,
      url: pageCanonical,
      description: PAGE_DESC,
    }),
    buildStateHubCollectionPage({
      name: `Memory care in ${state.name}`,
      url: pageCanonical,
      state,
    }),
    buildFaqSchemaFromPairs(CA_FAQS, pageCanonical),
  ];

  return (
    <>
      <JsonLd objects={stateJsonLd} />

      <SampleFacilityRotationProvider facilities={data.gradeCardFacilities}>
        <div className="m-app md:hidden">
          <MobileHomeView
            season={season}
            year={year}
            statItems={statItems}
            counties={data.counties}
            topCities={data.topCities}
            firstReview={data.sampleReviews[0] ?? null}
            editorials={CALIFORNIA_EDITORIAL_CARDS}
            mobileFaqs={CA_FAQS.slice(0, 4)}
            lastRefreshed={data.stats.lastRefreshed}
            countyCountLive={data.counties.length}
          />
        </div>
        <MobileStickyCtaBar />

        <div className="hidden md:block">
          <GovernanceBar />
          <SiteNav />

          <main>
            <CaliforniaStateHubSections data={data} />
          </main>

          <SiteFooter />
        </div>
      </SampleFacilityRotationProvider>
    </>
  );
}
