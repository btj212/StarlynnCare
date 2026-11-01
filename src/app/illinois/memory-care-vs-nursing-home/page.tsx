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

const PAGE_PATH = "/illinois/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE = "Assisted living and nursing homes in Illinois are not the same record";
const TITLE = "Illinois Assisted Living vs Nursing Homes: IDPH and CMS (2026)";
const DESC =
  "IDPH licenses assisted living and shared housing under 210 ILCS 9. CMS surveys nursing homes. A memory-care name is not an Alzheimer's designation.";
const DATE_PUBLISHED = "2026-10-31";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Who regulates each setting?",
    a: "The Illinois Department of Public Health licenses an Assisted Living Establishment under 210 ILCS 9 and 77 Ill. Adm. Code Part 295. A Shared Housing Establishment uses the same act and Part 296, and it is limited to 12 residents. A nursing home is a different license and is surveyed under CMS rules. StarlynnCare does not put the two citation histories on one profile.",
  },
  {
    q: "Is a Type 1 the same as a nursing-home immediate jeopardy tag?",
    a: "No. On an assisted living or shared housing visit, Type 1 is the most serious IDPH label, Type 2 is the middle label, and Type 3 is the lowest. On a CMS nursing-home survey, immediate jeopardy is a J, K, or L tag. The letters are not interchangeable.",
  },
  {
    q: "Why does an Illinois citation read like a rule?",
    a: "The IDPH visit file names the rule that was cited. That line is not the inspector's account of what happened in the building. The profile labels it as the regulation cited. The inspector's narrative is in the statement of deficiency when the portal publishes one.",
  },
  {
    q: "Does a memory-care name mean the home has the Special Alzheimer's designation?",
    a: "No. The Special Alzheimer's/Dementia Care designation is a separate IDPH approval for a dedicated dementia unit. A home can have memory care in its name without that designation in the file we publish. StarlynnCare does not treat the name as the designation.",
  },
  {
    q: "Does Medicaid treat them the same?",
    a: "No. A Supportive Living Facility is a different license from an assisted living or shared housing establishment, and it is the Medicaid residential pathway. Help with room and board in an assisted living establishment is not that benefit.",
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
  ["Regulator", "IDPH, Division of Assisted Living", "CMS"],
  ["Setting", "Assisted living or shared housing", "Nursing home"],
  ["Rule", "210 ILCS 9. Part 295, or Part 296 for a shared house of 12 or fewer.", "Federal nursing-home survey"],
  ["Citation scale", "Type 1, Type 2, and Type 3.", "F-tags. J, K, and L are immediate jeopardy."],
  ["Public lookup", "IDPH LLCS portal", "Care Compare"],
  ["Ranked against the other?", "No", "No"],
];

export default function IllinoisSettingPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Illinois", url: canonicalFor("/illinois") },
      { name: "Illinois guides", url: canonicalFor("/illinois/guides") },
      { name: "Assisted living and nursing homes", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar scope="IL" />
      <SiteNav
        countStateCode="IL"
        badge="Illinois"
        ctaHref="/illinois/facilities"
        ctaLabel="Illinois memory care facilities"
        stateNavHref="/illinois"
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
              <Link href="/illinois" className="hover:text-teal transition-colors">Illinois</Link>
              <span aria-hidden>›</span>
              <Link href="/illinois/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Two care settings</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal inline-block">
              Illinois decision guide
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <p className="text-[17px] leading-[1.7] text-ink-2">
            Families often use one name for both. Illinois does not. An assisted living establishment or a shared
            housing establishment is a state license. A nursing home is a federal certification with its own survey.
            The inspection file, the severity labels, and the peer group stay with the setting on the profile.
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
            source="210 ILCS 9, 77 Ill. Adm. Code Parts 295 and 296, and CMS Care Compare"
            refreshed="2026-10-31"
            note="The IDPH visit file names the rule that was cited. It is not the inspector's narrative."
          />

          <H2 id="designation">A name is not the designation</H2>
          <p className="text-[17px] leading-[1.7] text-ink-2">
            IDPH can approve a Special Alzheimer&apos;s/Dementia Care designation for a dedicated unit. That approval
            is not printed on the FOIA visit row. A published Illinois home on StarlynnCare was matched by its name.
            The profile does not say the state has granted the designation unless a current license record says so.
          </p>

          <H2 id="same-campus">A shared name is not a merge</H2>
          <p className="text-[17px] leading-[1.7] text-ink-2">
            Some campuses offer both settings. StarlynnCare keeps the assisted living record and the nursing-home
            record apart. A matching name does not combine the citations or the peer group.
          </p>

          <div className="mt-16 rounded-lg border border-paper-rule px-5 py-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-2">
              Related
            </p>
            <Link href="/illinois/memory-care-licensing" className="text-teal hover:underline text-[16px]">
              How Illinois licenses assisted living and shared housing
            </Link>
            <Link href="/illinois/guides" className="mt-4 block text-[14px] text-teal hover:underline">
              All Illinois guides
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
