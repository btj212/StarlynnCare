import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";
import { StatBlock, type StatItem } from "@/components/editorial/StatBlock";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/california/cost-guide";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "What Memory Care Actually Costs in California (2026)";
const DESC =
  "Median ranges by region, how RCFE bills are structured (base rate vs. level-of-care fees), what Medicare and Medi-Cal cover, long-term care insurance, tax considerations, and hidden fees — reviewed by a California RN.";
const DATE_PUBLISHED = "2026-05-02";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What's the average cost of memory care in California?",
    a: "Industry benchmarks place the statewide median for RCFE memory care around $6,500–$7,800/month in 2026, before level-of-care add-ons. Coastal metros run higher; inland cities lower. Always confirm with facility-specific quotes.",
  },
  {
    q: "How much does memory care cost per month in 2026?",
    a: "Expect all-in monthly bills of roughly $7,500–$9,500 for many families once level-of-care fees, supplies, and occasional services are included — on top of the advertised base rate.",
  },
  {
    q: "Does Medicare pay for memory care?",
    a: "Medicare does not pay for long-term room and board in an RCFE memory care setting. It may cover short-term skilled nursing after a qualifying hospital stay, and outpatient medical services — not the residential facility fee.",
  },
  {
    q: "Does Medi-Cal pay for memory care in California?",
    a: "Traditional Medi-Cal does not pay RCFE room and board. The Assisted Living Waiver may cover services (not rent) in participating facilities and counties, subject to eligibility and waitlists. SNF dementia units follow different Medi-Cal rules.",
  },
  {
    q: "Are memory care costs tax-deductible?",
    a: "Some medical components may qualify as itemized medical expenses if they exceed IRS thresholds — not tax advice; consult a CPA. Room and board alone is usually not deductible unless attributable to qualifying medical care.",
  },
  {
    q: "What is a level-of-care fee?",
    a: "A monthly add-on based on assessed care needs (points for ADLs, behaviors, medication complexity). It is the main driver of bill growth after move-in.",
  },
  {
    q: "Can long-term care insurance pay for memory care?",
    a: "Often yes, if the policy was purchased before impairment and benefit triggers are met (commonly cognitive impairment or two ADLs). Elimination periods and daily caps vary.",
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

const REGIONAL_STATS: StatItem[] = [
  {
    n: "$8,000–$12,000",
    unit: "/ mo",
    label: "Bay Area (Alameda, Contra Costa, San Mateo, Santa Clara counties)",
    src: "Genworth 2024",
  },
  {
    n: "$6,500–$9,500",
    unit: "/ mo",
    label: "Southern California (Los Angeles, Orange, San Diego counties)",
    src: "Genworth 2024",
  },
  {
    n: "$5,500–$7,500",
    unit: "/ mo",
    label: "Sacramento region and Inland Empire",
    src: "Genworth 2024",
  },
  {
    n: "~$7,800",
    unit: "/ mo",
    label: "Working median for RCFE memory care (estimate, base + typical LOC)",
    src: "Genworth + operator benchmarks",
  },
];

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
      {children}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-8 border-l-[3px] border-rust pl-5 py-1 text-[15px] leading-[1.65] text-ink-2 max-w-[66ch]">
      {children}
    </div>
  );
}

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

