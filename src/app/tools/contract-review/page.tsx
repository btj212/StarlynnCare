import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList, buildFaqSchemaFromPairs } from "@/lib/seo/schema";
import { ContractEmailCapture } from "./ContractEmailCapture";

const PAGE_PATH = "/tools/contract-review";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Contract Decoder — Memory Care Admission Agreement Review";
const DESC =
  "Send us your memory care admission agreement. We map every fee, rate-increase clause, and discharge trigger into plain language — education, not legal advice. Manual review, no AI.";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the Contract Decoder?",
    a: "You send us your memory care admission agreement (PDF). A human reviewer maps every fee, rate-increase clause, and discharge trigger into a plain-language summary emailed back to you. We do not provide legal advice — we translate regulatory and contractual jargon into terms families can act on.",
  },
  {
    q: "Is this legal advice?",
    a: "No. This is educational document translation. We explain what contract clauses typically mean in plain English. For legal advice on specific disputes or signing decisions, consult an elder-law attorney (see NAELA.org).",
  },
  {
    q: "How long does the review take?",
    a: "Typically 2 business days. We email you the plain-language breakdown at the address you provide.",
  },
  {
    q: "Is this service free?",
    a: "Yes, currently. We are validating demand before deciding whether to formalize this as a product. That means manual turnaround — we review every submission personally.",
  },
  {
    q: "What types of documents can you review?",
    a: "Memory care admission agreements, residency agreements, and related RCFE or ALF contracts. We focus on the clauses that matter most: monthly fees and escalation terms, discharge and transfer grounds, arbitration clauses, and levels-of-care pricing.",
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
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
  },
};

const WHAT_WE_REVIEW = [
  {
    label: "Monthly fees & escalation clauses",
    desc: "What triggers rate increases, how much notice is required, and what limits (if any) exist.",
  },
  {
    label: "Discharge & transfer grounds",
    desc: "The exact conditions under which a facility may ask a resident to leave — and how to evaluate their legitimacy.",
  },
  {
    label: "Levels-of-care pricing",
    desc: "How acuity tiers are defined, measured, and billed — and whether the definitions give the facility unilateral authority to upgrade.",
  },
  {
    label: "Arbitration clauses",
    desc: "Whether you are waiving your right to sue in open court and under what terms.",
  },
  {
    label: "Ancillary fee schedules",
    desc: "À la carte charges for medications, transport, incontinence supplies, and activities that don't appear in the headline rate.",
  },
];

export default function ContractReviewPage() {
  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Tools", url: canonicalFor("/tools") },
      { name: "Contract Decoder", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        {/* Hero */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[960px] px-4 sm:px-6 md:px-10 py-14">
            <nav className="flex flex-wrap gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4">
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Contract Decoder</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Free tool · manual review, not AI
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink mt-3 mb-5 max-w-[18ch]">
              Contract Decoder
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">
              Memory care admission agreements are written by facility lawyers for facility lawyers.
              Send us yours — we translate every fee escalation, discharge trigger, and arbitration
              clause into plain language you can act on.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] border border-paper-rule px-3 py-1.5 text-ink-4">
                Education, not legal advice
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] border border-paper-rule px-3 py-1.5 text-ink-4">
                Manual review · no AI
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] border border-paper-rule px-3 py-1.5 text-ink-4">
                Currently free
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[960px] px-4 sm:px-6 md:px-10 py-14">
          <div className="grid md:grid-cols-2 gap-14 md:gap-20 items-start">

            {/* Left: What we review + FAQ */}
            <div className="space-y-14">
              <div>
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block mb-6">
                  § What we translate
                </p>
                <ul className="space-y-5">
                  {WHAT_WE_REVIEW.map(({ label, desc }) => (
                    <li key={label} className="flex gap-4">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[8px]" style={{ backgroundColor: "var(--color-teal)" }} />
                      <div>
                        <p className="font-medium text-ink text-[15.5px] leading-snug">{label}</p>
                        <p className="text-[14px] text-ink-3 leading-relaxed mt-0.5">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block mb-6">
                  § Questions
                </p>
                <div className="space-y-5">
                  {FAQ_PAIRS.map(({ q, a }) => (
                    <div key={q} className="border-b border-paper-rule pb-5">
                      <p className="font-medium text-ink text-[15.5px] mb-1.5">{q}</p>
                      <p className="text-[14px] text-ink-3 leading-relaxed">{a}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded border border-paper-rule px-5 py-5" style={{ background: "var(--color-paper-2)" }}>
                <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-ink-4 mb-2">
                  Related guide
                </p>
                <Link
                  href="/library/the-first-72-hours"
                  className="font-[family-name:var(--font-display)] text-[18px] text-ink hover:text-teal transition-colors"
                >
                  The first 72 hours: what to ask before signing anything →
                </Link>
              </div>
            </div>

            {/* Right: Email capture */}
            <div>
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block mb-6">
                § Send us your agreement
              </p>
              <p className="text-[14px] text-ink-3 leading-relaxed mb-6">
                Enter your email below. We&rsquo;ll send you a confirmation with instructions to
                reply with your contract PDF attached — and we&rsquo;ll return a plain-language
                breakdown within 2 business days.
              </p>
              <ContractEmailCapture />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
