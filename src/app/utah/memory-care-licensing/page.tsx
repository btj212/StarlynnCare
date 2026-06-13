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

const PAGE_PATH = "/utah/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Utah memory care licensing explained — Assisted Living Facilities, DLBC, and how inspections work";
const TITLE =
  "Utah Memory Care Licensing: ALFs, DLBC Inspections & Dementia Care Requirements (2026)";
const DESC =
  "Utah licenses memory care homes as Assisted Living Facilities (ALFs) under Utah Admin. Code R432-270, regulated by the Division of Licensing and Background Checks (DLBC). Learn how the licensing tiers work, what inspections cover, how violations are classified, and what families should verify before choosing a Utah memory care facility.";
const DATE_PUBLISHED = "2026-06-12";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What type of license does a Utah memory care facility hold?",
    a: "Memory care homes in Utah are licensed as Assisted Living Facilities (ALFs) under Utah Admin. Code R432-270, administered by the Utah Division of Licensing and Background Checks (DLBC), which operates under the Utah Department of Health and Human Services (DHHS). Utah does not issue a separate 'memory care license' — instead, the ALF license governs all residential care settings for adults, including those operating dedicated dementia or Alzheimer's units.",
  },
  {
    q: "Does Utah require special certification for facilities that serve residents with dementia?",
    a: "Utah ALF regulations under R432-270 include requirements for facilities that serve residents with memory loss or dementia, including minimum staff training in dementia care, activity programming appropriate for cognitive impairment, and environmental design standards such as secured or monitored units. Facilities with a dedicated dementia care unit should be able to provide documentation of staff training hours and the dementia-specific policies they follow. Ask to see this documentation during your tour — it is not always prominently disclosed.",
  },
  {
    q: "How does DLBC inspect Utah memory care facilities?",
    a: "The Utah Division of Licensing and Background Checks conducts on-site inspections of all licensed ALFs — typically at least annually — and investigates complaints and reportable incidents. Inspections review staffing levels and credentials, resident rights, medication management, physical environment safety, care planning, and compliance with any dementia-specific requirements applicable to the unit. Inspection reports and any violations are public record and available through DLBC's licensing portal at ccl.utah.gov. StarlynnCare indexes these records for every published Utah facility profile.",
  },
  {
    q: "How are violations classified in Utah ALF inspections?",
    a: "Utah ALF inspections can result in citations for violations of the Administrative Rules (R432-270). The seriousness of a violation and the required corrective action depend on the nature of the finding. The most serious violations — those that pose immediate risk to resident health or safety — may result in immediate corrective action orders, civil penalties, or conditional license status. Less serious violations result in a standard plan of correction. StarlynnCare displays violation records as provided by DLBC on each Utah facility profile, including the exit date of the inspection and the violation description.",
  },
  {
    q: "Does Utah have Medicaid funding for memory care in ALFs?",
    a: "Utah Medicaid can fund certain services (but not room and board) for eligible residents in contracted ALFs through Home and Community-Based Services (HCBS) waiver programs administered by Utah DHHS. The ALF waiver program for assisted living covers personal care services for Medicaid-eligible individuals. Not all Utah ALFs participate in the Medicaid waiver program — ask directly about contract status, bed availability, and the scope of covered services before touring or applying.",
  },
  {
    q: "How is Utah's memory care system different from California's?",
    a: "California licenses all memory care homes as RCFEs (Residential Care Facilities for the Elderly) under CDSS and uses Type A / Type B deficiency severity labels. California also requires an Alzheimer's Special Care Disclosure for facilities marketing dementia care. Utah uses the ALF license type under DLBC and does not use California's Type A / Type B severity classification. Medicaid funding models also differ: California has the Assisted Living Waiver (ALW), while Utah has HCBS waiver programs through DHHS. When reading facility profiles across states on StarlynnCare, note the state-specific inspection terminology.",
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

function QuickReferenceTable() {
  const rows = [
    { attr: "License type", value: "Assisted Living Facility (ALF)" },
    { attr: "Licensing authority", value: "Utah Division of Licensing and Background Checks (DLBC)" },
    { attr: "Parent agency", value: "Utah Department of Health and Human Services (DHHS)" },
    { attr: "Governing rule", value: "Utah Admin. Code R432-270" },
    { attr: "Inspection source (StarlynnCare)", value: "DLBC licensing portal — ccl.utah.gov" },
    { attr: "Medicaid program", value: "HCBS ALF waiver through Utah DHHS — not universally available" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[400px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[200px]">
              Factor
            </th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Utah ALF
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
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UtLicensingPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Utah", url: canonicalFor("/utah") },
      { name: "Utah guides", url: canonicalFor("/utah/guides") },
      { name: "Memory care licensing", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav
        badge="Utah"
        ctaHref="/utah/facilities"
        ctaLabel="Utah memory care facilities"
        stateNavHref="/utah"
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
              <Link href="/utah" className="hover:text-teal transition-colors">
                Utah
              </Link>
              <span aria-hidden>›</span>
              <Link href="/utah/guides" className="hover:text-teal transition-colors">
                Guides
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care licensing</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Utah licensing guide · DLBC regulation
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
                Utah memory care homes are licensed as{" "}
                <strong className="font-medium text-ink">
                  Assisted Living Facilities (ALFs)
                </strong>{" "}
                under Utah Admin. Code R432-270, regulated by DLBC (Division of Licensing and
                Background Checks).
              </li>
              <li>
                There is{" "}
                <strong className="font-medium text-ink">no separate memory care license</strong> in Utah
                — dementia care requirements are built into the ALF rules and apply to facilities
                serving residents with cognitive impairment.
              </li>
              <li>
                DLBC conducts{" "}
                <strong className="font-medium text-ink">annual inspections</strong> and investigates
                complaints. Inspection records are public at ccl.utah.gov — StarlynnCare indexes
                them on every Utah facility profile.
              </li>
              <li>
                Medicaid funding for services (not room and board) may be available through{" "}
                <strong className="font-medium text-ink">HCBS waiver programs</strong> at contracted
                facilities — not universally available.
              </li>
            </ul>
          </aside>

          <H2 id="alf-licensing">Utah ALF licensing and memory care</H2>
          <Prose>
            <p>
              Utah does not have a distinct &ldquo;memory care&rdquo; facility license. All residential care
              settings for adults requiring assistance — including dedicated memory care communities — are
              licensed as{" "}
              <strong className="font-medium text-ink">
                Assisted Living Facilities (ALFs)
              </strong>{" "}
              under Utah Administrative Code R432-270. The Utah Division of Licensing and Background
              Checks (DLBC), which operates under the Utah Department of Health and Human Services
              (DHHS), is the state licensing and regulatory authority.
            </p>
            <p>
              Facilities that serve residents with dementia or Alzheimer&apos;s disease are subject to the
              dementia-care provisions within the ALF rules, including requirements for staff training in
              dementia care, activity programming designed for cognitive impairment, and physical environment
              standards for secured or monitored units where applicable.
            </p>
          </Prose>

          <QuickReferenceTable />

          <H2 id="inspections">How DLBC inspects Utah ALFs</H2>
          <Prose>
            <p>
              DLBC conducts on-site inspections of licensed ALFs on at least an annual basis and
              investigates complaints and reportable incidents. During an inspection, surveyors assess:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Staffing levels, supervision, and credential documentation</li>
              <li>Resident rights protections and freedom from abuse</li>
              <li>Medication storage, administration, and error reporting</li>
              <li>Individual care plans and service agreements</li>
              <li>Physical environment — safety, sanitation, and accessibility</li>
              <li>
                For memory care units: dementia training documentation, secured environment
                compliance, and programming records
              </li>
            </ul>
            <p>
              Inspection findings and any violations are published by DLBC at{" "}
              <a
                href="https://ccl.utah.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal underline underline-offset-4"
              >
                ccl.utah.gov
              </a>
              . StarlynnCare pulls these records and displays them on each Utah facility profile, with
              the inspection exit date and violation description.
            </p>
          </Prose>

          <H2 id="questions-to-ask">What to ask during a Utah memory care tour</H2>
          <Prose>
            <p>
              Because Utah&apos;s dementia care requirements are embedded in the ALF rules rather than
              flagged by a separate license or disclosure, families need to ask specifically about
              memory care practices during tours. Key questions:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="font-medium text-ink">Staff training:</strong> How many hours of
                dementia-specific training do direct care staff receive annually? Can I see the training
                records?
              </li>
              <li>
                <strong className="font-medium text-ink">Staffing ratios:</strong> What is the
                staff-to-resident ratio on the memory care unit during the day shift and at night?
              </li>
              <li>
                <strong className="font-medium text-ink">Secured environment:</strong> Is the memory
                care unit physically secured or monitored? What is the elopement prevention protocol?
              </li>
              <li>
                <strong className="font-medium text-ink">Inspection history:</strong> What did the most
                recent DLBC inspection find, and how were violations corrected? (Cross-reference with the
                StarlynnCare profile and the DLBC portal.)
              </li>
              <li>
                <strong className="font-medium text-ink">Medicaid:</strong> Does this facility hold an
                HCBS waiver contract, and are Medicaid beds available?
              </li>
            </ul>
          </Prose>

          <H2 id="how-to-read-profile">How to read a Utah facility profile on StarlynnCare</H2>
          <Prose>
            <p>Each Utah ALF profile on StarlynnCare shows:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>ALF license status and bed count</li>
              <li>Inspection history with exit dates and violation descriptions from DLBC records</li>
              <li>Complaint outcomes where records are available</li>
              <li>
                Direct link to the DLBC licensing portal for source verification
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
            source="Utah Division of Licensing and Background Checks (DLBC), Utah Admin. Code R432-270; Utah DHHS Home and Community-Based Services (HCBS) waiver programs"
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
              href="/utah"
              className="mt-4 inline-block text-[14px] text-teal hover:underline"
            >
              ← Utah memory care hub
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
