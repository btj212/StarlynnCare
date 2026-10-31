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

const PAGE_PATH = "/colorado/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE = "Assisted living and nursing homes in Colorado are not the same record";
const TITLE = "Colorado Assisted Living vs Nursing Homes: CDPHE and CMS (2026)";
const DESC =
  "CDPHE licenses assisted living and uses Level A–E citations. CMS surveys nursing homes with F-tags. StarlynnCare does not rank the two on one scale.";
const DATE_PUBLISHED = "2026-10-31";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Who regulates each setting?",
    a: "CDPHE licenses assisted living residences under 6 CCR 1011-1 Chapter 7. CMS certifies nursing homes and publishes surveys on Care Compare. A building can have both an assisted living license and a nursing-home certification. StarlynnCare keeps those as two profiles unless a certification number proves they are the same home.",
  },
  {
    q: "Is a Level E the same as a CMS letter E?",
    a: "No. On an assisted living citation, Level E means immediate jeopardy. On a nursing-home survey, the letter E is a pattern of potential harm, not immediate jeopardy. Immediate jeopardy on a nursing-home survey is J, K, or L.",
  },
  {
    q: "Why does a nursing-home citation read like a rule?",
    a: "The CMS health-citation file publishes the standard statement for the F-tag. It is not the inspector's account of what happened in that building. The profile labels it as the regulation cited. The survey packet on Care Compare has the finding.",
  },
  {
    q: "Does Medicaid treat them the same?",
    a: "No. Health First Colorado can pay for some services in a certified Alternative Care Facility under 10 CCR 2505-10, section 8.495. A Medicaid-certified nursing home is a different benefit. Neither one is a memory-care license.",
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

const ROWS: Array<[string, string, string]> = [
  ["Regulator", "CDPHE", "CMS"],
  ["Setting", "Assisted living residence", "Nursing home"],
  ["Rule", "6 CCR 1011-1 Chapter 7", "Federal nursing-home requirements"],
  ["Citation scale", "Level A–E. E is immediate jeopardy.", "F-tags. J, K, and L are immediate jeopardy."],
  ["Public lookup", "Find and Compare Facilities", "Care Compare"],
  ["Ranked against the other?", "No", "No"],
];

export default function ColoradoSettingPage() {
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
      { name: "Assisted living and nursing homes", url: canonicalUrl },
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
              <span className="text-ink-3">Two care settings</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal inline-block">
              Colorado decision guide
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
          <p className="text-[17px] leading-[1.7] text-ink-2">
            Families often use one name for both. Colorado does not. An assisted living residence is a state license.
            A nursing home is a federal certification. The inspection file, the severity letters, and the peer group
            stay with the setting on the profile.
          </p>

          <H2 id="side-by-side">Side by side</H2>
          <div className="overflow-x-auto rounded-lg border border-paper-rule">
            <table className="w-full min-w-[540px] text-[14px]">
              <thead>
                <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal"> </th>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Assisted living</th>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">Nursing home</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, assisted, nursing], i) => (
                  <tr key={label} className="border-t border-paper-rule" style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">{label}</td>
                    <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{assisted}</td>
                    <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{nursing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataFootnote
            source="CDPHE Chapter 7 and CMS Care Compare"
            refreshed="2026-10-31"
            note="Nursing-home text in the public citation file is the standard tag statement, not the surveyor's narrative."
          />

          <H2 id="same-campus">A shared name is not a merge</H2>
          <p className="text-[17px] leading-[1.7] text-ink-2">
            Some campuses appear on both lists. StarlynnCare matches a nursing home to an assisted living residence only by the CMS certification number.
            A matching name and street is saved as a review note. It does not combine the citation histories or the peer groups.
          </p>

          <H2 id="memory-care">Memory care is still not a license</H2>
          <p className="text-[17px] leading-[1.7] text-ink-2">
            Neither file has a column that says this building offers memory care. The current CMS provider file does not report a dementia unit.
            A published home has a name, a verified chain, or two directory listings that agree. A home that does not meet that test stays off the public list.
            Being unpublished is not a statement that the home lacks memory care. It means the public sources do not yet support the claim.
          </p>

          <div className="mt-16 rounded-lg border border-paper-rule px-5 py-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-2">
              Related
            </p>
            <Link href="/colorado/memory-care-licensing" className="text-teal hover:underline text-[16px]">
              How Colorado licenses assisted living
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
