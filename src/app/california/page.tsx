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
import { stateFromSlug } from "@/lib/states";
import {
  SampleFacilityRotationProvider,
} from "@/components/home/SampleFacilityRotation";
import { loadStateHubData } from "@/lib/data/stateHub";
import { caStateConfig } from "@/lib/stateHubConfigs/ca";
import { StateHubSections } from "@/components/state-hub/StateHubSections";
import { MobileStateHubView } from "@/components/mobile/MobileStateHubView";
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
  const data = await loadStateHubData("CA");
  const state = stateFromSlug("california")!;

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
    buildFaqSchemaFromPairs(caStateConfig.faqs.map((f) => ({ q: f.q, a: f.a })), pageCanonical),
  ];

  return (
    <>
      <JsonLd objects={stateJsonLd} />

      <SampleFacilityRotationProvider facilities={data.gradeCardFacilities}>
        <div className="m-app md:hidden">
          <MobileStateHubView data={data} config={caStateConfig} />
        </div>
        <MobileStickyCtaBar />

        <div className="hidden md:block">
          <GovernanceBar scope="CA" />
          <SiteNav countStateCode="CA" badge="California" ctaHref="/california" ctaLabel="California memory care facilities" />

          <main>
            <StateHubSections data={data} config={caStateConfig} />
          </main>

          <SiteFooter />
        </div>
      </SampleFacilityRotationProvider>
    </>
  );
}
