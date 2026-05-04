import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { StatBlock, type StatItem } from "@/components/editorial/StatBlock";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/california/cost-by-city";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Memory Care Costs by California City & Region (2026 Bands)";
const DESC =
  "Regional monthly cost bands for RCFE memory care across major California metros — benchmarks only, not quotes. Reviewed by a California RN.";
const DATE_PUBLISHED = "2026-05-03";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Why are these ranges so wide?",
    a: "Care needs drive level-of-care fees, private vs shared rooms differ, and coastal metros carry higher labor and real-estate costs than inland cities. Always request itemized quotes.",
  },
  {
    q: "Are these medians from StarlynnCare’s database?",
    a: "No — facility-specific pricing is negotiated privately. These bands synthesize Genworth regional benchmarks and operator-published starting rates typical for RCFE memory care cohorts.",
  },
  {
    q: "How should I use this page with facility profiles?",
    a: "Use inspection and citation history on each StarlynnCare profile to shortlist operators, then validate pricing on tours. Cost never substitutes for regulatory history.",
  },
];

export const metadata: Metadata = {
  title: `${TITLE} | StarlynnCare`,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
    url: canonicalUrl,
    type: "article",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
  },
};

const CITY_BANDS: StatItem[] = [
  {
    n: "$8,000–$13,000",
    unit: "/ mo",
    label: "San Francisco Bay Area core (Alameda, Contra Costa, San Mateo, Santa Clara counties)",
    src: "Genworth 2024",
  },
  {
    n: "$7,000–$11,000",
    unit: "/ mo",
    label: "Los Angeles & Orange counties — coastal premium zip codes trend higher",
    src: "Genworth 2024",
  },
  {
    n: "$6,500–$10,000",
    unit: "/ mo",
    label: "San Diego County",
    src: "Genworth 2024",
  },
  {
    n: "$5,800–$8,500",
    unit: "/ mo",
    label: "Sacramento region · Central Valley anchors (e.g., Fresno, Modesto, Stockton)",
    src: "Genworth 2024",
  },
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5"
    >
      {children}
    </h2>
  );
}

export default function CaliforniaCostByCityPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "California", url: canonicalFor("/california") },
      { name: "Cost by city", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
        <article className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-rust">
            <Link href="/california/cost-guide" className="hover:text-teal">
              California costs
            </Link>{" "}
            · Regional bands
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] font-normal text-[clamp(32px,4vw,48px)] leading-[1.05] tracking-[-0.02em] text-ink">
            {TITLE}
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2 max-w-[62ch]">{DESC}</p>
          <AuthorByline lastReviewed={DATE_PUBLISHED} className="mt-8" />

          <div className="mt-10 space-y-5 text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch]">
            <p>
              Families searching &ldquo;memory care cost in [city]&rdquo; rarely get a single answer —
              RCFE memory care bills bundle base rent, care levels, medication administration,
              supplies, and community fees. This page gives{" "}
              <strong className="font-medium text-ink">benchmark bands by metro</strong>, not facility quotes.
            </p>
          </div>

          <div className="mt-12">
            <StatBlock stats={CITY_BANDS} />
            <div className="mt-4">
              <DataFootnote
                source="Genworth Cost of Care Survey + StarlynnCare editorial synthesis"
                refreshed={DATE_PUBLISHED}
                note="Bands are planning estimates — verify with operators before contracting."
              />
            </div>
          </div>

          <H2 id="how-to-use">How to use these bands</H2>
          <div className="space-y-5 text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch]">
            <p>
              Start with the metro band where your family is realistically willing to visit weekly.
              Then open StarlynnCare county hubs — for example{" "}
              <Link href="/california/alameda-county" className="text-teal underline underline-offset-4">
                Alameda County
              </Link>
              ,{" "}
              <Link href="/california/los-angeles-county" className="text-teal underline underline-offset-4">
                Los Angeles County
              </Link>
              , or{" "}
              <Link href="/california/orange-county" className="text-teal underline underline-offset-4">
                Orange County
              </Link>{" "}
              — and compare inspection-derived signals before you prioritize price conversations.
            </p>
            <p>
              For statewide financing context (Medicare vs Medi-Cal limits, ALW caveats), pair this page with{" "}
              <Link href="/california/cost-guide" className="text-teal underline underline-offset-4">
                What memory care actually costs in California
              </Link>
              .
            </p>
          </div>

          <H2 id="faq">Questions families ask first</H2>
          <dl className="space-y-8 mt-8">
            {FAQ_PAIRS.map((f) => (
              <div key={f.q}>
                <dt className="font-[family-name:var(--font-display)] text-[19px] text-ink">{f.q}</dt>
                <dd className="mt-2 text-[16px] leading-relaxed text-ink-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
