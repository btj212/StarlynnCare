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

const PAGE_PATH = "/washington/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Washington memory care licensing — ALFs and the DSHS Specialized Dementia Care contract";
const TITLE = "Washington Memory Care Licensing: ALFs & Specialized Dementia Care (DSHS) — 2026";
const DESC =
  "Washington licenses memory care in Assisted Living Facilities (ALFs) regulated by DSHS Residential Care Services. A separate Specialized Dementia Care contract governs dementia-specific programming. Learn what each means for families searching in Washington state.";
const DATE_PUBLISHED = "2026-05-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What type of license does a memory care facility hold in Washington?",
    a: "Memory care facilities in Washington are typically licensed as Assisted Living Facilities (ALFs) under RCW 18.20 and WAC 388-78A, regulated by Washington DSHS Residential Care Services. ALFs provide housing with personal care, medication management, and social programming. An ALF specifically providing dementia care must also hold a Specialized Dementia Care contract with DSHS, which imposes additional staffing, training, and programming standards.",
  },
  {
    q: "What is the DSHS Specialized Dementia Care contract?",
    a: "The Specialized Dementia Care contract is an additional agreement an ALF enters with Washington DSHS that enables the facility to serve residents with dementia as the primary diagnosis. Requirements include specialized staff training in dementia and challenging behaviors, a dementia-specific programming model, a safe wandering environment, and individualized care planning. StarlynnCare indexes only Washington ALFs with an active Specialized Dementia Care contract.",
  },
  {
    q: "How does DSHS inspect memory care ALFs in Washington?",
    a: "DSHS Residential Care Services conducts routine inspections of licensed ALFs — typically annually — and investigates complaints from residents, families, or mandated reporters. For Specialized Dementia Care facilities, inspectors also review compliance with dementia program standards. Inspection findings are documented as deficiencies with scope and severity, and complaint outcomes are recorded as substantiated or unsubstantiated. StarlynnCare shows these records on each Washington facility profile with source links.",
  },
  {
    q: "Does Washington use 'Type A' or 'Type B' deficiency labels?",
    a: "No. Washington does not use California's Type A / Type B classification. DSHS uses its own deficiency severity terminology — findings are described in inspection narratives with scope (isolated, pattern, widespread) and severity levels. StarlynnCare surfaces these in plain language on each Washington profile.",
  },
  {
    q: "Does Washington have Medicaid funding for memory care in ALFs?",
    a: "Yes. Washington Medicaid (Apple Health) can fund residential care services at contracted ALFs through the COPES (Community Options Program Entry System) waiver for eligible residents. COPES funds services (not room and board) at contracted facilities. Not all Washington ALFs hold a COPES contract — ask about availability and wait times during your tour. Eligibility requires a functional assessment meeting nursing-facility level of care criteria.",
  },
  {
    q: "How is Washington ALF memory care regulation different from California's?",
    a: "California licenses memory care under RCFEs (Residential Care Facilities for the Elderly) regulated by CDSS, with Type A / Type B deficiency labels. Washington licenses memory care in ALFs (RCW 18.20) regulated by DSHS, with a Specialized Dementia Care contract as the dementia-specific overlay. Medicaid programs differ too: California uses ALW (Assisted Living Waiver), Washington uses COPES waiver. Inspection terminology and record systems are separate. Always check the state label on a StarlynnCare profile.",
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
  twitter: { card: "summary_large_image", title: `${TITLE} | StarlynnCare`, description: DESC },
};

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5">
      {children}
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">{children}</div>;
}

export default function WaLicensingPage() {
  const jsonLd = [
    buildArticleSchema({ headline: ARTICLE_HEADLINE, description: DESC, url: canonicalUrl, datePublished: DATE_PUBLISHED }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Washington", url: canonicalFor("/washington") },
      { name: "Washington guides", url: canonicalFor("/washington/guides") },
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
              <Link href="/washington" className="hover:text-teal transition-colors">Washington</Link>
              <span aria-hidden>›</span>
              <Link href="/washington/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care licensing</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Washington licensing guide · DSHS regulation
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
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">The short version</p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>Washington memory care facilities are licensed as <strong className="font-medium text-ink">Assisted Living Facilities (ALFs)</strong> under RCW 18.20, regulated by DSHS Residential Care Services.</li>
              <li>An ALF serving dementia residents must hold a <strong className="font-medium text-ink">Specialized Dementia Care contract</strong> with DSHS — this is the memory care credential in Washington.</li>
              <li>Washington does <strong className="font-medium text-ink">not</strong> use California&apos;s &ldquo;Type A / Type B&rdquo; deficiency labels — DSHS uses its own inspection terminology.</li>
              <li>Medicaid access is through the <strong className="font-medium text-ink">COPES waiver</strong> (Apple Health) at contracted facilities — not all ALFs participate.</li>
            </ul>
          </aside>

          <H2 id="alf-licensing">ALF licensing and the dementia care overlay</H2>
          <Prose>
            <p>
              Washington Assisted Living Facilities are licensed under RCW 18.20 and governed by WAC 388-78A. A license permits an ALF to provide housing with personal care, medication management, and supportive services to adults who need assistance but do not require 24-hour skilled nursing.
            </p>
            <p>
              A base ALF license is not sufficient for serving residents whose primary diagnosis is dementia. To operate as a memory care community, the facility must enter into a Specialized Dementia Care contract with DSHS, which adds dementia-specific requirements on top of the ALF license.
            </p>
          </Prose>

          <H2 id="specialized-dementia-care">The Specialized Dementia Care contract</H2>
          <Prose>
            <p>
              The Specialized Dementia Care contract requires the facility to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Provide specialized staff training in dementia care and challenging behavior management</li>
              <li>Implement a structured dementia-specific activity and programming model</li>
              <li>Maintain a safe wandering environment (secured perimeter or monitored exits)</li>
              <li>Develop individualized dementia care plans with family involvement</li>
              <li>Accept inspections and oversight specific to specialized dementia care standards</li>
            </ul>
          </Prose>

          <H2 id="inspections">DSHS inspections and deficiency records</H2>
          <Prose>
            <p>
              DSHS Residential Care Services inspects Washington ALFs annually and following complaints. For Specialized Dementia Care facilities, inspectors evaluate both standard ALF requirements and the dementia program-specific standards. Washington does not use California&apos;s Type A / Type B classification — findings are documented with scope (isolated, pattern, widespread) and severity descriptors in the inspection narrative.
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

          <DataFootnote source="Washington DSHS Residential Care Services (RCW 18.20; WAC 388-78A); Washington COPES waiver (Apple Health)" refreshed="2026-05-09" />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">Continue reading</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/washington/memory-care-vs-nursing-home" className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors">
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Washington</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Memory care vs. nursing home in Washington</p>
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
