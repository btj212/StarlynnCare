import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArticleLayout } from "@/components/insights/ArticleLayout";
import { BarChartSSR } from "@/components/insights/BarChartSSR";
import { PullStat } from "@/components/insights/PullStat";
import { SourceStamp } from "@/components/insights/SourceStamp";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";
import { canonicalFor } from "@/lib/seo/canonical";
import {
  loadCountyDeficiencyStats,
  PA_DATA_SOURCE,
  PA_DATA_WINDOW,
  PA_DATA_AS_OF,
} from "@/lib/data/pa/insights";

export const revalidate = 3600;

const PAGE_PATH = "/pennsylvania/insights/philadelphia-suburbs-worst-records";
const canonicalUrl = canonicalFor(PAGE_PATH);
const HEADLINE =
  "Philadelphia's affluent suburbs have some of PA's worst memory care records";
const TITLE =
  "Philadelphia suburbs lead PA in memory care deficiencies per facility — inspection data analysis";
const DESC =
  "Chester and Montgomery counties — among Pennsylvania's wealthiest — rank in the top five statewide for memory care deficiencies per facility. Chester County's 26 facilities average 80 deficiencies each, and outpace Pittsburgh's Allegheny County on IJ findings per facility despite having 40% fewer homes.";
const DATE_PUBLISHED = "2026-06-07";

/** Collar counties around Philadelphia — accented in the chart. */
const COLLAR_COUNTIES = new Set(["Chester", "Montgomery", "Bucks", "Delaware"]);

