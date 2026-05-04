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

const PAGE_PATH = "/library/medi-cal-and-memory-care";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Medi-Cal & Memory Care in California — What Families Actually Need to Know";
const DESC =
  "Plain-language guide to Medi-Cal limits for RCFE memory care, Assisted Living Waiver basics, share-of-cost concepts, and why traditional Medi-Cal does not pay memory-care rent — reviewed by a California RN.";
const DATE_PUBLISHED = "2026-05-03";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Does Medi-Cal pay for memory care room and board?",
    a: "Generally no for RCFE settings — Medi-Cal is not a substitute for private residential rent. Some waiver benefits may cover services (not room charges) for enrolled participants in participating counties.",
  },
  {
    q: "What is the Assisted Living Waiver (ALW)?",
    a: "A California waiver that may fund certain services in participating assisted living facilities — subject to eligibility, assessment, facility participation, and waitlists. It is not a blanket voucher for every memory care building.",
  },
  {
    q: "Should I trust facility marketing about Medi-Cal acceptance?",
    a: "Verify enrollment status, county participation, and written benefit explanations with your local Medi-Cal office or qualified benefits counselor — StarlynnCare profiles regulatory inspections, not payer eligibility.",
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

export default function MediCalMemoryCarePage() {
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Medi-Cal & memory care", url: canonicalUrl },
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
            <nav className="flex flex-wrap gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4">
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Medi-Cal &amp; memory care</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § California payer literacy · PHN-reviewed framing
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink mt-3 mb-5">
              {TITLE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14 space-y-5 text-[16.5px] leading-[1.75] text-ink-2">
          <H2 id="rent-vs-services">Room &amp; board vs. services</H2>
          <p>
            Memory care monthly bills combine rent, care levels, meals, and ancillary fees. Medi-Cal programs that
            assist with community-based care typically distinguish <strong>housing costs</strong> from{" "}
            <strong>waiver-funded services</strong>. Policies evolve — confirm current DHCS materials with a qualified
            counselor before you move money or decline coverage.
          </p>

          <H2 id="alw">Assisted Living Waiver — realistic expectations</H2>
          <p>
            ALW can help eligible participants access certain services in participating residential settings, but waitlists
            and county-specific implementation matter as much as statute. StarlynnCare does not maintain facility-level ALW
            enrollment tables — ask administrators directly and obtain written confirmation for financial planning.
          </p>

          <H2 id="starlynncare">How StarlynnCare fits</H2>
          <p>
            Our dataset emphasizes inspection citations, licensing status, and complaint-driven investigations — the pieces
            families use to judge whether a building can execute the care plan insurers and Medi-Cal programs expect. Use{" "}
            <Link href="/california" className="text-teal underline underline-offset-4">
              county hubs
            </Link>{" "}
            after you understand payer basics so shortlisting stays grounded in regulatory history.
          </p>

          <DataFootnote
            source="Educational overview · not legal or financial advice"
            refreshed={DATE_PUBLISHED}
            note="For eligibility, consult DHCS, your county Medi-Cal office, or a certified benefits advisor."
          />

          <div className="mt-16 border-t border-paper-rule pt-12 space-y-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
              FAQ
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

          <div className="mt-12 flex flex-col gap-3 text-[14px]">
            <Link href="/california/cost-guide" className="text-teal underline underline-offset-4">
              California memory care cost guide →
            </Link>
            <Link href="/library/memory-care-vs-nursing-home" className="text-teal underline underline-offset-4">
              Memory care vs. nursing home →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
