import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { buildArticleSchema, buildBreadcrumbList, buildFaqSchemaFromPairs } from "@/lib/seo/schema";

const PAGE_PATH = "/washington/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE = "Memory care vs. nursing home in Washington — DSHS vs. CMS inspection records";
const TITLE = "Memory Care vs. Nursing Home in Washington State (DSHS vs. CMS) — 2026";
const DESC =
  "Washington memory care ALFs are regulated by DSHS; nursing homes (SNFs) are regulated by CMS and Washington DOH. Different oversight, different inspections, and different Medicaid funding — here is how to compare them.";
const DATE_PUBLISHED = "2026-05-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the difference between memory care and a nursing home in Washington?",
    a: "Memory care in Washington is provided in an Assisted Living Facility (ALF) holding a DSHS Specialized Dementia Care contract. These are residential settings offering personal care, dementia programming, and a secure environment. A nursing home (Skilled Nursing Facility, or SNF) is licensed under a separate framework (RCW 18.51) and regulated by CMS and Washington DOH — providing 24-hour skilled nursing care including IV therapy, wound care, and rehabilitation services.",
  },
  {
    q: "Who regulates memory care ALFs vs. nursing homes in Washington?",
    a: "Washington ALFs are regulated by DSHS Residential Care Services under RCW 18.20. Nursing homes are regulated by Washington Department of Health (DOH) under RCW 18.51 and by CMS at the federal level. Inspection records for memory care ALFs are on StarlynnCare (sourced from DSHS); nursing home inspection records are on CMS Care Compare at medicare.gov.",
  },
  {
    q: "How is Medicaid funding different between memory care and nursing homes in Washington?",
    a: "Medicaid-eligible residents in Washington ALFs may receive funding through the COPES waiver (Community Options Program Entry System) under Apple Health (Washington Medicaid). The COPES waiver funds services at contracted facilities, not room and board. Nursing home stays for Medicaid-eligible residents are funded through a separate nursing facility benefit under Apple Health. Eligibility criteria and benefit scope differ between the two programs.",
  },
  {
    q: "Does Medicare cover memory care in Washington ALFs?",
    a: "No. Medicare does not cover ongoing custodial care in an ALF, including memory care. Medicare Part A can cover a short-term SNF stay (up to 100 days) after a qualifying three-day inpatient hospital admission — only while skilled nursing or rehabilitation services are medically necessary. Families relying on Medicare for long-term memory care financing should plan for a transition to private pay or Medicaid once the SNF benefit period ends.",
  },
  {
    q: "When does someone need a nursing home instead of memory care in Washington?",
    a: "A nursing home becomes necessary when a resident needs ongoing skilled medical services — such as IV medications, wound care, tracheostomy management, or post-acute rehabilitation — that exceed what an ALF is licensed to provide. Clinical triggers often include post-hospitalisation recovery needs, medically complex behavioral conditions requiring nursing oversight, or significant functional decline combined with medical complexity. A geriatrician or hospital discharge planner can help assess the appropriate level of care.",
  },
];

export const metadata: Metadata = {
  title: `${TITLE} | StarlynnCare`,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: { title: `${TITLE} | StarlynnCare`, description: DESC, url: canonicalUrl, type: "article", images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }] },
  twitter: { card: "summary_large_image", title: `${TITLE} | StarlynnCare`, description: DESC },
};

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5">{children}</h2>;
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">{children}</div>;
}