const FAQ_PAIRS = [
  {
    q: "Which Pennsylvania counties have the most memory care deficiencies per facility?",
    a: "Based on PA DHS OLTL inspection records through mid-2026, Philadelphia (87.6 deficiencies/facility), Chester (80.1), Lackawanna (75.6), Delaware (75.4), and Montgomery (75.4) counties have the highest rates among counties with 5 or more publishable memory care facilities. Note that Philadelphia's rate is based on only 7 facilities — a small sample that inflates the average — while Chester and Montgomery represent much larger samples of 26 and 48 facilities, respectively.",
  },
  {
    q: "Why do wealthy suburban counties rank so high for memory care deficiencies?",
    a: "A few structural factors contribute. Chester and Montgomery counties have high concentrations of large-capacity facilities — larger facilities accumulate more total deficiency findings across inspection cycles. Wealthier suburban markets attract more facility investment, which increases the number of inspection targets. PA DHS OLTL also responds to family complaints; more engaged families means more complaint-triggered inspections on top of routine surveys. None of that cancels the finding. The per-facility rate controls for facility count, and Chester still outpaces Allegheny on IJ findings per facility.",
  },
  {
    q: "How does Allegheny County (Pittsburgh) compare to the Philadelphia collar counties?",
    a: "Allegheny County has 44 publishable memory care facilities and 136 total immediate-jeopardy findings on record. Chester County has 26 facilities and 109 IJ findings — roughly 40% fewer facilities, but accumulating IJ findings at a rate of 4.2 per facility versus Allegheny's 3.1 per facility. This means Chester County's facilities collectively have a higher per-facility IJ rate than Pittsburgh-area facilities, despite being a smaller and wealthier suburban market.",
  },
  {
    q: "What is a 'collar county' in the context of Pennsylvania memory care?",
    a: "The collar counties — Chester, Montgomery, Bucks, and Delaware — are the four counties that border Philadelphia County. They are part of the greater Philadelphia metropolitan area and among the highest-income counties in Pennsylvania. For memory care, they represent a densely competitive market with many large facilities, which may partially explain their higher aggregate deficiency counts.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${TITLE} | StarlynnCare`,
      description: DESC,
      url: canonicalUrl,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${TITLE} | StarlynnCare`,
      description: DESC,
    },
  };
}

export default async function StoryBPage() {
  const countyStats = await loadCountyDeficiencyStats();

  // Show top 10 counties for the chart
  const chartCounties = countyStats.slice(0, 10);

  const jsonLd = [
    buildArticleSchema({
      headline: HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Pennsylvania", url: canonicalFor("/pennsylvania") },
      { name: "PA insights", url: canonicalFor("/pennsylvania/insights") },
      { name: "Philadelphia suburbs inspection records", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  // Find Allegheny for the comparison paragraph
  const allegheny = countyStats.find((c) => c.county === "Allegheny");
  const chester = countyStats.find((c) => c.county === "Chester");
  const montgomery = countyStats.find((c) => c.county === "Montgomery");

  const chesterIjPerFac = chester
    ? (chester.ijTotal / chester.facilities).toFixed(1)
    : "4.2";
  const alleghenyIjPerFac = allegheny
    ? (allegheny.ijTotal / allegheny.facilities).toFixed(1)
    : "3.1";

  return (
    <>
      <JsonLd objects={jsonLd} />
      <ArticleLayout
        eyebrow="PA DHS OLTL inspection data · county comparison"
        headline={HEADLINE}
        dek={DESC}
        lastReviewed={DATE_PUBLISHED}
        canonicalUrl={canonicalUrl}
        heroImage={{
          src: "/illustrations/pa-insights/affluent-suburban-residence-empty.png",
          alt: "Illustrated grand brick suburban residence with manicured landscaping and dark, empty windows — representing affluent address and surface presentation that does not match the inspection record underneath",
        }}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pennsylvania", href: "/pennsylvania" },
          { label: "PA insights", href: "/pennsylvania/insights" },
          { label: "Philadelphia suburbs records", href: PAGE_PATH },
        ]}
        sources={
          <>
            <p>
              PA DHS OLTL Human Services Provider Directory — inspection and deficiency records
              for licensed Personal Care Homes and Assisted Living Residences.
            </p>
            <p>
              <a
                href="https://www.dhs.pa.gov/Services/Licensing/Pages/OLTL-Facility-Search.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal underline"
              >
                dhs.pa.gov — OLTL Facility Search
              </a>
            </p>
          </>
        }
      >
        {/* TL;DR box */}
        <aside className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6 text-[16px] leading-[1.7] text-ink-2 mb-12">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">
            The short version
          </p>
          <ul className="list-disc pl-5 space-y-2.5">
            <li>
              Chester County ({chester?.facilities ?? 26} facilities) and Montgomery County (
              {montgomery?.facilities ?? 48} facilities) rank among Pennsylvania&apos;s top five
              counties for deficiencies per facility.
            </li>
            <li>
              Chester County averages{" "}
              <strong className="font-medium text-ink">
                {chester?.defPerFacility ?? "80.1"} deficiencies per facility
              </strong>{" "}
              — second statewide among counties with 5+ facilities.
            </li>
            <li>
              Chester County&apos;s {chester?.facilities ?? 26} facilities accumulate IJ findings
              at a higher per-facility rate ({chesterIjPerFac}/facility) than Allegheny County
              (Pittsburgh metro), which has {allegheny?.facilities ?? 44} facilities at{" "}
              {alleghenyIjPerFac}/facility.
            </li>
            <li>
              Wealth and suburban location do not predict safer memory care. Individual facility
              records — not county averages — should drive family decisions.
            </li>
          </ul>
        </aside>

        {/* Pull stat */}
        <PullStat
          stat={`Chester County, PA: ${chester?.defPerFacility ?? 80.1} deficiencies per memory care facility — second-highest rate in the state.`}
          context={`Based on ${chester?.facilities ?? 26} publishable PA DHS-licensed facilities · ${PA_DATA_SOURCE} · data as of ${PA_DATA_AS_OF}`}
        />

        {/* Chart */}
        <section aria-labelledby="chart-b-heading" className="my-10">
          <h2
            id="chart-b-heading"
            className="font-[family-name:var(--font-display)] font-normal text-[clamp(18px,2.5vw,26px)] leading-[1.15] tracking-[-0.01em] text-ink mb-4"
          >
            Deficiencies per facility — top 10 PA counties (5+ facilities)
          </h2>
          <div className="rounded-lg border border-paper-rule bg-paper-2 p-4 sm:p-6 overflow-x-auto">
            <BarChartSSR
              title="Deficiencies per facility — top PA counties"
              description="Vertical bar chart showing deficiencies per facility for the top 10 Pennsylvania counties, with Philadelphia collar counties highlighted."
              data={chartCounties.map((c) => ({
                label: c.county,
                value: c.defPerFacility,
                severe: COLLAR_COUNTIES.has(c.county),
                sub: `n=${c.facilities}`,
              }))}
              orientation="vertical"
              unit="avg deficiencies per facility"
              precision={1}
            />
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.06em]">
            <span className="inline-block w-3 h-3 rounded-sm mr-1.5 align-middle" style={{ background: "var(--color-rust)" }} aria-hidden="true" />
            Philadelphia collar counties (Chester, Montgomery, Bucks, Delaware) highlighted in rust.
            n = publishable facilities per county.
          </p>
          <SourceStamp
            source={`${PA_DATA_SOURCE} · ${PA_DATA_WINDOW}`}
            asOf={PA_DATA_AS_OF}
            note="Counties with ≥5 publishable facilities only"
          />
        </section>

        <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5">
          Chester County vs. Allegheny County: a telling comparison
        </h2>
        <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
          <p>
            Allegheny County (Pittsburgh) has{" "}
            <strong className="font-medium text-ink">
              {allegheny?.facilities ?? 44} publishable memory care facilities
            </strong>{" "}
            and{" "}
            <strong className="font-medium text-ink">
              {allegheny?.ijTotal ?? 136} total immediate-jeopardy findings
            </strong>{" "}
            on record — {alleghenyIjPerFac} IJ findings per facility.
          </p>
          <p>
            Chester County, with {chester?.facilities ?? 26} facilities — roughly 40% fewer than
            Allegheny — has accumulated {chester?.ijTotal ?? 109} IJ findings:{" "}
            <strong className="font-medium text-ink">{chesterIjPerFac} per facility</strong>.
            Chester has a higher per-facility IJ rate than Pennsylvania&apos;s largest urban county
            despite operating in one of the state&apos;s wealthiest markets.
          </p>
          <p>
            The relationship between price and inspection record does not run in the direction
            families typically assume. Several Chester County facilities have strong records;
            several have the worst in the state. Sorting by inspection grade, not zip code,
            is the only way to separate them.
          </p>
          <DataFootnote
            source={`${PA_DATA_SOURCE} · ${PA_DATA_WINDOW}`}
            refreshed={PA_DATA_AS_OF}
          />
        </div>

        <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5">
          What county data does and doesn&apos;t tell you
        </h2>
        <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
          <p>
            County averages locate you in the right search area, but the within-county variance is
            large. Chester County contains facilities with 0 IJ findings and facilities with 10+.
            The aggregate rate flags that the county warrants scrutiny — it doesn&apos;t identify
            which facilities to avoid or which to trust.
          </p>
          <p>
            Suburb and price point are poor proxies for inspection quality. The data is public,
            free, and sortable on every county hub and facility profile on StarlynnCare.
          </p>
        </div>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="mt-16 pt-8 border-t border-paper-rule">
          <h2
            id="faq-heading"
            className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mb-8"
          >
            Frequently asked questions
          </h2>
          <div className="space-y-8">
            {FAQ_PAIRS.map((pair) => (
              <div key={pair.q}>
                <h3 className="font-[family-name:var(--font-display)] font-normal text-[18px] leading-[1.3] text-ink mb-3">
                  {pair.q}
                </h3>
                <p className="text-[16px] leading-[1.75] text-ink-2">{pair.a}</p>
              </div>
            ))}
          </div>
        </section>
      </ArticleLayout>
    </>
  );
}
