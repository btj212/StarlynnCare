import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { EditorialHero } from "@/components/editorial/EditorialHero";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/washington/how-to-read-our-inspection-data";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "How to read our Washington inspection data — what state averages hide";
const TITLE = "How to Read WA Memory Care Inspection Data";
const DESC =
  "63% of Washington ALF inspections in our dataset are complaint-driven. 10% of facilities absorbed 33% of all complaints. This guide explains how the WA inspection dataset is built, what it measures, what it doesn't, and why we deliberately don't show trend lines.";
const DATE_PUBLISHED = "2026-05-23";

const QUARTERLY_DATA = [
  { quarter: "2023-Q2", count: 10 },
  { quarter: "2023-Q3", count: 12 },
  { quarter: "2023-Q4", count: 24 },
  { quarter: "2024-Q1", count: 27 },
  { quarter: "2024-Q2", count: 20 },
  { quarter: "2024-Q3", count: 26 },
  { quarter: "2024-Q4", count: 33 },
  { quarter: "2025-Q1", count: 69 },
  { quarter: "2025-Q2", count: 67 },
  { quarter: "2025-Q3", count: 36 },
  { quarter: "2025-Q4", count: 58 },
  { quarter: "2026-Q1", count: 27 },
];

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Why is the WA universe 180 facilities and not all licensed ALFs?",
    a: "Washington has roughly 7,000 licensed ALF, AFH, and ESF beds across thousands of facilities. Most of those are Adult Family Homes — small residential settings of 6 beds or fewer that are not dementia-focused memory care. StarlynnCare publishes facilities that pass our memory care signal model (explicit name keywords, DSHS Dementia Care contract, wa_memory_care_certified flag, or wa_dementia_specialty) plus a freshness gate requiring at least one inspection within 48 months. That combination narrows the publishable set to facilities that are identifiably memory care and have recent regulatory activity on record.",
  },
  {
    q: "What counts as a 'serious' citation on your WA profiles?",
    a: "We count Immediate Jeopardy (IJ) findings and Type A severity deficiencies as serious. IJ findings involve an immediate threat to resident health or safety. Type A findings represent actual or high-probability harm. Both categories require the facility to submit an immediate correction plan to DSHS. The remaining deficiencies — Type B (potential for harm, not immediate) and administrative findings — are shown but not counted in the serious-citation metric.",
  },
  {
    q: "Why don't you publish a 'WA average' score?",
    a: "Because it would be misleading. The WA complaint distribution is so skewed — 10% of facilities absorb 33% of all complaints, 20% absorb 54% — that an average describes almost no actual facility accurately. The median WA facility has a meaningfully different profile from the mean. We rank individual facilities, not the state.",
  },
  {
    q: "Why don't you show whether a facility is improving or getting worse?",
    a: "Two reasons. First, H1 2025 showed a 2× spike in serious citations statewide — from a quarterly baseline around 27 to 69 in Q1 2025 and 67 in Q2 2025. We don't know whether this reflects a real change in care quality, a DSHS methodology shift, or improved completeness of our ingest. Until we can distinguish between those explanations, any 'trending up' or 'trending down' label on an individual facility would be unreliable. Second, our WA dataset starts in May 2023 — a 36-month window is short for drawing reliable trend conclusions on a per-facility basis.",
  },
  {
    q: "Where does this data come from and how often is it refreshed?",
    a: "Inspection records come from DSHS LTCR via the BHForms public portal (fortress.wa.gov/dshs/adsaapps) and related public lookup tools. We scrape, parse, and ingest inspection reports into our database. Facilities are re-evaluated against our publishable criteria with each ingest run. The dataset shown on each WA facility profile reflects all inspections within the 48-month window, ordered by date.",
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

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5 group/h2"
    >
      <a href={`#${id}`} className="no-underline text-ink hover:text-ink">
        {children}
        <span className="ml-2 font-[family-name:var(--font-mono)] text-[14px] text-rust/40 opacity-0 group-hover/h2:opacity-100 transition-opacity select-none" aria-hidden>#</span>
      </a>
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">{children}</div>
  );
}

