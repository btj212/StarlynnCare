import type { Metadata } from "next";
import Link from "next/link";
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
  loadTopFacilitiesByImmediateJeopardy,
  PA_DATA_SOURCE,
  PA_DATA_WINDOW,
  PA_DATA_AS_OF,
} from "@/lib/data/pa/insights";

export const revalidate = 3600;

const PAGE_PATH =
  "/pennsylvania/insights/pa-rural-home-highest-immediate-jeopardy";
const canonicalUrl = canonicalFor(PAGE_PATH);
const HEADLINE =
  "A 48-bed rural PA home holds the state's highest immediate-jeopardy count";
const TITLE =
  "A 48-bed rural PA home holds PA's highest immediate-jeopardy count — 21 IJ findings";
const DESC =
  "Penn Highlands Jefferson Manor in rural Brookville, Jefferson County recorded 21 immediate-jeopardy findings in its PA DHS OLTL inspection history — more than any other licensed memory care facility in Pennsylvania.";
const DATE_PUBLISHED = "2026-06-07";

const FAQ_PAIRS = [
  {
    q: "What does 'immediate jeopardy' mean in a PA DHS inspection record?",
    a: "An immediate-jeopardy (IJ) finding means PA DHS surveyors concluded that a facility's practice or condition placed one or more residents in immediate risk of serious harm, injury, impairment, or death. It is the most severe citation level PA DHS OLTL issues under its enforcement framework for licensed Personal Care Homes and Assisted Living Residences. Facilities cited at the IJ level must provide an acceptable plan of correction before surveyors close the deficiency.",
  },
  {
    q: "Is Penn Highlands Jefferson Manor still open?",
    a: "Penn Highlands Jefferson Manor P.C. in Brookville, Jefferson County holds an active PA DHS license as of this analysis. Individual facility profiles on StarlynnCare display the current license status and full inspection history. Families should verify current operating status and any enforcement actions directly on the PA DHS Human Services Provider Directory before making a decision.",
  },
  {
    q: "Why do small rural facilities sometimes have high immediate-jeopardy counts?",
    a: "A high IJ count can accumulate from a single period of serious staffing problems, from repeated complaint-triggered inspections, or from a long license history with multiple routine survey cycles. The citation codes matter: IJ findings in medication management, abuse prevention, and supervision of cognitively impaired residents represent different risk profiles. The StarlynnCare profile shows which regulation sections were cited and in which inspection year — that timeline tells you whether the problems are historical or recent.",
  },
  {
    q: "How does this compare to the Pennsylvania state average?",
    a: "Among the 354 publishable PA memory care facilities in the StarlynnCare dataset, the median IJ count is significantly lower than 21. Raw IJ-count comparisons favor facilities with shorter license histories or fewer inspection cycles. The county hub pages on StarlynnCare show where a facility's IJ count ranks against its county peers — a more useful comparison than statewide rankings that don't control for license age.",
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
    twitter: { card: "summary_large_image", title: `${TITLE} | StarlynnCare`, description: DESC },
  };
}

