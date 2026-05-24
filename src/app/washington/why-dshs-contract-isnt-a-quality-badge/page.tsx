import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { EditorialHero } from "@/components/editorial/EditorialHero";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/washington/why-dshs-contract-isnt-a-quality-badge";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "A DSHS Dementia Care contract is not a quality badge — and here's what the WA inspection record shows";
const TITLE = "DSHS Dementia Care Contract: Not a Quality Signal (WA Data)";
const DESC =
  "Washington DSHS Dementia Care contracts mark Medicaid payment eligibility — not facility quality. Our analysis of 180 WA memory care facilities and 919 deficiencies shows contracted facilities have higher complaint rates, likely due to adverse selection from higher-acuity populations.";
const DATE_PUBLISHED = "2026-05-23";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is a DSHS Dementia Care contract?",
    a: "A contractual agreement between a Washington ALF and DSHS under RCW 74.39A authorizing the facility to provide dementia-specific residential care to Medicaid-eligible residents. The contract governs payment terms, care standards, and reporting — it does not grade the facility's inspection history or overall quality.",
  },
  {
    q: "Does holding a DSHS Dementia Care contract mean the facility is better at dementia care?",
    a: "Not on its own. The contract confirms the facility meets DSHS eligibility requirements to serve Medicaid dementia residents. It does not mean the facility has fewer citations, fewer complaints, or better inspection outcomes than a non-contracted facility. Our data shows the opposite correlation — though that correlation most likely reflects patient acuity, not care quality.",
  },
  {
    q: "Why do contracted facilities show more complaints in your data?",
    a: "The most defensible explanation is adverse selection: facilities that accept Medicaid dementia residents under DSHS contract tend to serve higher-acuity populations — residents with more advanced dementia, fewer private-pay alternatives, and more complex behavioral and medical needs. Sicker residents generate more incidents independent of facility quality. A second possible factor is heightened scrutiny: contracted facilities are on the public payer and may receive more complaint-triggered inspections as a result. We cannot distinguish between these two mechanisms with the data we have.",
  },
  {
    q: "Should I avoid contracted facilities?",
    a: "No. The contract correlation with complaints does not mean contracted facilities are worse. It means the contract is not informative as a quality signal in either direction. The right approach is to look at the facility's individual inspection history, deficiency severity, and complaint density on its StarlynnCare profile — and do the same comparison for any non-contracted facility you are considering.",
  },
  {
    q: "Where does DSHS publish the official contract list?",
    a: "DSHS Aging and Disability Services Administration (ADSA) maintains the contracted provider roster. The current list is published at fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx. You can search by facility name or license number. StarlynnCare surfaces the contract flag on each WA facility profile and links directly to this portal.",
  },
  {
    q: "How does the DSHS contract compare to California's Medi-Cal ALW or Texas's Alzheimer Certification?",
    a: "All three are state-program designations that signal Medicaid payment eligibility and some dementia-specific requirements — but none of them is a quality grade. California's Assisted Living Waiver (ALW) governs which RCFEs can serve Medi-Cal recipients in participating counties. Texas's Alzheimer Certification requires dementia training and secured environments but is voluntary. Washington's DSHS Dementia Care contract requires contract compliance and Medicaid eligibility. In all three cases, the designation should be read alongside — not instead of — the facility's inspection record.",
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
      className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5 group/h2"
    >
      <a href={`#${id}`} className="no-underline text-ink hover:text-ink">
        {children}
        <span className="ml-2 font-[family-name:var(--font-mono)] text-[14px] text-rust/40 opacity-0 group-hover/h2:opacity-100 transition-opacity select-none" aria-hidden>#</span>
      </a>
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
    {
      cohort: "Contracted (n=99)",
      complaints: "2.95",
      pctComplaint: "69.5%",
      seriousPer100: "3.50",
    },
    {
      cohort: "Not contracted (n=81)",
      complaints: "2.04",
      pctComplaint: "54.8%",
      seriousPer100: "2.49",
    },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Cohort
            </th>
            <th className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Complaints / facility
            </th>
            <th className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              % complaint-driven inspections
            </th>
            <th className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Serious citations / 100 beds
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.cohort}
              className="border-t border-paper-rule"
              style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}
            >
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[12px] text-ink-2 align-top">
                {row.cohort}
              </td>
              <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[13px] text-ink align-top font-semibold">
                {row.complaints}
              </td>
              <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[13px] text-ink align-top font-semibold">
                {row.pctComplaint}
              </td>
              <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[13px] text-ink align-top font-semibold">
                {row.seriousPer100}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WaDshsContractPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Washington", url: canonicalFor("/washington") },
      { name: "Washington guides", url: canonicalFor("/washington/guides") },
      { name: "DSHS contract literacy", url: canonicalUrl },
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
              <Link href="/washington" className="hover:text-teal transition-colors">Washington</Link>
              <span aria-hidden>›</span>
              <Link href="/washington/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">DSHS contract literacy</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Washington editorial · DSHS contract literacy · RN-reviewed
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
            <EditorialHero
              src="/illustrations/desk-family-reviewing-records.png"
              alt="Illustrated adult daughter and elderly grandmother reviewing documents together at a desk under a lamp — representing families reading the public DSHS inspection record"
              priority
            />
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <aside className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6 text-[16px] leading-[1.7] text-ink-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">
              The short version
            </p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>
                A <strong className="font-medium text-ink">DSHS Dementia Care contract</strong> is a Medicaid payment vehicle — it authorizes an ALF to serve Medicaid dementia residents and governs what DSHS will reimburse. It is not a quality grade, safety rating, or inspection credential.
              </li>
              <li>
                In our dataset of 180 publishable WA memory care facilities, contracted facilities (n=99) show <strong className="font-medium text-ink">+40% more serious citations per 100 beds</strong> than non-contracted facilities (n=81). The intuitive direction is the opposite.
              </li>
              <li>
                The most defensible explanation is <strong className="font-medium text-ink">adverse selection</strong>: contracted facilities accept higher-acuity Medicaid residents with more advanced dementia. More complex residents generate more incidents independent of facility quality.
              </li>
              <li>
                StarlynnCare shows the contract flag on WA facility profiles as a factual datum — not as a positive badge. Use the facility&apos;s individual inspection history, not the contract status, to assess quality.
              </li>
            </ul>
          </aside>

          <H2 id="what-the-contract-is">What the contract is, in 90 seconds</H2>
          <Prose>
            <p>
              Washington&apos;s DSHS Dementia Care contract is a formal agreement between an Assisted Living Facility and the Department of Social and Health Services, authorized under{" "}
              <strong className="font-medium text-ink">RCW 74.39A</strong> and administered by DSHS Aging and Disability Services Administration (ADSA). A contracted facility has agreed to accept Medicaid-eligible residents with dementia and to meet DSHS&apos;s standards for dementia-specific residential care — staffing ratios, programming, care plan documentation, and reporting requirements.
            </p>
            <p>
              Why does a facility apply? Two reasons, and they are purely operational. First, it unlocks the Medicaid payment stream for residents who cannot afford private pay. Second, it expands the facility&apos;s eligible resident pool to include individuals whose care is fully or partially funded by DSHS — a significant source of occupancy for many WA ALFs.
            </p>
            <p>
              What the contract does <em>not</em> include: no inspection score, no quality rating, no third-party clinical assessment. DSHS does not review a facility&apos;s citation history before awarding the contract. A facility can hold the contract while simultaneously accumulating complaints and serious deficiencies. A facility can decline the contract while maintaining an excellent inspection record. The two are independent.
            </p>
          </Prose>

          <H2 id="what-the-data-shows">What the WA inspection record actually shows</H2>
          <Prose>
            <p>
              We analyzed 180 publishable WA memory care facilities, 721 inspections spanning May 2023 through May 2026, and 919 deficiencies sourced from DSHS LTCR records. Of those 180 facilities, 99 hold a DSHS Dementia Care contract and 81 do not.
            </p>
          </Prose>
          <ComparisonTable />
          <DataFootnote
            source="Internal analysis · DSHS LTCR records May 2023 – May 2026 · 180 publishable WA ALFs · 721 inspections · 919 deficiencies"
            refreshed={DATE_PUBLISHED}
            note="Descriptive analysis only — not causal inference. Dataset limited to facilities that pass our 48-month freshness gate."
          />
          <div className="mt-8">
            <Prose>
              <p>
                On every metric — complaints per facility, share of complaint-driven inspections, and serious citations per 100 beds — the contracted cohort scores worse. The gap on serious citations per 100 beds is 3.50 vs 2.49, a{" "}
                <strong className="font-medium text-ink">40% difference</strong>. This is not a rounding artifact. It is a consistent pattern across all three measures.
              </p>
              <p>
                These numbers are not what most families expect when they see a facility holding a state dementia contract. They are worth understanding before treating the contract as a signal of quality.
              </p>
            </Prose>
          </div>

          <H2 id="why-the-wrong-direction">Why these numbers go the &ldquo;wrong&rdquo; direction</H2>
          <Prose>
            <p>
              Two mechanisms explain most of the gap, and they are not mutually exclusive.
            </p>
            <p>
              <strong className="font-medium text-ink">Adverse selection.</strong> Contracted facilities accept Medicaid dementia residents — a population with more advanced cognitive impairment, fewer private-pay alternatives, and more complex behavioral and medical profiles than the typical private-pay memory care resident. Residents with severe dementia are more likely to experience incidents: falls, medication errors, behavioral crises, wandering. When incidents happen, families and staff file complaints. Complaints trigger inspections. Inspections produce deficiency findings. This chain operates independent of how well the facility is managed.
            </p>
            <p>
              <strong className="font-medium text-ink">Heightened scrutiny.</strong> Contracted facilities are on the public payer and may receive closer DSHS attention than private-pay-only facilities. More inspections per facility, or more thorough inspections when they occur, produce more findings. If DSHS inspects contracted facilities more often, the citation count will mechanically be higher even if the underlying care quality is identical.
            </p>
            <p>
              We cannot distinguish between these two mechanisms with the data we have. What we can say is that neither mechanism implies the contracted facility is delivering worse care. The correlation between contract status and citation counts is real. The causal story behind it is not what the raw numbers suggest.
            </p>
            <p>
              To be direct: <em>we are not claiming contracted facilities are worse than non-contracted ones</em>. We are claiming the contract status is not informative as a quality signal — in either direction.
            </p>
          </Prose>

          <H2 id="how-we-show-it">How StarlynnCare displays the contract on facility profiles</H2>
          <Prose>
            <p>
              On a WA facility profile, the DSHS Dementia Care contract flag appears as a factual data point — a label that says the facility holds the contract, linked to the DSHS ADSA public lookup so families can verify it independently. It is displayed alongside other facility attributes like license type and bed count.
            </p>
            <p>
              It does not appear as a checkmark badge, a quality indicator, or a recommended signal. It does not boost the facility&apos;s ranking or summary grade on this site. It does not cause us to display fewer caveats about a facility&apos;s inspection history.
            </p>
            <p>
              This editorial posture — factual display, no quality inference — is the same one we apply to every regulatory designation we surface. Texas&apos;s Alzheimer Certification, California&apos;s Assisted Living Waiver participation, Oregon&apos;s Memory Care Endorsement: all factual flags, none of them a quality verdict. The data does not support treating any of them that way.
            </p>
          </Prose>

          <H2 id="what-to-look-at-instead">What to actually look at instead</H2>
          <Prose>
            <p>
              When evaluating a WA memory care facility, the contract status is a useful datum for one specific purpose: confirming whether Medicaid payment is available. If your family needs a Medicaid-funded placement, you need a contracted facility. That is the contract&apos;s functional value.
            </p>
            <p>
              For quality assessment, look at the inspection record directly:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="font-medium text-ink">Recent inspection density.</strong> How many inspections in the last 36 months? A facility with 8 complaint-driven inspections and 3 with findings is telling a different story than one with 2 routine inspections and no findings.
              </li>
              <li>
                <strong className="font-medium text-ink">Severity of findings.</strong> Serious citations (Type A, Immediate Jeopardy) involve harm or immediate risk. The count of those matters more than the total deficiency count.
              </li>
              <li>
                <strong className="font-medium text-ink">Complaint share.</strong> A facility whose inspections are predominantly complaint-driven, rather than routine, is signaling that residents or families are filing. That is a behavioral signal worth weighing.
              </li>
              <li>
                <strong className="font-medium text-ink">Patterns over time.</strong> A single serious finding in 2022 followed by clean inspections in 2024 and 2025 is a different picture than a string of serious findings in 2024 and 2025.
              </li>
            </ul>
            <p>
              Ask the longest-tenured direct care staff member on the floor what they would change about the place if they could. The answer is a more reliable quality signal than any regulatory designation — contracted or not.
            </p>
          </Prose>

          <div className="mt-16 border-t border-paper-rule pt-12 space-y-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
              Frequently asked
            </p>
            <dl className="space-y-6">
              {FAQ_PAIRS.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold text-ink">{f.q}</dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-ink-2">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-12">
            <Link
              href="/washington/facilities"
              className="inline-flex items-center gap-2 border border-ink px-5 py-3 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-ink hover:bg-ink hover:text-paper transition-colors"
            >
              Browse Washington memory care facilities →
            </Link>
          </div>

          <div className="mt-16 rounded-lg border border-paper-rule bg-paper-2 px-5 py-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-3">
              Continue reading
            </p>
            <ul className="space-y-3">
              <li>
                <Link href="/washington/how-to-read-our-inspection-data" className="text-teal hover:underline text-[16px]">
                  How to read our Washington inspection data →
                </Link>
              </li>
              <li>
                <Link href="/washington/memory-care-licensing" className="text-teal hover:underline text-[16px]">
                  Washington memory care licensing — ALFs &amp; Specialized Dementia Care →
                </Link>
              </li>
              <li>
                <Link href="/library/medi-cal-and-memory-care" className="text-teal hover:underline text-[16px]">
                  Medi-Cal &amp; memory care — the California equivalent (ALW) →
                </Link>
              </li>
              <li>
                <Link href="/texas/type-a-b-c-licensing" className="text-teal hover:underline text-[16px]">
                  Texas Alzheimer Certification — the same question in a different state →
                </Link>
              </li>
            </ul>
          </div>

          <div className="mt-12 pt-8 border-t border-paper-rule text-[14px] text-ink-3">
            Last reviewed {DATE_PUBLISHED}. Author bio and credentials at{" "}
            <Link href="/about" className="text-teal underline underline-offset-4">About</Link>. This is descriptive analysis of public inspection data — it is not a quality rating of any individual facility and should not be read as one.
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
