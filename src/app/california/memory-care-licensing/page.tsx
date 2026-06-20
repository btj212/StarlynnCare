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

const PAGE_PATH = "/california/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "California memory care licensing explained — RCFEs, CDSS, and the Alzheimer's Special Care Disclosure";
const TITLE =
  "California Memory Care Licensing: RCFEs, CDSS & Type A/B Deficiencies";
const DESC =
  "California licenses all memory care homes as RCFEs (Residential Care Facilities for the Elderly) under Title 22, regulated by CDSS Community Care Licensing. Facilities that market dementia care must file an Alzheimer's Special Care Disclosure under SB 1523. Learn what all of this means for families choosing a facility.";
const DATE_PUBLISHED = "2026-06-12";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is an RCFE and why does California use that license for memory care?",
    a: "RCFE stands for Residential Care Facility for the Elderly — California's single license type for all residential care settings that serve adults 60 and older, including memory care homes. RCFEs are regulated under California Health & Safety Code §1569 and Title 22, Division 6, Chapter 8 of the California Code of Regulations. California does not have a separate 'memory care' license; instead, a facility that provides dementia-specific programming must file an Alzheimer's Special Care Disclosure and comply with the staffing and program requirements that disclose entails.",
  },
  {
    q: "What is the Alzheimer's Special Care Disclosure required by SB 1523?",
    a: "California Health & Safety Code §1569.2 (originally enacted via SB 1523) requires any RCFE that claims to specialize in dementia care — through its name, marketing, or admission policies — to file a written disclosure with CDSS and provide it to prospective residents and families. The disclosure must describe the facility's dementia care philosophy, staff training protocols, physical environment (including secure areas), programming, behavior management practices, and discharge criteria. Filing a disclosure does not mean CDSS has independently verified the quality of those practices — it means the facility has disclosed what it does. Cross-reference the disclosure with the inspection history on each StarlynnCare profile.",
  },
  {
    q: "How does CDSS inspect California memory care homes?",
    a: "The California Department of Social Services (CDSS) Community Care Licensing Division (CCLD) is responsible for licensing and inspecting RCFEs, including memory care homes. CCLD conducts unannounced routine inspections — typically at least once per year for most facilities — and responds to complaints, incidents, and referrals. CCLD inspectors review staffing ratios, resident rights, medication management, physical environment, care plans, and — for memory care disclosures — dementia program compliance. Inspection findings are public record, and StarlynnCare indexes them for every licensed California facility.",
  },
  {
    q: "What is the difference between a Type A and Type B deficiency in California?",
    a: "California CDSS uses two deficiency severity classes. A Type A deficiency represents an immediate and serious threat to the physical health, mental health, or safety of residents — the highest severity level. A Type B deficiency is a lesser violation that does not pose an immediate threat but still reflects a regulatory violation. Both classes appear on StarlynnCare profiles. A facility with multiple Type A deficiencies, especially if they are repeated, is a meaningful warning sign. A facility with only Type B citations has a less severe record — but families should still read the full citation narratives.",
  },
  {
    q: "Does California have a Medicaid program that pays for memory care in RCFEs?",
    a: "Yes, through the Assisted Living Waiver (ALW). The ALW is a Medi-Cal (California Medicaid) Home and Community-Based Services waiver that covers personal care and services — but not room and board — for eligible residents in contracted RCFEs. Not all California RCFEs have an ALW contract, and there are often waiting lists by county. See the Medi-Cal and memory care article on StarlynnCare for county-level ALW availability and how to verify a facility's contract status before touring.",
  },
  {
    q: "How do I file a complaint about a California memory care home?",
    a: "Complaints about California RCFEs (including memory care homes) are filed with the CDSS Community Care Licensing Division. You can file online through the CCLD portal at ccld.dss.ca.gov, call the CCLD complaint hotline, or contact the local CCLD regional office. Anonymous complaints are accepted. CCLD is required to investigate all complaints and respond within timeframes set by law. If a resident is in immediate danger, also contact Adult Protective Services (APS) or call 911.",
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
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
      {children}
    </div>
  );
}

