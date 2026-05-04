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

const PAGE_PATH = "/library/dementia-vs-alzheimers-vs-lewy-body";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Dementia vs. Alzheimer’s vs. Lewy Body — A Family-Friendly Overview";
const DESC =
  "Non-diagnostic explainer for caregivers: how these terms relate, why doctors matter for diagnosis, and how symptoms influence residential care choices — reviewed by a California RN.";
const DATE_PUBLISHED = "2026-05-03";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Is dementia the same as Alzheimer’s?",
    a: "No — dementia is a syndrome (symptom cluster). Alzheimer’s disease is the most common cause of dementia, but not the only one.",
  },
  {
    q: "Can someone have more than one cause?",
    a: "Yes — mixed pathology is common. Clinicians document findings with exams, history, and sometimes imaging or biomarkers.",
  },
  {
    q: "Does StarlynnCare diagnose conditions?",
    a: "No — our facility profiles focus on regulatory inspections and licensing data. Medical diagnosis belongs with clinicians.",
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

export default function DementiaTypesPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Dementia types overview", url: canonicalUrl },
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
            <nav className="flex flex-wrap gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4">
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Dementia overview</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Clinical literacy · not a diagnostic article
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink mt-3 mb-5">
              {TITLE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14 space-y-5 text-[16.5px] leading-[1.75] text-ink-2">
          <H2 id="dementia">Dementia (umbrella)</H2>
          <p>
            Clinicians use &ldquo;dementia&rdquo; to describe cognitive decline severe enough to interfere with independence,
            usually including memory plus other domains (language, executive function, visuospatial skills). It is not a
            single disease — it is a clinical picture that demands diagnosis of underlying cause when possible.
          </p>

          <H2 id="alzheimers">Alzheimer’s disease</H2>
          <p>
            Alzheimer’s is the most frequently identified cause of dementia in older adults. Pathology involves abnormal
            protein aggregates that disrupt neurons over time. Families notice progressive memory loss, repetition, and
            difficulty with familiar tasks — though presentations vary. Medication and non-drug plans target symptoms and
            safety; StarlynnCare helps families evaluate <em>environmental safety</em> through inspection history.
          </p>

          <H2 id="lewy">Lewy body spectrum</H2>
          <p>
            Dementia with Lewy bodies often blends cognitive fluctuations, visual hallucinations, REM sleep behavior changes,
            and parkinsonian movement symptoms. Medication sensitivity (especially certain antipsychotics) makes care settings
            and physician coordination unusually important — ask memory care operators how they coordinate with neurologists
            when hallucinations escalate.
          </p>

          <H2 id="care-fit">Why this matters for residential care</H2>
          <p>
            Behaviors drive staffing requirements more than labels do. A building that handles wandering may still struggle
            with severe Lewy-related hallucinations if night staffing is thin — inspection citations sometimes reveal those
            gaps in supervision or medication administration. Cross-reference tour promises with documented deficiencies on
            each StarlynnCare profile.
          </p>

          <DataFootnote source="General medicine education · consult neurologists for diagnosis" refreshed={DATE_PUBLISHED} />

          <div className="mt-16 border-t border-paper-rule pt-12 space-y-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
              FAQ
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
            <Link href="/library/when-is-it-time-for-memory-care" className="text-teal underline underline-offset-4">
              When is it time for memory care? →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
