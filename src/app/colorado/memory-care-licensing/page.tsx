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

const PAGE_PATH = "/colorado/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE = "How Colorado licenses assisted living — and what it does not call memory care";
const TITLE = "Colorado Assisted Living Licensing: CDPHE Chapter 7 (2026)";
const DESC =
  "CDPHE licenses Colorado assisted living residences under 6 CCR 1011-1 Chapter 7. There is no separate memory-care license, and no public roster of secure environments.";
const DATE_PUBLISHED = "2026-10-31";
const FIND_AND_COMPARE = "https://cdphe.colorado.gov/health-facilities/find-and-compare-facilities";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Does Colorado have a memory-care license?",
    a: "No. The Colorado Department of Public Health and Environment licenses assisted living residences under 6 CCR 1011-1 Chapter 7. A secure environment is an optional part of that license. CDPHE does not publish a facility-level list of homes that have one.",
  },
  {
    q: "Does dementia training make a home memory care?",
    a: "No. Chapter 7 requires dementia training for staff at every assisted living residence. That requirement applies whether or not the home has a secure environment, so training is not a designation StarlynnCare can show as state verification.",
  },
  {
    q: "What do Level A through E mean?",
    a: "Chapter 7, Part 3.9 uses five levels. A is an isolated potential for harm. B is a pattern of potential harm. C is isolated actual harm. D is a pattern of actual harm. E is immediate jeopardy. These letters are not CMS nursing-home letters.",
  },
  {
    q: "Where can I check a Colorado assisted living license?",
    a: "CDPHE publishes Find and Compare Facilities. Each StarlynnCare assisted living profile links there. The complaint and citation text in this first release comes from a CDPHE records file dated May 18, 2026, not from a live inspection feed.",
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

export default function ColoradoLicensingPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Colorado", url: canonicalFor("/colorado") },
      { name: "Colorado guides", url: canonicalFor("/colorado/guides") },
      { name: "Assisted living licensing", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar scope="CO" />
      <SiteNav
        countStateCode="CO"
        badge="Colorado"
        ctaHref="/colorado/facilities"
        ctaLabel="Colorado memory care facilities"
        stateNavHref="/colorado"
      />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/colorado" className="hover:text-teal transition-colors">Colorado</Link>
              <span aria-hidden>›</span>
              <Link href="/colorado/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Licensing</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal inline-block">
              Colorado licensing guide · CDPHE
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
                CDPHE licenses assisted living residences under{" "}
                <strong className="font-medium text-ink">6 CCR 1011-1 Chapter 7</strong>.
                The statute is C.R.S. 25-27-101 and 25-27-104.
              </li>
              <li>
                There is <strong className="font-medium text-ink">no memory-care license</strong> to look up.
                A secure environment is optional under Chapter 7, Part 25.
              </li>
              <li>
                Dementia training is required at every assisted living residence. It does not identify which homes offer memory care.
              </li>
              <li>
                Citation levels A through E are an assisted-living scale. They are not CMS letters.
              </li>
            </ul>
          </aside>

          <H2 id="who-licenses">Who licenses the home</H2>
          <p className="text-[17px] leading-[1.7] text-ink-2">
            The Colorado Department of Public Health and Environment licenses assisted living residences.
            The public lookup is{" "}
            <a href={FIND_AND_COMPARE} className="text-teal underline underline-offset-4">
              Find and Compare Facilities
            </a>
            . StarlynnCare uses that directory as the list of assisted living residences. A home that is only
            certified through Health First Colorado, or whose license is still pending, is in the file and is not published as a licensed memory-care home.
          </p>
          <DataFootnote
            source="CDPHE Find and Compare Facilities"
            refreshed="2026-09-29"
            note="Directory date from the CDPHE facilities layer. Citation text in this release is a records file dated May 18, 2026."
          />

          <H2 id="not-a-license">What Colorado does not publish</H2>
          <p className="text-[17px] leading-[1.7] text-ink-2">
            Chapter 7 lets an assisted living residence add a secure environment. CDPHE does not give families a roster of which buildings have done that.
            A name that says memory care, a chain that operates memory care elsewhere, or a listing on a consumer directory is a clue.
            It is not a line on the state license. StarlynnCare says a state basis is on file only when a state source is stored on the profile. For Colorado, that line stays empty.
          </p>

          <H2 id="levels">How to read Level A through E</H2>
          <p className="text-[17px] leading-[1.7] text-ink-2 mb-4">
            Part 3.9 of Chapter 7 sorts a citation by what happened and how widely it happened.
          </p>
          <div className="overflow-x-auto rounded-lg border border-paper-rule">
            <table className="w-full min-w-[520px] text-[14px]">
              <thead>
                <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Level</th>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">What the rule says</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["A", "Isolated potential for more than minimal harm"],
                  ["B", "A pattern of potential for more than minimal harm"],
                  ["C", "Isolated actual harm"],
                  ["D", "A pattern of actual harm"],
                  ["E", "Immediate jeopardy"],
                ].map(([level, meaning], i) => (
                  <tr key={level} className="border-t border-paper-rule" style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-ink">{level}</td>
                    <td className="px-4 py-3 leading-relaxed text-ink-2">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[17px] leading-[1.7] text-ink-2">
            A missing letter stays unlabeled. StarlynnCare does not guess a level from a tag number.
          </p>

          <H2 id="records">What the citation text is</H2>
          <p className="text-[17px] leading-[1.7] text-ink-2">
            When the records file includes the inspector&apos;s citation, the profile shows that text and a short summary.
            When a row has only the regulation, the profile says so. Rows dated after the file&apos;s May 18, 2026 cutoff are kept out of the public record rather than repaired.
          </p>

          <div className="mt-16 rounded-lg border border-paper-rule px-5 py-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-2">
              Related
            </p>
            <Link href="/colorado/memory-care-vs-nursing-home" className="text-teal hover:underline text-[16px]">
              Assisted living and nursing homes in Colorado
            </Link>
            <Link href="/colorado/guides" className="mt-4 block text-[14px] text-teal hover:underline">
              All Colorado guides
            </Link>
          </div>

          <H2 id="questions">Questions families ask</H2>
          <div className="space-y-8">
            {FAQ_PAIRS.map((item) => (
              <div key={item.q}>
                <h3 className="font-[family-name:var(--font-display)] text-[22px] leading-snug text-ink mb-2">{item.q}</h3>
                <p className="text-[16px] leading-[1.7] text-ink-2">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
