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

const PAGE_PATH = "/library/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Memory Care vs. Nursing Home (SNF) — How They Differ (2026)";
const DESC =
  "California-focused comparison of RCFE memory care vs skilled nursing: licensing, staffing, Medicare/Medi-Cal, rehab vs residential dementia care, and how to read regulatory signals — reviewed by a California RN.";
const DATE_PUBLISHED = "2026-05-03";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Is memory care always non-medical compared to a nursing home?",
    a: "Generally yes at the licensing level: RCFE memory care provides supervision and assistance with daily living; SNFs provide skilled nursing services on-site. Individual buildings sometimes combine campuses — verify each wing’s license.",
  },
  {
    q: "When does Medicare cover memory care?",
    a: "Medicare does not pay long-term room and board in RCFE memory care. It may cover short-term skilled nursing after a qualifying hospital stay — different rules than assisted living.",
  },
  {
    q: "Why would someone choose SNF over memory care?",
    a: "Medical complexity drives the decision: wound care requiring licensed nurses around-the-clock, IV antibiotics, frequent respiratory therapy, or unstable conditions that cannot be managed in a residential care setting.",
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

export default function MemoryCareVsNursingHomePage() {
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
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
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care vs. nursing home</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Decision guide · RCFE memory care vs SNF
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,56px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5">
              Memory care vs. nursing home — <em>license class matters more than the brochure.</em>
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">
              StarlynnCare profiles California RCFEs and SNFs differently because inspectors cite different rules.
              This guide separates residential dementia care from skilled nursing when families hear both words in the same crisis week.
            </p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <H2 id="definitions">1 · Two different regulatory worlds</H2>
          <Prose>
            <p>
              <strong>Memory care (RCFE context)</strong> usually refers to a Residential Care Facility for the Elderly
              with dementia-capable staffing, environmental safeguards, and California Title 22 obligations when memory care
              is advertised or operated — citations appear in CDSS inspection narratives StarlynnCare reproduces.
            </p>
            <p>
              <strong>Skilled nursing facility (SNF)</strong> delivers licensed nursing care at a clinical standard,
              participates in Medicare/Medicaid survey cycles under federal rules, and documents care in a medical model.
              Many California SNFs host dementia special care units — still SNF-level licensing.
            </p>
          </Prose>

          <H2 id="comparison">2 · Snapshot comparison</H2>
          <div className="overflow-x-auto rounded-lg border border-paper-rule bg-paper-2">
            <table className="min-w-[640px] w-full text-left text-[14px] leading-snug">
              <thead>
                <tr className="border-b border-paper-rule bg-paper font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-rust">
                  <th className="px-4 py-3 font-semibold">Dimension</th>
                  <th className="px-4 py-3 font-semibold">RCFE memory care</th>
                  <th className="px-4 py-3 font-semibold">SNF (incl. dementia SCU)</th>
                </tr>
              </thead>
              <tbody className="text-ink-2">
                <tr className="border-b border-paper-rule align-top">
                  <td className="px-4 py-3 font-medium text-ink">Primary regulator (CA)</td>
                  <td className="px-4 py-3">CDSS Community Care Licensing</td>
                  <td className="px-4 py-3">CDSS + CMS certification pathway for Medicare/Medicaid SNFs</td>
                </tr>
                <tr className="border-b border-paper-rule align-top">
                  <td className="px-4 py-3 font-medium text-ink">Clinical threshold</td>
                  <td className="px-4 py-3">Residential supervision; not for unstable acute needs</td>
                  <td className="px-4 py-3">Skilled nursing orders, wound vacs, IV meds, frequent assessments</td>
                </tr>
                <tr className="border-b border-paper-rule align-top">
                  <td className="px-4 py-3 font-medium text-ink">Medicare room &amp; board</td>
                  <td className="px-4 py-3">Not covered long-term</td>
                  <td className="px-4 py-3">Short-term benefit possible after qualifying hospitalization — not infinite</td>
                </tr>
                <tr className="align-top">
                  <td className="px-4 py-3 font-medium text-ink">StarlynnCare data</td>
                  <td className="px-4 py-3">
                    RCFE inspections + deficiency classes — browse{" "}
                    <Link href="/california" className="text-teal underline underline-offset-4">
                      California hubs
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    Compare CMS star context where CCN exists on profile + state citations
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <DataFootnote source="Regulatory overview · not individualized medical advice" refreshed={DATE_PUBLISHED} />

          <H2 id="medi-cal">3 · Medi-Cal framing (high level)</H2>
          <Prose>
            <p>
              Traditional Medi-Cal does not turn RCFE memory care rent into a covered benefit the way families hope.
              SNF coverage follows different eligibility and medical necessity rules. For ALW and waiver nuances specific to memory care planning, read{" "}
              <Link href="/library/medi-cal-and-memory-care" className="text-teal underline underline-offset-4">
                Medi-Cal and memory care
              </Link>{" "}
              — written for navigation, not eligibility determination.
            </p>
          </Prose>

          <H2 id="tours">4 · What to verify on tours</H2>
          <Prose>
            <p>
              Ask SNFs for nurse staffing matrices and overnight RN coverage; ask RCFE memory care wings for elopement
              protocols and dementia staffing ratios. Then cross-check inspection citations — StarlynnCare surfaces{" "}
              <Link href="/library/type-a-vs-type-b-deficiencies-explained" className="text-teal underline underline-offset-4">
                Type A vs Type B deficiencies
              </Link>{" "}
              so families see whether issues were documentation-only vs immediate-risk findings.
            </p>
          </Prose>

          <div className="mt-16 border-t border-paper-rule pt-12">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust mb-4">
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

          <div className="mt-12 flex flex-col gap-3 text-[14px] text-ink-3">
            <Link href="/memory-care-vs-assisted-living" className="text-teal underline underline-offset-4">
              Memory care vs. assisted living →
            </Link>
            <Link href="/editorial-policy" className="text-teal underline underline-offset-4">
              Editorial policy →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