export default function CaliforniaCostGuidePage() {
  const articleLd = buildArticleSchema({
    headline: TITLE,
    description: DESC,
    url: canonicalUrl,
    datePublished: DATE_PUBLISHED,
  });
  const jsonLd = [
    articleLd,
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "California", url: canonicalFor("/california") },
      { name: "What memory care costs", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <Link href="/california" className="hover:text-teal transition-colors">
                California
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Cost guide</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Without the sales-tour quote walls
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,56px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5">
              What memory care actually costs in California in <em>2026.</em>
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">
              A registered nurse walks through the real numbers: base rate, level-of-care add-ons,
              hidden fees, what Medi-Cal covers, and how to read a tour quote.
            </p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <H2 id="tldr">TL;DR — the numbers</H2>
          <Prose>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Median monthly cost (RCFE memory care, estimate):</strong> roughly $7,800/month
                all-in for many families once level-of-care fees are included — highly variable by region
                and acuity.
              </li>
              <li>
                <strong>Range:</strong> about $4,500–$15,000+/month depending on geography, room type,
                and care needs.
              </li>
              <li>
                <strong>Hidden stack:</strong> most operators use a points-based level-of-care system
                that commonly adds <strong>$500–$2,500/month</strong> on top of the advertised base.
              </li>
              <li>
                <strong>Budget rule of thumb:</strong> plan for <strong>base + 25–40%</strong> in
                level-of-care fees until you have a facility-specific assessment in writing.
              </li>
            </ul>
          </Prose>
          <DataFootnote source="Genworth Cost of Care Survey · CA RCFE market benchmarks" refreshed={DATE_PUBLISHED} />

          <H2 id="bill-structure">How the bill is structured</H2>
          <Prose>
            <p>The base rate isn&apos;t the only line item. Most California families see five buckets:</p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>
                <strong>Base monthly rate</strong> — room, board, basic supervision (the number on the
                website).
              </li>
              <li>
                <strong>Level-of-care (LOC) fees</strong> — points for bathing, meds, mobility,
                behaviors; this is where bills grow fastest as dementia progresses.
              </li>
              <li>
                <strong>Community / move-in fee</strong> — one-time, often $2,000–$10,000;
                refundability varies.
              </li>
              <li>
                <strong>Optional services</strong> — salon, transportation, escorts, special diets.
              </li>
              <li>
                <strong>Move-out / end-of-stay</strong> — notice-period rent, cleaning, deposit
                handling.
              </li>
            </ol>
          </Prose>

          <H2 id="regional-costs">Regional variation</H2>
          <Prose>
            <p>
              Labor and real estate drive most of the gap between markets. Use the table as a
              benchmark — not a quote.
            </p>
          </Prose>
          <div className="mt-6">
            <StatBlock
              stats={REGIONAL_STATS}
              footnotes={[
                "Genworth 2024 Cost of Care Survey, California. Luxury units and specialized behavioral programs can exceed ranges.",
                "Confirm pricing in writing before admission; StarlynnCare does not verify operator rates.",
              ]}
            />
          </div>

          <H2 id="whats-included">What you&apos;re paying for</H2>
          <Prose>
            <p>Most RCFE memory care bundles include:</p>
          </Prose>
          <ul className="mt-4 space-y-2 text-[15.5px] leading-[1.65] text-ink-2 list-disc pl-6 max-w-[68ch]">
            <li>Licensed setting with secured perimeter and dementia-trained staffing (verify on tour)</li>
            <li>24/7 supervision; staffing ratios vary sharply by shift — ask nights and weekends</li>
            <li>ADL support, medication administration assistance, meals, programming</li>
          </ul>
          <Prose>
            <p className="mt-4">
              What memory care typically does <em>not</em> include without separate arrangement:
              24/7 skilled nursing, IV medications, complex wound care, active rehab — those are SNF
              domains.
            </p>
          </Prose>

          <H2 id="add-ons">Common add-on charges</H2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-[14.5px] text-ink-2 border-collapse">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="text-left py-3 pr-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Service
                  </th>
                  <th className="text-left py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Typical extra cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-rule">
                {[
                  ["Higher-acuity personal care (two-person assist)", "$500–$1,500 / mo"],
                  ["Incontinence supplies", "$100–$300 / mo"],
                  ["PT/OT (non-Medicare)", "$150–$250 / session"],
                  ["Behavioral 1:1 or dedicated attendant", "$1,000–$3,000 / mo"],
                  ["Companion / sitter", "$20–$30 / hr"],
                ].map(([service, cost]) => (
                  <tr key={service}>
                    <td className="py-3 pr-6 text-ink-2">{service}</td>
                    <td className="py-3 font-[family-name:var(--font-mono)] text-[13px] text-rust">{cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2 id="medi-cal-medicare">Medi-Cal, Medicare, ALW</H2>
          <Callout>
            Traditional Medi-Cal does not pay RCFE room and board. Medicare does not pay long-term
            residential memory care. Most families pay privately, use LTC insurance, VA Aid &amp;
            Attendance, or a combination.
          </Callout>
          <Prose>
            <p>
              The{" "}
              <a
                href="https://www.cdss.ca.gov/assisted-living-waiver"
                className="text-teal underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Assisted Living Waiver
              </a>{" "}
              can fund <em>services</em> in participating RCFEs for eligible beneficiaries in select
              counties — waitlists are common; room and board remains largely private-pay.
            </p>
          </Prose>

          <H2 id="ltc-insurance">Long-term care insurance</H2>
          <Prose>
            <p>
              Policies vary enormously on elimination periods (often 90 days), daily vs. monthly caps,
              inflation riders, and cognitive-impairment triggers. Denials on first filing are not
              uncommon; appeals with clinician documentation sometimes succeed.
            </p>
          </Prose>

          <H2 id="tax">Tax considerations (not tax advice)</H2>
          <Prose>
            <p>
              Some families deduct qualifying medical expenses above IRS AGI thresholds when memory
              care is medically necessary — definitions are strict. Consult a licensed CPA; do not
              rely on marketing brochures for tax planning.
            </p>
          </Prose>

          <H2 id="hidden-traps">Hidden cost traps on tours</H2>
          <ul className="mt-4 space-y-2 text-[15.5px] leading-[1.65] text-ink-2 list-disc pl-6 max-w-[68ch]">
            <li>Annual rate increases and LOC reassessment frequency</li>
            <li>Hospitalization rent policies (full rent while hospitalized)</li>
            <li>Forced transfer triggers if needs exceed RCFE scope</li>
            <li>Community fee charged again on internal AL → memory moves</li>
          </ul>

          <H2 id="methodology">Methodology</H2>
          <Prose>
            <p>
              StarlynnCare cites Genworth and CDSS licensing context for benchmarks. We do not accept
              payment to alter cost figures. Operators may submit published rate sheets via{" "}
              <a href="mailto:hello@starlynncare.com" className="text-teal underline">
                hello@starlynncare.com
              </a>{" "}
              for attribution when verified.
            </p>
          </Prose>

          <div className="mt-12 pt-8 border-t border-paper-rule flex flex-col gap-3 text-[14px] text-ink-3">
            <Link href="/california" className="text-teal underline underline-offset-4">
              Browse California memory care facilities →
            </Link>
            <Link
              href="/library/type-a-vs-type-b-deficiencies-explained"
              className="text-teal underline underline-offset-4"
            >
              Type-A vs. Type-B deficiencies →
            </Link>
            <Link href="/methodology" className="text-teal underline underline-offset-4">
              How StarlynnCare grades facilities →
            </Link>
          </div>
          <DataFootnote
            source={`${SITE_ORIGIN} · Genworth · CDSS · NIH · IRS Pub 502 (general reference only)`}
            refreshed={DATE_PUBLISHED}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
