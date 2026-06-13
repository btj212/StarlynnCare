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

const PAGE_PATH = "/illinois/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Illinois memory care licensing explained — Assisted Living Establishments, SHEs, and IDPH regulation";
const TITLE =
  "Illinois Memory Care Licensing: ALEs, SHEs, IDPH Inspections & Dementia Care Units (2026)";
const DESC =
  "Illinois licenses residential memory care homes as Assisted Living Establishments (ALEs) or Shared Housing Establishments (SHEs) under 210 ILCS 9, regulated by the Illinois Department of Public Health (IDPH). Facilities with dedicated dementia units hold a Special Alzheimer's/Dementia Care designation. Learn how the licensing system works and what families should verify.";
const DATE_PUBLISHED = "2026-06-12";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is an Assisted Living Establishment (ALE) in Illinois?",
    a: "An Assisted Living Establishment (ALE) is the primary license type for residential care settings in Illinois that provide room, board, and assistance with activities of daily living for adults. ALEs are licensed and regulated by the Illinois Department of Public Health (IDPH) under 210 ILCS 9 (Assisted Living and Shared Housing Act) and Illinois Administrative Code Part 295. ALEs can range from small residential homes to large purpose-built communities. Memory care homes operating as ALEs may also hold a Special Alzheimer's/Dementia Care designation if they operate a dedicated dementia unit.",
  },
  {
    q: "What is a Shared Housing Establishment (SHE) and how is it different from an ALE?",
    a: "A Shared Housing Establishment (SHE) is a smaller residential care setting licensed under the same 210 ILCS 9 statute as ALEs, but limited to 12 or fewer residents. SHEs are governed by Illinois Administrative Code Part 296. The smaller size means SHEs may offer a more homelike environment, which some families prefer for dementia care. Both ALEs and SHEs can hold the Special Alzheimer's/Dementia Care designation. Regulatory requirements for SHEs differ slightly from ALEs in areas such as staffing ratios and physical environment standards.",
  },
  {
    q: "What is the Special Alzheimer's/Dementia Care designation in Illinois?",
    a: "Illinois ALEs and SHEs that operate a dedicated Alzheimer's or dementia care unit must obtain a Special Alzheimer's/Dementia Care designation from IDPH. Requirements under 210 ILCS 9 and Part 295/296 include: a written dementia care philosophy, staff training specific to dementia and behavioral health, secured or monitored environment to prevent unsafe exit, structured programming for residents with cognitive impairment, and individualized care planning. Holding the designation means the facility has met IDPH's minimum baseline for dementia-specific programming — it does not guarantee quality, and families should cross-reference it with the inspection record.",
  },
  {
    q: "How does IDPH inspect Illinois memory care facilities?",
    a: "IDPH Division of Assisted Living conducts biennial (every two years) on-site surveys of all licensed ALEs and SHEs, as well as complaint investigations. Inspections review resident rights, staffing, medication management, care planning, physical environment, and for dementia designation holders, compliance with Special Alzheimer's/Dementia Care requirements. StarlynnCare indexes Illinois inspection records sourced from IDPH via FOIA request for every published Illinois facility profile, showing the inspection exit date and violation descriptions.",
  },
  {
    q: "How are violations classified in Illinois ALE and SHE inspections?",
    a: "IDPH classifies violations in Illinois ALEs and SHEs into three types based on severity and risk to residents. Type 1 violations represent the most serious findings — those that pose an immediate risk to resident health, safety, or rights. Type 2 violations are significant but not immediately dangerous. Type 3 violations are lesser regulatory infractions. Each violation also includes a citation code and the date of the inspection visit. StarlynnCare displays the violation type, citation code, and exit date on each Illinois facility profile.",
  },
  {
    q: "Does Illinois Medicaid cover memory care in ALEs or SHEs?",
    a: "Illinois Medicaid (through the Illinois Department of Healthcare and Family Services) funds certain home and community-based services in ALEs through waiver programs, but does not typically cover room and board costs. The HCBS Supportive Living Facility (SLF) program is the primary Medicaid-funded residential care pathway in Illinois, but SLF facilities are a separate license type from ALEs and SHEs. Families considering Medicaid funding for a loved one in an ALE or SHE should consult with the Illinois Department on Aging or a local Area Agency on Aging to understand current waiver availability and eligibility.",
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

function ComparisonTable() {
  const rows = [
    { attr: "License type", ale: "Assisted Living Establishment (ALE)", she: "Shared Housing Establishment (SHE)" },
    { attr: "Max residents", ale: "No upper limit set by statute", she: "12 residents or fewer" },
    { attr: "Regulator", ale: "IDPH Division of Assisted Living", she: "IDPH Division of Assisted Living" },
    { attr: "Governing law", ale: "210 ILCS 9; Ill. Admin. Code Part 295", she: "210 ILCS 9; Ill. Admin. Code Part 296" },
    {
      attr: "Dementia designation",
      ale: "Special Alzheimer's/Dementia Care designation (optional; required if marketing dementia unit)",
      she: "Special Alzheimer's/Dementia Care designation (same requirement as ALE)",
    },
    { attr: "Inspection cycle", ale: "Biennial IDPH survey + complaint investigations", she: "Biennial IDPH survey + complaint investigations" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">
              Factor
            </th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              ALE
            </th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              SHE
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
                  i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)",
              }}
            >
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">
                {row.attr}
              </td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.ale}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.she}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function IlLicensingPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Illinois", url: canonicalFor("/illinois") },
      { name: "Illinois guides", url: canonicalFor("/illinois/guides") },
      { name: "Memory care licensing", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav
        badge="Illinois"
        ctaHref="/illinois/facilities"
        ctaLabel="Illinois memory care facilities"
        stateNavHref="/illinois"
      />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div
          className="border-b border-paper-rule"
          style={{ background: "var(--color-paper-2)" }}
        >
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <Link href="/illinois" className="hover:text-teal transition-colors">
                Illinois
              </Link>
              <span aria-hidden>›</span>
              <Link href="/illinois/guides" className="hover:text-teal transition-colors">
                Guides
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care licensing</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Illinois licensing guide · IDPH regulation
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
                Illinois licenses memory care homes as{" "}
                <strong className="font-medium text-ink">
                  Assisted Living Establishments (ALEs)
                </strong>{" "}
                or{" "}
                <strong className="font-medium text-ink">
                  Shared Housing Establishments (SHEs)
                </strong>{" "}
                — SHEs are limited to 12 or fewer residents — both regulated by IDPH under 210 ILCS 9.
              </li>
              <li>
                Facilities with a dedicated dementia unit hold a{" "}
                <strong className="font-medium text-ink">
                  Special Alzheimer&apos;s/Dementia Care designation
                </strong>{" "}
                issued by IDPH — a minimum-baseline credential, not an independent quality rating.
              </li>
              <li>
                IDPH conducts{" "}
                <strong className="font-medium text-ink">biennial surveys</strong> of all ALEs
                and SHEs plus complaint investigations. Violations are classified as{" "}
                <strong className="font-medium text-ink">Type 1 (most serious), 2, or 3</strong>.
              </li>
              <li>
                StarlynnCare&apos;s Illinois data is sourced from IDPH via{" "}
                <strong className="font-medium text-ink">FOIA request</strong> covering inspections
                and complaint records from January 2024 onward.
              </li>
            </ul>
          </aside>

          <H2 id="ale-vs-she">ALE vs. SHE: what the distinction means for families</H2>
          <Prose>
            <p>
              Illinois recognizes two residential care license types under the Assisted Living and Shared
              Housing Act (210 ILCS 9). Both provide housing with assistance for daily living for adults
              who need support but do not require the level of care provided in a skilled nursing facility.
            </p>
            <p>
              The practical difference: a{" "}
              <strong className="font-medium text-ink">Shared Housing Establishment (SHE)</strong> is
              capped at 12 residents, which typically means a smaller, more homelike environment. Families
              who want a less institutional setting for a loved one with dementia sometimes prefer SHEs
              for this reason. However, smaller size does not automatically mean better staffing ratios or
              higher quality care — the inspection record is still the most reliable signal.
            </p>
          </Prose>

          <ComparisonTable />

          <H2 id="dementia-designation">The Special Alzheimer&apos;s/Dementia Care designation</H2>
          <Prose>
            <p>
              An Illinois ALE or SHE that operates a dedicated Alzheimer&apos;s or dementia care unit
              is required by 210 ILCS 9 to obtain a{" "}
              <strong className="font-medium text-ink">
                Special Alzheimer&apos;s/Dementia Care designation
              </strong>{" "}
              from IDPH. This designation requires the facility to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Maintain a written dementia care philosophy reviewed by IDPH</li>
              <li>
                Provide staff training in dementia-specific care, communication, and behavioral
                management
              </li>
              <li>
                Operate a secured or monitored environment to prevent unsafe resident exits (where
                applicable)
              </li>
              <li>Provide structured programming tailored to residents with cognitive impairment</li>
              <li>Document individualized care plans with dementia-specific goals</li>
            </ul>
            <p>
              Holding the designation signals that IDPH verified compliance with these baseline
              requirements at the time of the designation review. It is not a star rating or an
              independent quality certification. Cross-reference designation status with the
              facility&apos;s Type 1 violation history for a more complete picture.
            </p>
          </Prose>

          <H2 id="how-inspections-work">How IDPH inspects Illinois memory care homes</H2>
          <Prose>
            <p>
              IDPH Division of Assisted Living conducts biennial on-site surveys of all licensed ALEs
              and SHEs — approximately every two years — and investigates complaints and reportable
              incidents. The biennial cycle is less frequent than California&apos;s annual CDSS inspections or
              Oregon&apos;s typically annual DHS surveys, which means the indexed record may be older in some
              cases.
            </p>
            <p>
              During a survey, IDPH inspectors review:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Resident rights and freedom from abuse, neglect, and exploitation</li>
              <li>Staffing ratios and employee documentation</li>
              <li>Medication management and storage</li>
              <li>Individual service plans and care delivery</li>
              <li>Physical environment, safety, and fire preparedness</li>
              <li>
                For Special Alzheimer&apos;s/Dementia Care designation holders: dementia program
                compliance
              </li>
            </ul>
            <p>
              StarlynnCare&apos;s Illinois inspection data is sourced from IDPH via FOIA request and covers
              inspections and complaint investigations from January 2024 through May 2026. Each Illinois
              facility profile shows the inspection exit date, violation type (1/2/3), and the citation
              code.
            </p>
          </Prose>

          <H2 id="how-to-read-profile">How to read an Illinois facility profile on StarlynnCare</H2>
          <Prose>
            <p>Each Illinois ALE or SHE profile on StarlynnCare shows:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                License type (ALE or SHE) and Special Alzheimer&apos;s/Dementia Care designation status
                where available
              </li>
              <li>
                IDPH inspection findings with exit dates, violation type (1/2/3), and citation codes
              </li>
              <li>Complaint investigation outcomes where records are available</li>
              <li>
                Direct link to the IDPH LLCS portal for source verification
              </li>
            </ul>
            <p>
              Because Illinois uses a biennial survey cycle, some profiles may not reflect a survey in
              the past 12 months. When reviewing a profile, note the inspection exit date to understand
              the recency of the record.
            </p>
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
            source="Illinois Department of Public Health (IDPH) Division of Assisted Living — 210 ILCS 9 (Assisted Living and Shared Housing Act); Ill. Admin. Code Part 295 (ALEs) and Part 296 (SHEs). StarlynnCare Illinois data sourced via FOIA, Jan 2024–May 2026."
            refreshed={DATE_PUBLISHED}
          />

          {/* Continue reading */}
          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Link
                href="/library/37-questions-to-ask-on-a-memory-care-tour"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  All states
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  37 questions to ask on a memory care tour
                </p>
              </Link>
            </div>
            <Link
              href="/illinois"
              className="mt-4 inline-block text-[14px] text-teal hover:underline"
            >
              ← Illinois memory care hub
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