function QuarterlyTable() {
  const max = Math.max(...QUARTERLY_DATA.map((r) => r.count));
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[480px] text-[13px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Quarter
            </th>
            <th className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Serious citations (IJ + Type A)
            </th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal hidden sm:table-cell">
              Relative volume
            </th>
          </tr>
        </thead>
        <tbody>
          {QUARTERLY_DATA.map((row, i) => {
            const isSpike = row.count >= 60;
            return (
              <tr
                key={row.quarter}
                className="border-t border-paper-rule"
                style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}
              >
                <td className="px-4 py-2.5 font-[family-name:var(--font-mono)] text-[12px] text-ink-2 align-middle">
                  {row.quarter}
                </td>
                <td className={`px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-[14px] align-middle font-semibold ${isSpike ? "text-rust" : "text-ink"}`}>
                  {row.count}
                  {isSpike && (
                    <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-rust/70">spike</span>
                  )}
                </td>
                <td className="px-4 py-2.5 align-middle hidden sm:table-cell">
                  <div
                    className="h-2 rounded-full bg-rust/30"
                    style={{ width: `${Math.round((row.count / max) * 100)}%`, minWidth: "4px" }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function WaReadInspectionDataPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Washington", url: canonicalFor("/washington") },
      { name: "Washington guides", url: canonicalFor("/washington/guides") },
      { name: "How to read inspection data", url: canonicalUrl },
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
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/washington" className="hover:text-teal transition-colors">Washington</Link>
              <span aria-hidden>›</span>
              <Link href="/washington/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">How to read inspection data</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Washington methodology · WA inspection literacy · RN-reviewed
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
            <EditorialHero
              src="/illustrations/person-reading-chair-window.png"
              alt="Illustrated person reading a report in an armchair by a sunny window — representing a family member researching Washington inspection data before making a memory care decision"
              priority
            />
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <aside className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6 text-[16px] leading-[1.7] text-ink-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">
              The short version
            </p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>
                <strong className="font-medium text-ink">63% of WA inspections in our dataset are complaint-driven</strong>, not routine surveys. This is the primary way DSHS discovers problems.
              </li>
              <li>
                <strong className="font-medium text-ink">10% of WA facilities (18 of 180)</strong> absorbed 33% of all complaints. 20% absorbed 54%. The distribution is heavily skewed — the &ldquo;average&rdquo; facility experience is a statistical artifact, not a description of most facilities.
              </li>
              <li>
                <strong className="font-medium text-ink">We do not show trend lines</strong> (&ldquo;improving&rdquo; / &ldquo;getting worse&rdquo;) on WA facility profiles. H1 2025 shows a 2× spike in serious citations statewide. We don&apos;t know whether that reflects a real care change or a DSHS enforcement methodology shift. We won&apos;t publish trend claims until we can distinguish between them.
              </li>
              <li>
                <strong className="font-medium text-ink">We deliberately don&apos;t show certain columns</strong> — civil money penalties, repeat-deficiency flags, residents affected — because those fields are not yet populated for WA. We won&apos;t display data we don&apos;t have.
              </li>
            </ul>
          </aside>

          <H2 id="what-is-in-the-dataset">What&apos;s in the WA dataset</H2>
          <Prose>
            <p>
              The Washington inspection dataset on StarlynnCare covers{" "}
              <strong className="font-medium text-ink">180 publishable ALFs</strong>,{" "}
              <strong className="font-medium text-ink">721 inspections</strong> spanning May 2023 through May 2026, and{" "}
              <strong className="font-medium text-ink">919 deficiencies</strong>. All data comes from DSHS Long-Term Care Regulation (LTCR) via the public BHForms portal.
            </p>
            <p>
              <strong className="font-medium text-ink">Why 180 and not all WA ALFs.</strong> Washington licenses roughly 7,000+ ALF, AFH (Adult Family Home), and ESF (Enhanced Services Facility) beds across thousands of facilities. The vast majority are small AFHs — residential settings with 6 or fewer beds, often not dementia-focused. Our publishable set applies two filters: a memory care signal (explicit name keywords, DSHS Dementia Care contract, memory care certification flag, or dementia specialty self-declaration) and a 48-month freshness gate requiring at least one inspection on record. Facilities that don&apos;t pass both are not shown publicly. They remain in our database for future re-evaluation.
            </p>
            <p>
              <strong className="font-medium text-ink">Inspection types.</strong> DSHS inspects ALFs in two modes: routine surveys (scheduled, approximately annual) and complaint investigations (triggered by a complaint from a resident, family member, or other party). Our dataset tags each inspection as standard or complaint-driven. In the WA dataset, 457 of 721 inspections (63%) are complaint-driven.
            </p>
          </Prose>
          <DataFootnote
            source="DSHS LTCR · BHForms public portal · May 2023 – May 2026"
            refreshed={DATE_PUBLISHED}
            note="180 publishable WA ALFs · 721 inspections · 919 deficiencies · 48-month freshness gate"
          />

          <H2 id="complaint-concentration">The complaint surface is concentrated</H2>
          <Prose>
            <p>
              The most important structural fact about the WA dataset: complaints are not distributed evenly across facilities. They concentrate sharply in a small tail.
            </p>
            <p>
              In the 180-facility dataset: the top 10% of facilities by complaint count (18 facilities) absorbed <strong className="font-medium text-ink">33% of all complaints</strong>. The top 20% (36 facilities) absorbed <strong className="font-medium text-ink">54%</strong>. The bottom half of the distribution — facilities with zero or one complaint — accounts for a small fraction of total complaint volume.
            </p>
            <p>
              Normalizing by beds changes the picture further. Small facilities with high complaint counts can appear moderate in raw numbers but extreme when adjusted for capacity. A facility with 47 beds and 10 complaints is generating complaints at 21 per 100 beds — roughly 3× the rate of a 126-bed facility with 9 complaints.
            </p>
            <p>
              The practical implication: a statewide average complaint rate describes almost no actual facility accurately. The distribution is so skewed that the mean is far above the median. When a state-level summary says &ldquo;the average WA memory care facility receives X complaints per year,&rdquo; it is averaging a large quiet majority with a small extremely active tail. We don&apos;t publish that average. We rank individual facilities instead.
            </p>
          </Prose>

          <H2 id="the-2025-spike">The 2025 spike, and why we don&apos;t show trend lines</H2>
          <Prose>
            <p>
              Quarterly serious citations (IJ + Type A) across all 180 WA facilities:
            </p>
          </Prose>
          <QuarterlyTable />
          <DataFootnote
            source="DSHS LTCR records · 180 publishable WA ALFs"
            refreshed={DATE_PUBLISHED}
            note="Quarters are based on inspection date. 2026-Q1 data is partial (through May 2026)."
          />
          <div className="mt-8">
            <Prose>
              <p>
                H1 2025 is anomalous: Q1 2025 shows 69 serious citations, more than 2× the 2024 quarterly average of roughly 26.5. Q2 2025 is 67. The second half of 2025 and Q1 2026 return closer to the 2024 baseline.
              </p>
              <p>
                <strong className="font-medium text-ink">We don&apos;t know what caused this spike.</strong> Three explanations are plausible, and they are not distinguishable with our current data:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>A real deterioration in care quality across WA ALFs in H1 2025 — whether from staffing shortages, COVID aftermath, or other operational factors</li>
                <li>A DSHS enforcement methodology change — more thorough surveyors, revised deficiency classification standards, expanded use of complaint investigations</li>
                <li>Improved completeness in our ingest — our scraper reaching more facilities or capturing more PDF records that were previously missed</li>
              </ul>
              <p>
                Until we can distinguish between these, any &ldquo;trending up&rdquo; or &ldquo;trending down&rdquo; label on an individual WA facility profile would be unreliable. A facility whose serious citations doubled from 2024 to 2025 may have genuinely deteriorated — or may simply be reflecting a statewide methodology change. We won&apos;t publish directional trend claims that we cannot validate. This is not a technical limitation we expect to have indefinitely; it is a deliberate editorial choice while the 2025 data is under-explained.
              </p>
            </Prose>
          </div>

          <H2 id="how-we-count-serious">How we count serious citations in Washington</H2>
          <Prose>
            <p>
              WA DSHS LTCR uses its own severity classification system for ALF deficiencies, rooted in the Washington Administrative Code (WAC). StarlynnCare maps those classifications to the following tiers:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="font-medium text-ink">Immediate Jeopardy (IJ)</strong> — findings where DSHS determines a resident faces an immediate threat to health or safety. IJ findings require an immediate corrective action plan. In our 180-facility WA dataset, IJ findings are rare: 5 deficiencies across 2 facilities.
              </li>
              <li>
                <strong className="font-medium text-ink">Type A</strong> — actual or high-probability harm to one or more residents. Serious findings that require a corrective action plan but are not classified as immediate jeopardy. The most common &ldquo;serious&rdquo; tier in the WA dataset.
              </li>
              <li>
                <strong className="font-medium text-ink">Type B</strong> — potential for harm if not corrected. Lower severity. These appear on facility profiles but are not counted in the serious-citation metric.
              </li>
            </ul>
            <p>
              On each WA facility profile, the serious-citation count reflects IJ + Type A only. The total deficiency count includes all tiers. Both numbers are shown.
            </p>
          </Prose>

          <H2 id="reading-a-profile">What this means when reading a single facility profile</H2>
          <Prose>
            <p>
              Three things to look at when you open a WA facility profile, in order of signal strength:
            </p>
            <p>
              <strong className="font-medium text-ink">1. Recent inspection density and type.</strong> How many inspections in the last 36 months? What share were complaint-driven vs. routine? A facility with 8 complaint-driven inspections in 36 months and findings in most of them is a different situation than a facility with 2 routine inspections and no findings. The count alone isn&apos;t the signal — the type and outcome combination is.
            </p>
            <p>
              <strong className="font-medium text-ink">2. Severity mix.</strong> One IJ finding is more significant than ten Type B findings. Look at whether the serious-citation count reflects one bad inspection year or a recurring pattern. Read the description text on each serious deficiency — DSHS inspectors are specific about what was wrong and what residents were affected.
            </p>
            <p>
              <strong className="font-medium text-ink">3. Complaint share of inspections.</strong> A facility where 80% of inspections are complaint-driven and 70% of those produce findings is in a different situation than a facility where routine surveys dominate and findings are minor. The complaint-driven share is a behavioral signal: it means someone in the facility — a resident, a family member, a staff member — is reaching out to DSHS. That pattern matters independent of whether any individual inspection produced a serious finding.
            </p>
          </Prose>

          <H2 id="what-we-dont-show">What we don&apos;t yet publish, and why</H2>
          <Prose>
            <p>
              Several analyses that would be genuinely useful to families are not yet possible with the WA data we have. We name them explicitly rather than omitting them silently.
            </p>
            <ul className="list-disc pl-5 space-y-3">
              <li>
                <strong className="font-medium text-ink">Civil money penalties.</strong> DSHS can impose fines on facilities with serious violations. The penalty amounts are not consistently populated in our WA dataset. We don&apos;t show a &ldquo;$X in fines&rdquo; figure because we can&apos;t confirm that zero means no fines or means no data.
              </li>
              <li>
                <strong className="font-medium text-ink">Repeat deficiency flags.</strong> Whether a citation is a repeat of a previously cited violation — one of the clearest signals of systemic failure — requires matching deficiency text across inspections. Our WA ingest does not yet perform that match reliably. We don&apos;t show &ldquo;repeat citation&rdquo; labels.
              </li>
              <li>
                <strong className="font-medium text-ink">Residents affected and harm descriptions.</strong> DSHS inspection reports describe how many residents were affected and the nature of the harm. Those fields are not yet parsed from source PDFs into structured columns. We show the inspector narrative text where available, but not a structured &ldquo;X residents affected&rdquo; figure.
              </li>
              <li>
                <strong className="font-medium text-ink">Operator and ownership chain analysis.</strong> The operator and management company fields are null for most WA facilities — DSHS doesn&apos;t surface them in the directory sources we ingest. Brand-by-name matching (using facility name keywords) is a weak proxy. We don&apos;t publish ownership comparisons for WA until the data improves.
              </li>
            </ul>
          </Prose>

          <div className="mt-16 border-t border-paper-rule pt-12 space-y-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
              Frequently asked
            </p>
            <dl className="space-y-6">
              {FAQ_PAIRS.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold text-ink">{f.q}</dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-ink-2">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-12">
            <Link
              href="/washington/facilities"
              className="inline-flex items-center gap-2 border border-ink px-5 py-3 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-ink hover:bg-ink hover:text-paper transition-colors"
            >
              Browse Washington memory care facilities →
            </Link>
          </div>

          <div className="mt-16 rounded-lg border border-paper-rule bg-paper-2 px-5 py-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-3">
              Continue reading
            </p>
            <ul className="space-y-3">
              <li>
                <Link href="/washington/why-dshs-contract-isnt-a-quality-badge" className="text-teal hover:underline text-[16px]">
                  Why a DSHS Dementia Care contract isn&apos;t a quality badge →
                </Link>
              </li>
              <li>
                <Link href="/washington/memory-care-licensing" className="text-teal hover:underline text-[16px]">
                  Washington memory care licensing — ALFs &amp; Specialized Dementia Care →
                </Link>
              </li>
              <li>
                <Link href="/library/type-a-vs-type-b-deficiencies-explained" className="text-teal hover:underline text-[16px]">
                  Type-A vs. Type-B deficiencies, explained (California comparison) →
                </Link>
              </li>
            </ul>
          </div>

          <div className="mt-12 pt-8 border-t border-paper-rule text-[14px] text-ink-3">
            Last reviewed {DATE_PUBLISHED}. Author bio and credentials at{" "}
            <Link href="/about" className="text-teal underline underline-offset-4">About</Link>. Data sourced from DSHS LTCR public records. This page describes how the dataset is constructed — it is not a quality rating of any individual facility.
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
