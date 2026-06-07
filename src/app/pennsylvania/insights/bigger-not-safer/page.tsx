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
  loadBedTierSeverity,
  PA_DATA_SOURCE,
  PA_DATA_WINDOW,
  PA_DATA_AS_OF,
} from "@/lib/data/pa/insights";

export const revalidate = 3600;

const PAGE_PATH = "/pennsylvania/insights/bigger-not-safer";
const canonicalUrl = canonicalFor(PAGE_PATH);
const HEADLINE =
  "Bigger isn't safer: PA's largest memory care facilities average nearly 4× more severe citations";
const TITLE =
  "Bigger isn't safer: PA XL memory care facilities (100+ beds) average nearly 4× more severe citations than small homes";
const DESC =
  "Pennsylvania memory care facilities with 100 or more beds average 5.1 severe deficiency findings per facility — nearly four times the rate of homes with fewer than 20 beds. Size and scale in Pennsylvania memory care do not correlate with safer inspection records.";
const DATE_PUBLISHED = "2026-06-07";

const FAQ_PAIRS = [
  {
    q: "Do larger Pennsylvania memory care facilities have worse inspection records?",
    a: "On average, yes — by severe deficiency findings (severity ≥ 3 on the PA DHS scale). Facilities with 100 or more beds average 5.1 severe findings per facility, compared to 1.3 for homes with fewer than 20 beds. The Small-tier sample (n=3) is too thin for a statistically meaningful comparison, but the Medium-to-Large-to-XL progression is consistent and based on 43, 140, and 168 facilities respectively. Category averages are a starting screen. Individual facility records are the actual data point for any placement decision.",
  },
  {
    q: "What does 'severe' mean in a PA DHS inspection record?",
    a: "In the StarlynnCare dataset, 'severe' means a deficiency with severity level 3 or 4 on the PA DHS scale — where 4 is immediate jeopardy (immediate risk of serious harm or death) and 3 represents potential for more than minimal harm. Pennsylvania DHS OLTL does not use California's Type A/B labeling. Each citation references the specific regulation section of 55 Pa Code Chapter 2600 (PCH) or Chapter 2800 (ALR).",
  },
  {
    q: "Why might large facilities have more severe citations per facility?",
    a: "Larger facilities have more regulatory surface area — more residents, more staff, more medication passes. Survey teams find more because there is more to inspect. Pennsylvania's XL-tier facilities are also disproportionately chain-operated, and multi-site operators have been cited in PA DHS enforcement actions for staffing shortfalls. The pattern is real, but it plays out differently at the individual facility level. Several XL-tier facilities in PA have clean records; several small ones have poor ones.",
  },
  {
    q: "What bed-size tiers does StarlynnCare use for Pennsylvania?",
    a: "StarlynnCare groups Pennsylvania memory care facilities into four bed-size tiers: Small (fewer than 20 beds, n=3), Medium (20–49 beds, n=43), Large (50–99 beds, n=140), and XL (100 or more beds, n=168). The vast majority of PA memory care capacity is in the large and XL tiers — small homes are relatively uncommon in Pennsylvania compared to states like Oregon or California.",
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

export default async function StoryCPage() {
  const tiers = await loadBedTierSeverity();

  const xlTier = tiers.find((t) => t.tier === "xl");
  const smallTier = tiers.find((t) => t.tier === "small");
  const ratio =
    xlTier && smallTier && smallTier.avgSevere > 0
      ? (xlTier.avgSevere / smallTier.avgSevere).toFixed(1)
      : "3.9";

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
      { name: "Bigger isn't safer", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <ArticleLayout
        eyebrow="PA DHS OLTL inspection data · facility size analysis"
        headline={HEADLINE}
        dek={DESC}
        lastReviewed={DATE_PUBLISHED}
        canonicalUrl={canonicalUrl}
        heroImage={{
          src: "/illustrations/person-reading-chair-window.png",
          alt: "Illustrated person reading a report in an armchair by a window — representing a family member working through PA DHS inspection data before making a memory care placement decision",
        }}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pennsylvania", href: "/pennsylvania" },
          { label: "PA insights", href: "/pennsylvania/insights" },
          { label: "Bigger isn't safer", href: PAGE_PATH },
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
              PA facilities with{" "}
              <strong className="font-medium text-ink">100+ beds (XL tier)</strong> average{" "}
              <strong className="font-medium text-ink">
                {xlTier?.avgSevere ?? 5.1} severe findings per facility
              </strong>
              , based on {xlTier?.n ?? 168} facilities.
            </li>
            <li>
              PA facilities with{" "}
              <strong className="font-medium text-ink">fewer than 20 beds (Small tier)</strong>{" "}
              average{" "}
              <strong className="font-medium text-ink">
                {smallTier?.avgSevere ?? 1.3} severe findings per facility
              </strong>{" "}
              — but the sample is very small (n={smallTier?.n ?? 3}) and not statistically
              robust.
            </li>
            <li>
              The XL-to-Small ratio is approximately{" "}
              <strong className="font-medium text-ink">{ratio}×</strong>. Larger facilities
              accumulate more severe findings on average, though this partly reflects greater
              regulatory exposure, not just care quality.
            </li>
            <li>
              Most PA memory care capacity is in the Large (50–99 beds) and XL (100+ beds)
              tiers — small homes are uncommon in Pennsylvania.
            </li>
          </ul>
        </aside>

        {/* Pull stat */}
        <PullStat
          stat={`PA memory care facilities with 100+ beds average ${xlTier?.avgSevere ?? 5.1} severe citations per facility — ${ratio}× the rate of homes with fewer than 20 beds.`}
          context={`n=${xlTier?.n ?? 168} XL facilities, n=${smallTier?.n ?? 3} small facilities · ${PA_DATA_SOURCE} · data as of ${PA_DATA_AS_OF}`}
        />

        {/* Chart */}
        <section aria-labelledby="chart-c-heading" className="my-10">
          <h2
            id="chart-c-heading"
            className="font-[family-name:var(--font-display)] font-normal text-[clamp(18px,2.5vw,26px)] leading-[1.15] tracking-[-0.01em] text-ink mb-4"
          >
            Average severe findings per facility by bed-size tier
          </h2>
          <div className="rounded-lg border border-paper-rule bg-paper-2 p-4 sm:p-6 overflow-x-auto">
            <BarChartSSR
              title="Average severe findings per PA memory care facility by bed-size tier"
              description="Vertical bar chart showing that larger Pennsylvania memory care facilities have higher average severe deficiency counts, rising from 1.3 for small homes to 5.1 for XL facilities with 100+ beds."
              data={tiers.map((t) => ({
                label: t.label.split("\n")[0],
                value: t.avgSevere,
                severe: t.tier === "xl" || t.tier === "large",
                sub: `n=${t.n}`,
              }))}
              orientation="vertical"
              unit="avg severe findings per facility"
              precision={1}
            />
          </div>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.06em]">
            ⚠ Small tier (n={smallTier?.n ?? 3}): too few facilities for statistical inference.
            All other tiers represent large enough samples for directional interpretation.
          </p>
          <SourceStamp
            source={`${PA_DATA_SOURCE} · ${PA_DATA_WINDOW}`}
            asOf={PA_DATA_AS_OF}
            note="Severe = PA DHS severity ≥ 3. Includes all publishable PA facilities with beds data and inspection records."
          />
        </section>

        <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5">
          Why large facilities accumulate more severe citations
        </h2>
        <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
          <p>
            The pattern holds across the three well-populated tiers (Medium, Large, XL). Two
            structural factors explain most of it:
          </p>
          <p>
            First, regulatory surface area scales with size. A survey team reviewing 150 residents
            has more opportunities to find violations than one reviewing 35. More staff, more
            medication passes, more care processes — each is an inspection point. Raw deficiency
            counts are partly a function of how much there is to inspect.
          </p>
          <p>
            Second, Pennsylvania&apos;s largest facilities are disproportionately operated by
            national chains. Multi-site operators in PA have been cited in state enforcement
            actions for cost-cutting on staffing — thinner ratios relative to resident acuity
            increase the probability of findings in medication management and abuse prevention,
            which are the most common categories for severe citations.
          </p>
          <DataFootnote
            source={`${PA_DATA_SOURCE} · ${PA_DATA_WINDOW}`}
            refreshed={PA_DATA_AS_OF}
          />
        </div>

        <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5">
          Size is a screen, not a sentence
        </h2>
        <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
          <p>
            The Small-tier sample (n={smallTier?.n ?? 3}) is too thin to support a conclusion
            about small homes as a category. There are simply too few of them in Pennsylvania.
            The useful finding is in the XL-to-Large-to-Medium progression, which is consistent
            and well-powered: as bed count increases, average severe citations increase.
          </p>
          <p>
            A 120-bed PA facility with zero severe findings in five years is safer by this metric
            than a 45-bed facility with four IJ citations. Size is a useful filter when you have
            no other information. Once you have the individual inspection record, it supersedes
            bed count entirely.
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
