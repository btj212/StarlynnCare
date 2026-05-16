import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildDatasetSchema,
} from "@/lib/seo/schema";
import {
  AnalysisShell,
  AnalysisH2,
  AnalysisProse,
  AnalysisMethodNote,
} from "@/components/research/AnalysisShell";

const PAGE_PATH = "/research/california-cost-vs-quality";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "In California memory care, price is no guarantee of quality";
const META_TITLE = `${TITLE} | StarlynnCare Research`;
const DESC =
  "Analysis of 484 California memory care facilities finds an essentially flat correlation (r = 0.27) between county-median monthly cost and citation severity. The most expensive county is not the worst-cited county.";
const DATE_PUBLISHED = "2026-05-11";

export const metadata: Metadata = {
  title: META_TITLE,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: META_TITLE,
    description: DESC,
    url: canonicalUrl,
    type: "article",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: META_TITLE,
    description: DESC,
    images: ["/og-default.png"],
  },
};

const jsonLd = [
  buildArticleSchema({
    headline: TITLE,
    description: DESC,
    url: canonicalUrl,
    datePublished: DATE_PUBLISHED,
  }),
  buildBreadcrumbList([
    { name: "Home", url: canonicalFor("/") },
    { name: "Research", url: canonicalFor("/research") },
    { name: "Cost vs quality (CA)", url: canonicalUrl },
  ]),
  buildDatasetSchema({
    pageUrl: canonicalUrl,
    methodologyUrl: canonicalFor("/methodology"),
  }),
];

export default function CACostVsQualityPage() {
  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav
        countStateCode="CA"
        ctaHref="/california/facilities"
        ctaLabel="California memory care facilities"
      />

      <AnalysisShell
        eyebrow="Cost vs quality (CA)"
        title={TITLE}
        dek="A 484-facility cross-sectional analysis of California memory care: county-median monthly price (Genworth 2024) vs. inspection-derived citation severity. The two are almost uncorrelated."
        bylineDate="May 11, 2026"
        scope="California · 484 RCFEs"
        keyFindings={[
          {
            value: "r = 0.27",
            label: "price ↔ severity correlation",
            caption: "Pearson · p < 0.001",
            tone: "warn",
          },
          {
            value: "13%",
            label: "facilities with severity index > 5",
            caption: "63 of 484",
            tone: "alarm",
          },
          {
            value: "Different",
            label: "most-expensive vs worst-cited county",
            caption: "San Francisco vs Contra Costa",
            tone: "neutral",
          },
        ]}
        methodologyDisclosure={
          "Cost data: county-level median monthly cost from the Genworth 2024 Cost of Care Survey, joined to facility ZIPs.\n\nQuality measure: a per-facility severity index computed from CDSS deficiency citations (severity-weighted, normalized by inspection count).\n\nFacility-level price quotes are not used here; quotes vary too widely within a county to be comparable. Five direct facility-level price observations exist in the dataset but were null at run time and excluded."
        }
        sources={[
          {
            label: "CDSS Community Care Licensing — RCFE inspection records",
            url: "https://www.cdss.ca.gov/inforesources/cdss-programs/community-care-licensing",
          },
          {
            label: "Genworth 2024 Cost of Care Survey — county medians",
            url: "https://www.genworth.com/aging-and-you/finances/cost-of-care.html",
          },
          {
            label: "StarlynnCare methodology",
            url: "/methodology",
          },
        ]}
      >
        <AnalysisH2 id="what-we-found">What we found</AnalysisH2>
        <AnalysisProse>
          <p>
            Across 484 California memory care facilities, the Pearson
            correlation between county-median monthly cost and a
            severity-weighted citation index is{" "}
            <strong>r = 0.27</strong>. That is a weak positive relationship —
            statistically detectable (p &lt; 0.001) but small enough that
            knowing a facility&rsquo;s county price tier tells you almost
            nothing about how it has performed in inspections.
          </p>
          <p>
            <strong>13% of California memory care facilities</strong> (63 of
            484) carry a severity index above 5 — the threshold we use to flag
            facilities with a meaningful pattern of serious citations on
            record. These facilities are spread across the state&rsquo;s price
            spectrum, not concentrated at the bottom.
          </p>
          <p>
            The contrast that makes this concrete: the{" "}
            <strong>most expensive county</strong> in the analysis is San
            Francisco (Genworth 2024 median: $8,200/month). The{" "}
            <strong>highest average citation severity</strong> is in Contra
            Costa County (severity index = 4.44). They are different counties.
            Paying more does not move you out of risk.
          </p>
        </AnalysisProse>

        <AnalysisMethodNote>
          A correlation of 0.27 is not zero — high-cost counties do skew
          slightly worse on this severity index, contrary to what families
          often assume. But the relationship is too weak to use cost as a
          proxy for safety in either direction.
        </AnalysisMethodNote>

        <AnalysisH2 id="worst-value">Worst-value example</AnalysisH2>
        <AnalysisProse>
          <p>
            The single facility with the largest gap between price tier and
            inspection severity in the dataset is{" "}
            <strong>Araville Residential Care Home II</strong> in San Bruno —
            a 97th-percentile-priced market with a severity index of 9.7.
            High-cost market, high-severity inspection record. The
            relationship families would intuitively expect is reversed.
          </p>
          <p>
            By the inverse measure, several lower-cost facilities post
            consistently clean records — Sunrise at Yorba Linda is one
            example. We do not publish a single &ldquo;best value&rdquo; list
            because the calculation depends on what families weight; instead
            we surface the four independent signals on each facility profile.
          </p>
        </AnalysisProse>

        <AnalysisH2 id="why-this-matters">Why this matters for families</AnalysisH2>
        <AnalysisProse>
          <p>
            The dominant heuristic families bring to memory care placement is
            cost-as-quality. It comes from healthier markets — restaurants,
            hotels, schools — where price and quality at least loosely track.
            In California memory care, this analysis suggests they do not.
          </p>
          <p>
            That has two practical implications. First, a higher monthly rate
            should not substitute for reading the inspection record. Second, a
            lower monthly rate should not be assumed to mean a worse facility;
            the data does not support that conclusion either.
          </p>
          <p>
            See the inspection record on every California facility profile
            before signing.{" "}
            <Link
              href="/california/facilities"
              className="text-teal underline underline-offset-4 hover:text-teal/80"
            >
              Browse all California facilities →
            </Link>
          </p>
        </AnalysisProse>
      </AnalysisShell>

      <SiteFooter />
    </>
  );
}
