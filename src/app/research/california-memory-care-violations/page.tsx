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
import { loadCaResearchCorpus } from "@/lib/data/caResearchCorpus";

const PAGE_PATH = "/research/california-memory-care-violations";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE =
  "What inspectors actually cite at California memory care facilities";
const META_TITLE = `${TITLE} | StarlynnCare Research`;
const DATE_PUBLISHED = "2026-05-11";
const FALLBACK_DESC =
  "Analysis of CDSS deficiencies on file for publishable California memory care homes. A small share fall under the dementia-specific statutes (§§ 87705–87706). Home and citation counts are live from the database.";

function n(value: number): string {
  return value.toLocaleString("en-US");
}

export async function generateMetadata(): Promise<Metadata> {
  const corpus = await loadCaResearchCorpus();
  const desc = corpus
    ? `Analysis of ${n(corpus.deficiencies)} California memory care deficiencies (${corpus.window}, ${corpus.source}). ${corpus.sharePct}% fall under the dementia-specific statutes (§§ 87705–87706).`
    : FALLBACK_DESC;
  return {
    title: META_TITLE,
    description: desc,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: META_TITLE,
      description: desc,
      url: canonicalUrl,
      type: "article",
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
    },
    twitter: {
      card: "summary_large_image",
      title: META_TITLE,
      description: desc,
      images: ["/og-default.png"],
    },
  };
}

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

export default async function CAMemoryCareViolationsPage() {
  const corpus = await loadCaResearchCorpus();
  const homes = corpus ? n(corpus.homes) : "the publishable";
  const statute = corpus ? n(corpus.dementiaStatute) : null;
  const share = corpus ? `${corpus.sharePct}%` : "a small share";
  const desc = corpus
    ? `Analysis of ${n(corpus.deficiencies)} California memory care deficiencies (${corpus.window}, ${corpus.source}). ${corpus.sharePct}% fall under the dementia-specific statutes (§§ 87705–87706).`
    : FALLBACK_DESC;
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: desc,
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
        dek={
          corpus
            ? `A regulation-by-regulation look at every CDSS deficiency on file across ${homes} publishable California memory care facilities — what inspectors are actually writing up, and what they are not.`
            : "A regulation-by-regulation look at CDSS deficiencies on file for publishable California memory care facilities — what inspectors are actually writing up, and what they are not."
        }
        bylineDate="May 11, 2026 · live counts"
        scope={
          corpus
            ? `California · ${n(corpus.deficiencies)} deficiencies · ${corpus.window} · ${corpus.source}`
            : "California · CDSS deficiencies"
        }
        keyFindings={[
          {
            value: corpus ? n(corpus.deficiencies) : "—",
            label: "total CDSS deficiencies on file",
            caption: corpus
              ? `${n(corpus.homes)} publishable CA homes · ${corpus.window} · ${corpus.source}`
              : "Could not be loaded",
            tone: "neutral",
          },
          {
            value: share,
            label: "citations under dementia-specific statutes",
            caption: statute
              ? `${statute} under §87705 / §87706 · ${corpus?.window} · ${corpus?.source}`
              : "§87705 / §87706",
            tone: "warn",
          },
          {
            value: "1,069",
            label: "staffing-inadequacy mentions",
            caption: "May 2026 narrative scan · not rerun",
            tone: "alarm",
          },
        ]}
        methodologyDisclosure={
          (corpus
            ? `Source corpus: every CDSS deficiency citation on file for the ${n(corpus.homes)} California facilities StarlynnCare publishes (${corpus.window} in CDSS Transparency Portal records), as of ${corpus.asOf}.\n\n`
            : "Source corpus: every CDSS deficiency citation on file for publishable California facilities StarlynnCare publishes.\n\n") +
          "Dementia-statute share: deficiency codes matching 87705 or 87706.\n\n" +
          "Top-regulation table and keyword categories below are from a May 11, 2026 narrative scan and were not rerun on the live corpus.\n\n" +
          "Comparison group: publishable facilities in this directory serve memory care residents; no clean non–memory-care comparison group is available within this dataset."
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
            Across{" "}
            <strong>
              {corpus ? `${n(corpus.deficiencies)} CDSS deficiency citations` : "CDSS deficiency citations"}
            </strong>{" "}
            on file for the {corpus ? `${homes} California` : "California"} memory
            care facilities in StarlynnCare ({corpus ? `${corpus.window}, ${corpus.source}` : "CDSS"}),
            the most common single regulatory citation in a May 2026 scan was{" "}
            <strong>§87303(a) — &ldquo;general facility maintenance&rdquo;</strong>,
            appearing in 363 citations in that scan. This is a basic compliance
            category covering whether a facility is &ldquo;clean, safe, sanitary,
            and in good repair at all times.&rdquo;
          </p>
          <p>
            Only <strong>{share} of citations</strong>
            {statute && corpus
              ? ` (${statute} of ${n(corpus.deficiencies)})`
              : ""}{" "}
            are written under California&rsquo;s dementia-specific statutes —
            Title 22 §87705 and §87706, which govern programs serving residents
            with dementia. Most regulatory enforcement in memory care is driven
            by the same baseline RCFE rules that apply to any residential care
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
          Top-code counts are from the May 11, 2026 scan and were not rerun.
          Live totals above are all years on file from CDSS Community Care Licensing.
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
