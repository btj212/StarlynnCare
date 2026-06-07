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

const PAGE_PATH = "/minnesota/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE = "Memory care vs. nursing home in Minnesota — MDH vs. CMS inspection records";
const TITLE = "Memory Care vs. Nursing Home in Minnesota (MDH vs. CMS) — 2026";
const DESC =
  "Minnesota ALF memory care is regulated by MDH; nursing homes (SNFs) are regulated by CMS and MDH under a separate framework. Different oversight, different inspection records, and different Medicaid funding — here is how to compare them.";
const DATE_PUBLISHED = "2026-05-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the difference between memory care and a nursing home in Minnesota?",
    a: "Memory care in Minnesota is provided in an Assisted Living Facility with Dementia Care (ALF-DC) licensed under Chapter 144G by MDH. These are residential settings offering personal care, dementia-specific programming, and a secured environment. A nursing home (Skilled Nursing Facility, or SNF) is regulated under Minnesota Statutes Chapter 144A and federally by CMS — providing 24-hour skilled nursing care including IV therapy, wound management, and rehabilitation services.",
  },
  {
    q: "Who regulates memory care ALFs vs. nursing homes in Minnesota?",
    a: "Minnesota ALFs and ALF-DCs are regulated by Minnesota Department of Health (MDH) under Chapter 144G. SNFs are regulated by MDH under Chapter 144A and by CMS at the federal level. The licensing, inspection, and enforcement systems are separate. Inspection records for memory care ALFs are indexed by StarlynnCare (sourced from MDH licensing surveys); nursing home inspection records are on CMS Care Compare at medicare.gov.",
  },
  {
    q: "How does Medicaid funding differ between memory care and nursing homes in Minnesota?",
    a: "Minnesota Medicaid (Medical Assistance) can fund assisted living services at ALF-DC facilities through the CADI (Community Access for Disability Inclusion) waiver or the Elderly Waiver for eligible residents. These waivers fund services, not room and board. Nursing home stays for eligible residents are funded through the Medical Assistance nursing facility benefit, which covers room and board plus care. Eligibility, benefit scope, and facility participation differ between the two programs.",
  },
  {
    q: "Does Medicare cover memory care in Minnesota ALFs?",
    a: "No. Medicare does not cover custodial care in an assisted living facility, including ALF-DC memory care. Medicare Part A may cover a short-term SNF stay (up to 100 days) following a qualifying three-day inpatient hospital admission — only while skilled nursing or rehabilitation services are medically necessary. Long-term residential memory care is not a Medicare benefit.",
  },
  {
    q: "When does someone need a nursing home instead of memory care in Minnesota?",
    a: "A nursing home becomes appropriate when a clinician determines the resident requires ongoing skilled medical services — IV medications, wound care, tube feeding, ventilator management, or daily physical/occupational/speech therapy — that exceed what an ALF-DC is licensed to provide. Post-acute hospital discharge often triggers a short-term SNF stay; residents who stabilize may transition back to residential memory care. A geriatrician or hospital discharge planner can help evaluate the appropriate level of care.",
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
    { attr: "Setting type", mc: "ALF with Dementia Care (ALF-DC)", snf: "Skilled Nursing Facility (nursing home)" },
    { attr: "Primary regulator", mc: "Minnesota MDH (Chapter 144G)", snf: "Minnesota MDH (Ch. 144A) + CMS" },
    { attr: "Inspection records", mc: "StarlynnCare / MDH licensing portal", snf: "CMS Care Compare (medicare.gov)" },
    { attr: "Dementia designation", mc: "ALF-DC designation (Chapter 144G)", snf: "Not applicable" },
    { attr: "Medicaid funding", mc: "CADI or Elderly Waiver (Medical Assistance)", snf: "Medical Assistance nursing facility benefit" },
    { attr: "Medicare coverage", mc: "Not covered (custodial care)", snf: "Part A: post-acute stays, up to 100 days" },
    { attr: "Skilled nursing on-site?", mc: "No — personal care + dementia programming", snf: "Yes — 24-hour skilled nursing required" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[540px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">Factor</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Memory care (ALF-DC)</th>
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

export default function MnSnfPage() {
  const jsonLd = [
    buildArticleSchema({ headline: ARTICLE_HEADLINE, description: DESC, url: canonicalUrl, datePublished: DATE_PUBLISHED }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Minnesota", url: canonicalFor("/minnesota") },
      { name: "Minnesota guides", url: canonicalFor("/minnesota/guides") },
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
              <Link href="/minnesota" className="hover:text-teal transition-colors">Minnesota</Link>
              <span aria-hidden>›</span>
              <Link href="/minnesota/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care vs. nursing home</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Minnesota decision guide · MDH &amp; CMS
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
              <li>Memory care = <strong className="font-medium text-ink">ALF with Dementia Care (Chapter 144G)</strong>, inspected by MDH, indexed on StarlynnCare.</li>
              <li>Nursing homes = <strong className="font-medium text-ink">CMS + MDH (Chapter 144A)</strong>; records on CMS Care Compare.</li>
              <li><strong className="font-medium text-ink">Medicare does not cover</strong> residential memory care in an ALF-DC. It may cover a short SNF stay post-hospitalisation.</li>
              <li>Medicaid options differ: <strong className="font-medium text-ink">CADI / Elderly Waiver</strong> for ALF-DC; separate nursing facility benefit for SNF.</li>
            </ul>
          </aside>

          <H2 id="two-regulators">Two settings, two inspection systems</H2>
          <Prose>
            <p>Minnesota memory care (ALF-DC) and nursing home care are governed by separate regulatory frameworks within MDH — Chapter 144G for ALFs and Chapter 144A for nursing homes — plus federal CMS oversight for SNFs. Inspection records are in different systems: StarlynnCare for ALF-DC records, CMS Care Compare for nursing home records.</p>
          </Prose>

          <ComparisonTable />

          <H2 id="when-to-choose">When to choose each setting</H2>
          <Prose>
            <p>Choose ALF-DC memory care when the primary needs are dementia programming, personal care, and a secure residential environment — and daily skilled nursing is not medically required.</p>
            <p>Choose a nursing home (SNF) when a clinician determines the resident needs: IV medications, wound care, tube feeding, respiratory therapy, or skilled rehabilitation services that an ALF is not licensed to provide.</p>
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

          <DataFootnote source="Minnesota Statutes Chapters 144A (SNF) and 144G (ALF, ALF-DC); Minnesota MDH licensing surveys; CMS Care Compare; Minnesota Medical Assistance CADI and Elderly Waiver programs; Medicare Part A SNF benefit" refreshed="2026-05-09" />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">Continue reading</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/minnesota/memory-care-licensing" className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors">
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Minnesota</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Minnesota ALF with Dementia Care licensing (Chapter 144G)</p>
              </Link>
              <Link href="/library/37-questions-to-ask-on-a-memory-care-tour" className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors">
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">All states</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">37 questions to ask on a memory care tour</p>
              </Link>
            </div>
            <Link href="/minnesota/guides" className="mt-4 inline-block text-[14px] text-teal hover:underline">← All Minnesota guides</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
