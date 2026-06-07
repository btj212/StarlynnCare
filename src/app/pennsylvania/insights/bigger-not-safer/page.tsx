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
    a: "On average, yes — at least by the metric of severe deficiency findings (severity ≥ 3 on the PA DHS scale). Facilities with 100 or more beds average 5.1 severe findings per facility, compared to 1.3 for homes with fewer than 20 beds. However, this analysis has important caveats: there are only 3 small-facility data points (n=3), which is too few for statistical confidence. Larger facilities may also accumulate more findings simply because they are larger and have more inspection surface area and more residents. Families should look at per-resident metrics and individual facility profiles rather than this category-level average.",
  },
  {
    q: "What does 'severe' mean in a PA DHS inspection record?",
    a: "In the StarlynnCare dataset, 'severe' means a deficiency with severity level 3 or 4 on the PA DHS scale — where 4 is immediate jeopardy (immediate risk of serious harm or death) and 3 represents potential for more than minimal harm. Pennsylvania DHS OLTL does not use California's Type A/B labeling. Each citation references the specific regulation section of 55 Pa Code Chapter 2600 (PCH) or Chapter 2800 (ALR).",
  },
  {
    q: "Why might large facilities have more severe citations per facility?",
    a: "Several non-causal explanations exist. Larger facilities are more complex to operate and have more regulatory exposure — more residents, more staff, more inspectable processes. They also tend to have longer license histories, which means more total inspection cycles. Some large-chain facilities in Pennsylvania may operate in cost-constrained segments despite appearing premium. None of these explanations mean a large facility is necessarily unsafe — individual records vary widely even within the XL tier.",
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
          What drives the size-severity correlation?
        </h2>
        <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
          <p>
            The relationship between facility size and severe deficiencies in Pennsylvania is
            statistically consistent across the three well-powered tiers (Medium, Large, XL), but
            interpreting causation is difficult. Several mechanisms likely contribute:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="font-medium text-ink">Regulatory surface area</strong> — larger
              facilities have more residents, more staff, and more inspectable care processes.
              A survey team inspecting 150 residents has more opportunities to find violations
              than one inspecting 35 residents.
            </li>
            <li>
              <strong className="font-medium text-ink">Chain and investor ownership</strong> —
              Pennsylvania&apos;s largest facilities are disproportionately operated by national
              chains, which some research associates with thinner staffing ratios relative to
              resident acuity.
            </li>
            <li>
              <strong className="font-medium text-ink">Acuity mix</strong> — XL facilities in PA
              often serve residents with higher medical complexity, which increases clinical risk
              and potential citation exposure.
            </li>
          </ul>
          <DataFootnote
            source={`${PA_DATA_SOURCE} · ${PA_DATA_WINDOW}`}
            refreshed={PA_DATA_AS_OF}
          />
        </div>

        <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5">
          What this means for families
        </h2>
        <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
          <p>
            This finding should not lead families to reflexively prefer small facilities — the
            Small-tier sample is too thin (n={smallTier?.n ?? 3}) to draw reliable conclusions,
            and many large PA facilities maintain excellent records. What it challenges is the
            intuition that a larger, better-branded facility automatically means a safer
            environment.
          </p>
          <p>
            The right approach is to look at{" "}
            <strong className="font-medium text-ink">
              individual facility records, sorted by inspection record quality
            </strong>
            , rather than size category. A 120-bed PA facility with no severe findings in five
            years is safer, by this metric, than a 45-bed facility with multiple IJ citations.
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
