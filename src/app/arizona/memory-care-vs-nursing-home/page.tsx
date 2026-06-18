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

const PAGE_PATH = "/arizona/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Memory care vs. nursing home in Arizona — ADHS vs. CMS, two regulators, two inspection records";
const TITLE = "Memory Care vs. Nursing Home in Arizona (ADHS vs. CMS) — 2026";
const DESC =
  "Arizona ALH/ALC memory care is regulated by ADHS BRFL; nursing homes (SNFs) are regulated by CMS and ADHS Health Facility Licensing. Different regulators, different inspection records, and different ALTCS Medicaid funding — here is how to compare them.";
const DATE_PUBLISHED = "2026-06-15";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the difference between memory care and a nursing home in Arizona?",
    a: "Memory care in Arizona is typically provided in a Directed Care Assisted Living Home (ALH) or Assisted Living Center (ALC) licensed by ADHS BRFL under A.A.C. R9-10-800. These are residential settings offering personal care, medication management, and dementia-specific programming. A Skilled Nursing Facility (SNF) — commonly called a nursing home — is regulated by CMS and ADHS Health Facility Licensing and provides clinical nursing and medical services 24 hours a day, including IV therapy, wound care, and ventilator support. An SNF is appropriate when a resident requires ongoing medical intervention that an ALH or ALC is not licensed to safely provide.",
  },
  {
    q: "Who regulates memory care in Arizona vs. nursing homes?",
    a: "Arizona ALHs and ALCs are regulated by ADHS Bureau of Residential Facilities Licensing (BRFL) under A.A.C. Title 9, Chapter 10. Nursing homes (SNFs) are regulated jointly by CMS at the federal level and ADHS Health Facility Licensing at the state level under A.R.S. § 36-401 and A.A.C. R9-10-200 series. These are entirely separate inspection systems — StarlynnCare shows ADHS BRFL records for Arizona memory care facilities; CMS Care Compare shows nursing home inspection data separately.",
  },
  {
    q: "How does Medicaid funding differ between memory care and nursing homes in Arizona?",
    a: "Arizona Long Term Care System (ALTCS), administered by AHCCCS, can fund memory care in contracted Directed Care ALHs and ALCs for eligible residents. Nursing home stays can be funded by ALTCS through a separate nursing facility benefit track. ALTCS eligibility is determined through a functional assessment; benefit scope differs between residential memory care and nursing facility settings. Not all ALHs and ALCs have ALTCS contracts — ask about contract status and bed availability during your visit.",
  },
  {
    q: "When does someone need a nursing home rather than memory care?",
    a: "A nursing home becomes necessary when a resident requires daily skilled nursing care — such as IV medications, tube feeding, wound debridement, respiratory therapy, or skilled physical/occupational/speech therapy following hospitalization. Arizona ALHs and ALCs are not licensed to provide these clinical services. Typical triggers include post-acute recovery needs, medically complex conditions requiring 24-hour nursing oversight, or a combination of medical and mobility needs that exceed what residential memory care can safely manage. A geriatrician or hospital discharge planner can help assess the appropriate level of care.",
  },
  {
    q: "Does Arizona have special protections for memory care residents in ALHs and ALCs?",
    a: "Yes. The Directed Care license level requires ADHS to verify that the facility is equipped and staffed to serve cognitively impaired residents — including secured environments, trained staff, and individualized care plans. HB2764 (effective 2025) adds an optional Memory Care subclass with enhanced dementia-specific standards. Arizona also operates a Long-Term Care Ombudsman program that advocates for residents in both residential care settings and nursing homes.",
  },
  {
    q: "How does Arizona's system compare to California's?",
    a: "California uses a single RCFE (Residential Care Facility for the Elderly) license type regulated by CDSS, with Type A / Type B deficiency severity classification. Arizona uses two ALF license types (ALH and ALC) with care levels (Directed/Personal/Supervisory) and a newer HB2764 Memory Care subclass, all regulated by ADHS BRFL. Medicaid access differs: California uses the ALW (Assisted Living Waiver), Arizona uses ALTCS. The federal CMS inspection system for nursing homes is the same in both states. When reading a StarlynnCare profile, always note the state to interpret regulatory context correctly.",
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
    { attr: "Setting", mc: "ALH or ALC (Directed Care)", nh: "Skilled Nursing Facility (SNF)" },
    { attr: "Regulator", mc: "ADHS BRFL (A.A.C. R9-10-800)", nh: "CMS + ADHS Health Facility Licensing" },
    { attr: "Clinical services", mc: "Personal care, medication mgmt, dementia programming", nh: "24/7 nursing, IV, wound care, ventilator, skilled therapy" },
    { attr: "Medicaid", mc: "ALTCS (contracted facilities)", nh: "ALTCS nursing facility benefit" },
    { attr: "MC endorsement", mc: "Directed Care level required; HB2764 subclass optional", nh: "CMS Memory Care Program (voluntary)" },
    { attr: "Inspection source", mc: "AZ Care Check (ADHS BRFL)", nh: "CMS Care Compare (federal)" },
    { attr: "StarlynnCare indexes?", mc: "Yes — Directed Care only", nh: "Not indexed (use Care Compare)" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[540px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[170px]">Factor</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Memory care (ALH/ALC)</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Nursing home (SNF)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.attr} className="border-t border-paper-rule" style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}>
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">{row.attr}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.mc}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.nh}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AzNursingHomeComparisonPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Arizona", url: canonicalFor("/arizona") },
      { name: "Arizona guides", url: canonicalFor("/arizona/guides") },
      { name: "Memory care vs. nursing home", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav badge="Arizona" ctaHref="/arizona/facilities" ctaLabel="Arizona memory care facilities" stateNavHref="/arizona" />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/arizona" className="hover:text-teal transition-colors">Arizona</Link>
              <span aria-hidden>›</span>
              <Link href="/arizona/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care vs. nursing home</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Arizona decision guide · ADHS vs. CMS
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
                Arizona memory care (ALH/ALC, Directed Care) is regulated by{" "}
                <strong className="font-medium text-ink">ADHS Bureau of Residential Facilities Licensing</strong> — inspection records appear on AZ Care Check.
              </li>
              <li>
                Arizona nursing homes (SNFs) are regulated by{" "}
                <strong className="font-medium text-ink">CMS (federal)</strong> and ADHS Health Facility Licensing — inspection records appear on CMS Care Compare.
              </li>
              <li>
                These are <strong className="font-medium text-ink">entirely separate inspection systems</strong> — you must look at both if you are comparing different setting types.
              </li>
              <li>
                A nursing home is appropriate when someone needs 24-hour skilled nursing care. Memory care ALH/ALC is appropriate for dementia residents who do not need that level of clinical intervention.
              </li>
            </ul>
          </aside>

          <H2 id="two-regulators">Two regulators, two inspection systems</H2>
          <Prose>
            <p>
              When a family in Arizona is deciding between a memory care community and a nursing home, they are
              comparing facilities regulated by completely different agencies. Getting this right matters — the
              inspection records that tell you about quality are in different places.
            </p>
            <p>
              Arizona Directed Care ALHs and ALCs fall under ADHS Bureau of Residential Facilities Licensing (BRFL).
              Their inspection records are published on AZ Care Check (azcarecheck.azdhs.gov) and indexed by
              StarlynnCare. Arizona nursing homes (SNFs) are regulated at the federal level by CMS and at the state
              level by ADHS Health Facility Licensing — their inspection records appear on CMS Care Compare
              (medicare.gov/care-compare), a separate system entirely.
            </p>
          </Prose>

          <ComparisonTable />

          <H2 id="when-nursing-home">When someone needs a nursing home</H2>
          <Prose>
            <p>
              A nursing home (SNF) is appropriate when a resident requires daily skilled nursing care that a Directed
              Care ALH or ALC is not licensed to provide. Common clinical triggers include:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Post-acute recovery requiring skilled nursing and skilled therapy after hospitalization</li>
              <li>IV medications or infusion therapy</li>
              <li>Wound care requiring licensed nursing assessment and treatment</li>
              <li>Tube feeding or complex nutrition management</li>
              <li>Ventilator management or complex respiratory therapy</li>
              <li>Behavioral health conditions requiring 24-hour nursing oversight</li>
            </ul>
            <p>
              Many families find that a Directed Care ALC can meet a dementia resident&apos;s needs for years before
              transitioning to a SNF level of care — if ever. A geriatrician or hospital discharge planner is the
              right person to assess which setting is clinically appropriate for a specific resident.
            </p>
          </Prose>

          <H2 id="altcs-medicaid">ALTCS Medicaid: how funding differs</H2>
          <Prose>
            <p>
              Arizona Long Term Care System (ALTCS), administered by AHCCCS, funds long-term care for eligible
              residents through managed care organizations. ALTCS can fund both residential memory care in contracted
              Directed Care ALHs/ALCs and nursing home stays — but through different benefit tracks with different
              eligibility and reimbursement structures.
            </p>
            <p>
              For memory care in an ALH or ALC, the facility must hold an active ALTCS contract. Availability of
              ALTCS beds varies widely by facility and region. For nursing home care, ALTCS pays through a separate
              nursing facility rate structure. In all cases, eligibility is determined through an AHCCCS functional
              assessment — not every applicant qualifies.
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

          <DataFootnote
            source="ADHS BRFL (A.A.C. R9-10-800); CMS Nursing Home Compare; AHCCCS Arizona Long Term Care System (ALTCS); A.R.S. § 36-401"
            refreshed={DATE_PUBLISHED}
          />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/arizona/memory-care-licensing"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Arizona</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Arizona memory care licensing — ALH, ALC & Directed Care</p>
              </Link>
              <Link
                href="/library/37-questions-to-ask-on-a-memory-care-tour"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">All states</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">37 questions to ask on a memory care tour</p>
              </Link>
            </div>
            <Link href="/arizona/guides" className="mt-4 inline-block text-[14px] text-teal hover:underline">
              ← All Arizona guides
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
