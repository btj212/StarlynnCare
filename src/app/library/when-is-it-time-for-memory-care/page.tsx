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

const PAGE_PATH = "/library/when-is-it-time-for-memory-care";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "When Is It Time for Memory Care? A Decision Framework for Families";
const DESC =
  "Safety-focused checklist: wandering, nutrition, caregiver burnout, medication complexity, and parallel documentation to discuss with clinicians — not a substitute for medical advice — reviewed by a California RN.";
const DATE_PUBLISHED = "2026-05-03";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Is there a single right month to move?",
    a: "No — timing balances clinical guidance, caregiver capacity, finances, and housing availability. The goal is proactive moves before catastrophic injury, not arbitrary calendars.",
  },
  {
    q: "What if my parent refuses?",
    a: "Capacity evaluations matter — neurologists and geriatric psychiatrists help interpret judgment vs. autonomy. Safety overrides marketing preferences when elopement or self-neglect risk is documented.",
  },
  {
    q: "How does StarlynnCare help after we decide?",
    a: "Compare inspection histories before tours so you ask operators about documented supervision themes, not brochure promises.",
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

export default function WhenMemoryCarePage() {
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "When is it time for memory care", url: canonicalUrl },
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
              <span className="text-ink-3">Timing memory care</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Family decision guide · safety-first framing
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
          <H2 id="signals">1 · Safety signals that escalate urgency</H2>
          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong className="text-ink">Unsafe wandering or driving</strong> — documented elopement attempts, getting lost in familiar neighborhoods, or traffic incidents.
            </li>
            <li>
              <strong className="text-ink">Nutrition or hydration failure</strong> — progressive weight loss because meals cannot be completed even with cueing.
            </li>
            <li>
              <strong className="text-ink">Caregiver injury or burnout</strong> — repeated lifting injuries, sleep deprivation affecting judgment, or inability to supervise overnight.
            </li>
            <li>
              <strong className="text-ink">Medication complexity</strong> — frequent errors despite pill organizers; clinicians recommend supervised administration.
            </li>
          </ul>

          <H2 id="parallel">2 · Run clinical + regulatory tracks in parallel</H2>
          <p>
            Clinicians document progression; StarlynnCare documents whether buildings have recurring citations in staffing,
            supervision, or medication administration — the themes that predict whether a marketing tour matches operational
            reality. Read paired narratives on each facility page before you sign a lease-level contract.
          </p>

          <H2 id="tours">3 · Tours after you shortlist</H2>
          <p>
            Use{" "}
            <Link href="/california/37-questions-to-ask-on-a-tour" className="text-teal underline underline-offset-4">
              the 37-question checklist
            </Link>{" "}
            with inspection citations printed — administrators answer differently when families cite dated deficiencies by number.
          </p>

          <DataFootnote source="Family education · coordinate with physicians for capacity & safety planning" refreshed={DATE_PUBLISHED} />

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

          <div className="mt-12 flex flex-col gap-3 text-[14px]">
            <Link href="/california" className="text-teal underline underline-offset-4">
              Browse California hubs →
            </Link>
            <Link href="/library/dementia-vs-alzheimers-vs-lewy-body" className="text-teal underline underline-offset-4">
              Dementia vs. Alzheimer’s vs. Lewy body →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
