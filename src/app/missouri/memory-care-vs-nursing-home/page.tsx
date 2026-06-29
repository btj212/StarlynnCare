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

const PAGE_PATH = "/missouri/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Memory care vs. nursing home in Missouri — DHSS ALF/RCF vs. SNF/ICF, two regulators, two inspection records";
const TITLE = "Memory Care vs. Nursing Home in Missouri (DHSS ALF vs. SNF) — 2026";
const DESC =
  "Missouri ALF/RCF memory care is regulated by DHSS Section for Long-Term Care Regulation; nursing homes (SNF/ICF) are regulated by DHSS and CMS. Different regulators, different inspection records, and different MO HealthNet Medicaid coverage — here is how to compare them.";
const DATE_PUBLISHED = "2026-06-28";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the difference between memory care and a nursing home in Missouri?",
    a: "Memory care in Missouri is typically provided in an Assisted Living Facility (ALF) or Residential Care Facility (RCF) licensed by DHSS Section for Long-Term Care Regulation under Chapter 198 RSMo and 19 CSR 30. These are residential settings offering personal care assistance, medication management, and — where the Alzheimer's SCU disclosure is filed — dementia-specific programming. A Skilled Nursing Facility (SNF) or Intermediate Care Facility (ICF) — commonly called a nursing home — provides clinical nursing and medical services 24 hours a day, including IV therapy, wound care, and skilled rehabilitation. An SNF/ICF is appropriate when a resident requires ongoing medical intervention that a residential ALF or RCF is not licensed to safely provide.",
  },
  {
    q: "Who regulates memory care facilities vs. nursing homes in Missouri?",
    a: "Missouri ALFs and RCFs are regulated by DHSS Section for Long-Term Care Regulation under Chapter 198 RSMo and 19 CSR 30. Nursing homes (SNFs and ICFs) are regulated jointly by CMS at the federal level and by DHSS under a separate regulatory framework (19 CSR 15 and Chapter 198 RSMo). These are entirely separate inspection systems with different survey schedules, deficiency citation frameworks, and public data sources. StarlynnCare indexes DHSS ALF/RCF records; CMS Care Compare shows nursing home inspection data separately.",
  },
  {
    q: "How does MO HealthNet (Medicaid) funding differ between memory care and nursing homes?",
    a: "MO HealthNet provides very limited ALF/RCF coverage — primarily through the Home and Community-Based Services (HCBS) waiver, which requires a functional assessment, specific eligibility criteria, and an available waiver slot. Nursing home stays are covered through MO HealthNet's standard nursing facility benefit, which is broader and easier to access once eligibility is established. Many ALFs in Missouri do not accept MO HealthNet at all — ask directly about Medicaid acceptance and expected private-pay costs during the inquiry process.",
  },
  {
    q: "When does someone need a nursing home rather than memory care in Missouri?",
    a: "A nursing home becomes necessary when a resident requires daily skilled nursing care — such as IV medications, tube feeding, wound debridement, respiratory therapy, or skilled physical, occupational, or speech therapy following hospitalization. Missouri ALFs and RCFs are not licensed to provide clinical nursing services. Typical triggers include post-acute recovery needs, medically complex conditions requiring 24-hour nursing oversight, or care needs that exceed what the ALF can safely manage under 19 CSR 30 scope-of-practice limits. A geriatrician, physician, or hospital discharge planner can help determine the appropriate level of care.",
  },
  {
    q: "What special protections exist for dementia residents in Missouri ALFs?",
    a: "Missouri §198.510 RSMo requires facilities specializing in Alzheimer's or dementia care to file an annual Alzheimer's Special Care Services Disclosure (Form MO 580-2637) describing their specific services, training, environment, and admission/discharge criteria. ALF** facilities additionally must maintain secured environments and specialized evacuation plans for non-self-evacuating residents (§198.073.6 RSMo). DHSS conducts unannounced inspections, and complaint investigations are documented separately. Missouri also operates a Long-Term Care Ombudsman program that advocates for residents in both residential care settings and nursing homes.",
  },
  {
    q: "How does Missouri's system compare to Arizona's or California's?",
    a: "Arizona uses a Directed Care license level as the primary dementia signal plus a new HB2764 Memory Care subclass. California uses RCFE licensing with an annual Type A / Type B deficiency framework. Missouri uses disclosure-based signaling (§198.510 SCU disclosure) and ALF** authorization — there is no separate license tier for dementia care. Each state has a different inspection record format and regulatory citation system. When reading a StarlynnCare profile, always note the state to interpret regulatory context correctly.",
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
    { factor: "License type", mc: "ALF / ALF** / RCF / RCF*", nh: "Skilled Nursing Facility (SNF) / ICF" },
    { factor: "Regulator", mc: "DHSS Section for LTCR", nh: "DHSS + CMS (federal)" },
    { factor: "Governing rule", mc: "Ch. 198 RSMo · 19 CSR 30", nh: "Ch. 198 RSMo · 19 CSR 15 · CMS §483" },
    { factor: "Memory care signal", mc: "§198.510 SCU disclosure + ALF**", nh: "N/A — SNFs provide skilled nursing for all diagnoses" },
    { factor: "Clinical nursing 24/7?", mc: "No — personal care, medication mgmt.", nh: "Yes — required by law" },
    { factor: "MO HealthNet (Medicaid)", mc: "Limited HCBS waiver — not guaranteed", nh: "Standard nursing facility benefit — broader access" },
    { factor: "Inspection source", mc: "DHSS LTCR (FOIA / public records)", nh: "CMS Care Compare + DHSS annual survey" },
    { factor: "Avg. monthly cost (MO)", mc: "$3,500–$7,500 (2026 est.)", nh: "$6,000–$9,000 (2026 est.)" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">Factor</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Memory care (ALF/RCF)</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Nursing home (SNF/ICF)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.factor} className="border-t border-paper-rule" style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}>
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">{row.factor}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.mc}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.nh}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MoVsNursingHomePage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Missouri", url: canonicalFor("/missouri") },
      { name: "Missouri guides", url: canonicalFor("/missouri/guides") },
      { name: "Memory care vs. nursing home", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar scope="MO" />
      <SiteNav badge="Missouri" ctaHref="/missouri/facilities" ctaLabel="Missouri memory care facilities" stateNavHref="/missouri" />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/missouri" className="hover:text-teal transition-colors">Missouri</Link>
              <span aria-hidden>›</span>
              <Link href="/missouri/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care vs. nursing home</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Missouri decision guide · DHSS vs. CMS regulation
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
                Memory care ALFs/RCFs are regulated by <strong className="font-medium text-ink">DHSS Section for LTCR</strong>;
                nursing homes (SNF/ICF) are regulated by{" "}
                <strong className="font-medium text-ink">CMS + DHSS</strong> — different inspection systems.
              </li>
              <li>
                Memory care ALFs provide personal care and dementia programming; SNFs provide{" "}
                <strong className="font-medium text-ink">clinical skilled nursing services</strong> not available in ALFs.
              </li>
              <li>
                <strong className="font-medium text-ink">MO HealthNet</strong> covers nursing homes more broadly;
                ALF/RCF coverage is limited to the HCBS waiver with strict eligibility requirements.
              </li>
              <li>
                Use <strong className="font-medium text-ink">CMS Care Compare</strong> for nursing home inspection data;
                use StarlynnCare for Missouri ALF/RCF memory care records.
              </li>
            </ul>
          </aside>

          <H2 id="regulation">Two regulators, two inspection systems</H2>
          <Prose>
            <p>
              One of the most important things Missouri families should know: memory care ALFs and nursing homes
              are inspected by entirely different systems. StarlynnCare covers DHSS-licensed ALF and RCF facilities
              with the Alzheimer&apos;s SCU disclosure or ALF** authorization. Nursing home (SNF/ICF) inspection
              records are published separately on{" "}
              <a href="https://www.medicare.gov/care-compare/" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                CMS Care Compare
              </a>
              .
            </p>
            <p>
              Neither system is a substitute for the other. Families who are comparing both types of settings
              should check both sources independently. A nursing home with a strong CMS Care Compare rating and
              an ALF with a strong StarlynnCare grade are not directly comparable — they serve different acuity
              levels.
            </p>
          </Prose>

          <ComparisonTable />

          <H2 id="when-nursing-home">When to choose a nursing home over memory care</H2>
          <Prose>
            <p>
              Memory care ALFs are appropriate for residents with moderate cognitive impairment who need dementia
              programming, a secure environment, medication management, and personal care assistance but{" "}
              <em>do not require</em> around-the-clock clinical nursing intervention. An SNF becomes appropriate when:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The resident requires IV medications, tube feeding, or wound debridement</li>
              <li>Post-hospitalization skilled rehabilitation (PT/OT/SLP) is needed</li>
              <li>Medically complex conditions require 24-hour nursing assessment and intervention</li>
              <li>The resident&apos;s care needs have advanced beyond what 19 CSR 30 ALF scope of practice allows</li>
            </ul>
            <p>
              A geriatrician, physician, or hospital discharge planner can assess which level of care is clinically
              appropriate. Placement in the wrong setting — either under-placing in an ALF that cannot safely manage
              the care level, or over-placing in a nursing home when residential care would suffice — has real
              consequences for the resident&apos;s quality of life and for the family&apos;s finances.
            </p>
          </Prose>

          <H2 id="medicaid">MO HealthNet (Medicaid) coverage differences</H2>
          <Prose>
            <p>
              MO HealthNet coverage for ALF/RCF memory care is limited and uncertain. The primary pathway is
              the Home and Community-Based Services (HCBS) waiver, which has:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Strict functional eligibility criteria (nursing facility level of care required)</li>
              <li>A limited number of waiver slots (not always immediately available)</li>
              <li>Facility must be an approved HCBS provider (many ALFs are not)</li>
              <li>Income and asset limits for the resident</li>
            </ul>
            <p>
              By contrast, MO HealthNet&apos;s standard nursing facility benefit for SNF/ICF care is available
              to eligible recipients without a limited slot structure. Families facing financial constraints should
              consult a Medicaid-certified elder law attorney or a DHSS resource center before making placement
              decisions based on assumed Medicaid coverage.
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
            source="Missouri DHSS Section for Long-Term Care Regulation (Ch. 198 RSMo; 19 CSR 30; 19 CSR 15); CMS Care Compare; MO HealthNet Division"
            refreshed={DATE_PUBLISHED}
          />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/missouri/memory-care-licensing"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Missouri</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Missouri memory care licensing — ALF**, SCU Disclosure & 19 CSR</p>
              </Link>
              <Link
                href="/library/37-questions-to-ask-on-a-memory-care-tour"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">All states</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">37 questions to ask on a memory care tour</p>
              </Link>
            </div>
            <Link href="/missouri/guides" className="mt-4 inline-block text-[14px] text-teal hover:underline">
              ← All Missouri guides
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
