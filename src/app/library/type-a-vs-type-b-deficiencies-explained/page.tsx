import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { SITE_ORIGIN } from "@/lib/seo/canonical";
import { STARLYNN_EDITORIAL_REVIEWER } from "@/lib/seo/editor";
import { DataFootnote } from "@/components/editorial/DataFootnote";

const PAGE_PATH = "/library/type-a-vs-type-b-deficiencies-explained";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Type A vs. Type B Deficiencies in California Memory Care — Explained";
const DESC =
  "What the difference between a Type A and Type B deficiency means in a California RCFE inspection report, how to read them on a facility profile, and why they matter when choosing memory care.";
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
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonicalUrl}#article`,
    headline: TITLE,
    description: DESC,
    url: canonicalUrl,
    datePublished: DATE_PUBLISHED,
    dateModified: DATE_PUBLISHED,
    author: { "@type": "Organization", name: "StarlynnCare", url: SITE_ORIGIN },
    reviewedBy: { "@type": "Person", name: STARLYNN_EDITORIAL_REVIEWER },
    publisher: { "@type": "Organization", name: "StarlynnCare", url: SITE_ORIGIN },
    isPartOf: { "@type": "WebSite", name: "StarlynnCare", url: SITE_ORIGIN },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Library", item: canonicalFor("/library") },
      { "@type": "ListItem", position: 3, name: "Type A vs. Type B deficiencies", item: canonicalUrl },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: canonicalUrl,
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a Type A deficiency in a California memory care facility?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A Type A deficiency is cited when California CDSS inspectors determine that a violation 'presents an immediate risk to the health, safety, or personal rights of the clients in care' (Cal. Health & Safety Code §1540.1). Type A findings require the facility to submit a corrective action plan within 48 hours and trigger the highest civil penalty tier.",
        },
      },
      {
        "@type": "Question",
        name: "What is a Type B deficiency in a California RCFE?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A Type B deficiency covers all other violations that do not rise to the level of immediate jeopardy. They represent real regulatory failures — inadequate records, missing staff training documentation, improperly stored medications — but inspectors determined that residents were not in immediate danger at the time of the visit.",
        },
      },
      {
        "@type": "Question",
        name: "Which is worse, Type A or Type B?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Type A is more severe. It signals that inspectors found conditions posing an immediate risk to residents. That said, repeated Type B citations in the same regulatory domain (such as medication management or dementia care training) can be equally revealing about systemic quality problems at a facility.",
        },
      },
    ],
  },
];

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
      {children}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-8 border-l-[3px] border-rust pl-5 py-1 text-[15px] leading-[1.65] text-ink-2 max-w-[66ch]">
      {children}
    </div>
  );
}

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

