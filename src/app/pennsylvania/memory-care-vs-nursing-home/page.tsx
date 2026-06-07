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

const PAGE_PATH = "/pennsylvania/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Memory care vs. nursing home in Pennsylvania — DHS-licensed PCH/ALR vs. DOH-licensed SNF";
const TITLE =
  "Memory Care vs. Nursing Home in Pennsylvania: PCH, ALR, and SNF Compared — 2026";
const DESC =
  "Pennsylvania licenses memory care through DHS OLTL (PCH/ALR) and nursing homes through DOH/CMS. Two different regulators, two different inspection records, and different Medicaid funding. Here is how to choose.";
const DATE_PUBLISHED = "2026-06-02";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Who regulates memory care facilities vs. nursing homes in Pennsylvania?",
    a: "Memory care in Personal Care Homes (PCH) and Assisted Living Residences (ALR) is regulated by the Pennsylvania Department of Human Services (DHS), Office of Long-Term Living (OLTL), under 55 Pa Code Chapters 2600 and 2800. Skilled nursing facilities (SNFs) — commonly called nursing homes — are regulated by the Pennsylvania Department of Health (DOH) and, for Medicare/Medicaid-certified facilities, by the federal Centers for Medicare & Medicaid Services (CMS). These are separate licensing agencies with separate inspection records and separate enforcement frameworks.",
  },
  {
    q: "How are nursing home inspections different from PCH/ALR inspections in Pennsylvania?",
    a: "PA DOH and CMS inspect nursing homes using the federal survey protocol and cite deficiencies using federal F-tags (F500, F600, etc.) with a scope-severity grid (A through L). DHS OLTL inspects PCHs and ALRs under 55 Pa Code, citing specific regulation sections without federal F-tag numbering. StarlynnCare indexes DHS OLTL inspection records for PCH/ALR profiles and CMS Care Compare data for nursing home profiles — the two inspection systems are not directly comparable, and a deficiency listed on a PCH profile uses different terminology than one on a nursing home profile.",
  },
  {
    q: "Does Pennsylvania Medicaid cover memory care in a PCH or ALR?",
    a: "Pennsylvania Medicaid (Medical Assistance) does not pay room and board in a PCH or ALR. MA can fund personal care services through HealthChoices managed care organizations for eligible residents, but not the daily base rate. By contrast, nursing homes that are certified for Medicaid do accept MA to cover clinical care and room and board for Medicaid-eligible residents. If Medicaid is a primary payer consideration, a nursing home with a secured dementia unit may be the more feasible option — but the care environment, programming, and regulatory framework differ significantly from a PCH/ALR memory care setting.",
  },
  {
    q: "What level of care does each setting provide?",
    a: "Memory care in a PCH (Chapter 2600) is for residents who need help with activities of daily living, medications, and personal care but do not require continuous nursing or medical intervention. ALRs (Chapter 2800) provide a higher level of personal care with nursing oversight and can handle more complex residents. Skilled nursing facilities provide 24-hour nursing care, wound care, IV therapy, post-acute rehabilitation, and clinical monitoring. Families often move from a PCH or ALR memory care setting to a nursing home when a resident's medical needs escalate beyond what the state license permits in the residential setting.",
  },
  {
    q: "Can a nursing home have a memory care unit in Pennsylvania?",
    a: "Yes. Some Pennsylvania nursing homes operate secured dementia care units within their licensed skilled nursing facility. These units are inspected by PA DOH and CMS as part of the nursing home survey, not by DHS OLTL. The care environment in a nursing home memory care unit is more clinical than a standalone PCH or ALR — registered nurses, CNAs, and medical staff are present around the clock, and the unit typically includes more intensive health monitoring. Families who prefer a homelike residential environment often prefer PCH/ALR settings; families whose loved one needs continuous medical oversight may find a nursing home unit more appropriate.",
  },
  {
    q: "How do I read a Pennsylvania facility profile on StarlynnCare?",
    a: "PA DHS OLTL profiles show inspection records sourced from DHS OLTL inspection PDFs, parsed and dated with the specific 55 Pa Code citation for each deficiency. Severity chips show the DHS classification — Citation, Civil Money Penalty, Provisional License, Substantiated Abuse, Immediate Jeopardy, or Revocation. The peer percentile positions the facility against other PA DHS-regulated memory care facilities in its county. If the profile also shows CMS data (for nursing facilities with dementia units), those inspections are labeled separately with the CMS source designation.",
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

export default function PaVsNursingHomePage() {
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
              <Link href="/pennsylvania" className="hover:text-teal transition-colors">
                Pennsylvania
              </Link>
              <span aria-hidden>›</span>
              <Link href="/pennsylvania/guides" className="hover:text-teal transition-colors">
                Guides
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care vs. nursing home</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Pennsylvania decision guide · PA DHS vs. PA DOH + CMS
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
                PA memory care in a PCH/ALR is regulated by{" "}
                <strong className="font-medium text-ink">DHS OLTL</strong> (55 Pa Code Ch 2600/2800).
                Nursing homes are regulated by{" "}
                <strong className="font-medium text-ink">PA DOH + CMS</strong>. Different agencies,
                different inspection records.
              </li>
              <li>
                <strong className="font-medium text-ink">Medicaid covers room and board</strong> in
                a Medicaid-certified nursing home — it does{" "}
                <strong className="font-medium text-ink">not</strong> cover the base rate in a PCH
                or ALR (MA can fund services only).
              </li>
              <li>
                PCH/ALR memory care is a{" "}
                <strong className="font-medium text-ink">residential</strong> setting with personal
                care and dementia programming. A nursing home provides 24-hour nursing, clinical
                monitoring, and post-acute medical care.
              </li>
              <li>
                The right choice depends on your loved one&apos;s{" "}
                <strong className="font-medium text-ink">medical complexity</strong>, your
                payer situation, and what the inspection records reveal about operator quality.
              </li>
            </ul>
          </aside>

          <H2 id="two-regulators">Two regulators, two inspection records</H2>
          <Prose>
            <p>
              In Pennsylvania, memory care and skilled nursing are regulated by separate state
              agencies under separate statutes — and families comparing them need to understand that
              the two inspection records are not directly comparable.
            </p>
            <p>
              <strong className="font-medium text-ink">PCH/ALR memory care</strong> is regulated by
              the Department of Human Services (DHS), Office of Long-Term Living (OLTL). DHS
              inspectors cite violations under 55 Pa Code Chapter 2600 (PCH) or Chapter 2800 (ALR),
              referencing specific regulation sections. Enforcement ranges from correctable citations
              to Civil Money Penalties and Provisional License status. StarlynnCare indexes DHS OLTL
              inspection PDFs for each profile.
            </p>
            <p>
              <strong className="font-medium text-ink">Skilled nursing facilities (SNFs)</strong>{" "}
              — nursing homes — are regulated by the Pennsylvania Department of Health (DOH) and by
              CMS for Medicare/Medicaid-certified facilities. CMS inspections use federal F-tags
              with a scope-severity grid (A through L); PA DOH conducts its own licensing surveys.
              CMS publishes this data on Care Compare. StarlynnCare uses CMS data for nursing
              facility profiles when available.
            </p>
            <p>
              A citation on a DHS PCH profile and an F-tag on a CMS nursing home profile are
              different regulatory constructs. Do not attempt a direct numerical comparison between
              them — focus instead on severity trends within each facility&apos;s own record and
              relative to its peer group.
            </p>
          </Prose>

          <H2 id="care-levels">Care level: what each setting provides</H2>
          <Prose>
            <p>
              A PCH under Chapter 2600 is authorized to serve residents who need help with
              activities of daily living and personal care — but not residents who require
              continuous nursing or medical intervention beyond what personal care staff can provide.
              Many residents with mild-to-moderate dementia thrive in a well-run PCH.
            </p>
            <p>
              An ALR under Chapter 2800 provides a higher level of care with nursing oversight and
              can manage residents with more complex needs, including those with moderate-to-advanced
              dementia. The Assisted Living — Special Care license type is DHS&apos;s explicit
              designation for facilities focused on dementia care.
            </p>
            <p>
              A skilled nursing facility provides 24-hour licensed nursing, physician oversight,
              wound care, IV therapy, post-acute rehabilitation, and full clinical monitoring. A
              nursing home memory care unit within an SNF combines this clinical infrastructure
              with secured dementia-specific programming. Residents who require tube feeding,
              ventilator care, or frequent skilled nursing interventions typically need an SNF — a
              PCH or ALR is not licensed to provide that level of care.
            </p>
            <p>
              Families often begin in a PCH or ALR memory care setting and transition to a nursing
              home when a resident&apos;s medical complexity increases beyond what the DHS license
              permits. Planning for that transition — asking facilities about their discharge policy,
              their relationship with nearby SNFs, and their process for transferring records —
              should be part of your initial tour questions.
            </p>
          </Prose>

          <H2 id="medicaid">Medicaid and payer differences</H2>
          <Prose>
            <p>
              This is the most practical difference for many Pennsylvania families:
            </p>
            <p>
              <strong className="font-medium text-ink">Pennsylvania Medicaid does not cover room
              and board in a PCH or ALR.</strong> Medical Assistance (MA) can fund personal care
              services through HealthChoices managed care for eligible residents, but the
              facility&apos;s daily base rate must be paid privately or through other sources.
              The LIFE program (Living Independently for Elders) provides a more comprehensive
              benefit at PACE-enrolled facilities for residents who meet nursing-facility level of
              care — but LIFE sites are limited and enrollment requires meeting income/functional
              eligibility criteria.
            </p>
            <p>
              <strong className="font-medium text-ink">Medicaid-certified nursing homes</strong>{" "}
              accept MA for room and board for eligible residents. For families whose financial
              resources are limited, a Medicaid-certified SNF with a secured dementia unit may be
              the only viable long-term option — even if a PCH or ALR would be a preferred care
              environment. Confirm MA certification status with each facility directly.
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
            source="Pennsylvania DHS OLTL; 55 Pa Code Chapters 2600 and 2800; Pennsylvania Department of Health; CMS Care Compare; Pennsylvania HealthChoices managed care; PA LIFE program (PACE)"
            refreshed="2026-06-02"
          />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
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
                href="/library/when-is-it-time-for-memory-care"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  All states
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  When is it time for memory care?
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
