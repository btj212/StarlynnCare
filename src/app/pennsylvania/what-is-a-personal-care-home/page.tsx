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

const PAGE_PATH = "/pennsylvania/what-is-a-personal-care-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "What is a Personal Care Home in Pennsylvania?";
const TITLE =
  "What Is a Personal Care Home in Pennsylvania? PCH Definition, Licensing & Inspections";
const DESC =
  "A Personal Care Home (PCH) is a Pennsylvania DHS-licensed residential care facility for adults who need help with daily living — not nursing-home-level care. Here is how PCHs are licensed, inspected, and what to look for.";
const DATE_PUBLISHED = "2026-06-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is a Personal Care Home in Pennsylvania?",
    a: "A Personal Care Home (PCH) is a residential care facility licensed by the Pennsylvania Department of Human Services (DHS) under 55 Pa Code Chapter 2600. PCHs provide room, board, personal care, and assistance with activities of daily living (ADLs) — bathing, dressing, grooming, medication management — for adults who need supportive care but do not require 24-hour skilled nursing. Many PCHs serve residents with dementia or Alzheimer's disease, and those with a DHS-recognized Special Care or Secure Dementia Care Unit designation operate dedicated memory care programming.",
  },
  {
    q: "How is a Personal Care Home different from an Assisted Living Residence in Pennsylvania?",
    a: "Pennsylvania licenses two types of residential care: Personal Care Homes (PCH, Chapter 2600) and Assisted Living Residences (ALR, Chapter 2800). A PCH is designed for residents who need personal care assistance but do not require continuous nursing. An ALR provides a higher level of care including nursing oversight, more intensive medication management, and the ability to serve residents with greater medical complexity — including those with moderate-to-advanced dementia. Both can hold a memory care designation, but an ALR's staffing and care standards are more intensive than a PCH. When comparing facilities, check both the license type and whether a Special Care designation is active.",
  },
  {
    q: "What does a 'Special Care' or 'Secure Dementia Care Unit' designation mean?",
    a: "These designations appear in the DHS Human Services Provider Directory and on StarlynnCare facility profiles. 'Special Care' means the facility has disclosed to DHS OLTL that it operates dementia-specific programming. 'Secure Dementia Care Unit' means the unit is physically secured to prevent unsafe exits for residents at elopement risk. Both designations are DHS-recognized — not self-reported marketing terms. StarlynnCare indexes only facilities with one of these designations or an active Assisted Living — Special Care license type.",
  },
  {
    q: "Who inspects Personal Care Homes in Pennsylvania?",
    a: "PA DHS Office of Long-Term Living (OLTL) inspects all licensed PCHs and ALRs. Surveyors conduct routine annual inspections and respond to complaints. Citations reference the specific 55 Pa Code regulation section violated. Enforcement escalates from correctable citations to Civil Money Penalties, Provisional License status, Immediate Jeopardy findings, and in the most severe cases, license revocation. StarlynnCare publishes these DHS OLTL inspection records for each PA facility profile.",
  },
  {
    q: "Does Pennsylvania Medicaid pay for a Personal Care Home?",
    a: "Pennsylvania Medicaid (Medical Assistance) does not cover room and board in a PCH or ALR. MA can fund personal care services for eligible residents through HealthChoices managed care organizations, but not the facility's base daily rate. The LIFE program (Living Independently for Elders, a PACE-equivalent) provides more comprehensive coverage at enrolled sites for residents who meet nursing-facility level of care criteria — but LIFE sites are limited. Families who need Medicaid to cover room and board should ask about Medicaid-certified nursing homes with secured dementia units as an alternative.",
  },
  {
    q: "Is a Personal Care Home the same as assisted living in other states?",
    a: "Not exactly. Pennsylvania's 'Personal Care Home' license is roughly equivalent to what most states call 'assisted living,' but the name and regulatory framework differ. In California, these are Residential Care Facilities for the Elderly (RCFEs) regulated by CDSS. In Oregon, they are Assisted Living Facilities regulated by DHS. In Texas, Assisted Living Facilities are regulated by HHSC. When reading inspection records across states on StarlynnCare, always check the state label — a PA DHS citation uses different terminology and severity labels than a CA CDSS citation or a CMS F-tag.",
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: canonicalUrl,
    type: "article",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
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

export default function WhatIsAPersonalCareHomePage() {
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
      { name: "What is a Personal Care Home?", url: canonicalUrl },
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
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/pennsylvania" className="hover:text-teal transition-colors">Pennsylvania</Link>
              <span aria-hidden>›</span>
              <Link href="/pennsylvania/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">What is a Personal Care Home?</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Pennsylvania explainer · PA DHS OLTL · 55 Pa Code Ch 2600
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
                A <strong className="font-medium text-ink">Personal Care Home (PCH)</strong> is
                licensed by <strong className="font-medium text-ink">PA DHS OLTL</strong> under
                55 Pa Code Chapter 2600. It provides room, board, and personal care — not
                nursing-home-level medical care.
              </li>
              <li>
                PCHs with a{" "}
                <strong className="font-medium text-ink">Special Care or Secure Dementia Care Unit</strong>{" "}
                designation are the memory care tier StarlynnCare indexes for Pennsylvania.
              </li>
              <li>
                Inspections are conducted by DHS OLTL surveyors, who cite violations by
                specific 55 Pa Code regulation section. Records are public and indexed on every
                StarlynnCare PA facility profile.
              </li>
              <li>
                <strong className="font-medium text-ink">Pennsylvania Medicaid does not pay
                room and board</strong> in a PCH — MA can fund personal care services only.
              </li>
            </ul>
          </aside>

          <H2 id="definition">What a Personal Care Home is licensed to do</H2>
          <Prose>
            <p>
              A Personal Care Home is a category of residential care licensed by the Pennsylvania
              Department of Human Services (DHS), Office of Long-Term Living (OLTL), under
              55 Pa Code Chapter 2600. The license authorizes the facility to provide room, board,
              supervision, and assistance with activities of daily living — bathing, dressing,
              grooming, toileting, and mobility — for adults who need supportive care but do not
              require continuous nursing, physician oversight, or skilled nursing interventions.
            </p>
            <p>
              Many PCH residents have dementia or Alzheimer&apos;s disease. A PCH that focuses
              on memory care must hold one of two DHS-recognized designations: a{" "}
              <strong className="font-medium text-ink">Special Care</strong> designation (dementia-specific
              programming) or a <strong className="font-medium text-ink">Secure Dementia Care Unit</strong>{" "}
              designation (a physically secured unit for residents at elopement risk). These are
              recorded in the DHS Human Services Provider Directory — not self-reported marketing
              terms — and StarlynnCare indexes only facilities with one of these designations or
              an active Assisted Living — Special Care license.
            </p>
            <p>
              A PCH is not licensed to provide 24-hour skilled nursing, IV therapy, ventilator
              care, or post-acute rehabilitation. Residents whose medical complexity exceeds
              what the Chapter 2600 license permits must transfer to a licensed nursing facility
              (SNF) or to a higher-acuity Assisted Living Residence (Chapter 2800).
            </p>
          </Prose>

          <H2 id="pch-vs-alr">PCH vs. Assisted Living Residence — the PA distinction</H2>
          <Prose>
            <p>
              Pennsylvania licenses two categories of residential care that overlap with what
              other states call &quot;assisted living.&quot;
            </p>
            <p>
              A <strong className="font-medium text-ink">Personal Care Home (Chapter 2600)</strong>{" "}
              is the entry-level residential care license. It is appropriate for residents who need
              personal care and supervision but are medically stable. Staffing requirements under
              Chapter 2600 are less intensive than those for an ALR.
            </p>
            <p>
              An <strong className="font-medium text-ink">Assisted Living Residence (Chapter 2800)</strong>{" "}
              provides a higher level of care — including nursing oversight, medication management by
              licensed nurses, and the ability to serve residents with more complex medical and
              functional needs. The <em>Assisted Living — Special Care</em> license type specifically
              designates a facility focused on dementia care. ALRs face more intensive staffing and
              physical plant requirements than PCHs.
            </p>
            <p>
              Both license types can carry a Special Care or Secure Dementia Care Unit designation.
              When reviewing a PA facility on StarlynnCare, the license type (PCH or ALR) and
              the Special Care status both appear on the profile — check both before drawing
              conclusions about care level.
            </p>
          </Prose>

          <H2 id="inspections">How PA DHS inspects Personal Care Homes</H2>
          <Prose>
            <p>
              PA DHS OLTL surveyors conduct routine annual inspections of all licensed PCHs and
              ALRs, plus complaint investigations when a concern is reported. During a survey,
              inspectors assess compliance with 55 Pa Code Chapter 2600 across resident care,
              staffing, medication management, physical environment, and administrative requirements.
            </p>
            <p>
              Each citation identifies the specific regulation section violated — for example,
              a citation for a medication error might reference § 2600.166 (administration of
              medication). Enforcement escalates from correctable citations to Civil Money
              Penalties (monetary fines), Provisional License status (license downgraded, corrective
              action required within a set period), Substantiated Abuse findings, and Immediate
              Jeopardy findings for violations placing residents at serious risk of harm. License
              revocation is the most severe outcome.
            </p>
            <p>
              StarlynnCare publishes these DHS OLTL inspection records in full on each PA facility
              profile, including the regulation citation, the finding, and the enforcement
              classification. No marketing copy — only the public record.
            </p>
          </Prose>

          <H2 id="why-terminology-matters">Why terminology matters when comparing across states</H2>
          <Prose>
            <p>
              Pennsylvania&apos;s &quot;Personal Care Home&quot; is roughly equivalent to what most
              states call &quot;assisted living,&quot; but the name, regulations, and inspection
              framework differ significantly by state. Families who have experience with memory
              care in California (RCFEs, regulated by CDSS), Oregon (ALFs with Memory Care
              Endorsement), or Texas (ALFs regulated by HHSC) will find that the PA PCH/ALR
              structure uses different terminology, different citation labels, and a different
              Medicaid funding framework.
            </p>
            <p>
              When reading inspection records on StarlynnCare, the state label on each profile
              identifies which regulatory system applies. A 55 Pa Code citation in a PA DHS record
              is not directly comparable to a Type A/B deficiency in a California CDSS record or
              an F-tag in a federal CMS nursing home record. Focus on severity trends within each
              facility&apos;s own history and relative to its state peer group.
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
            source="Pennsylvania DHS OLTL; 55 Pa Code Chapters 2600 and 2800; PA DHS Human Services Provider Directory; Pennsylvania HealthChoices managed care; PA LIFE program (PACE)"
            refreshed={DATE_PUBLISHED}
          />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/pennsylvania/personal-care-home-vs-assisted-living"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  Personal care home vs. assisted living in Pennsylvania
                </p>
              </Link>
              <Link
                href="/pennsylvania/memory-care-licensing"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  Pennsylvania memory care licensing — PCH vs. ALR
                </p>
              </Link>
              <Link
                href="/pennsylvania/personal-care-home-cost"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  What does a personal care home cost in Pennsylvania?
                </p>
              </Link>
              <Link
                href="/pennsylvania/facilities"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  Browse all Pennsylvania memory care facilities
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