export default function TypeATypeBPage() {
  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        {/* ── Header ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/library" className="hover:text-teal transition-colors">Library</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Deficiency types</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Regulatory primer
            </div>
            <h1
              className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,56px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5"
            >
              Type A vs. Type B deficiencies — <em>what they actually mean.</em>
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">
              Every California RCFE inspection report classifies violations as Type A or Type B.
              Here is what that difference means for a family evaluating a memory care facility.
            </p>
            <p className="mt-4 font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.06em]">
              By {STARLYNN_EDITORIAL_REVIEWER} · Published {DATE_PUBLISHED}
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">

          <H2 id="the-law">The regulatory basis</H2>
          <Prose>
            <p>
              California Health &amp; Safety Code §1540.1 requires that every deficiency cited during
              a CDSS Community Care Licensing inspection of a Residential Care Facility for the
              Elderly (RCFE) be classified as either a <strong>Type A</strong> or a{" "}
              <strong>Type B</strong> deficiency.
            </p>
            <p>
              The classification does not reflect whether the facility corrected the problem —
              only whether inspectors determined the violation created an immediate risk at the
              time of the visit.
            </p>
          </Prose>
          <DataFootnote
            source="Cal. Health & Safety Code §1540.1 · California CDSS Community Care Licensing"
            refreshed={DATE_PUBLISHED}
          />

          <H2 id="type-a">Type A — immediate risk</H2>
          <Prose>
            <p>
              A <strong>Type A deficiency</strong> is cited when inspectors determine that the
              violation &ldquo;presents an immediate risk to the health, safety, or personal rights of
              the clients in care.&rdquo; In practice, this means inspectors witnessed — or found
              strong evidence of — a condition that could harm residents now, not hypothetically.
            </p>
            <p>Common Type A triggers in memory care inspections include:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>A resident found injured and unattended with no incident report filed</li>
              <li>Medications administered to the wrong resident (§87465)</li>
              <li>
                Failure to maintain a secured perimeter for a memory care unit, resulting in
                a resident elopement or near-elopement (§87706)
              </li>
              <li>
                Physical or verbal abuse by staff witnessed by the inspector (§87468)
              </li>
              <li>
                Immediate health risk from unsanitary conditions — pest infestation,
                contaminated food, or absent hot water
              </li>
            </ul>
          </Prose>

          <Callout>
            After a Type A deficiency is cited, the facility is required to submit a corrective
            action plan within 48 hours and may face civil penalties starting at $150 per day.
            Repeat Type A findings in the same regulatory domain within 12 months can trigger
            license probation.
          </Callout>

          <H2 id="type-b">Type B — lesser violation</H2>
          <Prose>
            <p>
              A <strong>Type B deficiency</strong> covers every other violation that does not
              meet the immediate-risk threshold. Type B findings are still regulatory failures —
              they appear on the permanent public record and must be corrected — but inspectors
              determined that residents were not in immediate danger at the time of the visit.
            </p>
            <p>Common Type B findings in memory care inspections include:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Missing or incomplete staff training records for dementia-specific programming
                (§87705)
              </li>
              <li>
                Resident care plans not updated within the required 30-day window after a
                change in condition
              </li>
              <li>Missing or expired Food Handler certificates</li>
              <li>
                Failure to post required consumer information (resident rights,
                LPA contact information)
              </li>
              <li>Minor documentation gaps in medication logs or incident reports</li>
            </ul>
          </Prose>

          <H2 id="what-to-look-for">What to look for when reading a facility profile</H2>
          <Prose>
            <p>
              When you read an inspection record on a StarlynnCare facility page, look at both
              the <em>type</em> and the <em>pattern</em>:
            </p>
          </Prose>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="border border-paper-rule rounded-lg p-5 bg-paper-2">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-2">
                Higher concern
              </p>
              <ul className="text-[14px] leading-[1.65] text-ink-2 space-y-1.5 list-disc pl-4">
                <li>Any Type A finding in the last 24 months</li>
                <li>More than one Type A in the last 36 months</li>
                <li>Repeat findings in the same regulatory section</li>
                <li>Type B patterns in §87705 or §87706 (dementia-specific regulations)</li>
                <li>Findings tied to a complaint that was substantiated</li>
              </ul>
            </div>
            <div className="border border-paper-rule rounded-lg p-5 bg-paper-2">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-teal mb-2">
                Lower concern
              </p>
              <ul className="text-[14px] leading-[1.65] text-ink-2 space-y-1.5 list-disc pl-4">
                <li>Single isolated Type B finding, corrected promptly</li>
                <li>Documentation gap (paperwork), not a care gap</li>
                <li>No repeat of the same violation across inspections</li>
                <li>Routine inspection with only food-service or housekeeping findings</li>
                <li>No complaints substantiated in the last 36 months</li>
              </ul>
            </div>
          </div>

          <H2 id="questions-to-ask">Questions to ask on a facility tour</H2>
          <Prose>
            <p>
              If a facility has a Type A or a repeat Type B in its record, these are reasonable
              questions to raise directly with the administrator:
            </p>
          </Prose>
          <ul className="mt-4 space-y-3 text-[15px] leading-[1.65] text-ink-2 list-disc pl-6 max-w-[68ch]">
            <li>
              &ldquo;Your last inspection cited a [Type A / Type B] finding in [area]. Can you walk me
              through what happened and what has changed since then?&rdquo;
            </li>
            <li>
              &ldquo;How does the facility track whether staff dementia-care training is current?&rdquo;
            </li>
            <li>
              &ldquo;What is your protocol when a memory care resident becomes agitated or attempts
              to leave the unit?&rdquo;
            </li>
          </ul>

          <H2 id="on-starlynn">How StarlynnCare uses deficiency data</H2>
          <Prose>
            <p>
              Each facility profile on StarlynnCare displays the count and type of deficiencies
              from CDSS inspection records ingested directly from the public CCLD transparency
              API. Type A findings are surfaced prominently; repeat findings across the same
              regulatory section are flagged. No paid placement, operator-supplied content, or
              referral revenue influences how a facility is ranked or displayed.
            </p>
          </Prose>

          <div className="mt-10 pt-8 border-t border-paper-rule flex flex-col gap-3 text-[14px] text-ink-3">
            <p>
              <Link href="/california" className="text-teal underline underline-offset-4 hover:text-teal/80">
                Browse California memory care facilities →
              </Link>
            </p>
            <p>
              <Link href="/methodology" className="text-teal underline underline-offset-4 hover:text-teal/80">
                How we compute inspection grades →
              </Link>
            </p>
            <p>
              <Link href="/library/memory-care-cost-california" className="text-teal underline underline-offset-4 hover:text-teal/80">
                What memory care costs in California →
              </Link>
            </p>
          </div>
          <DataFootnote
            source="CA CDSS Community Care Licensing · Cal. Health & Safety Code §1540.1"
            refreshed={DATE_PUBLISHED}
            note="All inspection data sourced from CDSS public CCLD transparency records"
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
