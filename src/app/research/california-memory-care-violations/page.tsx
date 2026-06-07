import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildDatasetSchema,
} from "@/lib/seo/schema";
import {
  AnalysisShell,
  AnalysisH2,
  AnalysisProse,
  AnalysisMethodNote,
} from "@/components/research/AnalysisShell";

const PAGE_PATH = "/research/california-memory-care-violations";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE =
  "What inspectors actually cite at California memory care facilities";
const META_TITLE = `${TITLE} | StarlynnCare Research`;
const DESC =
  "Analysis of 7,748 California memory care deficiencies. Only 6% fall under the dementia-specific statutes (§§ 87705–87706). The dominant harm category in inspector narratives is staffing inadequacy.";
const DATE_PUBLISHED = "2026-05-11";

export const metadata: Metadata = {
  title: META_TITLE,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: META_TITLE,
    description: DESC,
    url: canonicalUrl,
    type: "article",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: META_TITLE,
    description: DESC,
    images: ["/og-default.png"],
  },
};

const jsonLd = [
  buildArticleSchema({
    headline: TITLE,
    description: DESC,
    url: canonicalUrl,
    datePublished: DATE_PUBLISHED,
  }),
  buildBreadcrumbList([
    { name: "Home", url: canonicalFor("/") },
    { name: "Research", url: canonicalFor("/research") },
    { name: "Memory care violations (CA)", url: canonicalUrl },
  ]),
  buildDatasetSchema({
    pageUrl: canonicalUrl,
    methodologyUrl: canonicalFor("/methodology"),
  }),
];

const TOP_REGULATIONS = [
  {
    code: "§87303(a)",
    label: "General facility maintenance",
    citations: 363,
    note: "Clean, safe, sanitary, and in good repair at all times.",
  },
  {
    code: "§87309(a)",
    label: "Personnel records",
    citations: 352,
    note: "Required documentation for facility staff.",
  },
  {
    code: "§87303(e)(2)",
    label: "Broken or unsafe equipment",
    citations: 226,
    note: "Furniture, equipment, or fixtures that pose a hazard.",
  },
];

const KEYWORD_CATEGORIES = [
  { label: "Staffing inadequacy", count: 1069 },
  { label: "Abuse / neglect", count: 94 },
  { label: "Restraint", count: 0 },
];