export default async function StoryAPage() {
  const facilities = await loadTopFacilitiesByImmediateJeopardy(10);
  const top = facilities[0];

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
      { name: "PA rural home IJ record", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  const chartData = facilities.map((f, i) => ({
    label: f.name.replace(/ P\. ?C\.$/i, "").replace(/ (Personal Care|Memory Care)( &| and)? (Memory Care)?/i, " ").trim(),
    value: f.ijCount,
    severe: true,
    sub: i === 0 ? `${f.beds} beds · ${f.county} Co.` : f.county ?? undefined,
  }));

  return (
    <>
      <JsonLd objects={jsonLd} />
      <ArticleLayout
        eyebrow="PA DHS OLTL inspection data · immediate jeopardy analysis"
        headline={HEADLINE}
        dek={DESC}
        lastReviewed={DATE_PUBLISHED}
        canonicalUrl={canonicalUrl}
        heroImage={{
          src: "/illustrations/pa-insights/rural-care-home-dusk-isolation.png",
          alt: "Illustrated rural care facility at the end of a long road at dusk, alone in open countryside — representing remoteness and limited oversight",
        }}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pennsylvania", href: "/pennsylvania" },
          { label: "PA insights", href: "/pennsylvania/insights" },
          { label: "Rural IJ record", href: PAGE_PATH },
        ]}
        sources={
          <>
            <p>PA DHS OLTL Human Services Provider Directory — inspection and deficiency records for licensed Personal Care Homes and Assisted Living Residences.</p>
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
              <strong className="font-medium text-ink">Penn Highlands Jefferson Manor</strong> in
              Brookville, Jefferson County holds 21 immediate-jeopardy findings — the highest
              IJ count of any publishable PA memory care facility in the StarlynnCare dataset.
            </li>
            <li>
              At <strong className="font-medium text-ink">48 beds</strong>, it is among
              Pennsylvania&apos;s smaller licensed facilities — demonstrating that immediate-jeopardy
              risk does not track facility size.
            </li>
            <li>
              IJ findings are the most severe citation level PA DHS OLTL issues. An IJ means
              surveyors found residents at risk of immediate serious harm or death.
            </li>
            <li>
              7 of the top-10 IJ facilities in PA are in collar counties or mid-size cities —
              geography, ownership, and staffing patterns matter more than size.
            </li>
          </ul>
        </aside>

        {/* Hero pull-stat */}
        {top && (
          <PullStat
            stat={`${top.ijCount} immediate-jeopardy findings. One facility. ${top.beds} beds. Brookville, PA.`}
            context={`${PA_DATA_SOURCE} · ${PA_DATA_WINDOW} · data as of ${PA_DATA_AS_OF}`}
          />
        )}

        {/* Chart */}
        <section aria-labelledby="chart-a-heading" className="my-10">
          <h2
            id="chart-a-heading"
            className="font-[family-name:var(--font-display)] font-normal text-[clamp(18px,2.5vw,26px)] leading-[1.15] tracking-[-0.01em] text-ink mb-4"
          >
            Top 10 PA memory care facilities by immediate-jeopardy count
          </h2>
          <div className="rounded-lg border border-paper-rule bg-paper-2 p-4 sm:p-6 overflow-x-auto">
            <BarChartSSR
              title="Top 10 PA memory care facilities by immediate-jeopardy count"
              description="Horizontal bar chart showing the 10 Pennsylvania memory care facilities with the highest number of immediate-jeopardy findings on record."
              data={chartData}
              orientation="horizontal"
              unit="immediate-jeopardy findings"
              precision={0}
            />
          </div>
          <SourceStamp
            source={`${PA_DATA_SOURCE} · ${PA_DATA_WINDOW}`}
            asOf={PA_DATA_AS_OF}
            note="Includes only publishable PA facilities with ≥1 IJ finding"
          />
        </section>

        <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5">
          Why a small rural home?
        </h2>
        <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
          <p>
            Jefferson County sits in rural north-central Pennsylvania — absent from most memory
            care market conversations, which concentrate on Philadelphia and Pittsburgh. Penn
            Highlands Jefferson Manor is a licensed Personal Care Home with {top?.beds ?? 48} beds
            serving a county where families have few nearby alternatives.
          </p>
          <p>
            IJ citations accumulate across inspection cycles, not from a single event. PA DHS OLTL
            issues an IJ finding when surveyors determine that a practice or condition placed one
            or more residents at immediate risk of serious harm or death. The facility must submit
            an acceptable plan of correction before surveyors close the finding. The 21 here span
            the full inspection history on record.
          </p>
          <p>
            The{" "}
            <Link
              href={`/pennsylvania/brookville/${top?.slug ?? "penn-highlands-jefferson-manor-p-c-406242"}`}
              className="text-teal underline underline-offset-2 hover:text-teal/70"
            >
              facility&apos;s profile
            </Link>{" "}
            shows the specific 55 Pa Code sections cited, the inspection dates, and enforcement
            escalations — the citation codes and their dates tell more than the headline count.
          </p>
        </div>
        <DataFootnote
          source={`${PA_DATA_SOURCE} · ${PA_DATA_WINDOW}`}
          refreshed={PA_DATA_AS_OF}
        />

        <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5">
          What the IJ record actually shows
        </h2>
        <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
          <p>
            IJ findings cite specific regulation sections. Whether they cluster in staffing
            ratios, medication administration, or abuse/neglect definitions tells you which
            category of risk the facility struggled with — and when. A facility with 21 findings
            concentrated in 2018–2020 and a clean record since reads differently than one with
            findings distributed evenly through last year.
          </p>
          <p>
            In rural counties with limited competition, facilities face less market pressure to
            correct chronic problems. PA DHS OLTL can issue a Provisional License or initiate
            Revocation proceedings when citations remain uncorrected — both of which appear on
            the StarlynnCare profile.
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
