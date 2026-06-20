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

const PAGE_PATH = "/minnesota/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE = "Minnesota memory care licensing — Assisted Living Facility with Dementia Care (144G)";
const TITLE = "Minnesota Memory Care Licensing: ALF with Dementia Care";
const DESC =
  "Minnesota licenses memory care under Chapter 144G as Assisted Living Facility with Dementia Care, regulated by MDH. Learn what this license requires, how MDH inspects, and how to read a Minnesota facility profile on StarlynnCare.";
const DATE_PUBLISHED = "2026-05-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What type of license does a memory care facility hold in Minnesota?",
    a: "Minnesota memory care facilities are licensed as Assisted Living Facility with Dementia Care (ALF-DC) under Minnesota Statutes Chapter 144G, regulated by Minnesota Department of Health (MDH). Chapter 144G, enacted in 2019 and effective 2021, created a new licensing framework that replaced the former home care licensure for many residential settings and added explicit dementia-specific standards.",
  },
  {
    q: "What makes an ALF with Dementia Care different from a standard ALF in Minnesota?",
    a: "A standard ALF (Assisted Living Facility under 144G) provides housing with assisted living services. An ALF with Dementia Care designation requires additional staffing standards, dementia-specific staff training (including training in behavior management and communication), a secured or monitored environment designed to prevent unsafe exits, a written individualized dementia care plan for each resident, and a structured programming model addressing cognitive and behavioral needs. MDH separately surveys facilities for compliance with both the base ALF standards and the dementia care overlay.",
  },
  {
    q: "How does Minnesota MDH inspect memory care facilities?",
    a: "MDH conducts licensing surveys of Minnesota ALFs and ALFs with Dementia Care — typically annually — and investigates complaints. MDH may issue correction orders, assess civil monetary penalties, or take adverse licensing action based on findings. Minnesota does not use California's Type A / Type B deficiency labels. StarlynnCare shows MDH inspection findings on each Minnesota facility profile with dates and plain-language summaries.",
  },
  {
    q: "Does Minnesota have Medicaid funding for memory care in ALFs?",
    a: "Yes. Minnesota Medicaid (Medical Assistance) can fund assisted living services for eligible residents through the CADI (Community Access for Disability Inclusion) or Elderly Waiver programs at contracted facilities. These waivers fund services, not room and board. Not all Minnesota ALFs hold a waiver contract — ask about availability during your tour. Eligibility requires a level-of-care assessment and income/asset criteria.",
  },
  {
    q: "When did Chapter 144G take effect and why does it matter?",
    a: "Minnesota Chapter 144G was enacted in 2019 and took full effect August 1, 2021. It replaced a patchwork of home care and housing-with-services licensing with a unified framework for assisted living facilities, including an explicit ALF with Dementia Care designation. For families, this means that facilities operating before August 2021 have a compliance history that spans the transition — older inspection records may use different regulatory frameworks and language.",
  },
  {
    q: "How is Minnesota's memory care licensing different from California's?",
    a: "California licenses memory care under RCFEs regulated by CDSS, with Type A / Type B deficiency severity labels and a memory care disclosure requirement. Minnesota uses the ALF with Dementia Care designation under Chapter 144G, regulated by MDH, with its own inspection and correction order terminology. Medicaid funding differs too: California uses the Assisted Living Waiver, Minnesota uses CADI and Elderly Waiver programs. Always check the state label on a StarlynnCare profile.",
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

export default function MnLicensingPage() {
  const jsonLd = [
    buildArticleSchema({ headline: ARTICLE_HEADLINE, description: DESC, url: canonicalUrl, datePublished: DATE_PUBLISHED }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Minnesota", url: canonicalFor("/minnesota") },
      { name: "Minnesota guides", url: canonicalFor("/minnesota/guides") },
      { name: "Memory care licensing", url: canonicalUrl },
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
              <span className="text-ink-3">Memory care licensing</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Minnesota licensing guide · MDH regulation
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
              <li>Minnesota licenses memory care as <strong className="font-medium text-ink">Assisted Living Facility with Dementia Care (ALF-DC)</strong> under Chapter 144G, regulated by MDH.</li>
              <li>The dementia care designation requires specialized training, secured environments, individualized care plans, and structured dementia programming — on top of the base ALF license.</li>
              <li>Minnesota does <strong className="font-medium text-ink">not</strong> use California&apos;s &ldquo;Type A / Type B&rdquo; labels — MDH uses correction orders and its own enforcement terminology.</li>
              <li>Medicaid access is through <strong className="font-medium text-ink">CADI or Elderly Waiver</strong> programs at contracted facilities.</li>
            </ul>
          </aside>

          <H2 id="chapter-144g">Chapter 144G and the ALF with Dementia Care designation</H2>
          <Prose>
            <p>
              Minnesota&apos;s Chapter 144G, effective August 1, 2021, established a unified licensing framework for assisted living facilities statewide. The framework includes two tiers: a base Assisted Living Facility (ALF) license and an Assisted Living Facility with Dementia Care (ALF-DC) designation for facilities primarily serving residents with dementia.
            </p>
            <p>
              The ALF-DC designation requires the facility to meet additional standards — including specialized staff training, a secured or monitored environment, individualized dementia care planning, and structured programming. MDH surveys compliance with both the base ALF standards and the dementia care overlay on separate tracks.
            </p>
          </Prose>

          <H2 id="mdh-inspections">How MDH inspects Minnesota memory care facilities</H2>
          <Prose>
            <p>
              MDH conducts routine licensing surveys of Minnesota ALFs and ALF-DC facilities — typically annually — and investigates complaints. MDH may issue correction orders, assess civil monetary penalties, or impose license conditions based on findings. Minnesota does not use California&apos;s Type A / Type B deficiency classification; MDH uses its own enforcement vocabulary.
            </p>
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

          <DataFootnote source="Minnesota Statutes Chapter 144G (ALF licensing, effective 2021); Minnesota Department of Health (MDH) licensing surveys; Minnesota Medicaid CADI and Elderly Waiver programs" refreshed="2026-05-09" />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">Continue reading</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/minnesota/memory-care-vs-nursing-home" className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors">
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Minnesota</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Memory care vs. nursing home in Minnesota</p>
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
