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

const PAGE_PATH = "/arizona/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Arizona memory care licensing explained — ALH, ALC, and the ADHS Directed Care license level";
const TITLE = "Arizona Memory Care Licensing: ALH, ALC & Directed Care (2026)";
const DESC =
  "Arizona ADHS licenses memory care under Assisted Living Homes (ALH) and Assisted Living Centers (ALC). The Directed Care license level is the state-verified signal for dementia and cognitive-care capability. Learn what each means for families.";
const DATE_PUBLISHED = "2026-06-15";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the difference between an Assisted Living Home (ALH) and an Assisted Living Center (ALC) in Arizona?",
    a: "Both are licensed by ADHS Bureau of Residential Facilities Licensing (BRFL) under A.A.C. Title 9, Chapter 10. The key difference is size: an Assisted Living Home (ALH) serves up to 10 residents in a smaller, home-like setting; an Assisted Living Center (ALC) serves 11 or more residents in a facility setting. Both can hold a Directed Care license level or the new HB2764 Memory Care subclass. Families often prefer smaller ALH settings for a more residential feel, but larger ALCs may offer more on-site clinical services.",
  },
  {
    q: "What is the ADHS 'Directed Care' license level?",
    a: "Arizona assigns each assisted living license one of three care levels: Supervisory Care (least intensive), Personal Care (intermediate), and Directed Care (highest). A Directed Care license authorizes the facility to serve residents who require continuous supervision, protective oversight, or substantial assistance due to cognitive impairment — including Alzheimer's disease and other dementias. Only Directed Care facilities are indexed by StarlynnCare, because this is the ADHS-verified signal that the facility is equipped and authorized for dementia care.",
  },
  {
    q: "What is the new Arizona Memory Care subclass (HB2764)?",
    a: "House Bill 2764 created a formal Memory Care subclass within Arizona's assisted living licensing framework, effective July 1, 2025. Facilities that obtain this subclass must meet enhanced requirements specifically for residents with Alzheimer's disease or other dementias — including specialized staff training, physical environment standards, and structured programming. This subclass is intended to be the clearest Tier-1 signal of memory care capability. StarlynnCare will incorporate it as the primary signal once ADHS begins publishing it in the facility directory.",
  },
  {
    q: "How does ADHS inspect Directed Care facilities?",
    a: "ADHS BRFL conducts routine surveys (typically annual) and complaint investigations of all licensed ALHs and ALCs. For Directed Care facilities, inspectors apply the full A.A.C. R9-10-800 series standards — staffing ratios, medication management, behavior support plans, physical environment, and programming. Violations are cited by specific rule section. Enforcement actions range from a required plan of correction to civil money penalties, provisional license status, and license revocation for serious violations. Inspection records are published on AZ Care Check (azcarecheck.azdhs.gov).",
  },
  {
    q: "Does Arizona have Medicaid funding for memory care in ALHs or ALCs?",
    a: "Yes. Arizona Long Term Care System (ALTCS) is Arizona's Medicaid program for long-term services and supports. ALTCS can fund residential memory care in Directed Care ALHs and ALCs for eligible residents through contracted managed care organizations. Not all facilities accept ALTCS — ask about contract status and bed availability during your visit. ALTCS eligibility is determined by AHCCCS (Arizona Health Care Cost Containment System).",
  },
  {
    q: "How is Arizona's memory care licensing system different from California's?",
    a: "California licenses memory care under a single RCFE (Residential Care Facility for the Elderly) category regulated by CDSS. California uses Type A / Type B deficiency severity labels. Arizona uses two license types (ALH, ALC) both regulated by ADHS, with care levels (Supervisory/Personal/Directed) rather than a separate endorsement. Arizona's HB2764 Memory Care subclass is newer and more specific than California's general disclosure requirement. Medicaid access also differs — California uses ALW (Assisted Living Waiver), Arizona uses ALTCS. When reading a StarlynnCare profile, always note the state.",
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

function LicenseComparisonTable() {
  const rows = [
    { attr: "License type", alh: "Assisted Living Home (ALH)", alc: "Assisted Living Center (ALC)" },
    { attr: "Max residents", alh: "Up to 10", alc: "11 or more" },
    { attr: "Regulator", alh: "ADHS BRFL", alc: "ADHS BRFL" },
    { attr: "Governing rule", alh: "A.A.C. R9-10-800 series", alc: "A.A.C. R9-10-800 series" },
    { attr: "Care level for MC", alh: "Directed Care required", alc: "Directed Care required" },
    { attr: "HB2764 MC subclass", alh: "Available (eff. 2025-07-01)", alc: "Available (eff. 2025-07-01)" },
    { attr: "ALTCS Medicaid?", alh: "Yes — contracted facilities", alc: "Yes — contracted facilities" },
    { attr: "Inspection source", alh: "AZ Care Check (ADHS BRFL)", alc: "AZ Care Check (ADHS BRFL)" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[540px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">Factor</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">ALH</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">ALC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.attr} className="border-t border-paper-rule" style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}>
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">{row.attr}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.alh}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.alc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AzLicensingPage() {
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
      { name: "Memory care licensing", url: canonicalUrl },
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
              <span className="text-ink-3">Memory care licensing</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Arizona licensing guide · ADHS BRFL regulation
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
                Arizona licenses residential memory care as either an{" "}
                <strong className="font-medium text-ink">Assisted Living Home (ALH, ≤10 residents)</strong> or an{" "}
                <strong className="font-medium text-ink">Assisted Living Center (ALC, 11+ residents)</strong> — both regulated by ADHS BRFL under A.A.C. R9-10-800.
              </li>
              <li>
                The <strong className="font-medium text-ink">Directed Care license level</strong> is required for facilities serving residents with dementia or cognitive impairment — only Directed Care facilities are indexed on StarlynnCare.
              </li>
              <li>
                <strong className="font-medium text-ink">HB2764 (2025)</strong> created a formal Memory Care subclass — an additional layer of dementia-specific requirements. StarlynnCare will incorporate it once ADHS publishes it in the directory.
              </li>
              <li>
                Arizona Medicaid (ALTCS) can fund memory care in contracted Directed Care facilities — ask about contract status during your visit.
              </li>
            </ul>
          </aside>

          <H2 id="alh-vs-alc">ALH vs. ALC: what the difference means</H2>
          <Prose>
            <p>
              Arizona licenses residential assisted living under two frameworks based on facility size. Both are regulated
              by the ADHS Bureau of Residential Facilities Licensing (BRFL) under A.A.C. Title 9, Chapter 10 and both
              can serve residents with dementia when they hold a Directed Care license level.
            </p>
            <p>
              For memory care families, the size difference often matters more than the license type itself. Smaller
              Assisted Living Homes (up to 10 residents) tend to offer a quieter, more home-like environment — which
              can reduce agitation for some dementia residents. Larger Assisted Living Centers may offer more on-site
              clinical staff, a structured activities program, and greater care resources for residents with higher
              acuity needs. Ask about staffing ratios, secured environment features, and programming before deciding.
            </p>
          </Prose>

          <LicenseComparisonTable />

          <H2 id="directed-care">The ADHS Directed Care license level</H2>
          <Prose>
            <p>
              Arizona assigns each assisted living license one of three care levels, set by ADHS at the time of
              licensure and visible in the official facility directory:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="font-medium text-ink">Supervisory Care</strong> — lowest acuity; residents need supervision or protective oversight but retain significant independence</li>
              <li><strong className="font-medium text-ink">Personal Care</strong> — intermediate; residents need assistance with activities of daily living (ADLs)</li>
              <li><strong className="font-medium text-ink">Directed Care</strong> — highest; residents require continuous supervision, protective oversight, and direction with decision-making due to cognitive impairment</li>
            </ul>
            <p>
              Only Directed Care facilities are authorized to serve residents who cannot direct their own care due to
              dementia, Alzheimer&apos;s disease, or other cognitive conditions. StarlynnCare indexes only Directed Care
              facilities for this reason — it is the ADHS-verified signal that the facility is equipped and licensed
              for dementia care.
            </p>
          </Prose>

          <H2 id="hb2764">HB2764: Arizona&apos;s new Memory Care subclass</H2>
          <Prose>
            <p>
              Arizona House Bill 2764, effective July 1, 2025, created a formal Memory Care subclass within the
              Assisted Living licensing framework. Facilities must apply separately for this subclass — holding a
              Directed Care license level alone does not confer Memory Care subclass status.
            </p>
            <p>
              The Memory Care subclass requires facilities to meet enhanced standards including:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Specialized dementia care staff training and ongoing competency verification</li>
              <li>Secured environments with appropriate exit controls for wandering prevention</li>
              <li>Individualized dementia care plans with family involvement</li>
              <li>Structured activity programming appropriate for cognitive impairment stages</li>
              <li>Dining, environment, and sensory design standards specific to dementia populations</li>
            </ul>
            <p>
              StarlynnCare will incorporate the Memory Care subclass as the primary Tier-1 signal once ADHS begins
              publishing it in the ArcGIS facility directory — expected in the coming months as facilities complete
              applications.
            </p>
          </Prose>

          <H2 id="how-inspections-work">How ADHS inspects Directed Care facilities</H2>
          <Prose>
            <p>
              ADHS BRFL conducts routine licensing surveys (typically annual) and investigates complaints for all
              licensed ALHs and ALCs. Inspectors apply the A.A.C. R9-10-800 series standards — staffing, medication
              management, behavior support plans, physical environment, infection control, and resident rights.
              For Directed Care facilities, dementia-specific compliance is evaluated throughout.
            </p>
            <p>
              Arizona does not use California&apos;s Type A / Type B deficiency classification. Violations are cited by
              specific A.A.C. rule section with a required plan of correction. Enforcement escalation can include
              civil money penalties, provisional license status, or license revocation. AZ Care Check (azcarecheck.
              azdhs.gov) publishes inspection records for each facility — StarlynnCare surfaces these in plain
              language on each Arizona profile.
            </p>
          </Prose>

          <H2 id="how-to-read-profile">How to read an Arizona facility on StarlynnCare</H2>
          <Prose>
            <p>Each Arizona facility profile on StarlynnCare shows:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>License type (ALH or ALC) and ADHS Directed Care license level status</li>
              <li>HB2764 Memory Care subclass status (when published by ADHS)</li>
              <li>ADHS inspection history with dates and finding summaries</li>
              <li>Complaint investigation outcomes</li>
              <li>Direct link to AZ Care Check for source verification</li>
            </ul>
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
            source="Arizona ADHS Bureau of Residential Facilities Licensing (A.A.C. R9-10-800; HB2764 2025 session); AHCCCS Arizona Long Term Care System"
            refreshed={DATE_PUBLISHED}
          />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/arizona/memory-care-vs-nursing-home"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Arizona</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Memory care vs. nursing home in Arizona</p>
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
