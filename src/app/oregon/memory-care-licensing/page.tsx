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

const PAGE_PATH = "/oregon/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Oregon memory care licensing explained — ALFs, RCFs, and the DHS Memory Care Endorsement";
const TITLE = "Oregon Memory Care Licensing: ALFs, RCFs & Memory Care Endorsement (2026)";
const DESC =
  "Oregon licenses memory care under two frameworks — Assisted Living (ALF) and Residential Care (RCF) — both regulated by Oregon DHS. A separate Memory Care Endorsement governs dementia-specific programming. Learn what each means for families.";
const DATE_PUBLISHED = "2026-05-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the difference between an Assisted Living Facility (ALF) and a Residential Care Facility (RCF) in Oregon?",
    a: "Both ALFs and RCFs are licensed by Oregon Department of Human Services (DHS) under ORS Chapter 443 and provide housing with personal care and services. ALFs are generally designed for independent to moderately dependent residents and require access to nursing services; RCFs tend to serve residents with higher care needs in a more residential setting. Both can hold a Memory Care Endorsement. Families should ask each specific facility which license it operates under and how its staff-to-resident ratio differs.",
  },
  {
    q: "What is the Oregon DHS Memory Care Endorsement?",
    a: "The Memory Care Endorsement is an additional credential issued by Oregon DHS to ALFs and RCFs that meet specific dementia-care standards under OAR 411-057. Requirements include a dedicated dementia care program, specialized staff training in dementia and behavioral health, secured or monitored environments to prevent unsafe exits, structured daily programming, and individualized care planning. An endorsement does not guarantee quality — it signals that DHS has verified compliance with a higher baseline at the time of endorsement review.",
  },
  {
    q: "How does Oregon inspect memory care facilities?",
    a: "Oregon DHS Long-Term Care Licensing conducts routine surveys of licensed ALFs and RCFs and investigates complaints. Inspections review resident rights, medication management, staffing, care planning, environment, and — for endorsed facilities — dementia-specific programming requirements. StarlynnCare shows inspection findings from DHS records on each Oregon facility profile with dates and a link to the source record.",
  },
  {
    q: "Does Oregon use 'Type A' or 'Type B' deficiency labels like California?",
    a: "No. Oregon does not use California's Type A / Type B deficiency classification. Oregon DHS uses its own enforcement terminology — inspectors may cite a 'licensing violation,' issue a 'correction order,' impose a civil penalty, or substantiate a complaint. The severity and scope of a finding are described in the inspection narrative. StarlynnCare surfaces these findings in plain language on each Oregon facility profile.",
  },
  {
    q: "Does Oregon have a Medicaid program for memory care in ALFs or RCFs?",
    a: "Yes. Oregon Medicaid (Oregon Health Plan) can fund residential care and memory care services through the K Plan (Oregon Home and Community-Based Services waiver) for eligible residents in contracted facilities. The facility must have a Medicaid contract with Oregon DHS Aging and People with Disabilities (APD). Not all Oregon ALFs and RCFs accept Medicaid — ask about contract status and bed availability directly during your tour.",
  },
  {
    q: "How is Oregon's memory care system different from California's?",
    a: "California licenses memory care under a single RCFE (Residential Care Facility for the Elderly) category regulated by CDSS. California uses Type A / Type B deficiency severity labels and a statewide disclosure system. Oregon uses two license types (ALF, RCF) regulated by DHS, a separate Memory Care Endorsement for dementia-specific programming, and different inspection terminology. Medicaid access also differs — California uses ALW (Assisted Living Waiver), Oregon uses the K Plan waiver. When reading a StarlynnCare profile, always note the state.",
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
    { attr: "License type", alf: "Assisted Living Facility (ALF)", rcf: "Residential Care Facility (RCF)" },
    { attr: "Regulator", alf: "Oregon DHS — Long-Term Care Licensing", rcf: "Oregon DHS — Long-Term Care Licensing" },
    { attr: "Governing statute", alf: "ORS 443.400–443.455; OAR 411-054", rcf: "ORS 443.400–443.455; OAR 411-054" },
    { attr: "Memory Care Endorsement", alf: "Optional — apply separately per OAR 411-057", rcf: "Optional — apply separately per OAR 411-057" },
    { attr: "Medicaid contract possible?", alf: "Yes — K Plan waiver (APD contracted)", rcf: "Yes — K Plan waiver (APD contracted)" },
    { attr: "Inspection source (StarlynnCare)", alf: "DHS LTC Licensing portal", rcf: "DHS LTC Licensing portal" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[540px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">Factor</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">ALF</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">RCF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.attr} className="border-t border-paper-rule" style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}>
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">{row.attr}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.alf}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.rcf}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OrLicensingPage() {
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
      { name: "Memory care licensing", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav badge="Oregon" ctaHref="/oregon/facilities" ctaLabel="Oregon memory care facilities" stateNavHref="/oregon" />

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
              <span className="text-ink-3">Memory care licensing</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Oregon licensing guide · Oregon DHS regulation
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
                Oregon licenses residential memory care as either an{" "}
                <strong className="font-medium text-ink">Assisted Living Facility (ALF)</strong> or a{" "}
                <strong className="font-medium text-ink">Residential Care Facility (RCF)</strong> — both regulated by Oregon DHS under ORS Chapter 443.
              </li>
              <li>
                A separate <strong className="font-medium text-ink">Memory Care Endorsement</strong> (OAR 411-057) is required for facilities that market dementia-specific programming — it is not automatic.
              </li>
              <li>
                Oregon does <strong className="font-medium text-ink">not</strong> use California&apos;s &ldquo;Type A / Type B&rdquo; deficiency labels. Oregon DHS uses its own enforcement terminology.
              </li>
              <li>
                Medicaid access (Oregon K Plan waiver) is available at contracted facilities — ask about contract status and availability during your tour.
              </li>
            </ul>
          </aside>

          <H2 id="alf-vs-rcf">ALF vs. RCF: what the difference means</H2>
          <Prose>
            <p>
              Oregon licenses residential care settings under two frameworks. Assisted Living Facilities (ALFs) and
              Residential Care Facilities (RCFs) are both regulated by Oregon DHS Long-Term Care Licensing under ORS
              Chapter 443 and the applicable Oregon Administrative Rules. Both provide housing with assistance for
              daily activities, medication support, and access to health services.
            </p>
            <p>
              The practical difference for memory care families is less about the license type itself and more about
              how the specific facility is physically designed, staffed, and programmed — and whether it holds a
              Memory Care Endorsement. Ask each facility which license it operates under, the staff-to-resident
              ratio on the memory care unit, and whether the endorsement is current.
            </p>
          </Prose>

          <ComparisonTable />

          <H2 id="memory-care-endorsement">The DHS Memory Care Endorsement</H2>
          <Prose>
            <p>
              The Memory Care Endorsement is an additional credential issued by Oregon DHS to facilities that meet
              dementia-specific standards under OAR 411-057. Requirements include:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>A written dementia care program reviewed and approved by DHS</li>
              <li>Staff training in dementia, communication, and behavioral health management</li>
              <li>Secured or monitored physical environment to prevent unsafe exits</li>
              <li>Structured daily programming tailored to dementia residents</li>
              <li>Individualized care planning with family involvement</li>
            </ul>
            <p>
              An endorsement does not guarantee high quality — it means DHS has verified the facility met these
              baseline requirements at the time of endorsement review. Families should cross-reference endorsement
              status with inspection history and complaint records, both available on each StarlynnCare Oregon profile.
            </p>
          </Prose>

          <H2 id="how-inspections-work">How Oregon DHS inspects memory care facilities</H2>
          <Prose>
            <p>
              Oregon DHS Long-Term Care Licensing conducts routine licensing surveys of all ALFs and RCFs —
              typically annually — and investigates complaints. For endorsed facilities, inspectors review compliance
              with the dementia program standards in addition to general licensing requirements.
            </p>
            <p>
              Oregon does not use California&apos;s Type A / Type B deficiency severity classification. DHS uses its own
              enforcement vocabulary: a citation may be a &ldquo;licensing violation,&rdquo; a &ldquo;correction order,&rdquo; a
              &ldquo;civil penalty,&rdquo; or a &ldquo;substantiated complaint.&rdquo; The severity and scope of each finding are
              described in the inspection narrative, which StarlynnCare surfaces in plain language on each profile.
            </p>
          </Prose>

          <H2 id="how-to-read-profile">How to read an Oregon facility on StarlynnCare</H2>
          <Prose>
            <p>
              Each Oregon facility profile on StarlynnCare shows:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>License type (ALF or RCF) and Memory Care Endorsement status</li>
              <li>DHS inspection history with dates and finding summaries</li>
              <li>Complaint investigation outcomes</li>
              <li>Direct link to the Oregon DHS Long-Term Care Licensing portal for source verification</li>
            </ul>
          </Prose>

          {/* FAQ section */}
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
            source="Oregon DHS Long-Term Care Licensing (ORS ch. 443; OAR 411-054, 411-057); Oregon Health Plan K Plan waiver"
            refreshed="2026-05-09"
          />

          {/* Continue reading */}
          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/oregon/memory-care-vs-nursing-home"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Oregon</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Memory care vs. nursing home in Oregon</p>
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