export default function CAMemoryCareViolationsPage() {
  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav
        countStateCode="CA"
        ctaHref="/california/facilities"
        ctaLabel="California memory care facilities"
      />

      <AnalysisShell
        eyebrow="Memory care violations (CA)"
        title={TITLE}
        dek="A regulation-by-regulation breakdown of every CDSS deficiency on file across 484 publishable California memory care facilities — what inspectors are actually writing up, and what they are not."
        bylineDate="May 11, 2026"
        scope="California · 7,748 deficiencies"
        keyFindings={[
          {
            value: "7,748",
            label: "total CDSS deficiencies analyzed",
            caption: "All publishable CA RCFEs · all years",
            tone: "neutral",
          },
          {
            value: "6%",
            label: "citations under dementia-specific statutes",
            caption: "470 under §87705 / §87706",
            tone: "warn",
          },
          {
            value: "1,069",
            label: "staffing-inadequacy mentions",
            caption: "Top harm category in narratives",
            tone: "alarm",
          },
        ]}
        methodologyDisclosure={
          "Source corpus: every CDSS deficiency citation on file for the 484 California facilities StarlynnCare publishes (all years available in CDSS Transparency Portal records).\n\nRegulation counts: exact CCR Title 22 code as recorded by the CDSS licensing agent.\n\nKeyword categories: case-insensitive substring scan of inspector narrative text, deduplicated per citation. A single citation can map to multiple categories.\n\nComparison group: all 484 publishable facilities serve memory care residents; no clean non–memory-care comparison group is available within this dataset."
        }
        sources={[
          {
            label: "CDSS Community Care Licensing — RCFE inspection records",
            url: "https://www.cdss.ca.gov/inforesources/cdss-programs/community-care-licensing",
          },
          {
            label: "CCR Title 22 §§ 87705–87706 — RCFE dementia-care regulations",
            url: "https://govt.westlaw.com/calregs/Browse/Home/California/CaliforniaCodeofRegulations?guid=I8C7BE5A0D45611DEB97CF67CD0B99467",
          },
          {
            label: "StarlynnCare methodology",
            url: "/methodology",
          },
        ]}
      >
        <AnalysisH2 id="what-we-found">What we found</AnalysisH2>
        <AnalysisProse>
          <p>
            Across <strong>7,748 CDSS deficiency citations</strong> on file
            for the 484 California memory care facilities in StarlynnCare,
            the most common single regulatory citation is{" "}
            <strong>§87303(a) — &ldquo;general facility maintenance&rdquo;</strong>,
            appearing in roughly one of every twenty-one deficiencies (363
            citations). This is a basic compliance category covering whether a
            facility is &ldquo;clean, safe, sanitary, and in good repair at
            all times.&rdquo;
          </p>
          <p>
            Only <strong>6% of citations</strong> (470 of 7,748) are written
            under California&rsquo;s dementia-specific statutes — Title 22
            §87705 and §87706, which govern programs serving residents with
            dementia. Most regulatory enforcement in memory care is driven by
            the same baseline RCFE rules that apply to any residential care
            facility for the elderly.
          </p>
        </AnalysisProse>

        <AnalysisH2 id="top-regulations">Most-cited regulations</AnalysisH2>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-[14px] text-left border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b-2 border-paper-rule">
                {["Regulation", "Plain-language", "Citations"].map((h) => (
                  <th
                    key={h}
                    className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-ink-4 py-3 pr-4 font-normal"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_REGULATIONS.map((r) => (
                <tr
                  key={r.code}
                  className="border-b border-paper-rule"
                >
                  <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-ink">
                    {r.code}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-ink">{r.label}</span>
                    <span className="block text-[12px] text-ink-3 leading-[1.3] mt-0.5">
                      {r.note}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-rust font-semibold">
                    {r.citations.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-ink-4 mt-3 max-w-[60ch]">
          Citations counted per occurrence, not per facility. Source: CDSS
          inspection records in StarlynnCare database.
        </p>

        <AnalysisH2 id="harm-categories">What inspector narratives describe</AnalysisH2>
        <AnalysisProse>
          <p>
            Looking past the regulation codes to the words inspectors actually
            wrote, one harm category dominates:
          </p>
        </AnalysisProse>

        <ul className="mt-4 space-y-3 text-[15px] leading-[1.6] text-ink-2">
          {KEYWORD_CATEGORIES.map((k) => (
            <li
              key={k.label}
              className="flex items-baseline gap-3 border-b border-paper-rule pb-2"
            >
              <span className="font-[family-name:var(--font-mono)] text-rust font-semibold shrink-0 w-16 text-right">
                {k.count.toLocaleString()}
              </span>
              <span>
                <strong className="text-ink">{k.label}</strong>
              </span>
            </li>
          ))}
        </ul>

        <AnalysisMethodNote>
          Restraint mentions register as zero in this scan — that does not
          mean restraint never occurred, only that inspector narratives in
          this corpus did not use the word. CDSS narrative language is
          structured and the keyword scan is literal.
        </AnalysisMethodNote>

        <AnalysisH2 id="why-this-matters">
          Why this matters for tour conversations
        </AnalysisH2>
        <AnalysisProse>
          <p>
            Two implications for families touring California memory care:
          </p>
          <p>
            First, the <strong>most-cited regulations are general — not
            dementia-specific</strong>. Asking a tour guide about specialized
            memory care programming is reasonable, but the larger compliance
            risk often sits in baseline maintenance, staffing records, and
            equipment safety. Ask about those too.
          </p>
          <p>
            Second, the dominant theme inside inspector narratives is{" "}
            <strong>staffing inadequacy</strong>. Specific staffing-question
            scripts are in our{" "}
            <Link
              href="/library/37-questions-to-ask-on-a-memory-care-tour"
              className="text-teal underline underline-offset-4 hover:text-teal/80"
            >
              37-question tour checklist
            </Link>
            .
          </p>
        </AnalysisProse>
      </AnalysisShell>

      <SiteFooter />
    </>
  );
}
