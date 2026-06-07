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

const PAGE_PATH = "/pennsylvania/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Pennsylvania memory care licensing — Personal Care Home vs. Assisted Living Residence and the Special Care designation";
const TITLE =
  "Pennsylvania Memory Care Licensing: PCH vs. ALR & Special Care Designation — 2026";
const DESC =
  "Pennsylvania licenses memory care under DHS OLTL as Personal Care Homes (55 Pa Code Ch 2600) and Assisted Living Residences (Ch 2800). Learn the difference, how the Special Care and Secure Dementia Care Unit designations work, and how to read a PA facility profile on StarlynnCare.";
const DATE_PUBLISHED = "2026-06-02";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What type of license does a memory care facility hold in Pennsylvania?",
    a: "Pennsylvania memory care facilities are licensed by the Department of Human Services (DHS) Office of Long-Term Living (OLTL) as either a Personal Care Home (PCH) under 55 Pa Code Chapter 2600 or an Assisted Living Residence (ALR) under 55 Pa Code Chapter 2800. A facility licensed as 'Assisted Living — Special Care' indicates a license type specifically for residents with dementia or Alzheimer's disease. Both PCH and ALR license types can serve memory care residents when the facility holds a DHS-recognized Special Care or Secure Dementia Care Unit designation.",
  },
  {
    q: "What is the difference between a Personal Care Home and an Assisted Living Residence in Pennsylvania?",
    a: "A Personal Care Home (PCH, Chapter 2600) provides room, board, personal care, and assistance with activities of daily living to residents who need supportive care but do not require nursing home-level services. An Assisted Living Residence (ALR, Chapter 2800) provides a higher level of care including nursing oversight, medication management, and more intensive personal care — appropriate for residents with greater medical and functional needs, including those with moderate-to-advanced dementia. Both license types can hold a memory care designation, but an ALR's staffing and care standards are more intensive.",
  },
  {
    q: "What do 'Special Care' and 'Secure Dementia Care Unit' mean on a Pennsylvania DHS record?",
    a: "These designations are recorded in the DHS Human Services Provider Directory under the 'Special Care/Secure Dementia Care Unit' column, based on the facility's disclosure to DHS OLTL. 'Special Care' indicates the facility operates a dedicated dementia-specific programming unit. 'Secure Dementia Care Unit' indicates a physically secured environment designed to prevent unsafe exits for residents with advanced dementia who are at elopement risk. Both are DHS-recognized — not self-reported marketing terms — and StarlynnCare indexes only facilities with one of these designations or an active ALR-Special Care license.",
  },
  {
    q: "How does PA DHS OLTL inspect memory care facilities?",
    a: "PA DHS OLTL conducts routine annual surveys and complaint investigations of all licensed PCHs and ALRs. Surveyors cite violations under the specific 55 Pa Code regulation section — each citation on a StarlynnCare profile includes the code reference. Enforcement escalates from correctable citations to Civil Money Penalties (monetary fines), Provisional License status (license downgraded, facility must correct within a set period), Substantiated Abuse findings, and in the most severe cases, Immediate Jeopardy findings or license revocation.",
  },
  {
    q: "Does Pennsylvania Medicaid cover memory care in a PCH or ALR?",
    a: "Pennsylvania Medicaid (Medical Assistance) does not cover room and board in a PCH or ALR. MA can fund personal care services for eligible residents through managed care organizations under HealthChoices, but not the facility's base daily rate. Families with limited resources should ask each facility about PA MA waiver participation, LIFE program availability (Living Independently for Elders, a PACE-equivalent program), and whether any county-funded options apply. Nursing facilities (SNFs) with secured dementia units do accept Medicaid for clinical care through a separate license — those are indexed separately on StarlynnCare.",
  },
  {
    q: "How is Pennsylvania memory care licensing different from California or Oregon?",
    a: "California licenses memory care under RCFEs regulated by CDSS, using a 'memory care disclosure' requirement and Type A/B deficiency severity labels. Oregon requires a separate DHS Memory Care Endorsement for dementia-specific programming in ALFs. Pennsylvania's DHS OLTL approach uses a PCH vs. ALR license structure with a Special Care / Secure Dementia Care Unit designation in the provider directory — there are no Type A/B California-style labels. PA DHS citations reference 55 Pa Code section numbers directly. Always check the state label on a StarlynnCare profile before comparing inspection records across states.",
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

export default function PaLicensingPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Pennsylvania", url: canonicalFor("/pennsylvania") },
      { name: "Pennsylvania guides", url: canonicalFor("/pennsylvania/guides") },
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
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <Link href="/pennsylvania" className="hover:text-teal transition-colors">
                Pennsylvania
              </Link>
              <span aria-hidden>›</span>
              <Link href="/pennsylvania/guides" className="hover:text-teal transition-colors">
                Guides
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care licensing</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Pennsylvania licensing guide · PA DHS OLTL regulation
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline className="border-b-0 pb-0 mb-0" />
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
                Pennsylvania licenses memory care as either a{" "}
                <strong className="font-medium text-ink">Personal Care Home (PCH)</strong> under 55
                Pa Code Chapter 2600, or an{" "}
                <strong className="font-medium text-ink">Assisted Living Residence (ALR)</strong>{" "}
                under Chapter 2800 — both regulated by PA DHS OLTL.
              </li>
              <li>
                The <strong className="font-medium text-ink">Special Care</strong> or{" "}
                <strong className="font-medium text-ink">Secure Dementia Care Unit</strong>{" "}
                designation in the DHS provider directory confirms dementia-specific programming —
                it is not a self-reported marketing claim.
              </li>
              <li>
                PA DHS does <strong className="font-medium text-ink">not</strong> use
                California&apos;s Type A/B severity labels. Each citation references a specific 55
                Pa Code section. Enforcement escalates from citations to Civil Money Penalties,
                Provisional License status, and Revocation.
              </li>
              <li>
                Pennsylvania Medicaid does{" "}
                <strong className="font-medium text-ink">not</strong> cover room and board in a PCH
                or ALR — MA funds services only through HealthChoices managed care.
              </li>
            </ul>
          </aside>

          <H2 id="license-types">PCH vs. ALR: two license types, one oversight agency</H2>
          <Prose>
            <p>
              Pennsylvania&apos;s DHS Office of Long-Term Living (OLTL) licenses two types of
              residential care settings where memory care is provided:
            </p>
            <p>
              A <strong className="font-medium text-ink">Personal Care Home (PCH)</strong> under 55
              Pa Code Chapter 2600 serves adults who need help with activities of daily living,
              medications, and personal care — but who do not require nursing-home-level services.
              PCHs are the most common setting for dementia care in Pennsylvania, covering a wide
              range of sizes from small residential homes to larger institutional buildings.
            </p>
            <p>
              An{" "}
              <strong className="font-medium text-ink">Assisted Living Residence (ALR)</strong>{" "}
              under 55 Pa Code Chapter 2800 provides a higher level of care including nursing
              oversight, more intensive personal care services, and capacity to handle residents with
              greater medical complexity. ALRs are typically larger facilities with more structured
              clinical programming. A facility licensed specifically as{" "}
              <strong className="font-medium text-ink">Assisted Living — Special Care</strong> has a
              license type DHS issues explicitly for dementia and Alzheimer&apos;s care.
            </p>
            <p>
              Both license types are subject to the same DHS OLTL inspection and enforcement
              framework. The regulatory difference between a PCH and an ALR is primarily in staffing
              ratios, nursing requirements, and the complexity of care they are authorized to
              provide — not in whether they can serve residents with dementia.
            </p>
          </Prose>

          <H2 id="special-care">The Special Care and Secure Dementia Care Unit designations</H2>
          <Prose>
            <p>
              The DHS Human Services Provider Directory includes a{" "}
              <strong className="font-medium text-ink">Special Care / Secure Dementia Care Unit</strong>{" "}
              column for each licensed facility. This designation is recorded by DHS based on the
              facility&apos;s disclosed programming — it is not a self-reported marketing claim on
              the facility&apos;s own website.
            </p>
            <p>
              A <strong className="font-medium text-ink">Special Care</strong> designation indicates
              the facility operates a dedicated unit or programming model for residents with
              dementia, including structured activities, dementia-trained staff, and a physical
              environment adapted for cognitive impairment.
            </p>
            <p>
              A{" "}
              <strong className="font-medium text-ink">Secure Dementia Care Unit</strong> indicates
              a physically secured environment — controlled exits, alarmed doors, or enclosed
              courtyards — designed to prevent unsafe elopement for residents with advanced dementia
              who are at risk of wandering. This is relevant for families whose loved one has
              demonstrated exit-seeking behavior.
            </p>
            <p>
              StarlynnCare indexes only facilities with one of these designations, or facilities
              with an active Assisted Living — Special Care license type. If a facility is not
              indexed here, it either does not hold a DHS-recognized dementia designation or is not
              yet in our coverage area.
            </p>
          </Prose>

          <H2 id="inspections">How PA DHS OLTL inspects memory care facilities</H2>
          <Prose>
            <p>
              DHS OLTL conducts routine annual surveys and complaint investigations of all licensed
              PCHs and ALRs. Inspection teams cite violations under specific 55 Pa Code sections —
              each citation on a StarlynnCare profile shows the regulation cited (e.g.,{" "}
              <span className="font-[family-name:var(--font-mono)] text-[14px]">
                55 Pa Code § 2600.171
              </span>
              ), a plain-language description, and the severity classification.
            </p>
            <p>
              Enforcement escalates along a clear hierarchy:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="font-medium text-ink">Citation</strong> — a correctable finding
                with no monetary penalty; the facility must submit a Plan of Correction.
              </li>
              <li>
                <strong className="font-medium text-ink">Civil Money Penalty (CMP)</strong> — a
                monetary fine imposed when DHS finds a violation serious enough to warrant financial
                accountability.
              </li>
              <li>
                <strong className="font-medium text-ink">Provisional License</strong> — the
                facility&apos;s license is downgraded to provisional status while it corrects
                identified deficiencies; a provisional license is a significant signal of ongoing
                compliance failure.
              </li>
              <li>
                <strong className="font-medium text-ink">Substantiated Abuse</strong> — a finding
                that abuse or neglect occurred and has been substantiated by DHS investigation.
              </li>
              <li>
                <strong className="font-medium text-ink">Immediate Jeopardy</strong> — a finding
                that residents face an immediate risk to life or safety.
              </li>
              <li>
                <strong className="font-medium text-ink">Revocation</strong> — the facility&apos;s
                license is refused or revoked.
              </li>
            </ul>
            <p>
              Pennsylvania does not use California&apos;s Type A / Type B deficiency labels, nor
              Minnesota&apos;s correction order terminology. Inspection language is PA DHS
              vocabulary — always check the state label on a StarlynnCare profile.
            </p>
          </Prose>

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
            source="Pennsylvania DHS OLTL Human Services Provider Directory (2026); 55 Pa Code Chapter 2600 (Personal Care Homes) and Chapter 2800 (Assisted Living Residences); Pennsylvania HealthChoices managed care program"
            refreshed="2026-06-02"
          />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/pennsylvania/memory-care-vs-nursing-home"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  Memory care vs. nursing home in Pennsylvania
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
              href="/pennsylvania/guides"
              className="mt-4 inline-block text-[14px] text-teal hover:underline"
            >
              ← All Pennsylvania guides
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
