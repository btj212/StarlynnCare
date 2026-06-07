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

const PAGE_PATH = "/research/california-geographic-equity";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE =
  "High-income California ZIPs do not have better memory care records";
const META_TITLE = `${TITLE} | StarlynnCare Research`;
const DESC =
  "ZIP-level household income explains almost none of the variation in California memory care deficiency rates (Pearson r = 0.23). Several of the highest-income ZIPs rank among the worst-cited.";
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
    { name: "Geographic equity (CA)", url: canonicalUrl },
  ]),
  buildDatasetSchema({
    pageUrl: canonicalUrl,
    methodologyUrl: canonicalFor("/methodology"),
  }),
];

const QUARTILES = [
  { label: "Q1 — Low income", rate: 0.52 },
  { label: "Q2 — Mid-low", rate: 0.71 },
  { label: "Q3 — Mid-high", rate: 0.87 },
  { label: "Q4 — High income", rate: 1.32 },
];

const HIGH_INCOME_OFFENDERS = [
  { zip: "94560", income: "$159,465", rate: 5.97, area: "Newark" },
  { zip: "94555", income: "$202,832", rate: 4.78, area: "Fremont" },
  { zip: "94536", income: "$152,076", rate: 2.81, area: "Fremont" },
];

export default function CAGeographicEquityPage() {
  const maxRate = Math.max(...QUARTILES.map((q) => q.rate));
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
        eyebrow="Geographic equity (CA)"
        title={TITLE}
        dek="An income–quality cross-section across 484 California memory care facilities and 108 ZIP codes. The headline that families often hear — &lsquo;richer ZIP, better care&rsquo; — does not survive contact with the inspection record."
        bylineDate="May 11, 2026"
        scope="California · 108 ZIPs · 484 facilities"
        keyFindings={[
          {
            value: "r = 0.23",
            label: "ZIP income ↔ deficiency rate",
            caption: "Pearson · p = 0.018",
            tone: "warn",
          },
          {
            value: "Q4",
            label: "highest-deficiency income quartile",
            caption: "Avg 1.32 def/inspection",
            tone: "alarm",
          },
          {
            value: "1.32 vs 0.52",
            label: "high-income vs low-income avg deficiency rate",
            caption: "Q4 vs Q1 quartile means",
            tone: "neutral",
          },
        ]}
        methodologyDisclosure={
          "Income data: U.S. Census Bureau ACS 5-year (2022) median household income, joined to facility ZIPs. 484 of 484 ZIPs matched directly; none required approximation.\n\nQuality measure: deficiency citations per inspection at each facility, averaged across all facilities in a ZIP. Restricted to ZIPs with ≥2 publishable facilities (n = 108).\n\nQuartile assignment is by ZIP-level income against the in-sample distribution, not against statewide household income."
        }
        sources={[
          {
            label: "U.S. Census Bureau — American Community Survey 2022 (ZIP-level income)",
            url: "https://www.census.gov/programs-surveys/acs",
          },
          {
            label: "CDSS Community Care Licensing — RCFE inspection records",
            url: "https://www.cdss.ca.gov/inforesources/cdss-programs/community-care-licensing",
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
            Across the 108 California ZIPs with two or more publishable
            memory care facilities, the Pearson correlation between
            ZIP-level median household income and average deficiency rate is{" "}
            <strong>r = 0.23</strong> — weak, statistically detectable
            (p = 0.018), but very far from a one-to-one relationship.
          </p>
          <p>
            The direction of the small relationship that does exist runs{" "}
            <strong>against</strong> the popular intuition. Higher-income
            ZIPs have <em>more</em> deficiencies per inspection, not fewer.
            The Q4 (highest income) quartile averages 1.32 deficiencies per
            inspection; the Q1 (lowest income) quartile averages 0.52.
          </p>
        </AnalysisProse>

        <AnalysisH2 id="quartiles">Deficiency rate by income quartile</AnalysisH2>
        <div className="mt-4 space-y-3 max-w-[520px]">
          {QUARTILES.map((q) => {
            const widthPct = Math.round((q.rate / maxRate) * 100);
            return (
              <div key={q.label} className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-mono)] text-[12px] text-ink-4 w-28 shrink-0 text-right">
                  {q.label}
                </span>
                <div className="flex-1 bg-paper-2 rounded-full overflow-hidden h-5">
                  <div
                    className="h-full rounded-full bg-rust/70 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(widthPct, 6)}%` }}
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-white/90 whitespace-nowrap">
                      {q.rate.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-ink-4 mt-3 max-w-[60ch]">
          Average deficiencies per inspection by ZIP-income quartile.
          Quartile cutoffs derived from the in-sample distribution of 108
          ZIPs.
        </p>

        <AnalysisH2 id="high-income-offenders">
          High-income ZIPs with poor inspection records
        </AnalysisH2>
        <AnalysisProse>
          <p>
            The aggregate result is concentrated in a handful of high-income
            ZIPs that post conspicuously bad records. Three illustrative
            examples:
          </p>
        </AnalysisProse>

        <ul className="mt-4 space-y-3 text-[15px] leading-[1.6] text-ink-2">
          {HIGH_INCOME_OFFENDERS.map((row) => (
            <li
              key={row.zip}
              className="flex items-baseline gap-3 border-b border-paper-rule pb-2"
            >
              <span className="font-[family-name:var(--font-mono)] text-rust font-semibold shrink-0 w-12">
                {row.zip}
              </span>
              <span>
                <strong className="text-ink">{row.area}</strong>{" "}
                <span className="text-ink-3">
                  · median income {row.income} · {row.rate.toFixed(2)} def/insp
                </span>
              </span>
            </li>
          ))}
        </ul>

        <AnalysisMethodNote>
          Three points do not make a trend in isolation, but the same pattern
          appears across the full Q4 quartile. Wealthy California ZIPs are
          not, on average, where the cleanest inspection records live.
        </AnalysisMethodNote>

        <AnalysisH2 id="why-this-matters">
          Why this matters for placement decisions
        </AnalysisH2>
        <AnalysisProse>
          <p>
            Income geography is one of the strongest cultural shortcuts
            families use when choosing care for a parent: the assumption is
            that a wealthier neighborhood will produce a better facility.
            This analysis gives that assumption a reality check — at least
            for memory care in California, ZIP-level income is not a
            reliable proxy for inspection performance.
          </p>
          <p>
            The practical move is the same as in our{" "}
            <Link
              href="/research/california-cost-vs-quality"
              className="text-teal underline underline-offset-4 hover:text-teal/80"
            >
              cost-vs-quality analysis
            </Link>
            : read the actual inspection record on the facility profile.
            Geography is not a substitute.
          </p>
        </AnalysisProse>
      </AnalysisShell>

      <SiteFooter />
    </>
  );
}