function DeficiencyTable() {
  const rows = [
    {
      attr: "Severity class",
      typeA: "Type A",
      typeB: "Type B",
    },
    {
      attr: "Definition",
      typeA: "Immediate and serious threat to physical health, mental health, or safety",
      typeB: "Lesser violation — does not pose an immediate threat",
    },
    {
      attr: "CDSS response",
      typeA: "Mandatory plan of correction; may trigger civil penalty or license action",
      typeB: "Plan of correction required; typically no immediate enforcement action",
    },
    {
      attr: "StarlynnCare display",
      typeA: "Shown with red severity badge on facility profiles",
      typeB: "Shown with amber severity badge on facility profiles",
    },
    {
      attr: "Repeat citation weight",
      typeA: "Repeat Type A citations are heavily weighted in the facility grade",
      typeB: "Repeat Type B citations increase grade risk incrementally",
    },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[540px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">
              Factor
            </th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Type A
            </th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Type B
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.attr}
              className="border-t border-paper-rule"
              style={{
                background:
                  i % 2 === 0
                    ? "var(--color-paper-2)"
                    : "var(--color-paper)",
              }}
            >
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">
                {row.attr}
              </td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">
                {row.typeA}
              </td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">
                {row.typeB}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CaLicensingPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "California", url: canonicalFor("/california") },
      { name: "California guides", url: canonicalFor("/library") },
      { name: "Memory care licensing", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav
        badge="California"
        ctaHref="/california/facilities"
        ctaLabel="California memory care facilities"
        stateNavHref="/california"
      />

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
              <Link href="/california" className="hover:text-teal transition-colors">
                California
              </Link>
              <span aria-hidden>›</span>
              <Link href="/library" className="hover:text-teal transition-colors">
                Guides
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care licensing</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              California licensing guide · CDSS regulation
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">
              {DESC}
            </p>
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
                California uses a single license type —{" "}
                <strong className="font-medium text-ink">
                  RCFE (Residential Care Facility for the Elderly)
                </strong>{" "}
                — for all residential memory care homes, regulated by CDSS under Title 22 CCR.
              </li>
              <li>
                Facilities that market dementia-specific care must file an{" "}
                <strong className="font-medium text-ink">
                  Alzheimer&apos;s Special Care Disclosure
                </strong>{" "}
                (SB 1523 / HSC §1569.2) — but filing it is not an independent quality verification.
              </li>
              <li>
                California uses{" "}
                <strong className="font-medium text-ink">Type A / Type B</strong>{" "}
                deficiency severity labels. Type A = immediate health or safety threat. Type B = lesser
                violation.
              </li>
              <li>
                Medi-Cal can fund personal care services (not room and board) through the{" "}
                <strong className="font-medium text-ink">Assisted Living Waiver (ALW)</strong> at
                contracted facilities — availability varies by county.
              </li>
            </ul>
          </aside>

          <H2 id="what-is-rcfe">What is an RCFE and how it covers memory care</H2>
          <Prose>
            <p>
              California does not have a separate &ldquo;memory care facility&rdquo; license. Every
              residential setting that provides room, board, and personal care to adults 60 and older
              — from a six-bed board-and-care to a 120-bed community — is licensed as a{" "}
              <strong className="font-medium text-ink">
                Residential Care Facility for the Elderly (RCFE)
              </strong>{" "}
              under California Health &amp; Safety Code §1569 and Title 22, Division 6, Chapter 8 of the
              California Code of Regulations.
            </p>
            <p>
              CDSS Community Care Licensing Division (CCLD) is the licensing authority for all RCFEs in
              California. CCLD sets staffing requirements, physical environment standards, medication
              management rules, and resident rights protections that apply to every licensed facility —
              including those operating a dedicated memory care unit.
            </p>
            <p>
              The practical implication for families: a facility can call itself a &ldquo;memory care
              community&rdquo; without a separate license. What matters for comparison is the inspection
              history under the RCFE license, the Alzheimer&apos;s Special Care Disclosure if filed, and the
              staffing ratio and program quality you observe during your tour.
            </p>
          </Prose>

          <H2 id="alz-disclosure">The Alzheimer&apos;s Special Care Disclosure</H2>
          <Prose>
            <p>
              California Health &amp; Safety Code §1569.2, enacted via SB 1523, requires any RCFE that
              represents — through its name, advertising, or admissions practices — that it specializes in
              dementia care to file a written disclosure with CDSS and provide it in writing to
              prospective residents and their families before signing an admission agreement.
            </p>
            <p>
              The disclosure must describe:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The facility&apos;s dementia care philosophy and approach</li>
              <li>
                Staff training specific to dementia — types, frequency, and minimum hours required
              </li>
              <li>
                Physical environment features — secured or monitored areas, wayfinding, and
                elopement prevention
              </li>
              <li>Structured programming and activities tailored to residents with dementia</li>
              <li>
                Behavior management practices and how the facility responds to challenging behaviors
              </li>
              <li>Discharge and transfer criteria specific to the memory care setting</li>
            </ul>
            <p>
              <strong className="font-medium text-ink">
                Filing a disclosure is not an independent quality endorsement.
              </strong>{" "}
              CDSS does not audit the contents of a disclosure at filing — it confirms receipt.
              Families should read the disclosure, then ask the facility to demonstrate how each
              commitment is actually being met during a tour.
            </p>
          </Prose>

          <H2 id="inspections">How CDSS inspects California memory care homes</H2>
          <Prose>
            <p>
              CDSS Community Care Licensing investigators conduct unannounced routine inspections of
              all RCFEs — typically at least once per year — and respond to complaints, incidents
              (such as elopements, falls, or medication errors), and referrals from Adult Protective
              Services or hospitals. Inspectors review:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Staffing ratios and staff qualification records</li>
              <li>Resident rights (personal privacy, freedom from abuse, access to outside contacts)</li>
              <li>Medication storage, administration, and documentation</li>
              <li>Care plans and individualized service agreements</li>
              <li>Physical environment, sanitation, and fire safety</li>
              <li>
                For facilities with an Alzheimer&apos;s Special Care Disclosure: program compliance
                with the disclosure commitments
              </li>
            </ul>
            <p>
              Inspection findings become part of the public RCFE record on the CDSS Community Care
              Licensing portal (ccld.dss.ca.gov). StarlynnCare indexes these findings for every
              licensed California facility with a published profile.
            </p>
          </Prose>

          <H2 id="type-a-type-b">Type A and Type B deficiencies</H2>
          <Prose>
            <p>
              California uses a two-level severity system for RCFE deficiency citations. Understanding
              the distinction helps families read inspection records accurately.
            </p>
          </Prose>
          <DeficiencyTable />
          <Prose>
            <p className="mt-8">
              When reviewing a facility&apos;s inspection history, look for both the count and the
              pattern. A single old Type B citation from a decade ago is different from three Type A
              citations in the past 18 months. Recurring citations for the same violation — especially
              related to medication management, elopement prevention, or staffing — are a more
              significant concern than an isolated one-time finding.
            </p>
          </Prose>

          <H2 id="how-to-read-profile">How to read a California facility profile on StarlynnCare</H2>
          <Prose>
            <p>Each California RCFE profile on StarlynnCare shows:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                RCFE license status and Alzheimer&apos;s Special Care Disclosure indicator (filed /
                not filed)
              </li>
              <li>Inspection history with dates, deficiency classes, and citation descriptions</li>
              <li>Complaint outcomes where substantiated</li>
              <li>
                A facility grade derived from citation counts, severity, recency, and peer
                comparisons within the same region — see{" "}
                <Link href="/methodology" className="text-teal underline underline-offset-4">
                  methodology
                </Link>{" "}
                for grading detail
              </li>
              <li>
                Direct link to the CDSS CCLD portal record for source verification
              </li>
            </ul>
          </Prose>

          {/* FAQ section */}
          <H2 id="faq">Frequently asked questions</H2>
          <div className="space-y-8 mt-6">
            {FAQ_PAIRS.map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-[family-name:var(--font-display)] font-normal text-[18px] leading-[1.25] text-ink mb-2">
                  {q}
                </h3>
                <p className="text-[16px] leading-[1.7] text-ink-2">{a}</p>
              </div>
            ))}
          </div>

          <DataFootnote
            source="CA CDSS Community Care Licensing Division (HSC §1569; Title 22 Div. 6 Ch. 8); SB 1523 / HSC §1569.2 (Alzheimer's Special Care Disclosure); California Assisted Living Waiver (Medi-Cal Home and Community-Based Services)"
            refreshed={DATE_PUBLISHED}
          />

          {/* Continue reading */}
          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/library/medi-cal-and-memory-care"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  California
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  Medi-Cal &amp; memory care — what families need to know
                </p>
              </Link>
              <Link
                href="/library/memory-care-vs-nursing-home"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  All states
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  Memory care vs. nursing home — which is right?
                </p>
              </Link>
            </div>
            <Link
              href="/california"
              className="mt-4 inline-block text-[14px] text-teal hover:underline"
            >
              ← California memory care hub
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
