import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/oregon/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Memory care vs. nursing home in Oregon — two regulators, two inspection records";
const TITLE = "Memory Care vs. Nursing Home in Oregon (Oregon DHS vs. CMS) — 2026";
const DESC =
  "Oregon ALF/RCF memory care is regulated by Oregon DHS; nursing homes (SNFs) are regulated by CMS and Oregon Health Authority. Different regulators, different inspection records, and different Medicaid funding streams — here is how to compare them.";
const DATE_PUBLISHED = "2026-05-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the difference between memory care and a nursing home in Oregon?",
    a: "Memory care in Oregon is typically provided in an Assisted Living Facility (ALF) or Residential Care Facility (RCF) holding a DHS Memory Care Endorsement. These are residential settings where residents receive personal care, medication management, and dementia-specific programming. A Skilled Nursing Facility (SNF), often called a nursing home, is regulated by CMS and Oregon Health Authority and provides clinical nursing and medical services 24 hours a day — including IV therapy, wound care, and ventilator support. SNFs are appropriate when a resident requires ongoing medical intervention that an ALF or RCF cannot safely provide.",
  },
  {
    q: "Who regulates memory care ALFs/RCFs in Oregon vs. nursing homes?",
    a: "Oregon ALFs and RCFs are regulated by Oregon DHS Long-Term Care Licensing under ORS Chapter 443. Nursing homes (SNFs) are regulated jointly by CMS (Centers for Medicare & Medicaid Services) at the federal level and Oregon Health Authority (OHA) at the state level. These are entirely separate inspection systems — StarlynnCare shows DHS records for Oregon memory care facilities; CMS Care Compare shows nursing home inspection data separately.",
  },
  {
    q: "How does Medicaid funding differ between memory care and nursing homes in Oregon?",
    a: "Oregon Medicaid (Oregon Health Plan) funds residential care services in contracted ALFs and RCFs through the K Plan (Oregon Home and Community-Based Services waiver) for eligible residents. Nursing home stays can be funded by Medicaid through a different nursing facility benefit track. Medicaid eligibility and benefit scope differ between settings. The K Plan requires the facility to hold an active Oregon DHS Medicaid contract and for the resident to have an assessed level of need that meets program criteria.",
  },
  {
    q: "When does someone need a nursing home rather than memory care?",
    a: "A nursing home becomes necessary when a resident needs daily skilled nursing care — such as IV medications, tube feeding, wound debridement, respiratory therapy, or skilled physical/occupational/speech therapy following a hospitalisation. ALFs and RCFs are not licensed to provide these services. Clinical triggers typically include post-acute recovery needs, medically complex behavioral health conditions requiring 24-hour nursing oversight, or a combination of mobility and medical needs that exceed what residential memory care can safely manage. A geriatrician or hospital discharge planner can help assess the appropriate level of care.",
  },
  {
    q: "Does Oregon have special protections for memory care residents in ALFs?",
    a: "Yes. Oregon's Memory Care Endorsement (OAR 411-057) establishes baseline standards for endorsed facilities that go beyond a standard ALF or RCF license — including secured environments, specialized staff training in dementia, structured programming, and individualized care planning with family involvement. Oregon also has a Long-Term Care Ombudsman program that advocates for residents in both residential care settings and nursing homes.",
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
      className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5"
    >
      {children}
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">{children}</div>
  );
}

