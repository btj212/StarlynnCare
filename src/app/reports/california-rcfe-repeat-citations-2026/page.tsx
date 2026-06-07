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
  REPEAT_OFFENDERS,
  CHAIN_SCORECARD,
  YEARLY_RATES,
  REPORT_SUMMARY,
  METHODOLOGY_DISCLOSURE,
} from "@/lib/content/reports/california-rcfe-repeat-citations-2026";
import { ReportWatchCapture } from "./_WatchCapture";

// ─── Metadata ─────────────────────────────────────────────────────────────────

const PAGE_PATH = "/reports/california-rcfe-repeat-citations-2026";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE =
  "1 in 8 California Senior Care Facilities Has Repeat Regulatory Citations for the Same Violation";
const META_TITLE =
  "California Senior Care: 1-in-8 Has Repeat Citations | StarlynnCare";
const DESC =
  "Analysis of 484 CA RCFEs: 63 facilities (13%) cited for the same violation in 3+ separate inspections. Includes chain operator scorecard and yearly rates.";
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
    { name: "Reports", url: canonicalFor("/reports") },
    { name: "CA RCFE Repeat Citations 2026", url: canonicalUrl },
  ]),
  buildDatasetSchema({
    pageUrl: canonicalUrl,
    methodologyUrl: canonicalFor("/methodology"),
  }),
];

// ─── Inline layout helpers ────────────────────────────────────────────────────

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,30px)] leading-[1.1] tracking-[-0.01em] text-ink mt-14 mb-5"
    >
      {children}
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[70ch] space-y-4">
      {children}
    </div>
  );
}

function MethodNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13.5px] leading-[1.6] text-ink-3 italic border-l-2 border-paper-rule pl-4 my-5 max-w-[66ch]">
      {children}
    </p>
  );
}

