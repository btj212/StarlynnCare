import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { buildArticleSchema, buildBreadcrumbList } from "@/lib/seo/schema";

const PAGE_PATH = "/california/37-questions-to-ask-on-a-tour";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "37 Questions to Ask on a Memory Care Tour (California)";
const DESC =
  "A printable-style checklist for families: what to ask before you book, on the tour, and after you leave — reviewed by a California RN.";
const DATE_PUBLISHED = "2026-05-02";

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

const BEFORE = [
  "What is the facility license number, and is memory care authorized under that license (care category / secured unit)?",
  "Can you email the full resident agreement, house rules, and fee schedule before we tour?",
  "How do you structure base rent vs. level-of-care fees — what was the average monthly increase last year for residents like mine?",
  "What staff positions are on-site overnight, and what is the typical awake staffing ratio by shift?",
  "When was your last routine inspection, and were there any Type A deficiencies or substantiated complaints in the last 24 months?",
  "How do you manage elopement risk — delayed egress, perimeter checks, wearable alerts?",
  "What is your policy on psychotropic medications and gradual dose reduction (GDR) per regulations?",
  "Do you accept Assisted Living Waiver or other Medi-Cal–related programs — and is there a waitlist?",
  "What hospice agencies have privileges here, and how do handoffs work after hours?",
  "Can we tour on a weekend evening to see staffing reality, not the weekday showcase?",
  "What items can families bring (furniture, locks, cameras) and what is prohibited?",
  "Who signs transfer agreements if hospitalization occurs — and what are the daily hold fees?",
];

const DURING = [
  "Show me the secured perimeter from the inside — how does a resident exit to the garden safely?",
  "Where do residents eat — small cohorts or one large dining room — and how long is breakfast service?",
  "May we observe medication administration (without violating HIPAA) or speak with the med aide supervisor?",
  "How do you cue residents who refuse meals or fluids — what is documented in the care plan?",
  "What happens when a resident has a fall — who assesses, who notifies family, and within what timeframe?",
  "How do you staff for behavioral expressions during bathing or transfers?",
  "What dementia-specific training do caregivers receive and how often is it refreshed?",
  "Who writes care plans and how quickly are they updated after hospital discharge?",
  "How do you prevent medication errors with look-alike/sound-alike drugs?",
  "What is the protocol for suspected abuse or neglect — internal and external reporting?",
  "Can we speak with a family council member or recent move-in family (with privacy respected)?",
  "How do you prevent urinary tract infections and skin breakdown in immobile residents?",
  "What is your nurse coverage — hours on-site vs. telehealth — and who takes physician orders?",
  "How do you manage diabetes or anticoagulation in memory care — partner pharmacies, labs, transport?",
  "What personal care supplies are included vs. billed separately (briefs, lotions, specialty nutrition)?",
  "How do you document refusal behaviors — and when do you call 911 vs. manage in place?",
  "What happens if my loved one outpaces staffing — discharge criteria and notice periods?",
  "How do you coordinate dental, vision, and psychiatry when residents cannot self-advocate?",
  "May we see a blank incident report template (redacted) to understand transparency?",
  "What wellness metrics do families receive monthly — weight, falls, infections?",
];

const AFTER = [
  "Request references from three families whose loved ones had needs similar to ours.",
  "Ask for the administrator’s direct line — does anyone answer after 8 p.m.?",
  "Re-read the inspection narrative on StarlynnCare: does it match what we were told today?",
  "Compare this quote line-by-line with the second finalist property — where are the hidden stacks?",
  "Sleep on it — guilt is not a discharge plan. Re-tour if answers shifted under mild pressure.",
];

export default function ThirtySevenQuestionsPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "California", url: canonicalFor("/california") },
      { name: "37 questions tour checklist", url: canonicalUrl },
    ]),
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
              <Link href="/california" className="hover:text-teal transition-colors">
                California
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Tour checklist</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Family toolkit · No email gate
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,56px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5">
              37 questions to ask on a memory care tour
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">
              Use this list on your phone or print it. Checkboxes are for your notes — not a scorecard against
              staff humanity.
            </p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14 space-y-14">
          <section aria-labelledby="letter-star" className="rounded-xl border border-paper-rule bg-paper-2 px-6 py-8">
            <h2 id="letter-star" className="sr-only">
              Letter from Star
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust mb-3">
              A note from Star
            </p>
            <div className="text-[16.5px] leading-[1.75] text-ink-2 space-y-4">
              <p>
                I sat where you sit — reading brochures that promise “homelike care” while my mind scanned for the
                details regulators actually cite: egress controls, medication storage, whether night staff can
                hear a fall.
              </p>
              <p>
                This checklist distills the questions that reveal whether a building can truly hold your person
                safely as cognition changes. If an answer feels defensive, slow down. If documentation does not
                match the lobby flowers, trust the record.
              </p>
              <p className="text-ink font-medium">
                — Rebecca Lynn Starkey, BSN, RN, PHN · California RN License 95100373
              </p>
            </div>
          </section>

          <ChecklistSection title="Before you book" id="before" items={BEFORE} offset={0} />
          <ChecklistSection title="During the tour" id="during" items={DURING} offset={BEFORE.length} />
          <ChecklistSection title="After you leave" id="after" items={AFTER} offset={BEFORE.length + DURING.length} />

          <p className="text-[13px] text-ink-4 font-[family-name:var(--font-mono)]">
            Total prompts: {BEFORE.length + DURING.length + AFTER.length}. Pair with our{" "}
            <Link href="/california/glossary" className="text-teal underline underline-offset-4">
              glossary
            </Link>{" "}
            if a term is unfamiliar.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function ChecklistSection({
  title,
  id,
  items,
  offset,
}: {
  title: string;
  id: string;
  items: string[];
  offset: number;
}) {
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="font-[family-name:var(--font-display)] text-[clamp(22px,3vw,30px)] text-ink mb-6 scroll-mt-24"
      >
        {title}
      </h2>
      <ul className="space-y-4 list-none pl-0">
        {items.map((text, i) => (
          <li key={text} className="flex gap-3">
            <span
              className="mt-1 h-5 w-5 shrink-0 rounded border border-paper-rule bg-paper shadow-inner"
              aria-hidden
            />
            <span className="text-[15.5px] leading-relaxed text-ink-2">
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-rust mr-2">
                {offset + i + 1}.
              </span>
              {text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
