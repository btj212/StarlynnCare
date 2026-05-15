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

const PAGE_PATH = "/research/california-inspection-seasonality";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE =
  "California memory care citations cluster in fall — and almost never on weekends";
const META_TITLE = `${TITLE} | StarlynnCare Research`;
const DESC =
  "August carries the highest single-month citation count in the California memory care record (692 citations). Weekends see almost no inspections, leaving facilities largely unobserved Saturday through Sunday.";
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
    { name: "Inspection seasonality (CA)", url: canonicalUrl },
  ]),
  buildDatasetSchema({
    pageUrl: canonicalUrl,
    methodologyUrl: canonicalFor("/methodology"),
  }),
];

const MONTHLY = [
  { month: "Jan", citations: 553 },
  { month: "Feb", citations: 449 },
  { month: "Mar", citations: 567 },
  { month: "Apr", citations: 612 },
  { month: "May", citations: 587 },
  { month: "Jun", citations: 641 },
  { month: "Jul", citations: 658 },
  { month: "Aug", citations: 692 },
  { month: "Sep", citations: 681 },
  { month: "Oct", citations: 672 },
  { month: "Nov", citations: 605 },
  { month: "Dec", citations: 531 },
];

const DAY_OF_WEEK = [
  { day: "Mon", rate: 0.62 },
  { day: "Tue", rate: 0.71 },
  { day: "Wed", rate: 0.65 },
  { day: "Thu", rate: 0.68 },
  { day: "Fri", rate: 1.13 },
  { day: "Sat", rate: 0.92 },
  { day: "Sun", rate: 0.86 },
];

export default function CASeasonalityPage() {
  const maxMonthly = Math.max(...MONTHLY.map((m) => m.citations));
  const maxDow = Math.max(...DAY_OF_WEEK.map((d) => d.rate));

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
        eyebrow="Inspection seasonality (CA)"
        title={TITLE}
        dek="A calendar-level view of when CDSS actually inspects California memory care facilities — and when problems show up in the record. Two patterns dominate: a fall citation peak, and a weekend observation gap."
        bylineDate="May 11, 2026"
        scope="California · 2021–2025"
        keyFindings={[
          {
            value: "Aug",
            label: "highest-citation month",
            caption: "692 citations · 296 serious",
            tone: "alarm",
          },
          {
            value: "Fall",
            label: "highest-citation season (severity-weighted)",
            caption: "Sep–Nov · most serious citations",
            tone: "warn",
          },
          {
            value: "0.89 vs 0.66",
            label: "weekend vs midweek deficiency rate",
            caption: "Per inspection · 2021–2025",
            tone: "neutral",
          },
        ]}
        methodologyDisclosure={
          "Source corpus: every CDSS deficiency citation issued at the 484 publishable California memory care facilities between 2021 and May 2025.\n\nMonthly counts: total citations bucketed by inspection-visit calendar month across the full window.\n\nDay-of-week rate: deficiencies divided by inspections-per-day, normalizing for the fact that CDSS schedules most inspections Tue–Thu. The Friday and weekend numbers represent fewer inspections each, which makes the per-inspection rate larger; do not read them as &lsquo;Friday is when violations happen,&rsquo; read them as &lsquo;the rare Friday inspection finds more.&rsquo;"
        }
        sources={[
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
            Two patterns dominate the calendar of California memory care
            citations between 2021 and 2025.
          </p>
          <p>
            First, a <strong>fall citation peak</strong>. August carries the
            single highest monthly citation count in the data (692
            citations), with September and October close behind. February
            posts the lowest count (449). Weighted by severity, the peak
            sharpens further: 296 serious-or-worse citations in August
            alone, and fall (Sep–Nov) is the highest-severity season.
          </p>
          <p>
            Second, a <strong>weekend observation gap</strong>. CDSS
            inspectors do most of their work Tuesday through Thursday.
            Saturday and Sunday inspections are rare. Many facilities go
            unobserved by state regulators for two days every week — a
            structural feature of how this regulatory system operates, not a
            scandal, but worth families understanding.
          </p>
        </AnalysisProse>

        <AnalysisH2 id="monthly">Citations by month, 2021–2025</AnalysisH2>
        <div className="mt-4 space-y-2 max-w-[520px]">
          {MONTHLY.map((m) => {
            const widthPct = Math.round((m.citations / maxMonthly) * 100);
            const isPeak = m.citations === maxMonthly;
            return (
              <div key={m.month} className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-mono)] text-[12px] text-ink-4 w-10 shrink-0 text-right">
                  {m.month}
                </span>
                <div className="flex-1 bg-paper-2 rounded-full overflow-hidden h-5">
                  <div
                    className={`h-full rounded-full flex items-center justify-end pr-2 ${isPeak ? "bg-rust" : "bg-rust/55"}`}
                    style={{ width: `${Math.max(widthPct, 6)}%` }}
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-white/90 whitespace-nowrap">
                      {m.citations}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-ink-4 mt-3 max-w-[60ch]">
          Total deficiency citations issued, by month, across all 484 CA
          publishable facilities, 2021–2025. 2025 partial year.
        </p>

        <AnalysisH2 id="dow">Deficiency rate by day of week</AnalysisH2>
        <div className="mt-4 space-y-2 max-w-[520px]">
          {DAY_OF_WEEK.map((d) => {
            const widthPct = Math.round((d.rate / maxDow) * 100);
            return (
              <div key={d.day} className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-mono)] text-[12px] text-ink-4 w-10 shrink-0 text-right">
                  {d.day}
                </span>
                <div className="flex-1 bg-paper-2 rounded-full overflow-hidden h-5">
                  <div
                    className="h-full rounded-full bg-teal/65 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(widthPct, 6)}%` }}
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-white/90 whitespace-nowrap">
                      {d.rate.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-ink-4 mt-3 max-w-[60ch]">
          Deficiencies per inspection. The Friday and weekend bars represent
          a much smaller number of inspections each — so this is &lsquo;what
          gets found when CDSS does come on a Friday,&rsquo; not &lsquo;when
          violations happen.&rsquo;
        </p>

        <AnalysisMethodNote>
          A common misread of day-of-week inspection data is to attribute
          quality patterns to staff behavior — &ldquo;facilities slack off on
          weekends.&rdquo; The cleaner reading here is regulatory: weekend
          inspections are rare, so the per-visit rate is computed from a
          small sample. The structural fact that weekends are unobserved
          stands on its own.
        </AnalysisMethodNote>

        <AnalysisH2 id="why-this-matters">
          Why this matters for tour timing
        </AnalysisH2>
        <AnalysisProse>
          <p>
            Two practical implications. First, when families consider an
            <em> unannounced</em> visit to evaluate a facility, weekends and
            Friday afternoons are the times the state itself is least likely
            to have been there recently. That is when staffing patterns,
            response times, and call-bell behavior are least scrutinized
            from the regulator side.
          </p>
          <p>
            Second, the fall peak suggests that if you are reading a
            facility&rsquo;s recent inspection history in the spring, you may
            be looking at a relatively quiet stretch. A facility&rsquo;s
            citation history during August–October is the more diagnostic
            window.
          </p>
          <p>
            For specific tour-question scripts, see{" "}
            <Link
              href="/library/37-questions-to-ask-on-a-memory-care-tour"
              className="text-teal underline underline-offset-4 hover:text-teal/80"
            >
              the 37-question tour checklist
            </Link>
            .
          </p>
        </AnalysisProse>
      </AnalysisShell>

      <SiteFooter />
    </>
  );
}