function SeverityBadge({ level }: { level: number }) {
  const cls =
    level === 4
      ? "bg-grade-f/10 text-grade-f border-grade-f/30"
      : level === 3
        ? "bg-rust-soft text-rust border-rust/30"
        : level === 2
          ? "bg-gold-soft text-gold border-gold/30"
          : "bg-teal-soft text-teal border-teal/30";
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-[0.08em] border ${cls}`}
    >
      Sev {level}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CARCFERepeatCitationsPage() {
  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav countStateCode="CA" ctaHref="/california/facilities" ctaLabel="California memory care facilities" />

      {/* ── Report Header ─────────────────────────────────────────────────── */}
      <div
        className="border-b border-teal/20"
        style={{ background: "var(--color-teal-deep)", color: "var(--color-paper)" }}
      >
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-10 py-16 md:py-20">
          <nav
            className="flex items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] opacity-60"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="hover:opacity-100 transition-opacity">Home</Link>
            <span aria-hidden>›</span>
            <span>Reports</span>
            <span aria-hidden>›</span>
            <span>CA RCFE Repeat Citations</span>
          </nav>

          <div className="mb-3 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] opacity-70">
            Data Report · May 2026
          </div>

          <h1
            className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,52px)] leading-[1.06] tracking-[-0.02em] mb-5 max-w-[900px]"
            style={{ color: "var(--color-paper)" }}
          >
            One in 8 California Senior Care Facilities Has Repeat Regulatory Citations for the Same Violation
          </h1>

          <p
            className="text-[18px] leading-[1.6] max-w-[62ch] mb-8 opacity-85"
            style={{ color: "var(--color-paper)" }}
          >
            An analysis of CDSS inspection records for 484 California residential care facilities
            for the elderly finds a persistent pattern: the same regulatory rules broken, at
            the same facilities, across multiple separate inspections.
          </p>

          <p className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.04em] opacity-55">
            Analysis by StarlynnCare Research · Reviewed by Rebecca Lynn Starkey, BSN, RN, PHN · Last updated May 11, 2026
          </p>
        </div>
      </div>

      {/* ── Key Findings Strip ────────────────────────────────────────────── */}
      <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-10 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div>
              <p
                className="font-[family-name:var(--font-mono)] text-[clamp(28px,3.5vw,40px)] font-semibold text-ink leading-none mb-1"
                aria-label={`${REPORT_SUMMARY.totalFacilities} RCFEs analyzed`}
              >
                {REPORT_SUMMARY.totalFacilities.toLocaleString()}
              </p>
              <p className="text-[13px] text-ink-3 leading-[1.4]">California RCFEs in dataset</p>
              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4 mt-1">
                CDSS records · May 2026
              </p>
            </div>
            <div>
              <p
                className="font-[family-name:var(--font-mono)] text-[clamp(28px,3.5vw,40px)] font-semibold text-rust leading-none mb-1"
                aria-label="1 in 8 facilities have repeat citations"
              >
                1 in {REPORT_SUMMARY.oneInN}
              </p>
              <p className="text-[13px] text-ink-3 leading-[1.4]">facilities with a pattern of repeat citations</p>
              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4 mt-1">
                {REPORT_SUMMARY.repeatOffenderFacilities} of {REPORT_SUMMARY.totalFacilities} · same rule, 3+ inspection visits
              </p>
            </div>
            <div>
              <p
                className="font-[family-name:var(--font-mono)] text-[clamp(28px,3.5vw,40px)] font-semibold text-gold leading-none mb-1"
                aria-label="+132% citation rate rise from 2021 to 2024"
              >
                +{REPORT_SUMMARY.rateRisePct}%
              </p>
              <p className="text-[13px] text-ink-3 leading-[1.4]">citation rate rise, 2021–2024</p>
              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4 mt-1">
                Post-COVID ramp-up · see note in body
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-10 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 lg:gap-16 items-start">

            {/* ── Left column ───────────────────────────────────────────── */}
            <div>

              {/* Section 1: What we found */}
              <H2 id="what-we-found">What we found</H2>
              <Prose>
                <p>
                  Among the 484 California residential care facilities for the elderly (RCFEs) tracked
                  in StarlynnCare&rsquo;s database, <strong>63 — one in every eight</strong> — have been cited
                  by state inspectors for the exact same California Code of Regulations Title 22 violation
                  in three or more separate inspection visits. The data covers CDSS inspection records from
                  {" "}{REPORT_SUMMARY.dataWindowStart} through {REPORT_SUMMARY.dataWindowEnd}.
                </p>
                <p>
                  The most-repeated violation is{" "}
                  <strong>§87303(a) — &ldquo;general facility maintenance.&rdquo;</strong>{" "}
                  This regulation requires that a facility be &ldquo;clean, safe, sanitary and in good repair
                  at all times&rdquo; — covering physical plant condition, equipment maintenance, and
                  overall cleanliness. It appeared in repeat-citation patterns at more than a dozen
                  facilities in the dataset.
                </p>
                <p>
                  Other frequently-repeated violations involve{" "}
                  <strong>staffing levels and competency</strong> (§87411(a)),{" "}
                  <strong>safe storage of hazardous items</strong> (§87309(a)), and{" "}
                  <strong>incidental medical and dental care requirements</strong> (§87465 series).
                  Together, these patterns suggest that for some facilities, certain compliance
                  failures are structural rather than isolated.
                </p>
              </Prose>

              <MethodNote>
                A &ldquo;repeat citation&rdquo; in this analysis means the same CCR Title 22 regulation code was
                cited by a CDSS licensing agent during 3 or more separate, distinct inspection visits
                at the same facility. It does not indicate whether violations were corrected between
                visits. These are historical regulatory records, not current facility conditions.
              </MethodNote>

              <Prose>
                <p>The five facility–regulation pairs with the most distinct inspection visits citing the same rule:</p>
              </Prose>

              <ul className="mt-4 space-y-3 text-[15px] leading-[1.6] text-ink-2 max-w-[68ch]">
                {REPEAT_OFFENDERS.slice(0, 5).map((row, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-rust font-semibold shrink-0 w-8 text-right">
                      {row.timesDistinctVisits}×
                    </span>
                    <span>
                      <Link
                        href={`/california/${row.citySlug}/${row.facilitySlug}`}
                        className="text-teal underline underline-offset-4 hover:text-teal/80"
                      >
                        {row.facilityName}
                      </Link>
                      {" "}({row.city}) — §{row.regulationCode}: {row.regulationPlain.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Repeat offenders table */}
              <H2 id="repeat-offenders">Repeat-citation facilities — top 20</H2>
              <p className="text-[13.5px] text-ink-3 mb-5 max-w-[70ch]">
                Facility + regulation pairs cited in 3 or more distinct inspection visits. Sorted
                by visit count, then maximum severity. Click a facility name to view its full
                inspection history.
              </p>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-[13.5px] text-left border-collapse min-w-[620px]">
                  <thead>
                    <tr className="border-b-2 border-paper-rule">
                      {["Facility", "City", "Regulation", "Visits", "Last cited"].map((h) => (
                        <th
                          key={h}
                          className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-ink-4 py-3 pr-4 font-normal"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {REPEAT_OFFENDERS.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-paper-rule hover:bg-paper-2 transition-colors"
                      >
                        <td className="py-3 pr-4 leading-[1.35]">
                          <Link
                            href={`/california/${row.citySlug}/${row.facilitySlug}`}
                            className="text-teal hover:underline font-medium"
                          >
                            {row.facilityName}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-ink-3 whitespace-nowrap">{row.city}</td>
                        <td className="py-3 pr-4">
                          <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-2">
                            §{row.regulationCode}
                          </span>
                          <span className="block text-[11.5px] text-ink-4 leading-[1.3] mt-0.5">
                            {row.regulationPlain}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-[family-name:var(--font-mono)] text-rust font-semibold">
                            {row.timesDistinctVisits}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3 flex items-center gap-2 flex-wrap">
                            {row.mostRecentDate}
                            <SeverityBadge level={row.maxSeverity} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[12px] text-ink-4 mt-3 max-w-[66ch]">
                Source: CDSS inspection records in StarlynnCare database (queried 2026-05-11).
                &ldquo;Visits&rdquo; = distinct inspection visits in which this regulation was cited.
                Severity: 1 = minor, 2 = moderate, 3 = serious, 4 = immediate jeopardy.
              </p>

              {/* Section 2: The trend */}
              <H2 id="the-trend">Citation rates over time, 2021–2025</H2>
              <Prose>
                <p>
                  The deficiency rate across CA RCFEs in this dataset rose{" "}
                  <strong>{REPORT_SUMMARY.rateRisePct}%</strong> between 2021 and 2024 — from{" "}
                  {REPORT_SUMMARY.rate2021} citations per inspection in 2021 to{" "}
                  {REPORT_SUMMARY.rate2024} in 2024. That rise should be read carefully:{" "}
                  <strong>2020 and 2021 saw severely reduced inspection activity</strong> across
                  California due to COVID-era restrictions, suppressing the baseline. The
                  post-COVID period represents a resumption of normal inspection frequency, not
                  necessarily a sudden worsening of conditions.
                </p>
                <p>
                  That said, the upward trend through 2024 — even accounting for the COVID-ramp
                  dynamic — raises the question of whether reduced inspection cadence during
                  2020–2021 may have allowed conditions to deteriorate before regulators returned.
                  The 2025 figure (0.58 through May) suggests possible moderation, but the year
                  is incomplete.
                </p>
              </Prose>

              <div className="mt-8 space-y-3 max-w-[520px]">
                {YEARLY_RATES.map((row) => {
                  const maxRate = 0.9;
                  const widthPct = Math.round((row.deficiencyRate / maxRate) * 100);
                  return (
                    <div key={row.year} className="flex items-center gap-3">
                      <span className="font-[family-name:var(--font-mono)] text-[12px] text-ink-4 w-12 shrink-0 text-right">
                        {row.year}
                      </span>
                      <div className="flex-1 bg-paper-2 rounded-full overflow-hidden h-5">
                        <div
                          className="h-full rounded-full bg-rust/70 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(widthPct, 6)}%` }}
                        >
                          <span className="font-[family-name:var(--font-mono)] text-[10px] text-white/90 whitespace-nowrap">
                            {row.deficiencyRate.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {row.note && (
                        <span className="text-[11px] text-ink-4 max-w-[140px] leading-[1.3] shrink-0">
                          {row.note}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[12px] text-ink-4 mt-3 max-w-[60ch]">
                Deficiencies per inspection, by year. 2020 omitted (1 inspection — COVID shutdown).
                2025 = January – May only. Source: CDSS records in StarlynnCare database.
              </p>

              {/* Section 3: Chain scorecard (additional finding) */}
              <h3
                id="chain-scorecard"
                className="font-[family-name:var(--font-display)] font-normal text-[20px] text-ink mt-12 mb-1"
              >
                <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-ink-4 block mb-2">
                  Additional Finding
                </span>
                Chain operator scorecard
              </h3>
              <Prose>
                <p>
                  Among operators with three or more facilities and at least 50 licensed beds in
                  our dataset, citation rates vary significantly — though the small number of
                  qualifying chains limits broad conclusions.
                </p>
                <p>
                  Three operator groups meet this threshold. Their{" "}
                  <strong>Weighted Citation Scores (WCS)</strong> are computed from CDSS inspection
                  records for the last three years (May 2023 – May 2026). The WCS for a chain is the
                  average of each facility&rsquo;s per-bed, severity-weighted deficiency sum.
                  Severity weights: 1 (minor) = 1, 2 (moderate) = 2, 3 (serious) = 3,
                  4 (immediate jeopardy) = 5. Lower score = fewer and less severe citations per
                  licensed bed.
                </p>
              </Prose>

              <MethodNote>
                Operator names reflect CDSS licensing records and may not capture all corporate
                affiliations. Oakmont Senior Living operates under multiple legal entities in CDSS
                records; those entities have been combined into a single row. Only operators with
                ≥3 CA facilities and ≥50 total licensed beds in our dataset are included.
              </MethodNote>

              <div className="mt-6 overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-[13.5px] text-left border-collapse min-w-[580px]">
                  <thead>
                    <tr className="border-b-2 border-paper-rule">
                      {[
                        { label: "Operator", align: "left" },
                        { label: "Facilities", align: "right" },
                        { label: "Total Beds", align: "right" },
                        { label: "Inspections", align: "right" },
                        { label: "Deficiencies", align: "right" },
                        { label: "WCS", align: "right" },
                      ].map(({ label, align }) => (
                        <th
                          key={label}
                          className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-ink-4 py-3 pr-4 font-normal ${align === "right" ? "text-right" : ""}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CHAIN_SCORECARD.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-paper-rule hover:bg-paper-2 transition-colors"
                      >
                        <td className="py-3 pr-4 leading-[1.35]">
                          <span className="text-ink font-medium">{row.displayName}</span>
                          {row.combinedEntitiesNote && (
                            <span className="block text-[11px] text-ink-4 mt-0.5 leading-[1.3] max-w-[44ch]">
                              †
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right font-[family-name:var(--font-mono)] text-ink-3">
                          {row.caFacilitiesInDataset}
                        </td>
                        <td className="py-3 pr-4 text-right font-[family-name:var(--font-mono)] text-ink-3">
                          {row.totalBeds.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right font-[family-name:var(--font-mono)] text-ink-3">
                          {row.totalInspections}
                        </td>
                        <td className="py-3 pr-4 text-right font-[family-name:var(--font-mono)] text-ink-3">
                          {row.totalDeficiencies}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`font-[family-name:var(--font-mono)] font-semibold ${
                              row.weightedCitationScore > 0.1
                                ? "text-rust"
                                : row.weightedCitationScore > 0.05
                                  ? "text-gold"
                                  : "text-teal"
                            }`}
                          >
                            {row.weightedCitationScore.toFixed(3)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[12px] text-ink-4 mt-3 max-w-[68ch]">
                WCS = Weighted Citation Score (lower = fewer/less-severe citations per licensed
                bed). Last 3 years. † Oakmont Senior Living operates under multiple legal entities
                in CDSS records; rows combined for readability.
                Source: CDSS records in StarlynnCare database (queried 2026-05-13).
              </p>

              {/* Watch-list capture */}
              <div
                className="mt-16 rounded-xl border border-paper-rule p-8"
                style={{ background: "var(--color-paper-2)" }}
              >
                <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-teal mb-3">
                  Full report coming
                </p>
                <h3 className="font-[family-name:var(--font-display)] font-normal text-[20px] text-ink mb-2">
                  Get notified when we publish the full California Memory Care Report
                </h3>
                <p className="text-[14px] text-ink-3 mb-5 max-w-[52ch]">
                  The full report covers all 484 facility profiles, county-level maps, chain
                  scorecards, and family guidance. One email when it publishes — no spam.
                </p>
                <ReportWatchCapture />
              </div>

            </div>

            {/* ── Right column: sidebar ──────────────────────────────────── */}
            <aside className="space-y-8 lg:sticky lg:top-8">

              {/* About this data */}
              <div
                className="rounded-xl border border-paper-rule p-6 text-[13px] leading-[1.65] text-ink-2 space-y-3"
                style={{ background: "var(--color-paper-2)" }}
              >
                <h2 className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
                  About this data
                </h2>
                {METHODOLOGY_DISCLOSURE.split("\n\n").map((para, i) => (
                  <p key={i} className="text-[12.5px]">{para}</p>
                ))}
                <p>
                  <a
                    href="https://www.ccld.dss.ca.gov/carefacilitysearch/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal underline underline-offset-4 hover:text-teal/80 text-[12.5px]"
                  >
                    Verify current status on CDSS CCLD →
                  </a>
                </p>
              </div>

              {/* Quick stats */}
              <div
                className="rounded-xl border border-paper-rule p-6"
                style={{ background: "var(--color-paper-2)" }}
              >
                <h2 className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-ink-4 mb-4">
                  Dataset summary
                </h2>
                <dl className="space-y-2.5 text-[13px]">
                  {(
                    [
                      ["RCFEs analyzed", REPORT_SUMMARY.totalFacilities.toLocaleString()],
                      ["Inspections", REPORT_SUMMARY.totalInspections.toLocaleString()],
                      ["Deficiency records", REPORT_SUMMARY.totalDeficiencies.toLocaleString()],
                      [
                        "With repeat citations",
                        `${REPORT_SUMMARY.repeatOffenderFacilities} (${REPORT_SUMMARY.repeatOffenderPct}%)`,
                      ],
                      [
                        "Data window",
                        `${REPORT_SUMMARY.dataWindowStart} – ${REPORT_SUMMARY.dataWindowEnd}`,
                      ],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-ink-3">{label}</dt>
                      <dd className="font-[family-name:var(--font-mono)] text-ink font-medium text-right">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Browse CTA */}
              <div
                className="rounded-xl border border-teal/20 p-6"
                style={{ background: "var(--color-teal-soft)" }}
              >
                <p className="text-[13px] font-medium mb-3" style={{ color: "var(--color-teal-deep)" }}>
                  Looking for a specific facility?
                </p>
                <Link
                  href="/california/facilities"
                  className="inline-block w-full text-center px-4 py-2.5 rounded text-white text-[13px] font-medium transition-colors"
                  style={{ background: "var(--color-teal)" }}
                >
                  Browse all 484 CA facilities →
                </Link>
              </div>

            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