function ComparisonTable() {
  const rows = [
    { attr: "Setting type", mc: "ALF or RCF with Memory Care Endorsement", snf: "Skilled Nursing Facility (nursing home)" },
    { attr: "State regulator", mc: "Oregon DHS — LTC Licensing", snf: "Oregon Health Authority (OHA) + CMS" },
    { attr: "Inspection records", mc: "StarlynnCare / DHS portal", snf: "CMS Care Compare (medicare.gov)" },
    { attr: "Memory care endorsement", mc: "Optional — DHS-issued per OAR 411-057", snf: "Not applicable" },
    { attr: "Medicaid funding", mc: "Oregon K Plan waiver (contracted beds)", snf: "Oregon Medicaid nursing facility benefit" },
    { attr: "Medicare coverage", mc: "Typically not covered (custodial care)", snf: "Part A for post-acute stays; 100 days limit" },
    { attr: "24-hr skilled nursing required?", mc: "No — personal care + dementia programming", snf: "Yes — skilled nursing on-site 24 hrs/day" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[540px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">Factor</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Memory care (ALF/RCF)</th>
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

export default function OrSnfPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Oregon", url: canonicalFor("/oregon") },
      { name: "Oregon guides", url: canonicalFor("/oregon/guides") },
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
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/oregon" className="hover:text-teal transition-colors">Oregon</Link>
              <span aria-hidden>›</span>
              <Link href="/oregon/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care vs. nursing home</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Oregon decision guide · Oregon DHS &amp; CMS
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <aside className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6 text-[16px] leading-[1.7] text-ink-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">
              The short version
            </p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>
                Memory care in Oregon is residential — licensed as an <strong className="font-medium text-ink">ALF or RCF with a DHS Memory Care Endorsement</strong>,
                regulated by Oregon DHS, funded by the Oregon K Plan Medicaid waiver for eligible residents.
              </li>
              <li>
                Nursing homes (SNFs) are regulated by <strong className="font-medium text-ink">CMS and Oregon Health Authority</strong>; they provide 24-hour skilled
                nursing. Inspection records are on CMS Care Compare, not StarlynnCare.
              </li>
              <li>
                <strong className="font-medium text-ink">Medicare covers SNF stays</strong> after a qualifying hospital admission (up to 100 days). Medicare does not
                cover residential memory care in an ALF or RCF.
              </li>
              <li>
                Choose a nursing home when a clinician documents need for daily skilled nursing. Choose residential
                memory care when <strong className="font-medium text-ink">personal care, dementia programming, and a home-like environment</strong> are the primary needs.
              </li>
            </ul>
          </aside>

          <H2 id="two-regulators">Two settings, two regulators</H2>
          <Prose>
            <p>
              In Oregon, residential memory care and skilled nursing are governed by entirely separate regulatory
              systems. An ALF or RCF with a DHS Memory Care Endorsement is inspected by Oregon DHS Long-Term
              Care Licensing — these are the records StarlynnCare indexes. A Skilled Nursing Facility (SNF) is
              federally certified and inspected jointly by CMS and Oregon Health Authority; those records appear
              on CMS Care Compare at medicare.gov.
            </p>
            <p>
              Families comparing options should pull inspection histories from both systems before touring. A
              facility can look good on one record and have significant findings on the other if it operates
              multiple licensed settings on the same campus.
            </p>
          </Prose>

          <ComparisonTable />

          <H2 id="funding">Funding differences</H2>
          <Prose>
            <p>
              The most consequential practical difference for most families is who pays and for how long. Residential
              memory care in an Oregon ALF or RCF is almost always privately paid unless the resident qualifies for
              the Oregon K Plan waiver through Oregon Medicaid. The K Plan funds personal care and supportive services
              (not room and board) at contracted facilities — eligibility requires documented functional need and income
              and asset limits.
            </p>
            <p>
              Skilled nursing facilities can be paid by Medicare Part A for up to 100 days following a qualifying
              three-day inpatient hospital stay, but only while skilled nursing or rehab services are medically
              necessary. Long-stay nursing home care can be funded by Oregon Medicaid through a separate nursing
              facility benefit.
            </p>
          </Prose>

          <H2 id="when-to-choose">When to choose each setting</H2>
          <Prose>
            <p>
              Choose residential memory care (ALF/RCF with endorsement) when the primary needs are:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Dementia-specific programming, structured daily activities, and a secured environment</li>
              <li>Assistance with bathing, dressing, eating, and mobility — but not clinical nursing</li>
              <li>A home-like atmosphere with fewer medical personnel and more lifestyle focus</li>
            </ul>
            <p className="mt-4">
              Escalate to a skilled nursing facility when a clinician determines the resident needs:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>IV medications, wound care, tube feeding, or respiratory therapy</li>
              <li>Post-acute rehabilitation following a hospitalisation</li>
              <li>Behaviorally complex dementia presentations requiring psychiatric nursing oversight</li>
              <li>Non-ambulatory care needs that exceed an ALF or RCF&apos;s licensed capability</li>
            </ul>
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

          <DataFootnote
            source="Oregon DHS LTC Licensing (ORS ch. 443; OAR 411-054, 411-057); Oregon Health Plan K Plan waiver; CMS Care Compare; Medicare Part A SNF benefit"
            refreshed="2026-05-09"
          />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/oregon/memory-care-licensing"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Oregon</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Oregon ALF, RCF & Memory Care Endorsement explained</p>
              </Link>
              <Link
                href="/library/37-questions-to-ask-on-a-memory-care-tour"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">All states</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">37 questions to ask on a memory care tour</p>
              </Link>
            </div>
            <Link href="/oregon/guides" className="mt-4 inline-block text-[14px] text-teal hover:underline">
              ← All Oregon guides
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