function ComparisonTable() {
  const rows = [
    { attr: "Setting type", mc: "ALF + Specialized Dementia Care contract", snf: "Skilled Nursing Facility (nursing home)" },
    { attr: "State regulator", mc: "Washington DSHS — Residential Care Services", snf: "Washington DOH + CMS" },
    { attr: "Inspection records", mc: "StarlynnCare / DSHS portal", snf: "CMS Care Compare (medicare.gov)" },
    { attr: "Dementia credential", mc: "DSHS Specialized Dementia Care contract", snf: "Not applicable" },
    { attr: "Medicaid funding", mc: "COPES waiver (Apple Health)", snf: "Apple Health nursing facility benefit" },
    { attr: "Medicare coverage", mc: "Not covered (custodial care)", snf: "Part A: post-acute stays, up to 100 days" },
    { attr: "Skilled nursing on-site?", mc: "No — personal care + dementia programming", snf: "Yes — 24-hour skilled nursing required" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[540px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">Factor</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Memory care (ALF)</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Nursing home (SNF)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.attr} className="border-t border-paper-rule" style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}>
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">{row.attr}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.mc}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.snf}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WaSnfPage() {
  const jsonLd = [
    buildArticleSchema({ headline: ARTICLE_HEADLINE, description: DESC, url: canonicalUrl, datePublished: DATE_PUBLISHED }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Washington", url: canonicalFor("/washington") },
      { name: "Washington guides", url: canonicalFor("/washington/guides") },
      { name: "Memory care vs. nursing home", url: canonicalUrl },
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
            <nav className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/washington" className="hover:text-teal transition-colors">Washington</Link>
              <span aria-hidden>›</span>
              <Link href="/washington/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care vs. nursing home</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Washington decision guide · DSHS &amp; CMS
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">{ARTICLE_HEADLINE}</h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8"><AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" /></div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <aside className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6 text-[16px] leading-[1.7] text-ink-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">The short version</p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>Memory care in Washington = <strong className="font-medium text-ink">ALF + DSHS Specialized Dementia Care contract</strong>, inspected by DSHS.</li>
              <li>Nursing homes (SNFs) = <strong className="font-medium text-ink">CMS + Washington DOH</strong> oversight; inspection records on Care Compare.</li>
              <li><strong className="font-medium text-ink">Medicare does not cover</strong> residential memory care in an ALF. It may cover a short SNF stay.</li>
              <li>Medicaid options differ: <strong className="font-medium text-ink">COPES waiver</strong> for ALF, separate nursing facility benefit for SNF.</li>
            </ul>
          </aside>

          <H2 id="two-regulators">Two settings, two regulators</H2>
          <Prose>
            <p>Washington ALF memory care and nursing home care operate under separate regulatory systems. DSHS Residential Care Services regulates ALFs; CMS and Washington DOH regulate SNFs. Inspection records for memory care ALFs are indexed by StarlynnCare; nursing home records appear on CMS Care Compare.</p>
            <p>Families evaluating both options should pull records from both sources before touring. A campus that includes both an ALF memory care unit and a skilled nursing wing may have records in two separate systems.</p>
          </Prose>

          <ComparisonTable />

          <H2 id="when-to-choose">When to choose each setting</H2>
          <Prose>
            <p>Choose a Washington memory care ALF when the primary needs are dementia programming, personal care, and a secure residential environment — and daily skilled nursing is not medically required.</p>
            <p>Escalate to a SNF when a clinician documents need for: IV medications, wound care, tube feeding, post-acute rehabilitation, or nursing management of medically complex behavioral conditions.</p>
          </Prose>

          <H2 id="faq">Frequently asked questions</H2>
          <div className="space-y-8 mt-6">
            {FAQ_PAIRS.map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-[family-name:var(--font-display)] font-normal text-[18px] leading-[1.25] text-ink mb-2">{q}</h3>
                <p className="text-[16px] leading-[1.7] text-ink-2">{a}</p>
              </div>
            ))}
          </div>

          <DataFootnote source="Washington DSHS Residential Care Services (RCW 18.20; WAC 388-78A); Washington DOH SNF regulation (RCW 18.51); CMS Care Compare; Apple Health COPES waiver; Medicare Part A SNF benefit" refreshed="2026-05-09" />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">Continue reading</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/washington/memory-care-licensing" className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors">
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Washington</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Washington ALF &amp; Specialized Dementia Care licensing</p>
              </Link>
              <Link href="/library/37-questions-to-ask-on-a-memory-care-tour" className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors">
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">All states</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">37 questions to ask on a memory care tour</p>
              </Link>
            </div>
            <Link href="/washington/guides" className="mt-4 inline-block text-[14px] text-teal hover:underline">← All Washington guides</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
